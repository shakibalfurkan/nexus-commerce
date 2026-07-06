import { CircuitBreakerError } from "../errors/AppError.js";
import logger from "../utils/logger.js";

// ─── Types ───

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  name: string;
  failureThreshold: number;
  failureWindowMs: number;
  resetTimeoutMs: number;
  halfOpenMaxRetries: number;
  enableLogging?: boolean;
}

interface CircuitStateInternal {
  state: CircuitState;
  failureCount: number;
  lastFailureTime: number;
  lastStateChange: number;
  halfOpenAttempts: number;
  consecutiveSuccesses: number;
}

// ─── Default Options ───

const DEFAULT_OPTIONS: Required<CircuitBreakerOptions> = {
  name: "unnamed-circuit-breaker",
  failureThreshold: 5,
  failureWindowMs: 10_000,
  resetTimeoutMs: 30_000,
  halfOpenMaxRetries: 3,
  enableLogging: true,
};

// ─── Circuit Breaker Class ───

export class CircuitBreaker {
  private state: CircuitStateInternal;
  private readonly options: Required<CircuitBreakerOptions>;
  private readonly failureTimestamps: number[] = [];

  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.state = {
      state: "CLOSED",
      failureCount: 0,
      lastFailureTime: 0,
      lastStateChange: Date.now(),
      halfOpenAttempts: 0,
      consecutiveSuccesses: 0,
    };
  }

  getState(): CircuitState {
    return this.state.state;
  }

  getMetrics() {
    return {
      name: this.options.name,
      state: this.state.state,
      failureCount: this.state.failureCount,
      failureTimestamps: this.failureTimestamps.length,
      halfOpenAttempts: this.state.halfOpenAttempts,
      consecutiveSuccesses: this.state.consecutiveSuccesses,
      lastFailureTime: this.state.lastFailureTime,
      lastStateChange: this.state.lastStateChange,
      uptime: Date.now() - this.state.lastStateChange,
    };
  }

  /**
   * Executes a protected async function with circuit breaker logic.
   *
   * @param fn - The async function to protect
   * @param fallback - Optional fallback function to call when circuit is OPEN
   * @returns The result of the function or fallback
   * @throws {CircuitBreakerError} If circuit is OPEN and no fallback provided
   */
  async execute<T>(
    fn: () => Promise<T>,
    fallback?: () => Promise<T>,
  ): Promise<T> {
    this.pruneFailureTimestamps();

    if (this.state.state === "OPEN") {
      if (
        Date.now() - this.state.lastStateChange >=
        this.options.resetTimeoutMs
      ) {
        // Transition to HALF_OPEN
        this.transitionTo("HALF_OPEN");
        this.log(`Circuit transitioning to HALF_OPEN after reset timeout`);
      } else {
        // Circuit is OPEN — fail fast
        if (fallback) {
          return fallback();
        }
        throw new CircuitBreakerError(
          `Circuit breaker is OPEN for "${this.options.name}". ` +
            `Failing fast to prevent cascading failure.`,
        );
      }
    }

    if (this.state.state === "HALF_OPEN") {
      if (this.state.halfOpenAttempts >= this.options.halfOpenMaxRetries) {
        this.transitionTo("OPEN");
        this.state.halfOpenAttempts = 0;
        this.log(
          `Circuit returning to OPEN after ${this.options.halfOpenMaxRetries} failed HALF_OPEN attempts`,
        );
        if (fallback) {
          return fallback();
        }
        throw new CircuitBreakerError(
          `Circuit breaker is OPEN for "${this.options.name}" after failed HALF_OPEN attempts.`,
        );
      }
      this.state.halfOpenAttempts++;
    }

    try {
      const result = await fn();

      // Success — reset failure count if in HALF_OPEN
      if (this.state.state === "HALF_OPEN") {
        this.state.consecutiveSuccesses++;
        if (this.state.consecutiveSuccesses >= 2) {
          this.transitionTo("CLOSED");
          this.state.halfOpenAttempts = 0;
          this.state.consecutiveSuccesses = 0;
          this.log(`Circuit recovered and transitioned to CLOSED`);
        }
      } else {
        this.state.failureCount = 0;
      }

      return result;
    } catch (error) {
      this.recordFailure();

      if (this.state.state === "HALF_OPEN") {
        this.transitionTo("OPEN");
        this.log(`HALF_OPEN probe failed, circuit returning to OPEN`);
      }

      throw error;
    }
  }

  forceState(state: CircuitState): void {
    this.transitionTo(state);
    this.log(`Circuit manually forced to ${state}`);
  }

  // ─── Private Methods ───

  private recordFailure(): void {
    const now = Date.now();
    this.failureTimestamps.push(now);
    this.state.lastFailureTime = now;
    this.state.failureCount = this.failureTimestamps.length;

    if (
      this.state.state === "CLOSED" &&
      this.failureTimestamps.length >= this.options.failureThreshold
    ) {
      this.transitionTo("OPEN");
      this.log(
        `Failure threshold (${this.options.failureThreshold}) reached. Circuit OPEN.`,
      );
    }
  }

  private pruneFailureTimestamps(): void {
    const cutoff = Date.now() - this.options.failureWindowMs;
    while (
      this.failureTimestamps.length > 0 &&
      this.failureTimestamps[0]! < cutoff
    ) {
      this.failureTimestamps.shift();
    }
    this.state.failureCount = this.failureTimestamps.length;
  }

  private transitionTo(newState: CircuitState): void {
    this.state.state = newState;
    this.state.lastStateChange = Date.now();

    if (newState === "CLOSED") {
      this.failureTimestamps.length = 0;
      this.state.failureCount = 0;
      this.state.halfOpenAttempts = 0;
      this.state.consecutiveSuccesses = 0;
    }
  }

  private log(message: string): void {
    if (this.options.enableLogging) {
      logger.warn(`[CircuitBreaker:${this.options.name}] ${message}`, {
        state: this.state.state,
        failureCount: this.state.failureCount,
      });
    }
  }
}
