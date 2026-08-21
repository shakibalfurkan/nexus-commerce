import { Section, Text } from "react-email";
import { EmailLayout, emailStyles } from "./emailLayout.js";

/**
 * EmailVerificationEmail — OTP verification email.
 *
 * Rendered for the `email.verification.otp.sent` domain event. The recipient
 * types the OTP back into the app — we deliberately do NOT deep-link the OTP
 * (typing it proves mailbox ownership).
 */

export interface EmailVerificationEmailProps {
  /** Recipient's first name (used for personalization only). */
  firstName: string;
  /** Recipient email address. */
  email: string;
  /** One-time passcode to verify the email address. */
  otp: string;
}

export function EmailVerificationEmail({
  firstName,
  email,
  otp,
}: EmailVerificationEmailProps) {
  return (
    <EmailLayout previewText={`Your Nexus verification code is ${otp}`}>
      <Text style={emailStyles.heading}>Verify your email address</Text>

      <Text style={emailStyles.paragraph}>Hi {firstName},</Text>

      <Text style={emailStyles.paragraph}>
        Use the code below to verify{" "}
        <span style={{ fontWeight: 600 }}>{email}</span> and finish setting up
        your Nexus account. This code expires in 10 minutes.
      </Text>

      <Section style={{ textAlign: "center", margin: "28px 0" }}>
        <Text
          style={{
            fontSize: "32px",
            fontWeight: 700,
            letterSpacing: "8px",
            color: "#0f172a",
            margin: 0,
          }}
        >
          {otp}
        </Text>
      </Section>

      <Text style={emailStyles.paragraph}>
        Didn't request this? You can safely ignore this email — your account is
        not at risk.
      </Text>

      <Text style={emailStyles.mutedText}>
        Need help? Reply to this email or visit our Help Center.
      </Text>
    </EmailLayout>
  );
}

export default EmailVerificationEmail;
