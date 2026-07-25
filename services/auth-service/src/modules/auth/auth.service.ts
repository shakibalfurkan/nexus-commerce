import crypto from "crypto";
import { v5 as uuidv5 } from "uuid";
import config from "../../config/index.js";
import {
  BadRequestError,
  InternalServerError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
} from "../../errors/AppError.js";
import { prisma } from "../../lib/prisma.js";
import {
  hashPassword,
  isPasswordMatched,
} from "../../utils/passwordHandler.js";
import { redisClient } from "../../config/redis.js";
import verifyOtp from "../../utils/otp/verifyOtp.js";
import logger from "../../utils/logger.js";
import checkOtpRestrictions from "../../utils/otp/checkOtpRestrictions.js";
import trackOtpRequests from "../../utils/otp/trackOtpRequests.js";
import { UserRoles } from "../../generated/prisma/enums.js";
import createInternalSignature from "../../utils/createInternalSignature.js";
import type { IAuthResult, ITokenRefreshResult } from "./auth.interface.js";
import { createUserProfile } from "../../lib/axiosClients/userServiceClient.js";
import { buildJwtPayload } from "../../utils/token/buildJwtPayload.js";
import {
  issueAccessToken,
  issueRefreshToken,
} from "../../utils/token/issueToken.js";
import {
  checkLockout,
  handleFailedLogin,
  resetLoginAttempts,
} from "../../utils/handleLogin.js";
import {
  revokeRefreshToken,
  revokeTokenFamily,
} from "../../utils/token/revokeToken.js";
import { generateToken } from "../../utils/token/generateToken.js";
import * as AuthRepository from "../../modules/auth/auth.repository.js";
import { emitDomainEvent } from "../../events/outboxWriter.js";
import {
  DomainEventTypes,
  OtpPurpose,
  createEventMetadata,
  type TOtpPurpose,
} from "../../events/eventTypes.js";
import verifyToken from "../../utils/token/verifyToken.js";
import type { JwtPayload } from "jsonwebtoken";

const DNS_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

// ─── Helper: Map body role + header to UserRoles ───
function deriveRequiredRole(
  bodyRole: string,
  clientType: string | undefined,
): UserRoles {
  if (!clientType || !bodyRole) {
    throw new BadRequestError("Missing role or client type");
  }

  const validPairs: Record<string, string> = {
    "customer-web": "customer",
    "seller-web": "seller",
    "admin-web": "admin",
  };

  const expectedBodyRole = validPairs[clientType];
  if (!expectedBodyRole) {
    throw new BadRequestError("Invalid or unrecognized X-Client-Type");
  }

  if (bodyRole !== expectedBodyRole) {
    throw new BadRequestError(
      "Client type and role mismatch",
      "CLIENT_ROLE_MISMATCH",
    );
  }

  // Map to UserRoles
  if (clientType === "customer-web") return UserRoles.CUSTOMER;
  if (clientType === "seller-web") return UserRoles.SELLER;
  if (clientType === "admin-web") return UserRoles.ADMIN; // catch-all; SUPER_ADMIN handled during check

  throw new BadRequestError("Invalid or unrecognized X-Client-Type");
}

// ─── Helper: Extract role mapping ───
function mapBodyRoleToUserRole(bodyRole: string): UserRoles {
  if (bodyRole === "customer") return UserRoles.CUSTOMER;
  if (bodyRole === "seller") return UserRoles.SELLER;
  if (bodyRole === "admin") return UserRoles.ADMIN;
  throw new BadRequestError("Invalid role in request body");
}

function isAdminRole(role: UserRoles): boolean {
  return role === UserRoles.ADMIN || role === UserRoles.SUPER_ADMIN;
}

// ═══════════════════════════════════════════════════════════════════
// REGISTER
// ═══════════════════════════════════════════════════════════════════

