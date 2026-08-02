/**
 * EmailProvider Interface — Clean abstraction for transactional email delivery.
 *
 * Core consumer logic depends on this interface, never on a concrete provider
 * (Resend, SES, etc.). Swapping providers touches exactly one adapter file.
 *
 * Design decisions:
 * - `SendEmailCommand` carries pre-rendered HTML so the provider stays
 *   template-agnostic — the TemplateEngine renders, the provider transports.
 * - `SendEmailResult` returns a `messageId` for idempotency tracking and
 *   external observability (stored in NotificationLog.providerMessageId).
 * - Errors are thrown as `EmailProviderError`, not returned — the resilience
 *   layer (circuit breaker + retry) catches and classifies them.
 */

/** Command sent to the email provider after template rendering is complete. */
export interface SendEmailCommand {
  /** Recipient email address. */
  to: string;
  /** Email subject line (plain text, no HTML). */
  subject: string;
  /** Pre-rendered HTML body from the template engine. */
  html: string;
}

/** Result returned by the provider on successful delivery. */
export interface SendEmailResult {
  /** Provider-returned message ID (e.g. Resend's `id` field). */
  messageId: string;
  /** Provider name for audit/logging (e.g. "resend"). */
  provider: string;
}

/**
 * Contract for any email provider implementation.
 *
 * Implementations MUST:
 * - Throw `EmailProviderError` on failure (not return error objects).
 * - Never leak SDK-specific types into the method signature.
 * - Be safe to wrap in a circuit breaker / retry decorator.
 */
export interface EmailProvider {
  /** Human-readable provider name for logging and audit trails. */
  readonly name: string;

  /**
   * Send a single transactional email.
   *
   * @throws {EmailProviderError} on any delivery failure (HTTP error,
   *   non-2xx response, network timeout, etc.).
   */
  send(command: SendEmailCommand): Promise<SendEmailResult>;
}
