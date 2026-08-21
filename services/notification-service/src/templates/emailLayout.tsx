import type { ReactNode } from "react";
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "react-email";

/**
 * EmailLayout — Shared visual shell for all transactional emails.
 *
 * Keeps brand, typography, and footer consistent across templates while each
 * template supplies only its own content + preview text.
 *
 * Why React Email (not EJS/Handlebars):
 * - JSX auto-escapes all interpolated values → HTML-injection safe by default.
 * - Typed props → a missing/misspelled template variable is a compile error.
 */

export interface EmailLayoutProps {
  /** Shown in the inbox preview pane (keep under ~140 chars). */
  previewText: string;
  children: ReactNode;
}

// ─── Brand / palette (single source of truth for now) ───

const BRAND_COLOR = "#4f46e5";

export const emailStyles = {
  body: {
    backgroundColor: "#f4f6fb",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    margin: 0,
    padding: "32px 12px",
  },
  container: {
    maxWidth: "600px",
    margin: "0 auto",
  },
  header: {
    padding: "0 8px 16px",
  },
  brand: {
    fontSize: "22px",
    fontWeight: 700,
    color: BRAND_COLOR,
    letterSpacing: "-0.02em",
    margin: 0,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    border: "1px solid #e2e8f0",
    padding: "32px 28px",
  },
  heading: {
    fontSize: "20px",
    fontWeight: 700,
    color: "#0f172a",
    lineHeight: "28px",
    margin: "0 0 16px",
  },
  paragraph: {
    fontSize: "15px",
    lineHeight: "24px",
    color: "#334155",
    margin: "0 0 16px",
  },
  mutedText: {
    fontSize: "13px",
    lineHeight: "20px",
    color: "#64748b",
    margin: "12px 0 0",
  },
  button: {
    backgroundColor: BRAND_COLOR,
    borderRadius: "8px",
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: 600,
    textDecoration: "none",
    padding: "12px 20px",
    display: "inline-block",
  },
  link: {
    color: BRAND_COLOR,
    textDecoration: "underline",
  },
  hr: {
    borderColor: "#e2e8f0",
    margin: "24px 0 0",
  },
  footerText: {
    fontSize: "12px",
    lineHeight: "18px",
    color: "#94a3b8",
    margin: "4px 0",
  },
  footerLink: {
    fontSize: "12px",
    color: "#94a3b8",
    textDecoration: "underline",
  },
} as const;

export function EmailLayout({ previewText, children }: EmailLayoutProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={emailStyles.body}>
        <Container style={emailStyles.container}>
          <Section style={emailStyles.header}>
            <Text style={emailStyles.brand}>Nexus</Text>
          </Section>

          <Section style={emailStyles.card}>{children}</Section>

          <Hr style={emailStyles.hr} />

          <Section
            style={{
              padding: "16px 8px 0",
              textAlign: "center",
            }}
          >
            <Text style={emailStyles.footerText}>
              © {new Date().getFullYear()} Nexus Commerce. All rights reserved.
            </Text>
            <Link
              href="https://nexus-commerce.com"
              style={emailStyles.footerLink}
            >
              nexus-commerce.com
            </Link>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default EmailLayout;
