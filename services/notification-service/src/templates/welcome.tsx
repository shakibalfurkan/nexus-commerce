import { Button, Text } from "react-email";
import { EmailLayout, emailStyles } from "./email-layout.js";

/**
 * WelcomeEmail — Post-registration welcome email.
 *
 * Rendered for the `user.registered` domain event. Orients the new customer,
 * surfaces the next action (explore the storefront), and gives an
 * account-care contact for issues.
 */

export interface WelcomeEmailProps {
  /** Recipient's first name. */
  firstName: string;
}

export function WelcomeEmail({ firstName }: WelcomeEmailProps) {
  return (
    <EmailLayout previewText={`Welcome to Nexus, ${firstName}!`}>
      <Text style={emailStyles.heading}>Welcome to Nexus, {firstName}!</Text>

      <Text style={emailStyles.paragraph}>
        Your account is ready. Browse curated products from independent sellers,
        track orders, and check out securely — all in one place.
      </Text>

      <Button href="https://nexus-commerce.com" style={emailStyles.button}>
        Start exploring
      </Button>

      <Text style={emailStyles.paragraph}>See you inside,</Text>
      <Text style={emailStyles.paragraph}>The Nexus Team</Text>
    </EmailLayout>
  );
}

export default WelcomeEmail;