/**
 * OTP purposes — auth-service-specific constant (not a domain event).
 * Relocated from the deleted local `eventTypes.ts`.
 */
export const OtpPurpose = {
  EMAIL_VERIFICATION: "EMAIL_VERIFICATION",
} as const;

export type TOtpPurpose = (typeof OtpPurpose)[keyof typeof OtpPurpose];
