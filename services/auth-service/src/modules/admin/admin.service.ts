import crypto from "crypto";
import config from "../../config/index.js";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  InternalServerError,
} from "@nexus/errors";
import { prisma } from "../../lib/prisma.js";
import logger from "../../utils/logger.js";
import { hashPassword } from "../../utils/passwordHandler.js";
import { emitDomainEvent } from "@nexus/kafka";
import { AuthDomainEventTypes } from "@nexus/event-contracts";
import { UserRoles } from "../../generated/prisma/enums.js";
import * as CredentialRepository from "../../repositories/credential.js";
import * as AdminInviteRepository from "../../repositories/adminInvite.js";
import { createUserProfile } from "../../lib/axiosClients/userServiceClient.js";
import { AuthService } from "../auth/auth.service.js";
import { writeAuditLog } from "../../repositories/auditLog.js";
import type {
  IAuthResult,
  ICredentialLoginInput,
  IRequestContext,
} from "../auth/auth.interface.js";
import type {
  IAdminInviteAcceptDTO,
  ICreatedAdminInvite,
  IInviteValidationResult,
} from "./admin.interface.js";

/**
 * Admin-app flows: login, invite creation (SUPER_ADMIN), invite validation and
 * invite consumption.
 *
 * Invites live in PostgreSQL, not Redis: they are an audit trail (who invited,
 * when, status history) that ephemeral TTL storage would lose, and the volume is
 * far below where Redis's performance would matter.
 */

const ADMIN_SURFACE = "admin-web";
const INVITE_TTL_MS = 24 * 60 * 60 * 1000;
const INVITE_TOKEN_BYTES = 32;

function hashInviteToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function isAdminRole(role: UserRoles): boolean {
  return role === UserRoles.ADMIN || role === UserRoles.SUPER_ADMIN;
}

/**
 * Admin login is a separate surface with its own (stricter) rate limit at the
 * route level. The account must hold an admin role — a dual-role
 * customer/seller account can never reach the admin dashboard. Denials are
 * audited and return a generic 403 (no role information leaked).
 */
