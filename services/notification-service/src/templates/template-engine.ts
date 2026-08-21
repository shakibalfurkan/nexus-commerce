import { render } from "@react-email/render";
import type { ComponentProps, ReactElement } from "react";

import { EmailVerificationEmail } from "./emailVerification.js";
import { PasswordResetEmail } from "./passwordReset.js";
import { WelcomeEmail } from "./welcome.js";

/**
 * TemplateEngine — Maps a `templateKey` to its React Email component and
 * renders it to an HTML string.
 *
 * Registry/map pattern (`.clinerules` §7): no switch/if-else chains — adding a
 * template is a one-line registry entry plus the component file. Template keys
 * are aligned with `domainEventRegistry` in
 * `src/events/domain-event.schemas.ts`.
 *
 * Security: JSX auto-escapes all interpolated props → HTML-injection safe by
 * default (unlike string-concatenated EJS/Handlebars templates).
 */

export type TemplateKey = "email-verification" | "password-reset" | "welcome";

/** Maps each template key to its concrete component type. */
export type TemplateComponents = {
  "email-verification": typeof EmailVerificationEmail;
  "password-reset": typeof PasswordResetEmail;
  welcome: typeof WelcomeEmail;
};

/** Typed props for a given template key (compile-time checked). */
export type TemplateProps<Key extends TemplateKey> = ComponentProps<
  TemplateComponents[Key]
>;

/**
 * Each entry carries a `render` function bound to its own props type. This is
 * the correlated-record pattern: indexing by the same generic `Key` keeps the
 * component and its props in lockstep, so a wrong props shape is a compile
 * error rather than a runtime surprise.
 */
type TemplateRegistry = {
  [Key in TemplateKey]: {
    render: (props: TemplateProps<Key>) => ReactElement | null;
  };
};

export const templateRegistry: TemplateRegistry = {
  "email-verification": {
    render: (props) => EmailVerificationEmail(props),
  },
  "password-reset": {
    render: (props) => PasswordResetEmail(props),
  },
  welcome: {
    render: (props) => WelcomeEmail(props),
  },
};

// ─── Public API ───

export interface RenderTemplateResult {
  /** Rendered HTML string ready for the email provider. */
  html: string;
  /** Template key used, for audit/logging. */
  templateKey: TemplateKey;
}

export function isTemplateKey(value: string): value is TemplateKey {
  return value in templateRegistry;
}

/**
 * Render a registered template to HTML.
 *
 * The generic keeps the caller's props checked against the component's typed
 * props at compile time. An invalid `templateKey` throws at runtime — the
 * registry is the single source of truth, so a missing key is a programming
 * error, not a user error.
 *
 * @throws {Error} if `templateKey` is not registered.
 */
export async function renderTemplate<Key extends TemplateKey>(
  templateKey: Key,
  props: TemplateProps<Key>,
): Promise<RenderTemplateResult> {
  const entry = templateRegistry[templateKey];
  const element = entry.render(props);

  const html = await render(element);

  return { html, templateKey };
}
