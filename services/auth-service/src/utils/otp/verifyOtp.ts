import { redisClient } from "../../config/redis.js";
import { BadRequestError } from "../../errors/AppError.js";
import { OtpPurpose, type TOtpPurpose } from "../../events/eventTypes.js";

const MAX_ATTEMPTS = 3;
const BLOCK_TIME = 30 * 60;

const verifyOtp = async (
  email: string,
  otp: string,
  purpose: TOtpPurpose = OtpPurpose.EMAIL_VERIFICATION,
) => {
  const purposeSuffix = `:${purpose}`;
  const blockKey = `auth:otp_block:${email}${purposeSuffix}`;
  const attemptKey = `auth:otp_attempts:${email}${purposeSuffix}`;
  const otpKey = `auth:otp:${purpose}:${email}`;

  const isBlocked = await redisClient.get(blockKey);
  if (isBlocked) {
    throw new BadRequestError(
      "Too many failed attempts. Please try again after 30 minutes.",
    );
  }

  const storedOtp = await redisClient.get(otpKey);
  if (!storedOtp) {
    throw new BadRequestError("Invalid or Expired OTP");
  }

  if (otp !== storedOtp) {
    const failedAttempts = Number((await redisClient.get(attemptKey)) ?? 0) + 1;

    if (failedAttempts > MAX_ATTEMPTS) {
      await redisClient
        .multi()
        .set(blockKey, "blocked", "EX", BLOCK_TIME)
        .del(otpKey, attemptKey)
        .exec();

      throw new BadRequestError(
        "Account blocked due to multiple failed OTP attempts. Please try again after 30 minutes.",
      );
    }

    await redisClient.set(
      attemptKey,
      failedAttempts.toString(),
      "EX",
      BLOCK_TIME,
    );

    throw new BadRequestError(
      `Invalid OTP. ${MAX_ATTEMPTS - failedAttempts} attempts left.`,
    );
  }

  await redisClient.del(otpKey, attemptKey);
};

export default verifyOtp;
