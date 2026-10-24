import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import { UnauthorizedError } from "@nexus/errors";
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

  if (Number.isNaN(requestTime) || now - requestTime > fiveMinutes) {
    throw new UnauthorizedError("Request timestamp expired");
  }

  const path = `${req.baseUrl}${req.path}`;
  const payload = `${req.method.toUpperCase()}:${path}:${timestamp}:${JSON.stringify(req.body ?? {})}`;
  const expectedSignature = crypto
    .createHmac("sha256", config.internal_service_secret!)
    .update(payload)
    .digest("hex");

  const sigBuf = Buffer.from(String(signature), "hex");
  const expBuf = Buffer.from(expectedSignature, "hex");
  if (
    sigBuf.length !== expBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expBuf)
  ) {
    throw new UnauthorizedError("Invalid internal service signature");
  }

  next();
};

export default verifyInternalCall;