const registerRequest = async (
  payload: TRegisterRequest,
  clientType: string | undefined,
  ipAddress?: string,
  userAgent?: string,
): Promise<void> => {
  const { email, password, role: bodyRoleStr, firstName, lastName } = payload;

  // Cross-validate body role vs header
  const bodyRoleLower = bodyRoleStr.toLowerCase();
  try {
    deriveRequiredRole(bodyRoleLower, clientType);
  } catch (err: any) {
    // Log mismatch as potential tampering
    if (err.field === "CLIENT_ROLE_MISMATCH") {
      await prisma.auditLog.create({
        data: {
          actorId: "anonymous",
          action: "ROLE_HEADER_BODY_MISMATCH",
          targetId: "anonymous",
          targetType: "Credential",
          newValues: { bodyRole: bodyRoleLower, clientType } as any,
          ipAddress: ipAddress ?? null,
          userAgent: userAgent ?? null,
          metadata: { context: "registerRequest" } as any,
        },
      });
    }
    throw err;
  }

  // ADMIN/SUPER_ADMIN cannot self-register
  const requiredRole = mapBodyRoleToUserRole(bodyRoleLower);
  if (isAdminRole(requiredRole)) {
    throw new BadRequestError("Invalid registration role");
  }

  const existingUser = await AuthRepository.findByEmail(email);
  if (existingUser) {
    throw new BadRequestError("Email already in use", "email");
  }

  await checkOtpRestrictions(email, OtpPurpose.EMAIL_VERIFICATION);
  await trackOtpRequests(email, OtpPurpose.EMAIL_VERIFICATION);

  const hashedPassword = await hashPassword(password, config.bcrypt_salt_round);

  const otp = crypto.randomInt(100000, 999999).toString();

  const registrationData: TRegisterRequest = {
    email,
    password: hashedPassword,
    role: bodyRoleStr as "CUSTOMER" | "SELLER",
    firstName,
    lastName,
  };

  await redisClient.setex(
    `auth:reg:${email}`,
    35 * 60,
    JSON.stringify(registrationData),
  );
  await redisClient.setex(
    `auth:otp:${OtpPurpose.EMAIL_VERIFICATION}:${email}`,
    5 * 60,
    otp,
  );

  const aggregateId = uuidv5(email, DNS_NAMESPACE);

  await emitDomainEvent({
    eventName: DomainEventTypes.EMAIL_VERIFICATION_OTP_SENT,
    aggregateId,
    payload: {
      firstName,
      email,
      otp,
    },
    metadata: createEventMetadata(),
  });
};

