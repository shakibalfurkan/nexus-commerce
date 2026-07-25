import { randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import type { PrismaTransaction } from "../types/database.types.js";
import { encrypt, decrypt, generateSalt } from "./encryption.js";
import { computeEmailBlindIndex } from "./blindIndex.js";
import { NotFoundError } from "../errors/AppError.js";

// ─── Public API ───

export async function initializeUserEncryption(
  userId: string,
  email: string,
  tx?: PrismaTransaction,
): Promise<{
  encryptedEmail: string;
  emailBlindIndex: string;
}> {
  const client = tx ?? prisma;

  const keyId = `key_${randomBytes(16).toString("hex")}`;

  const salt = generateSalt();

  const encryptedKey = salt;

  // Create the encryption key record
  await client.encryptionKey.create({
    data: {
      userId,
      keyId,
      encryptedKey,
      algorithm: "aes-256-gcm",
    },
  });

  // Encrypt the email
  const encryptedEmail = encrypt(email, userId);

  // Compute the blind index for the email
  const emailBlindIndex = computeEmailBlindIndex(email);

  return {
    encryptedEmail,
    emailBlindIndex,
  };
}

export async function destroyUserEncryptionKey(
  userId: string,
  tx?: PrismaTransaction,
): Promise<void> {
  const client = tx ?? prisma;

  const keyRecord = await client.encryptionKey.findUnique({
    where: { userId },
  });

  if (!keyRecord) {
    throw new NotFoundError(
      "No encryption key found for this user. PII may already be shredded.",
      "userId",
    );
  }

  await client.encryptionKey.delete({
    where: { userId },
  });
}

export async function hasActiveEncryptionKey(userId: string): Promise<boolean> {
  const count = await prisma.encryptionKey.count({
    where: { userId },
  });
  return count > 0;
}

export function encryptPiiField(plaintext: string, userId: string): string {
  return encrypt(plaintext, userId);
}

export function decryptPiiField(
  encryptedPayload: string,
  userId: string,
): string {
  return decrypt(encryptedPayload, userId);
}
