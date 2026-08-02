/**
 * ResendEmailProvider — Concrete EmailProvider implementation using the
 * Resend HTTP API (POST https://api.resend.com/emails).
 *
 * No Resend SDK is used — this is a raw `fetch` call behind the
 * EmailProvider interface. Swapping to SES/Mailgun touches only this file.
 *
 * Error classification:
 * - 4xx (except 429) → non-retryable (bad request, invalid recipient)
 * - 429 (rate limited) → retryable (transient)
 * - 5xx → retryable (server error)
 * - Network/timeout → retryable
 */

import type {
  EmailProvider,
  SendEmailCommand,
  SendEmailResult,
} from "./email-provider.interface.js";
import { EmailProviderError } from "./email-provider.error.js";
import logger from "../utils/logger.js";

const RESEND_API_URL = "https://api.resend.com/emails";

/** Resend API success response shape (only the fields we use). */
interface ResendSuccessResponse {
  id: string;
}

/** Resend API error response shape. */
interface ResendErrorResponse {
  message?: string;
  name?: string;
}

export interface ResendEmailProviderOptions {
  apiKey: string;
  /** From address, e.g. "Nexus <no-reply@yourdomain.com>". */
  fromEmail: string;
  /** Optional request timeout in milliseconds (default: 10s). */
  timeoutMs?: number;
}

export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";
  private readonly apiKey: string;
  private readonly fromEmail: string;
  private readonly timeoutMs: number;

  constructor(options: ResendEmailProviderOptions) {
    if (!options.apiKey) {
      throw new Error("ResendEmailProvider: apiKey is required");
    }
    if (!options.fromEmail) {
      throw new Error("ResendEmailProvider: fromEmail is required");
    }
    this.apiKey = options.apiKey;
    this.fromEmail = options.fromEmail;
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  async send(command: SendEmailCommand): Promise<SendEmailResult> {
    const body = JSON.stringify({
      from: this.fromEmail,
      to: [command.to],
      subject: command.subject,
      html: command.html,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(RESEND_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body,
        signal: controller.signal,
      });
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === "AbortError";
      throw new EmailProviderError(
        isTimeout
          ? `Resend API request timed out after ${this.timeoutMs}ms`
          : `Resend API network error: ${error instanceof Error ? error.message : String(error)}`,
        {
          retryable: true,
          cause: error,
        },
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorBody = await this.parseErrorBody(response);
      const statusCode = response.status;
      const isRateLimited = statusCode === 429;
      const isRetryable = isRateLimited || statusCode >= 500;

      throw new EmailProviderError(
        `Resend API returned ${statusCode}: ${errorBody.message ?? "Unknown error"}`,
        {
          retryable: isRetryable,
          statusCode,
          providerCode: errorBody.name,
        },
      );
    }

    const data = (await response.json()) as ResendSuccessResponse;

    if (!data.id) {
      throw new EmailProviderError(
        "Resend API returned success but no message ID in response",
        { retryable: true },
      );
    }

    logger.debug("Email sent via Resend", {
      messageId: data.id,
      to: command.to,
      subject: command.subject,
    });

    return {
      messageId: data.id,
      provider: this.name,
    };
  }

  private async parseErrorBody(
    response: Response,
  ): Promise<ResendErrorResponse> {
    try {
      return (await response.json()) as ResendErrorResponse;
    } catch {
      return { message: response.statusText };
    }
  }
}
