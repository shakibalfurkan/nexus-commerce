import crypto from "crypto";
import { v5 as uuidv5 } from "uuid";
import config from "../../config/index.js";
import {
  BadRequestError,
  InternalServerError,
  UnauthorizedError,
} from "@nexus/errors";
import { prisma } from "../../lib/prisma.js";
import { redis } from "../../lib/redis.js";
import logger from "../../utils/logger.js";
import {
  hashPassword,
  isPasswordMatched,
} from "../../utils/passwordHandler.js";
import generateOtp from "../../utils/otp/generateOtp.js";
import verifyOtp from "../../utils/otp/verifyOtp.js";
import checkOtpRestrictions from "../../utils/otp/checkOtpRestrictions.js";
import trackOtpRequests from "../../utils/otp/trackOtpRequests.js";
import { OtpPurpose } from "../../constant/otp.js";
import { UserRoles } from "../../generated/prisma/enums.js";
import type { Credential } from "../../generated/prisma/client.js";
import { emitDomainEvent } from "@nexus/kafka";
import { AuthDomainEventTypes } from "@nexus/event-contracts";
import { buildJwtPayload } from "../../utils/token/buildJwtPayload.js";
import { issueAccessToken } from "../../utils/token/issueToken.js";
import { generateToken } from "../../utils/token/generateToken.js";
import verifyToken from "../../utils/token/verifyToken.js";
import {
  findActiveTokenHash,
  hashRefreshToken,
  issueRefreshToken,
  revokeRefreshToken,
  revokeTokenFamily,
  rotateRefreshToken,
} from "../../repositories/refreshToken.js";
import * as CredentialRepository from "../../repositories/credential.js";
import * as AuditLogRepository from "../../repositories/auditLog.js";
import {
  createUserProfile,
  restoreUser,
} from "../../lib/axiosClients/userServiceClient.js";
import {
  checkLockout,
  handleFailedLogin,
  resetLoginAttempts,
} from "../../utils/handleLogin.js";
import type {
  IAuthResult,
  ICachedRegistration,
  ICompleteRegistrationInput,
  IRequestContext,
  IStartRegistrationInput,
  ITokenRefreshResult,
  TClientSurface,
  TRegisterableRole,
} from "./auth.interface.js";

/**
 * Shared auth logic — everything a login surface or role registration needs and
 * nothing role-specific:
 *
 *  - credential verification (exactly one password check per login)
 *  - session issuance / refresh / logout
 *  - password reset
 *  - the OTP-backed registration core, reused by `customer/` and `seller/`
 *  - the role replica sync consumed from user-service events
 *
 * Role modules own only their schemas, routes and role gate.
 */

// ─── Constants ───

const DNS_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
const REGISTRATION_TTL_SECONDS = 35 * 60;
const OTP_TTL_SECONDS = 5 * 60;
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;

/** Surface → reset page. A data map, not a chain of `if (clientType === …)`. */
const RESET_PAGE_BY_SURFACE: Record<TClientSurface, string> = {
  "customer-web": `${config.customer_client_url}/reset-password`,
  "seller-web": `${config.seller_client_url}/reset-password`,
  "admin-web": `${config.admin_client_url}/reset-password`,
};

function isAdminRole(role: UserRoles): boolean {
  return role === UserRoles.ADMIN || role === UserRoles.SUPER_ADMIN;
}

function registrationKey(role: TRegisterableRole, email: string): string {
  return `auth:reg:${role}:${email}`;
}

function registrationOtpKey(email: string): string {
  return `auth:otp:${OtpPurpose.EMAIL_VERIFICATION}:${email}`;
}

// ─── Client surface guard (tamper detection) ───

/**
 * Each register/login route declares the surface it serves. A present-but-wrong
 * `X-Client-Type` is treated as tampering and recorded in the audit log; a
 * missing header is a plain 400.
 */
