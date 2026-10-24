import { Button, Text } from "react-email";
import { EmailLayout, emailStyles } from "./emailLayout.js";

export interface AccountRestoreEmailProps {
  email: string;
  otp: string;
}

export function AccountRestoreEmail({ email, otp }: AccountRestoreEmailProps) {
  return (
    <EmailLayout previewText="Restore your Nexus account">
      <Text style={emailStyles.heading}>Restore your account</Text>
      <Text style={emailStyles.paragraph}>Hi there,</Text>
      <Text style={emailStyles.paragraph}>
        We received a request to restore the account for{" "}
        <span style={{ fontWeight: 600 }}>{email}</span>. Use the code below to
        verify and restore your account. This code expires in 10 minutes.
      </Text>
      <Text style={emailStyles.mutedText}>{otp}</Text>
      <Text style={emailStyles.paragraph}>
        Didn&apos;t request this? You can ignore this email.
      </Text>
    </EmailLayout>
  );
}

export default AccountRestoreEmail;
