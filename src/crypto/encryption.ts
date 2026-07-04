import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  createHmac,
} from "node:crypto";
import { InternalServerError } from "../errors/AppError.js";
import config from "../config/index.js";

// ─── Constants ───
const ALGORITHM = "aes-256-gcm" as const;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

// Encoding: base64url is URL-safe and doesn't require escaping
const ENCODING = "base64url" as const;

// ─── Master Key Management ───
function getMasterKey(): Buffer {
  const masterKeyHex = config.encryption.master_key;
  if (!masterKeyHex) {
    throw new InternalServerError(
      "ENCRYPTION_MASTER_KEY environment variable is required for PII encryption",
    );
  }
  return Buffer.from(masterKeyHex, "hex");
}

// ─── Per-User Key Derivation (HKDF) ───
function deriveUserKey(userId: string, salt: Buffer): Buffer {
  const masterKey = getMasterKey();

  // HKDF Extract: PRK = HMAC-SHA256(salt, masterKey)
  const prk = createHmac("sha256", salt).update(masterKey).digest();

  // HKDF Expand: derivedKey = HMAC-SHA256(PRK, userId + 0x01)
  const info = Buffer.from(`classyshop-user-key:${userId}`, "utf-8");
  const derivedKey = createHmac("sha256", prk)
    .update(Buffer.concat([info, Buffer.from([0x01])]))
    .digest()
    .subarray(0, KEY_LENGTH);

  return derivedKey;
}

// ─── Encryption / Decryption ───
export function encrypt(plaintext: string, userId: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = deriveUserKey(userId, salt);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf-8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Format: salt (16) + IV (12) + ciphertext (N) + authTag (16)
  const payload = Buffer.concat([salt, iv, encrypted, authTag]);
  return payload.toString(ENCODING);
}

export function decrypt(encryptedPayload: string, userId: string): string {
  try {
    const payload = Buffer.from(encryptedPayload, ENCODING);

    // Parse the payload: salt (16) + IV (12) + ciphertext (N) + authTag (16)
    const salt = payload.subarray(0, SALT_LENGTH);
    const iv = payload.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = payload.subarray(payload.length - AUTH_TAG_LENGTH);
    const ciphertext = payload.subarray(
      SALT_LENGTH + IV_LENGTH,
      payload.length - AUTH_TAG_LENGTH,
    );

    const key = deriveUserKey(userId, salt);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString("utf-8");
  } catch (error) {
    throw new InternalServerError(
      "Failed to decrypt PII data. The encryption key may have been rotated or the data is corrupted.",
    );
  }
}

export function generateSalt(): string {
  return randomBytes(SALT_LENGTH).toString("hex");
}

export function encryptUserKeyForStorage(userKey: Buffer): string {
  const masterKey = getMasterKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, masterKey, iv);
  const encrypted = Buffer.concat([cipher.update(userKey), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const payload = Buffer.concat([iv, encrypted, authTag]);
  return payload.toString(ENCODING);
}

export function decryptUserKeyFromStorage(encryptedKey: string): Buffer {
  const masterKey = getMasterKey();
  const payload = Buffer.from(encryptedKey, ENCODING);

  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(payload.length - AUTH_TAG_LENGTH);
  const ciphertext = payload.subarray(
    IV_LENGTH,
    payload.length - AUTH_TAG_LENGTH,
  );

  const decipher = createDecipheriv(ALGORITHM, masterKey, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
