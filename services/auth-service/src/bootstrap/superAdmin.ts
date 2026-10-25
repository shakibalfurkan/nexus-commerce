import { z } from "zod";
import { AuthValidation } from "../modules/auth/auth.validation.js";
import { UserRoles } from "../generated/prisma/enums.js";
import * as CredentialRepository from "../repositories/credential.js";
import { prisma } from "../lib/prisma.js";
import config from "../config/index.js";
import logger from "../utils/logger.js";
import { hashPassword } from "../utils/passwordHandler.js";
import { createUserProfile } from "../lib/axiosClients/userServiceClient.js";
import { writeAuditLog } from "../repositories/auditLog.js";
import { ConflictError } from "@nexus/errors";

const envSchema = z.object({
  email: AuthValidation.emailSchema,
  password: AuthValidation.passwordSchema,
  firstName: z.string().min(1).default("Super"),
  lastName: z.string().min(1).default("Admin"),
});

export interface SuperAdminEnv {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

/**
 * Phase A: validate env vars only when a bootstrap is actually needed.
 * Throws with a clear message on missing/invalid values.
 */
export function validateSuperAdminEnv(): SuperAdminEnv {
  const raw = {
    email: config.super_admin_email,
    password: config.super_admin_password,
    firstName: config.super_admin_first_name ?? "Super",
    lastName: config.super_admin_last_name ?? "Admin",
  };

  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      "No SUPER_ADMIN exists and SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD are not set or invalid",
    );
  }
  return parsed.data;
}

export async function hasSuperAdmin(): Promise<boolean> {
  return CredentialRepository.existsSuperAdmin();
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2002"
  );
}

export async function createSuperAdmin(env: SuperAdminEnv): Promise<void> {
  const existing = await CredentialRepository.findByEmail(env.email);
  if (existing) {
    const roles = existing.role ?? [];
    if (roles.includes(UserRoles.SUPER_ADMIN)) {
      // Idempotent: only ensure profile exists.
      try {
        await createUserProfile(
          {
            id: existing.id,
            email: existing.email,
            role: UserRoles.SUPER_ADMIN,
            profile: { firstName: env.firstName, lastName: env.lastName },
          },
          "bootstrap",
        );
      } catch {
        // profile likely exists; ignore
      }
      return;
    }
    throw new Error(
      `SUPER_ADMIN_EMAIL belongs to an existing ${roles.join(",")} credential; aborting (admin identities never hold customer/seller/plain-ADMIN roles)`,
    );
  }

  const hashedPassword = await hashPassword(
    env.password,
    config.bcrypt_salt_round,
  );

  let credentialId: string;
  try {
    const credential = await prisma.credential.create({
      data: {
        email: env.email,
        password: hashedPassword,
        role: [UserRoles.SUPER_ADMIN],
      },
    });
    credentialId = credential.id;
  } catch (err) {
    if (isUniqueViolation(err)) {
      // Another instance won the race; re-check.
      const again = await CredentialRepository.findByEmail(env.email);
      if (again && again.role.includes(UserRoles.SUPER_ADMIN)) return;
      throw err;
    }
    throw err;
  }

  // Profile + audit, with compensation on failure (mirror invite accept).
  try {
    await createUserProfile(
      {
        id: credentialId,
        email: env.email,
        role: UserRoles.SUPER_ADMIN,
        profile: { firstName: env.firstName, lastName: env.lastName },
      },
      "bootstrap",
    );

    await prisma.$transaction(async (tx) => {
      await writeAuditLog(tx, {
        actorId: "system",
        action: "SUPER_ADMIN_BOOTSTRAPPED",
        targetId: credentialId,
        targetType: "Credential",
        newValues: { email: env.email, role: "SUPER_ADMIN" },
      });
    });
  } catch (err) {
    // Compensation: remove credential so retry converges (profile never created).
    try {
      await prisma.credential.delete({ where: { id: credentialId } });
    } catch {
      // ignore
    }
    throw err;
  }
}

export async function bootstrapSuperAdminWithRetry(): Promise<void> {
  const env = validateSuperAdminEnv();
  const delays = [1000, 2000, 4000, 8000, 16000];
  let lastErr: unknown;
  for (let i = 0; i < delays.length; i++) {
    try {
      await createSuperAdmin(env);
      logger.info("SUPER_ADMIN bootstrap completed");
      return;
    } catch (err) {
      lastErr = err;
      logger.error("SUPER_ADMIN bootstrap attempt failed", {
        attempt: i + 1,
        error: err instanceof Error ? err.message : String(err),
      });
      if (i < delays.length - 1) {
        await new Promise((r) => setTimeout(r, delays[i]));
      }
    }
  }
  throw lastErr;
}

// Keep ConflictError referenced (compensation parity) — unused guard.
void ConflictError;
