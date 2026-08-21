import { Button, Text } from "react-email";
import { EmailLayout, emailStyles } from "./emailLayout.js";

/**
 * PasswordResetEmail — Password reset email with a single-use reset link.
 *
 * Rendered for the `password.reset.requested` domain event. The link points to
 * the customer storefront reset page; the token itself is single-use and
 * short-lived (issued by auth-service).
 */

export interface PasswordResetEmailProps {
  /** Recipient email address. */
  email: string;
  /** Full reset URL (storefront page + short-lived token). */
  resetUiLink: string;
}

export function PasswordResetEmail({
  email,
  resetUiLink,
}: PasswordResetEmailProps) {
  return (
    <EmailLayout previewText="Reset your Nexus password">
      <Text style={emailStyles.heading}>Reset your password</Text>

      <Text style={emailStyles.paragraph}>Hi there,</Text>

      <Text style={emailStyles.paragraph}>
        We received a request to reset the password for{" "}
        <span style={{ fontWeight: 600 }}>{email}</span>. Click the button
        below to choose a new password. This link expires in 15 minutes.
      </Text>

      <Button href={resetUiLink} style={emailStyles.button}>
        Reset password
      </Button>

      <Text style={emailStyles.paragraph}>
        If the button doesn&apos;t work, copy and paste this link into your
        browser:
      </Text>

      <Text style={emailStyles.mutedText}>{resetUiLink}</Text>

      <Text style={emailStyles.paragraph}>
        Didn&apos;t request a password reset? You can ignore this email. Your
        password will stay the same until you use the link above.
      </Text>
    </EmailLayout>
  );
}

export default PasswordResetEmail;
