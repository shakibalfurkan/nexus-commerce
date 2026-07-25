import { UnauthorizedError } from "../errors/AppError.js";
import { prisma } from "../lib/prisma.js";

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

export function checkLockout(credential: {
  failedLoginAttempts: number;
  lockedUntil: Date | null;
}): void {
  if (credential.lockedUntil && credential.lockedUntil > new Date()) {
    const remainingMs = credential.lockedUntil.getTime() - Date.now();
    const remainingMin = Math.ceil(remainingMs / 60000);
    throw new UnauthorizedError(
      `Account temporarily locked. Try again in ${remainingMin} minute(s).`,
    );
  }
}

export async function handleFailedLogin(credentialId: string): Promise<void> {
  const updated = await prisma.credential.update({
    where: { id: credentialId },
    data: {
      failedLoginAttempts: { increment: 1 },
    },
  });

  if (updated.failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
    await prisma.credential.update({
      where: { id: credentialId },
      data: {
        lockedUntil: new Date(Date.now() + LOCK_DURATION_MS),
      },
    });
  }
}

export async function resetLoginAttempts(credentialId: string): Promise<void> {
  await prisma.credential.update({
    where: { id: credentialId },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLogin: new Date(),
    },
  });
}
