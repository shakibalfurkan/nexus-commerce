import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import { UnauthorizedError } from "../errors/AppError.js";
import config from "../config/index.js";

const verifyInternalCall = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const signature = req.headers["x-internal-signature"];
  const timestamp = req.headers["x-internal-timestamp"];

  if (!signature || !timestamp) {
    throw new UnauthorizedError("Missing internal service credentials");
  }

  const requestTime = parseInt(timestamp as string);
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;

  if (now - requestTime > fiveMinutes) {
    throw new UnauthorizedError("Request timestamp expired");
  }

  const payload = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac("sha256", config.internal_service_secret!)
    .update(payload)
    .digest("hex");

  if (signature !== expectedSignature) {
    throw new UnauthorizedError("Invalid internal service signature");
  }

  next();
};

export default verifyInternalCall;
