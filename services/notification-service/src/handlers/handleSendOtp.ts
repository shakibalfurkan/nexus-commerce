import type { TSendOtpPayload } from "../types/index.js";
import logger from "../utils/logger.js";
import { sendEmail } from "../utils/sendMail.js";

export const handleSendOtp = async (payload: TSendOtpPayload) => {
  const { email, userName, otp, reason, userType } = payload;
  const templateName =
    reason === "email-verification"
      ? "email-verification"
      : "login-verification";

  await sendEmail(email, "Your One Time Password (OTP)", templateName, {
    userName,
    otp,
    userType: userType.toLowerCase(),
  });
  logger.info(`OTP email sent to ${email} for reason: ${reason}`);
};
