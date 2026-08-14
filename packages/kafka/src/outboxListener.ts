import { Client, escapeIdentifier, type ClientConfig } from "pg";
import type { Logger } from "@nexus/logger";
import { calculateBackoff, sleep } from "./backoff.js";

export interface OutboxListenerOptions {
  /** Postgres connection string for the outbox database. */
  connectionString: string;
  /** Postgres NOTIFY channel. Defaults to "outbox_channel". */
  channel?: string;
  /** Base delay for reconnect backoff (ms). Default 1s. */
  baseBackoffMs?: number;
  /** Cap for reconnect backoff (ms). Default 30s. */
  maxBackoffMs?: number;
  /**
   * Max consecutive reconnect attempts before the listener gives up and logs
   * an error (fallback poll remains the durability net). Default 10.
   */
  maxReconnectAttempts?: number;
}

export const DEFAULT_OUTBOX_LISTENER_OPTIONS = {
  channel: "outbox_channel",
  baseBackoffMs: 1_000,
  maxBackoffMs: 30_000,
  maxReconnectAttempts: 10,
} as const;

export interface OutboxListenerHandlers {
  /** Called with the notified event id (the trigger sends `NEW.id::text`). */
  onEvent: (eventId: string) => Promise<void> | void;
  /** Optional observability hooks. */
  onError?: (error: Error) => void;
  onReconnect?: (attempt: number, delayMs: number) => void;
}

/**
 * Postgres LISTEN/NOTIFY listener — the PRIMARY trigger for draining the
 * outbox. The per-service trigger fires `pg_notify('outbox_channel', id)` on
 * insert; this client receives those ids and hands them to the poller.
 *
 * WHY this exists alongside the interval poller: NOTIFY is fire-and-forget. If
 * the listener is disconnected when a row is inserted, that NOTIFY is dropped.
 * The outbox poller's slow interval is the safety net that re-scans for
 * PENDING rows and guarantees no message is lost even during a listener blip.
 */
export class OutboxListener {
  private readonly clientConfig: ClientConfig;
  private readonly channel: string;
  private readonly baseBackoffMs: number;
  private readonly maxBackoffMs: number;
  private readonly maxReconnectAttempts: number;
  private readonly handlers: OutboxListenerHandlers;
  private readonly logger: Logger;

  private client: Client | null = null;
  private shouldRun = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    options: OutboxListenerOptions,
    handlers: OutboxListenerHandlers,
    logger: Logger,
  ) {
    this.clientConfig = { connectionString: options.connectionString };
    this.channel = options.channel ?? DEFAULT_OUTBOX_LISTENER_OPTIONS.channel;
    this.baseBackoffMs =
      options.baseBackoffMs ?? DEFAULT_OUTBOX_LISTENER_OPTIONS.baseBackoffMs;
    this.maxBackoffMs =
      options.maxBackoffMs ?? DEFAULT_OUTBOX_LISTENER_OPTIONS.maxBackoffMs;
    this.maxReconnectAttempts =
      options.maxReconnectAttempts ??
      DEFAULT_OUTBOX_LISTENER_OPTIONS.maxReconnectAttempts;
    this.handlers = handlers;
    this.logger = logger;
  }

  /** Begin listening. Resolves once LISTEN is active (or after a dropped initial connect). */
  async start(): Promise<void> {
    if (this.shouldRun) return;
    this.shouldRun = true;
    this.reconnectAttempt = 0;
    await this.connectWithRetry();
  }

  /**
   * Clean shutdown: UNLISTEN so the server stops sending notifications for
   * this session, then close the connection. Safe to call when not connected.
   */
  async stop(): Promise<void> {
    this.shouldRun = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (!this.client) return;

    const client = this.client;
    this.client = null;
    try {
      await client.query(`UNLISTEN ${escapeIdentifier(this.channel)}`);
    } catch (error) {
      this.logger.warn("[OutboxListener] Error during UNLISTEN", error);
    }
    try {
      await client.end();
    } catch (error) {
      this.logger.warn("[OutboxListener] Error closing connection", error);
    }
  }

  /** Connect, fail, back off, retry — until success, shutdown, or attempts exhausted. */
  private async connectWithRetry(): Promise<void> {
    while (this.shouldRun) {
      try {
        await this.connectOnce();
        return;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.handlers.onError?.(err);
        if (!this.shouldRun) return;

        this.reconnectAttempt += 1;
        if (this.reconnectAttempt > this.maxReconnectAttempts) {
          // Give up so we never retry infinitely. The poller's fallback interval
          // still covers durability while the listener is down.
          this.logger.error(
            `[OutboxListener] Gave up after ${this.reconnectAttempt} reconnect attempts`,
            err,
          );
          return;
        }

        const delayMs = calculateBackoff(
          this.reconnectAttempt - 1,
          this.baseBackoffMs,
          this.maxBackoffMs,
        );
        this.handlers.onReconnect?.(this.reconnectAttempt, delayMs);
        this.logger.warn(
          `[OutboxListener] Reconnecting (attempt ${this.reconnectAttempt}/${this.maxReconnectAttempts}) in ${delayMs}ms`,
        );
        await sleep(delayMs);
      }
    }
  }

  private async connectOnce(): Promise<void> {
    const client = new Client(this.clientConfig);
    await client.connect();
    await client.query(`LISTEN ${escapeIdentifier(this.channel)}`);

    this.client = client;
    this.reconnectAttempt = 0;
    this.logger.info(`[OutboxListener] Listening on "${this.channel}"`);

    client.on("notification", (message) => {
      // The trigger payload is the outbox row id (NEW.id::text). Empty payload
      // is malformed — surface it on the error hook rather than silently drop.
      if (!message.payload) {
        this.handlers.onError?.(
          new Error(`Empty NOTIFY payload on channel "${this.channel}"`),
        );
        return;
      }
      // Fire-and-forget the handler; a failure is observability, not a crash.
      void Promise.resolve(this.handlers.onEvent(message.payload)).catch(
        (err: unknown) =>
          this.handlers.onError?.(
            err instanceof Error ? err : new Error(String(err)),
          ),
      );
    });

    // After a successful connect, pg reports connection loss via 'error' and
    // 'end'. Schedule a reconnect for either.
    client.on("error", (err) => {
      this.handlers.onError?.(err);
      this.scheduleReconnectAfterDrop();
    });
    client.on("end", () => {
      this.scheduleReconnectAfterDrop();
    });
  }

  /** Schedule a single reconnection attempt with backoff after a connection drop. */
  private scheduleReconnectAfterDrop(): void {
    if (!this.shouldRun || this.reconnectTimer) return;
    if (this.reconnectAttempt >= this.maxReconnectAttempts) {
      this.logger.error(
        `[OutboxListener] Reconnect attempts exhausted (${this.reconnectAttempt})`,
      );
      return;
    }

    this.reconnectAttempt += 1;
    const delayMs = calculateBackoff(
      this.reconnectAttempt - 1,
      this.baseBackoffMs,
      this.maxBackoffMs,
    );
    this.handlers.onReconnect?.(this.reconnectAttempt, delayMs);
    this.logger.warn(
      `[OutboxListener] Connection lost. Reconnecting (attempt ${this.reconnectAttempt}/${this.maxReconnectAttempts}) in ${delayMs}ms`,
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.client = null;
      void this.connectWithRetry().catch((err: unknown) =>
        this.handlers.onError?.(
          err instanceof Error ? err : new Error(String(err)),
        ),
      );
    }, delayMs);
  }
}
