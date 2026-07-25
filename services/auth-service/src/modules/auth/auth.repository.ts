import { prisma } from "../../lib/prisma.js";

export async function updatePassword(id: string, hashedPassword: string) {
  return prisma.credential.update({
    where: { id },
    data: { password: hashedPassword },
  });
}

export async function findRefreshToken(token: string) {
  return prisma.refreshToken.findUnique({
    where: { token },
    include: { credential: true },
  });
}

export async function revokeRefreshToken(token: string) {
  return prisma.refreshToken.update({
    where: { token },
    data: { isRevoked: true },
  });
}

export async function revokeTokenFamily(familyId: string) {
  return prisma.refreshToken.updateMany({
    where: { familyId },
    data: { isRevoked: true },
  });
}

export async function createPasswordReset(data: {
  credentialId: string;
  resetToken: string;
  expiresAt: Date;
}) {
  return prisma.passwordReset.create({ data });
}

export async function findPasswordResetByToken(resetToken: string) {
  return prisma.passwordReset.findUnique({
    where: { resetToken },
  });
}

export async function markPasswordResetUsed(id: string) {
  return prisma.passwordReset.update({
    where: { id },
    data: { usedAt: new Date() },
  });
}