async function assertClientSurface(
  expected: TClientSurface,
  context: IRequestContext,
): Promise<void> {
  if (context.clientType === expected) {
    return;
  }

  if (context.clientType) {
    await AuditLogRepository.writeAuditLog(prisma, {
      actorId: "anonymous",
      action: "CLIENT_TYPE_MISMATCH",
      targetId: "anonymous",
      targetType: "Credential",
      newValues: {
        expectedSurface: expected,
        clientType: context.clientType,
      },
      metadata: { context: "clientSurfaceGuard" },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
  }

  throw new BadRequestError(
    `This endpoint serves the ${expected} client only`,
    "CLIENT_TYPE_MISMATCH",
  );
}

// ─── Credential verification + session issuance ───

async function verifyCredentials(
  email: string,
  password: string,
): Promise<Credential> {
  const credential = await CredentialRepository.findByEmail(email);

  if (!credential) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const isPasswordValid = await isPasswordMatched(
    password,
    credential.password,
  );

  if (!isPasswordValid) {
    await handleFailedLogin(credential.id);
    throw new UnauthorizedError("Invalid email or password");
  }

  return credential;
}

async function issueSession(
  credential: Credential,
  activeRole: UserRoles,
): Promise<IAuthResult> {
  const jwtPayload = buildJwtPayload({
    id: credential.id,
    email: credential.email,
    role: credential.role,
    activeRole,
  });

  const accessToken = issueAccessToken(jwtPayload);
  const { token: refreshToken } = await issueRefreshToken(
    jwtPayload,
    credential.id,
  );

  return {
    id: credential.id,
    email: credential.email,
    role: credential.role,
    accessToken,
    refreshToken,
  };
}

/**
 * Account-state checks + token issuance, run only after a surface has confirmed
 * both the password and the role it requires.
 */
async function completeLogin(
  credential: Credential,
  activeRole: UserRoles,
): Promise<IAuthResult> {
  if (credential.isDeleted) {
    const graceMs = 30 * 24 * 60 * 60 * 1000;
    const deletedAt = credential.deletedAt;
    const withinGrace =
      !!deletedAt && Date.now() - deletedAt.getTime() < graceMs;
    if (withinGrace) {
      throw new UnauthorizedError("ACCOUNT_DELETED");
    }
    throw new UnauthorizedError("Invalid email or password");
  }

  if (credential.isBlocked) {
    throw new UnauthorizedError(
      `Account is blocked until ${credential.blockedUntil}`,
    );
  }

  if (!credential.isActive) {
    throw new UnauthorizedError("Account is deactivated");
  }

  checkLockout(credential);
  await resetLoginAttempts(credential.id);

  return issueSession(credential, activeRole);
}

// ─── OTP-backed registration core (shared by customer/ and seller/) ───

async function emitOtpEmail(
  email: string,
  firstName: string,
  otp: string,
): Promise<void> {
  const aggregateId = uuidv5(email, DNS_NAMESPACE);

  await prisma.$transaction(async (tx) => {
    await emitDomainEvent(tx, {
      eventType: AuthDomainEventTypes.EMAIL_VERIFICATION_OTP_SENT,
      aggregateId,
      payload: { firstName, email, otp },
    });
  });
}

/**
 * Stage 1: validate the registration, cache it (hashed password) and email an
 * OTP. The account is NOT created here — nothing exists until the OTP is proven.
 */
async function startRegistration(
  input: IStartRegistrationInput,
): Promise<void> {
  const { role, email, password, firstName, profile } = input;

  const existing = await CredentialRepository.findByEmail(email);
  if (existing) {
    throw new BadRequestError("Email already in use", "email");
  }

  await checkOtpRestrictions(email, OtpPurpose.EMAIL_VERIFICATION);
  await trackOtpRequests(email, OtpPurpose.EMAIL_VERIFICATION);

  const hashedPassword = await hashPassword(password, config.bcrypt_salt_round);
  const otp = generateOtp();

  const registration: ICachedRegistration = {
    email,
    password: hashedPassword,
    firstName,
    profile,
  };

  await redis.setex(
    registrationKey(role, email),
    REGISTRATION_TTL_SECONDS,
    JSON.stringify(registration),
  );
  await redis.setex(registrationOtpKey(email), OTP_TTL_SECONDS, otp);

  await emitOtpEmail(email, firstName, otp);
}

async function resendRegistrationOtp(
  email: string,
  role: TRegisterableRole,
): Promise<void> {
  const cached = await redis.get(registrationKey(role, email));
  if (!cached) {
    throw new BadRequestError("Registration expired or not found");
  }

  const registration = JSON.parse(cached) as ICachedRegistration;

  await checkOtpRestrictions(email, OtpPurpose.EMAIL_VERIFICATION);
  await trackOtpRequests(email, OtpPurpose.EMAIL_VERIFICATION);

  const otp = generateOtp();
  await redis.setex(registrationOtpKey(email), OTP_TTL_SECONDS, otp);

  await emitOtpEmail(email, registration.firstName, otp);
}

/**
 * Stage 2: verify the OTP, create the credential and provision the owner's
 * profile in user-service (the source of truth for user state). A failed
 * provisioning call rolls the credential back so no half-registered account can
 * exist, then the client can retry the whole flow.
 */
async function completeRegistration(
  input: ICompleteRegistrationInput,
): Promise<IAuthResult> {
  const { requestId, role, email, otp } = input;

  const cached = await redis.get(registrationKey(role, email));
  if (!cached) {
    throw new BadRequestError("Registration expired or not found");
  }

  const registration = JSON.parse(cached) as ICachedRegistration;

  await verifyOtp(email, otp, OtpPurpose.EMAIL_VERIFICATION);

  const credential = await prisma.credential.create({
    data: {
      email: registration.email,
      password: registration.password,
      role: [role],
    },
  });

  try {
    await createUserProfile(
      {
        id: credential.id,
        email: credential.email,
        role,
        profile: registration.profile,
      },
      requestId,
    );
  } catch (error) {
    await prisma.credential.delete({ where: { id: credential.id } });

    logger.error("[AuthService] Registration failed — credential rolled back", {
      requestId,
      role,
      error,
    });

    throw new InternalServerError(
      "User registration failed. Please try again.",
    );
  }

  await redis
    .del(registrationKey(role, email))
    .catch((err: unknown) =>
      logger.error(
        `[redis] Failed to delete registration cache for ${email}`,
        err,
      ),
    );

  return issueSession(credential, role);
}

// ─── Role replica sync (from user-service events) ───

/**
 * Adds a role to a credential after user-service confirmed the matching profile
 * exists (e.g. customer → seller via `user.seller.profile.attached`).
 *
 * Idempotent by design — the consumer is at-least-once. Admin identities must
 * never gain customer/seller roles, so that case is logged and dropped without
 * retrying (a business-rule violation would loop forever otherwise).
 */
async function addRoleToCredential(
  credentialId: string,
  role: UserRoles,
): Promise<void> {
  const credential = await CredentialRepository.findById(credentialId);

  if (!credential) {
    logger.warn(
      `[AuthService] Role sync for unknown credential ${credentialId} — nothing to update`,
    );
    return;
  }

  if (credential.role.includes(role)) {
    return;
  }

  if (credential.role.some(isAdminRole)) {
    logger.error(
      `[AuthService] Refusing to add ${role} to admin credential ${credentialId}`,
    );
    return;
  }

  const updated = await CredentialRepository.addRoleIfUnchanged(
    credentialId,
    role,
    credential.role,
  );

  if (!updated) {
    // Concurrent role write — the event stays unacknowledged work at the broker
    // level only if we throw, and redelivery would re-run this same check.
    logger.warn(
      `[AuthService] Role sync skipped for ${credentialId} — roles changed concurrently`,
    );
    return;
  }

  await AuditLogRepository.writeAuditLog(prisma, {
    actorId: "user-service",
    action: "CREDENTIAL_ROLE_ADDED",
    targetId: credentialId,
    targetType: "Credential",
    oldValues: { roles: credential.role },
    newValues: { roles: [...credential.role, role] },
  });

  logger.info(`[AuthService] Credential ${credentialId} now holds ${role}`);
}

// ─── Refresh token / logout ───

const refreshToken = async (token: string): Promise<ITokenRefreshResult> => {
  // 1. Verify signature/expiry first — an invalid signature or expired JWT
  //    rejects immediately, with no Redis call needed
  const decodedToken = verifyToken(
    token,
    config.jwt.refresh_token_secret,
    "refresh",
  );

  const credentialId = decodedToken.id;
  const familyId = decodedToken.familyId;
  const activeRole = decodedToken.activeRole;

  if (!familyId || !activeRole) {
    throw new UnauthorizedError("Invalid refresh token");
  }

  // 2. Fetch the stored hash — null means expired (past TTL) or already revoked
  const storedTokenHash = await findActiveTokenHash(credentialId, familyId);
  if (!storedTokenHash) {
    throw new UnauthorizedError("Invalid refresh token");
  }

  // 3. Hash-compare the presented token against the stored hash:
  //    mismatch = reuse of an already-rotated token → revoke the whole family
  if (hashRefreshToken(token) !== storedTokenHash) {
    await revokeTokenFamily(credentialId, familyId);
    logger.warn(
      `[RTR] Token reuse detected — revoked family ${familyId} for credential ${credentialId}`,
    );
    throw new UnauthorizedError("Refresh token has been revoked");
  }

  // 4. Rotate atomically (Lua compare-hash-then-overwrite) so two concurrent
  //    refresh attempts on the same family cannot race — the loser is reuse
  const jwtPayload = buildJwtPayload({
    id: credentialId,
    email: decodedToken.email,
    role: decodedToken.role,
    activeRole,
  });

  const rotated = await rotateRefreshToken(
    credentialId,
    familyId,
    storedTokenHash,
    jwtPayload,
  );

  if (!rotated) {
    await revokeTokenFamily(credentialId, familyId);
    logger.warn(
      `[RTR] Token reuse detected — revoked family ${familyId} for credential ${credentialId}`,
    );
    throw new UnauthorizedError("Refresh token has been revoked");
  }

  const accessToken = issueAccessToken(jwtPayload);

  return {
    accessToken,
    refreshToken: rotated.token,
    role: decodedToken.role,
  };
};

const logout = async (token: string): Promise<void> => {
  await revokeRefreshToken(token);
};

// ─── Password reset ───

function resolveResetPage(clientType: string | undefined): string {
  if (!clientType) {
    return RESET_PAGE_BY_SURFACE["customer-web"];
  }

  const page = RESET_PAGE_BY_SURFACE[clientType as TClientSurface];
  if (!page) {
    throw new BadRequestError("Invalid or unrecognized X-Client-Type");
  }

  return page;
}

const requestPasswordReset = async (
  email: string,
  clientType: string | undefined,
): Promise<void> => {
  const credential = await CredentialRepository.findByEmail(email);

  if (!credential) {
    // Never reveal whether an account exists.
    return;
  }

  const resetToken = generateToken(
    {
      id: credential.id,
      role: credential.role,
      email: credential.email,
      tokenType: "password_reset",
    },
    config.jwt.password_reset_token_secret,
    config.jwt.password_reset_token_expires_in,
  );

  await prisma.passwordReset.create({
    data: {
      credentialId: credential.id,
      resetToken,
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  const resetUiLink = `${resolveResetPage(clientType)}?resetToken=${resetToken}`;

  await prisma.$transaction(async (tx) => {
    await emitDomainEvent(tx, {
      eventType: AuthDomainEventTypes.PASSWORD_RESET_REQUESTED,
      aggregateId: credential.id,
      payload: { email, resetUiLink },
    });
  });
};

const verifyPasswordReset = async (payload: {
  resetToken: string;
  newPassword: string;
}): Promise<void> => {
  const { resetToken, newPassword } = payload;

  const resetRecord = await prisma.passwordReset.findUnique({
    where: { resetToken },
  });

  if (!resetRecord) {
    throw new BadRequestError("Invalid or expired reset token");
  }

  if (resetRecord.usedAt) {
    throw new BadRequestError("Reset token has already been used");
  }

  if (resetRecord.expiresAt < new Date()) {
    throw new BadRequestError("Reset token has expired");
  }

  const hashedPassword = await hashPassword(
    newPassword,
    config.bcrypt_salt_round,
  );

  await prisma.$transaction([
    prisma.credential.update({
      where: { id: resetRecord.credentialId },
      data: { password: hashedPassword },
    }),
    prisma.passwordReset.update({
      where: { id: resetRecord.id },
      data: { usedAt: new Date() },
    }),
  ]);
};

const requestAccountRestore = async (email: string): Promise<void> => {
  const credential = await CredentialRepository.findByEmail(email);
  if (!credential || !credential.isDeleted) return;

  const graceMs = 30 * 24 * 60 * 60 * 1000;
  if (
    !credential.deletedAt ||
    Date.now() - credential.deletedAt.getTime() > graceMs
  ) {
    return;
  }

  const otp = generateOtp();
  const hashed = crypto
    .createHmac("sha256", config.internal_service_secret!)
    .update(otp)
    .digest("hex");

  const key = `auth:restore:${credential.id}`;
  await redis.set(key, hashed, "EX", 600);

  await prisma.$transaction(async (tx) => {
    await emitDomainEvent(tx, {
      eventType: AuthDomainEventTypes.ACCOUNT_RESTORE_REQUESTED,
      aggregateId: credential.id,
      payload: { email, otp },
    });
  });
};

const verifyAccountRestore = async (
  email: string,
  otp: string,
): Promise<void> => {
  const credential = await CredentialRepository.findByEmail(email);
  if (!credential || !credential.isDeleted) {
    throw new BadRequestError("Invalid or expired restore request");
  }

  const key = `auth:restore:${credential.id}`;
  const stored = await redis.get(key);
  if (!stored) {
    throw new BadRequestError("Invalid or expired restore request");
  }

  const hashed = crypto
    .createHmac("sha256", config.internal_service_secret!)
    .update(otp)
    .digest("hex");

  const a = Buffer.from(hashed, "hex");
  const b = Buffer.from(stored, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new BadRequestError("Invalid OTP");
  }

  await redis.del(key);

  await restoreUser(credential.id);
};

export const AuthService = {
  requestAccountRestore,
  verifyAccountRestore,
  assertClientSurface,
  verifyCredentials,
  completeLogin,
  startRegistration,
  resendRegistrationOtp,
  completeRegistration,
  addRoleToCredential,
  refreshToken,
  logout,
  requestPasswordReset,
  verifyPasswordReset,
};
