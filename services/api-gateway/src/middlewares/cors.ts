import cors from "cors";
import config from "../config/index.js";
import { logger } from "../utils/logger.js";

const ALLOWED_ORIGINS: string[] = config.allowed_origins ?? [];

const originValidator = (
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
): void => {
  if (!origin) return callback(null, true);

  if (ALLOWED_ORIGINS.includes(origin)) {
    return callback(null, true);
  }

  logger.warn("CORS: rejected origin", { origin });
  return callback(null, false);
};

export const corsMiddleware = cors({
  origin: originValidator,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  maxAge: 86400, // 24 hours caching for preflight requests
  preflightContinue: false,
});
