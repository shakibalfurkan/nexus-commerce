import { CircuitBreakerError } from "@nexus/errors";

import config from "../config/index.js";
import logger from "../utils/logger.js";

/**
 * Circuit Breaker — Protects against cascading failures from external
 * dependencies (e.g. the Resend email API).
 *
 * State machine:
 *  CLOSED → normal operation. Failures are counted. When `failureThreshold`
 *  is reached, transition to OPEN.
 *  OPEN → all requests fast-fail with `CircuitBreakerError`. After
 *  `resetTimeoutMs`, transition to HALF_OPEN.
 *  HALF_OPEN → a single test request is allowed. If it succeeds, transition
 *  to CLOSED. If it fails, transition back to OPEN.
 *
 * The `shouldTrip` predicate determines which errors count as failures —
 * for the email provider, only `EmailProviderError` with `retryable: true`
 * (5xx, 429, network) should trip the breaker. Non-retryable 4xx errors are
 * client mistakes, not provider failures.
 *
 * In-memory state (per-instance). Acceptable for free-tier single-instance
 * deployment; for multi-instance, each instance has its own breaker which is
 * a safe local optimization.
 */

// ─── Types ───

export type CircuitBreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  /** Consecutive failures before opening the circuit. */
  failureThreshold: number;
  /** How long to stay OPEN before transitioning to HALF_OPEN (ms). */
  resetTimeoutMs: number;
  /**
   * Predicate: should this error count as a failure?
   * Default: all errors trip the breaker.
   */
  shouldTrip?: (error: unknown) => boolean;
}

// ─── Circuit Breaker ───

export class CircuitBreaker {
  private state: CircuitBreakerState = "CLOSED";
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly shouldTrip: (error: unknown) => boolean;

  constructor(options: CircuitBreakerOptions) {
    this.failureThreshold = options.failureThreshold;
    this.resetTimeoutMs = options.resetTimeoutMs;
    this.shouldTrip = options.shouldTrip ?? ((error: unknown) => true);
  }

  /** Current state of the breaker (for health checks / observability). */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Execute an async operation through the circuit breaker.
   *
   * @throws {CircuitBreakerError} when the circuit is OPEN (fast-fail).
   * @throws the original error if the operation fails.
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Check if we should transition from OPEN → HALF_OPEN.
    if (this.state === "OPEN") {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.resetTimeoutMs) {
        this.state = "HALF_OPEN";
        logger.warn("Circuit breaker transitioning OPEN → HALF_OPEN");
      } else {
        throw new CircuitBreakerError(
          "Circuit breaker is OPEN — external dependency unavailable",
        );
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      if (this.shouldTrip(error)) {
        this.onFailure();
      }
      throw error;
    }
  }

  /** Successful operation — reset failure count, close from HALF_OPEN. */
  private onSuccess(): void {
    if (this.state === "HALF_OPEN") {
      this.state = "CLOSED";
      this.failureCount = 0;
      logger.info("Circuit breaker CLOSED — external dependency recovered");
    }
  }

  /** Failed operation — increment count, open if threshold reached. */
  private onFailure(): void {
    this.lastFailureTime = Date.now();

    if (this.state === "HALF_OPEN") {
      this.state = "OPEN";
      logger.warn("Circuit breaker re-opened from HALF_OPEN");
      return;
    }

    this.failureCount++;
    if (this.failureCount >= this.failureThreshold) {
      this.state = "OPEN";
      logger.warn("Circuit breaker OPENED", {
        failureCount: this.failureCount,
        threshold: this.failureThreshold,
      });
    }
  }
}

// ─── Factory ───

/**
 * Create a `CircuitBreaker` from the service config.
 *
 * @param shouldTrip — predicate for which errors count as failures.
 *   If omitted, all errors trip the breaker.
 */
export function createCircuitBreaker(
  shouldTrip?: (error: unknown) => boolean,
): CircuitBreaker {
  return new CircuitBreaker({
    failureThreshold: config.resilience.circuitBreakerFailureThreshold,
    resetTimeoutMs: config.resilience.circuitBreakerResetTimeoutMs,
    // Conditional spread avoids passing `undefined` to an optional prop
    // (exactOptionalPropertyTypes: true).
    ...(shouldTrip !== undefined ? { shouldTrip } : {}),
  });
}
