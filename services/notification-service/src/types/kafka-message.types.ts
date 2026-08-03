import { ValidationError } from "@nexus/errors";
import {
  DomainEventSchema,
  type TDomainEvent,
} from "../events/domain-event.schemas.js";

/**
 * Typed container that binds a validated Kafka event body to its trace
 * context. Trace metadata (`traceparent`) travels in the Kafka message
 * HEADERS — not the JSON body — so consumers must bind the two together at
 * the boundary. This type deliberately references only primitive header
 * values so no vendor SDK (kafkajs) leaks into core logic.
 */

export interface KafkaMessageHeaders {
  [key: string]: unknown;
}

export interface IncomingNotificationMessage {
  event: TDomainEvent;
  /** W3C traceparent, propagated verbatim from the Kafka message headers. */
  traceparent?: string;
  /**
   * Logical correlation ID for this message. Populated from the
   * `correlationId`/`correlation-id` header when present; falls back to the
   * event's `aggregateId` (the only per-event UUID on the wire today).
   */
  correlationId: string;
}

const TRACEPARENT_HEADER = "traceparent";
const CORRELATION_ID_HEADERS = ["correlationid", "correlation-id"] as const;

export function readHeader(
  headers: KafkaMessageHeaders,
  key: string,
): string | undefined {
  const raw = headers[key];
  if (raw === undefined || raw === null) {
    return undefined;
  }
  // KafkaJS delivers header values as Buffer by default; tolerate strings too.
  return raw instanceof Uint8Array ? raw.toString() : String(raw);
}

/**
 * Parses and validates an incoming Kafka message at the consumer boundary.
 * Throws {@link ValidationError} for malformed JSON or a payload that does
 * not match the registered domain-event envelope.
 */
export function parseKafkaMessage(
  value: string | null | undefined,
  headers: KafkaMessageHeaders = {},
): IncomingNotificationMessage {
  let raw: unknown;
  try {
    raw = value ? JSON.parse(value) : undefined;
  } catch {
    throw new ValidationError("Kafka message is not valid JSON");
  }

  const parsed = DomainEventSchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new ValidationError(
      `Kafka event failed schema validation: ${details}`,
    );
  }

  const traceparent = readHeader(headers, TRACEPARENT_HEADER);
  const correlationId =
    CORRELATION_ID_HEADERS.map((header) => readHeader(headers, header)).find(
      (value): value is string => value !== undefined,
    ) ?? parsed.data.aggregateId;

  const message: IncomingNotificationMessage = {
    event: parsed.data,
    correlationId,
  };
  if (traceparent !== undefined) {
    message.traceparent = traceparent;
  }
  return message;
}
