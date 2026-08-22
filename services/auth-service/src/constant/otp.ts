/**
 * OTP purposes — auth-service-specific constant
 */
export const OtpPurpose = {
  EMAIL_VERIFICATION: "EMAIL_VERIFICATION",
} as const;

export type TOtpPurpose = (typeof OtpPurpose)[keyof typeof OtpPurpose];