const verifyRegistration = async (
  requestId: string,
  payload: { email: string; otp: string; clientType?: string },
): Promise<IAuthResult> => {
  const { email, otp, clientType } = payload;

  const cachedData = await redisClient.get(`auth:reg:${email}`);
  if (!cachedData) {
    throw new BadRequestError("Registration expired or not found");
  }

  const { password, ...userData } = JSON.parse(cachedData);

  // Cross-validate role vs header
  const bodyRoleLower = userData.role.toLowerCase();
  deriveRequiredRole(bodyRoleLower, clientType);

  // Reject admin roles
  const requiredRole = mapBodyRoleToUserRole(bodyRoleLower);
  if (isAdminRole(requiredRole)) {
    throw new BadRequestError("Invalid registration role");
  }

  await verifyOtp(email, otp, OtpPurpose.EMAIL_VERIFICATION);

  const credential = await prisma.credential.create({
    data: {
      email: userData.email,
      password,
      role: [userData.role],
    },
  });

  const requestBody = {
    id: credential.id,
    ...userData,
  };

  const signature = createInternalSignature(
    requestBody,
    config.internal_service_secret,
  );

  try {
    await createUserProfile(requestBody, signature, requestId);
  } catch (error) {
    await prisma.credential.delete({ where: { id: credential.id } });

    logger.error(`[AuthService] Registration failed`, { requestId, error });
    throw new InternalServerError(
      "User registration failed. Please try again.",
    );
  }

  await redisClient
    .del(`auth:reg:${email}`)
    .catch((err: any) =>
      logger.error(
        `[redisClient] Failed to delete registration cache for ${email}`,
        err,
      ),
    );

  const jwtPayload = buildJwtPayload({
    ...credential,
    activeRole: credential.role[0] ?? UserRoles.CUSTOMER,
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
};

// ═══════════════════════════════════════════════════════════════════
// RESEND OTP (generic, parameterized by purpose)
// ═══════════════════════════════════════════════════════════════════

const resendOtp = async (
  email: string,
  purpose: TOtpPurpose = OtpPurpose.EMAIL_VERIFICATION,
): Promise<void> => {
  // For EMAIL_VERIFICATION, check registration cache exists
  if (purpose === OtpPurpose.EMAIL_VERIFICATION) {
    const cachedData = await redisClient.get(`auth:reg:${email}`);
    if (!cachedData) {
      throw new BadRequestError("Registration expired or not found");
    }
  }

  await checkOtpRestrictions(email, purpose);
  await trackOtpRequests(email, purpose);

  const otp = crypto.randomInt(100000, 999999).toString();
  await redisClient.setex(`auth:otp:${purpose}:${email}`, 5 * 60, otp);

  let firstName = "User";
  if (purpose === OtpPurpose.EMAIL_VERIFICATION) {
    const cachedData = await redisClient.get(`auth:reg:${email}`);
    if (cachedData) {
      const parsed = JSON.parse(cachedData);
      firstName = parsed.firstName ?? "User";
    }
  }

  const aggregateId = uuidv5(email, DNS_NAMESPACE);

  await emitDomainEvent({
    eventName: DomainEventTypes.EMAIL_VERIFICATION_OTP_SENT,
    aggregateId,
    payload: {
      firstName,
      email,
      otp,
    },
    metadata: createEventMetadata(),
  });
};

// ═══════════════════════════════════════════════════════════════════
// LOGIN (Cross-surface validation)
// ═══════════════════════════════════════════════════════════════════

const login = async (payload: {
  email: string;
  password: string;
  role: "customer" | "seller" | "admin";
  clientType: string | undefined;
  ipAddress?: string;
  userAgent?: string;
}): Promise<IAuthResult> => {
  const {
    email,
    password,
    role: bodyRole,
    clientType,
    ipAddress,
    userAgent,
  } = payload;

  // --- Step 1: Look up Credential by email ---
  const credential = await AuthRepository.findByEmail(email);

  // --- Step 2: Verify password against the stored hash ---
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

  // --- Step 3: Cross-validate BOTH role signals before checking credential.roles ---
  let requiredRole: UserRoles;
  try {
    requiredRole = deriveRequiredRole(bodyRole, clientType);
  } catch (err: any) {
    // Log mismatch as potential tampering (AuditLog)
    if (err.field === "CLIENT_ROLE_MISMATCH") {
      await prisma.auditLog.create({
        data: {
          actorId: "anonymous",
          action: "ROLE_HEADER_BODY_MISMATCH",
          targetId: "anonymous",
          targetType: "Credential",
          newValues: { bodyRole, clientType } as any,
          ipAddress: ipAddress ?? null,
          userAgent: userAgent ?? null,
          metadata: { context: "login" } as any,
        },
      });
    }
    throw err;
  }

  // --- Step 4: Check credential.roles.includes(requiredRole) ---
  const hasRequiredRole = credential.role.some(
    (r) =>
      r === requiredRole ||
      (requiredRole === UserRoles.ADMIN &&
        (r === UserRoles.ADMIN || r === UserRoles.SUPER_ADMIN)),
  );

  if (!hasRequiredRole) {
    if (isAdminRole(requiredRole)) {
      // ADMIN/SUPER_ADMIN: generic 403, log it to AuditLog
      await prisma.auditLog.create({
        data: {
          actorId: credential.id,
          action: "ADMIN_LOGIN_DENIED_NO_ROLE",
          targetId: credential.id,
          targetType: "Credential",
          oldValues: { roles: credential.role } as any,
          newValues: { requiredRole } as any,
          ipAddress: ipAddress ?? null,
          userAgent: userAgent ?? null,
        },
      });
      throw new ForbiddenError("Access denied");
    }

    // CUSTOMER/SELLER: specific error since password was verified
    const missingRoleStr =
      requiredRole === UserRoles.CUSTOMER ? "CUSTOMER" : "SELLER";
    const displayRole = missingRoleStr.toLowerCase();
    throw new BadRequestError(
      JSON.stringify({
        code: "ROLE_NOT_PROVISIONED",
        message: `No ${displayRole} account exists for this email.`,
        canSelfProvision: true,
        missingRole: missingRoleStr,
      }),
      "ROLE_NOT_PROVISIONED",
    );
  }

  // --- Step 5: Lockout/active checks (existing logic) ---
  if (credential.isDeleted) {
    throw new UnauthorizedError("Account is deleted");
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

  // --- Step 6: Issue tokens with activeRole = requiredRole, availableRoles = credential.role ---
  const jwtPayload = buildJwtPayload({
    id: credential.id,
    email: credential.email,
    role: credential.role,
    activeRole: requiredRole,
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
};

// ═══════════════════════════════════════════════════════════════════
// REFRESH TOKEN
// ═══════════════════════════════════════════════════════════════════

const refreshToken = async (token: string): Promise<ITokenRefreshResult> => {
  const storedToken = await prisma.refreshToken.findUnique({
    where: { token },
    include: { credential: true },
  });

  if (!storedToken) {
    throw new UnauthorizedError("Invalid refresh token");
  }

  if (storedToken.isRevoked) {
    await revokeTokenFamily(storedToken.familyId);
    logger.warn(
      `[RTR] Token reuse detected — revoked family ${storedToken.familyId} for credential ${storedToken.credentialId}`,
    );
    throw new UnauthorizedError("Refresh token has been revoked");
  }

  if (storedToken.expiresAt < new Date()) {
    await revokeRefreshToken(token);
    throw new UnauthorizedError("Refresh token has expired");
  }

  const decodedToken = verifyToken(
    token,
    config.jwt.refresh_token_secret!,
    "refresh",
  ) as JwtPayload;

  const { activeRole } = decodedToken;

  await revokeRefreshToken(token);

  const jwtPayload = buildJwtPayload({ ...storedToken.credential, activeRole });
  const accessToken = issueAccessToken(jwtPayload);
  const { token: newRefreshToken } = await issueRefreshToken(
    jwtPayload,
    storedToken.credentialId,
    storedToken.familyId,
  );

  return {
    accessToken,
    refreshToken: newRefreshToken,
    role: storedToken.credential.role,
  };
};

// ═══════════════════════════════════════════════════════════════════
// LOGOUT
// ═══════════════════════════════════════════════════════════════════

const logout = async (token: string): Promise<void> => {
  await revokeRefreshToken(token);
};

// ═══════════════════════════════════════════════════════════════════
// PASSWORD RESET
// ═══════════════════════════════════════════════════════════════════

const requestPasswordReset = async (
  email: string,
  clientType: string,
): Promise<void> => {
  const credential = await prisma.credential.findUnique({
    where: { email },
  });

  if (!credential) {
    return;
  }

  const resetToken = generateToken(
    {
      id: credential.id,
      role: credential.role,
      email: credential.email,
      tokenType: "reset",
    },
    config.jwt.reset_token_secret,
    config.jwt.reset_token_expires_in,
  );

  await prisma.passwordReset.create({
    data: {
      credentialId: credential.id,
      resetToken,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  let resetUiLink;

  if (clientType === "customer-web") {
    resetUiLink = `${config.customer_client_url}/reset-password?resetToken=${resetToken}`;
  } else if (clientType === "seller-web") {
    resetUiLink = `${config.seller_client_url}/reset-password?resetToken=${resetToken}`;
  } else if (clientType === "admin-web") {
    resetUiLink = `${config.admin_client_url}/reset-password?resetToken=${resetToken}`;
  } else {
    resetUiLink = `${config.customer_client_url}/reset-password?resetToken=${resetToken}`;
  }

  await emitDomainEvent({
    eventName: DomainEventTypes.PASSWORD_RESET_REQUESTED,
    aggregateId: credential.id,
    payload: {
      email,
      resetUiLink: resetUiLink as string,
    },
    metadata: createEventMetadata(),
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

// ═══════════════════════════════════════════════════════════════════
// SELF-SERVICE PROVISIONING (Task 2)
// ═══════════════════════════════════════════════════════════════════

const provisionSeller = async (credentialId: string): Promise<void> => {
  const credential = await AuthRepository.findById(credentialId);
  if (!credential) {
    throw new UnauthorizedError("Credential not found");
  }

  // Hard rule: ADMIN/SUPER_ADMIN must never gain CUSTOMER/SELLER roles
  if (credential.role.some((r) => isAdminRole(r))) {
    throw new ForbiddenError(
      "Admin identities cannot gain customer or seller roles",
    );
  }

  // User must have CUSTOMER role already
  if (!credential.role.includes(UserRoles.CUSTOMER)) {
    throw new ForbiddenError(
      "Only existing customers can provision a seller account",
    );
  }

  // No duplicate provisioning
  if (credential.role.includes(UserRoles.SELLER)) {
    throw new ConflictError("Seller role already exists on this account");
  }

  // Emit async event — user-service will consume and create the profile
  await emitDomainEvent({
    eventName: DomainEventTypes.SELLER_PROFILE_REQUESTED,
    aggregateId: credential.id,
    payload: {
      userId: credential.id,
      requestedRole: "SELLER",
    },
    metadata: createEventMetadata(),
  });
};

const provisionCustomer = async (credentialId: string): Promise<void> => {
  const credential = await AuthRepository.findById(credentialId);
  if (!credential) {
    throw new UnauthorizedError("Credential not found");
  }

  // Hard rule: ADMIN/SUPER_ADMIN must never gain CUSTOMER/SELLER roles
  if (credential.role.some((r) => isAdminRole(r))) {
    throw new ForbiddenError(
      "Admin identities cannot gain customer or seller roles",
    );
  }

  // User must have SELLER role already
  if (!credential.role.includes(UserRoles.SELLER)) {
    throw new ForbiddenError(
      "Only existing sellers can provision a customer account",
    );
  }

  // No duplicate provisioning
  if (credential.role.includes(UserRoles.CUSTOMER)) {
    throw new ConflictError("Customer role already exists on this account");
  }

  // Emit async event
  await emitDomainEvent({
    eventName: DomainEventTypes.CUSTOMER_PROFILE_REQUESTED,
    aggregateId: credential.id,
    payload: {
      userId: credential.id,
      requestedRole: "CUSTOMER",
    },
    metadata: createEventMetadata(),
  });
};

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

export const AuthService = {
  registerRequest,
  verifyRegistration,
  resendOtp,
  login,
  refreshToken,
  logout,
  requestPasswordReset,
  verifyPasswordReset,
  provisionSeller,
  provisionCustomer,
};
