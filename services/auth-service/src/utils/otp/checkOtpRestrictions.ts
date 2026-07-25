import { redisClient } from "../../config/redis.js";
import { BadRequestError } from "../../errors/AppError.js";
import { OtpPurpose, type TOtpPurpose } from "../../events/eventTypes.js";

const checkOtpRestrictions = async (
  email: string,
  purpose: TOtpPurpose = OtpPurpose.EMAIL_VERIFICATION,
): Promise<boolean> => {
  const normalizedEmail = email.toLowerCase().trim();
  const purposeSuffix = `:${purpose}`;

  const isBlocked = await redisClient.get(
    `auth:otp_block:${normalizedEmail}${purposeSuffix}`,
  );
  if (isBlocked) {
    throw new BadRequestError(
      "Account temporarily blocked due to multiple failed OTP attempts. Please try again after 30 minutes.",
      "OTP_BLOCKED",
    );
  }

  const isSpamBlocked = await redisClient.get(
    `auth:otp_spam_block:${normalizedEmail}${purposeSuffix}`,
  );
  if (isSpamBlocked) {
    throw new BadRequestError(
      "Too many OTP requests. Please try again after 60 minutes.",
      "OTP_SPAM_BLOCKED",
    );
  }

  const isInCooldown = await redisClient.get(
    `auth:otp_cooldown:${normalizedEmail}${purposeSuffix}`,
  );
  if (isInCooldown) {
    throw new BadRequestError(
      "Please wait 1 minute before requesting a new OTP.",
      "OTP_COOLDOWN",
    );
  }

  return true;
};

export default checkOtpRestrictions;
