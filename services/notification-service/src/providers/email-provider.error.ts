/**
 * EmailProviderError — Typed error for email delivery failures.
 *
 * The `retryable` flag lets the resilience layer (circuit breaker + retry)
 * distinguish between transient failures (5xx, network timeout) and permanent
 * failures (4xx validation errors, invalid recipient) without inspecting
 * error messages.
 */

export interface EmailProviderErrorOptions {
  /** Whether the error is transient and a retry might succeed. */
  retryable: boolean;
  /** HTTP status code from the provider, if applicable. */
  statusCode?: number | undefined;
  /** Provider-internal error code, if the response body includes one. */
  providerCode?: string | undefined;
  /** Original error cause for debugging. */
  cause?: unknown;
}

export class EmailProviderError extends Error {
  readonly retryable: boolean;
  readonly statusCode: number | undefined;
  readonly providerCode: string | undefined;

  constructor(message: string, options: EmailProviderErrorOptions) {
    // Native ES2022 cause — cleaner than a type-cast assignment.
    super(message, options.cause !== undefined ? { cause: options.cause } : {});
    this.name = "EmailProviderError";
    this.retryable = options.retryable;
    this.statusCode = options.statusCode;
    this.providerCode = options.providerCode;
  }
}
