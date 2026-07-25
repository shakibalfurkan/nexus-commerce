import type { UserRoles } from "../../generated/prisma/enums.js";
import { prisma } from "../../lib/prisma.js";

export async function findByEmail(email: string) {
  return prisma.credential.findUnique({
    where: { email },
  });
}
export async function findByEmailExcludingDeleted(email: string) {
  return prisma.credential.findUnique({
    where: { email, isDeleted: false },
  });
}
export async function findById(id: string) {
  return prisma.credential.findUnique({
    where: { id },
  });
}

export async function createCredential(data: {
  email: string;
  password: string;
  role: UserRoles[];
}) {
  return prisma.credential.create({
    data: {
      email: data.email,
      password: data.password,
      role: data.role,
    },
  });
}

export async function incrementFailedLoginAttempts(id: string) {
  return prisma.credential.update({
    where: { id },
    data: {
      failedLoginAttempts: { increment: 1 },
    },
  });
}

export async function resetFailedLoginAttempts(id: string) {
  return prisma.credential.update({
    where: { id },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });
}

export async function lockAccount(id: string, lockedUntil: Date) {
  return prisma.credential.update({
    where: { id },
    data: {
      lockedUntil,
    },
  });
}
