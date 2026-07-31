import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

// ─── Dotenv Loader ───

export function loadEnv(): void {
  dotenv.config({ path: path.join(process.cwd(), ".env") });
}

// ─── Env Helpers ───

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `[CONFIG] Missing required environment variable: ${name}. ` +
        `The service cannot start without this value.`,
    );
  }
  return value;
}

export function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] ?? defaultValue;
}

// ─── Zod Validation ───

export function validateEnv<T extends z.ZodType>(
  schema: T,
  data: unknown,
): z.infer<T> {
  return schema.parse(data);
}

// ─── Common Schemas ───

export const nodeEnvSchema = z.enum(["development", "production", "test"]);

export const jwtSchema = z.object({
  access_token_secret: z.string().min(1, "JWT_ACCESS_TOKEN_SECRET is required"),
  access_token_expires_in: z.string().default("15m"),
  refresh_token_secret: z
    .string()
    .min(1, "JWT_REFRESH_TOKEN_SECRET is required"),
  refresh_token_expires_in: z.string().default("7d"),
  reset_token_secret: z.string().min(1, "JWT_RESET_TOKEN_SECRET is required"),
  reset_token_expires_in: z.string().default("15m"),
});

export const kafkaSchema = z.object({
  broker: z.string().min(1, "KAFKA_BROKER is required"),
  username: z.string().min(1, "KAFKA_USERNAME is required"),
  password: z.string().min(1, "KAFKA_PASSWORD is required"),
});

export const corsSchema = z.object({
  allowed_origins: z
    .string()
    .optional()
    .transform((val) => val?.split(",").map((origin) => origin.trim()) ?? []),
});