async function adminLogin(
  payload: ICredentialLoginInput,
  context: IRequestContext,
): Promise<IAuthResult> {
  await AuthService.assertClientSurface(ADMIN_SURFACE, context);

  const credential = await AuthService.verifyCredentials(
    payload.email,
    payload.password,
  );

  if (!credential.role.some(isAdminRole)) {
    await writeAuditLog(prisma, {
      actorId: credential.id,
      action: "ADMIN_LOGIN_DENIED_NO_ROLE",
      targetId: credential.id,
      targetType: "Credential",
      oldValues: { roles: credential.role },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    throw new ForbiddenError("Access denied");
  }

  // One active role per session: a super admin keeps the higher privilege so
  // the SUPER_ADMIN-only invite guard can never be bypassed by an admin-web
  // login that silently downgraded the session.
  const activeRole = credential.role.includes(UserRoles.SUPER_ADMIN)
    ? UserRoles.SUPER_ADMIN
    : UserRoles.ADMIN;

  return AuthService.completeLogin(credential, activeRole);
}

/**
 * Creates a single-use invite and emails the link through the existing
 * notification pathway (outbox → notification-service). Only the token hash is
 * persisted; the raw token exists solely inside the emailed link.
 */
async function createInvite(
  email: string,
  invitedById: string,
): Promise<ICreatedAdminInvite> {
  const existingAccount = await CredentialRepository.findByEmail(email);
  if (existingAccount) {
    throw new ConflictError(
      "An account with this email address already exists",
      "email",
    );
  }

  const rawToken = crypto.randomBytes(INVITE_TOKEN_BYTES).toString("hex");
  const tokenHash = hashInviteToken(rawToken);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const inviteLink = `${config.admin_client_url}/accept-invite?token=${rawToken}`;

  return prisma.$transaction(async (tx) => {
    const invite = await AdminInviteRepository.create(
      { email, tokenHash, invitedById, expiresAt },
      tx,
    );

    await writeAuditLog(tx, {
      actorId: invitedById,
      action: "ADMIN_INVITE_CREATED",
      targetId: invite.id,
      targetType: "AdminInvite",
      newValues: { email, expiresAt: expiresAt.toISOString() },
    });

    await emitDomainEvent(tx, {
      eventType: AuthDomainEventTypes.ADMIN_INVITE_CREATED,
      aggregateId: invite.id,
      payload: {
        email,
        inviteLink,
        expiresAt: expiresAt.toISOString(),
      },
    });

    return { id: invite.id, email, expiresAt: expiresAt.toISOString() };
  });
}

/**
 * Read-only validation so the admin setup form can render an "expired or
 * invalid invite" state before asking for a password. Expired pending invites
 * are flipped to EXPIRED here, keeping the stored status truthful.
 */
async function validateInvite(
  rawToken: string,
): Promise<IInviteValidationResult> {
  const invite = await AdminInviteRepository.findByTokenHash(
    hashInviteToken(rawToken),
  );

  if (!invite) {
    return { valid: false, status: "INVALID" };
  }

  if (invite.status === "CONSUMED") {
    return { valid: false, status: "CONSUMED" };
  }

  if (invite.status === "EXPIRED") {
    return { valid: false, status: "EXPIRED" };
  }

  if (invite.expiresAt <= new Date()) {
    await AdminInviteRepository.markExpired(invite.id);
    return { valid: false, status: "EXPIRED" };
  }

  return {
    valid: true,
    status: "PENDING",
    email: invite.email,
    expiresAt: invite.expiresAt.toISOString(),
  };
}

/**
 * Consumes an invite: creates the ADMIN credential and marks the invite
 * CONSUMED in the SAME transaction, so there is no window in which the token is
 * spent but the account does not exist. The user-service admin profile is
 * provisioned right after; if that call fails, the transaction is compensated
 * (credential removed, invite back to PENDING) and the invitee can retry with
 * the same link.
 */
async function acceptInvite(
  rawToken: string,
  payload: IAdminInviteAcceptDTO,
  requestId: string,
): Promise<{ id: string; email: string }> {
  const invite = await AdminInviteRepository.findByTokenHash(
    hashInviteToken(rawToken),
  );

  if (!invite || invite.status !== "PENDING") {
    throw new BadRequestError(
      "This admin invite is no longer valid",
      "INVITE_INVALID",
    );
  }

  if (invite.expiresAt <= new Date()) {
    await AdminInviteRepository.markExpired(invite.id);
    throw new BadRequestError(
      "This admin invite has expired",
      "INVITE_EXPIRED",
    );
  }

  const existingAccount = await CredentialRepository.findByEmail(invite.email);
  if (existingAccount) {
    throw new ConflictError(
      "An account with this email address already exists",
      "email",
    );
  }

  const hashedPassword = await hashPassword(
    payload.password,
    config.bcrypt_salt_round,
  );

  const credential = await prisma.$transaction(async (tx) => {
    const created = await tx.credential.create({
      data: {
        email: invite.email,
        password: hashedPassword,
        role: [UserRoles.ADMIN],
      },
    });

    const consumed = await AdminInviteRepository.markConsumed(
      invite.id,
      created.id,
      tx,
    );

    // Rolls the credential back with it — no consumed token without an account.
    if (!consumed) {
      throw new ConflictError(
        "This admin invite has already been used",
        "INVITE_CONSUMED",
      );
    }

    await writeAuditLog(tx, {
      actorId: created.id,
      action: "ADMIN_INVITE_CONSUMED",
      targetId: invite.id,
      targetType: "AdminInvite",
      oldValues: { status: "PENDING" },
      newValues: { status: "CONSUMED", email: invite.email },
    });

    return created;
  });

  try {
    await createUserProfile(
      {
        id: credential.id,
        email: credential.email,
        role: UserRoles.ADMIN,
        profile: {
          firstName: payload.firstName,
          lastName: payload.lastName,
          ...(payload.phone ? { phone: payload.phone } : {}),
        },
      },
      requestId,
    );
  } catch (error) {
    await prisma.$transaction(async (tx) => {
      await tx.credential.delete({ where: { id: credential.id } });
      await AdminInviteRepository.reopen(invite.id, credential.id, tx);
      await writeAuditLog(tx, {
        actorId: credential.id,
        action: "ADMIN_INVITE_ACCEPT_ROLLED_BACK",
        targetId: invite.id,
        targetType: "AdminInvite",
        oldValues: { status: "CONSUMED" },
        newValues: { status: "PENDING" },
      });
    });

    logger.error("[AdminService] Invite accept failed — rolled back", {
      requestId,
      inviteId: invite.id,
      error,
    });

    throw new InternalServerError(
      "Admin account setup failed. Please try again.",
    );
  }

  return { id: credential.id, email: credential.email };
}

export const AdminService = {
  adminLogin,
  createInvite,
  validateInvite,
  acceptInvite,
};
