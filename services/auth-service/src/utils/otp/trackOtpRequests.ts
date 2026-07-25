import { redisClient } from "../../config/redis.js";
import { BadRequestError } from "../../errors/AppError.js";
import { OtpPurpose, type TOtpPurpose } from "../../events/eventTypes.js";

const OTP_REQUEST_LIMIT = 3;
const OTP_SPAM_BLOCK_DURATION = 60 * 60;
const OTP_REQUEST_WINDOW = 30 * 60;
const OTP_COOLDOWN_DURATION = 60;

const trackOtpRequests = async (
  email: string,
  purpose: TOtpPurpose = OtpPurpose.EMAIL_VERIFICATION,
): Promise<boolean> => {
  const normalizedEmail = email.toLowerCase().trim();
  const purposeSuffix = `:${purpose}`;
  const otpRequestCountKey = `auth:otp_request_count:${normalizedEmail}${purposeSuffix}`;
  const otpSpamBlockKey = `auth:otp_spam_block:${normalizedEmail}${purposeSuffix}`;
  const otpCooldownKey = `auth:otp_cooldown:${normalizedEmail}${purposeSuffix}`;

  const isSpamBlocked = await redisClient.get(otpSpamBlockKey);
  if (isSpamBlocked) {
    throw new BadRequestError(
      "Too many OTP requests. Please try again after 60 minutes.",
    );
  }

  const currentCount = await redisClient.get(otpRequestCountKey);
  const otpRequests = parseInt(currentCount || "0") + 1;

  if (otpRequests > OTP_REQUEST_LIMIT) {
    await redisClient.set(
      otpSpamBlockKey,
      "blocked",
      "EX",
      OTP_SPAM_BLOCK_DURATION,
    );
    throw new BadRequestError(
      "Too many OTP requests. Please try again after 60 minutes.",
    );
  }

  await Promise.all([
    redisClient.set(
      otpRequestCountKey,
      otpRequests.toString(),
      "EX",
      OTP_REQUEST_WINDOW,
    ),
    redisClient.set(otpCooldownKey, "active", "EX", OTP_COOLDOWN_DURATION),
  ]);

  return true;
};

export default trackOtpRequests;
