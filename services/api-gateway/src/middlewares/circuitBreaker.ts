import type { Request, Response, NextFunction } from "express";
import config from "../config/index.js";
import { logger } from "../utils/logger.js";
import { ServiceUnavailableError } from "@nexus/errors";

interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: "CLOSED" | "OPEN" | "HALF_OPEN";
}

const services = new Map<string, CircuitBreakerState>();

const THRESHOLD = config.circuit_breaker_threshold;
const TIMEOUT = config.circuit_breaker_timeout;
const RESET_TIMEOUT = config.circuit_breaker_reset_timeout;

// ----- Internal Helpers ---------

const getOrCreate = (service: string): CircuitBreakerState => {
  if (!services.has(service)) {
    services.set(service, { failures: 0, lastFailureTime: 0, state: "CLOSED" });
  }
  return services.get(service)!;
};

const refreshState = (state: CircuitBreakerState): void => {
  const elapsed = Date.now() - state.lastFailureTime;

  if (state.state === "OPEN" && elapsed >= RESET_TIMEOUT) {
    state.state = "HALF_OPEN";
    state.failures = 0;
    logger.info("Circuit breaker → HALF_OPEN");
  }

  if (state.state === "CLOSED" && elapsed >= TIMEOUT && state.failures > 0) {
    state.failures = 0;
  }
};

// ─── Public Controls ─────

export const recordSuccess = (service: string): void => {
  const state = getOrCreate(service);

  if (state.state === "HALF_OPEN") {
    state.state = "CLOSED";
    state.failures = 0;
    logger.info("Circuit breaker → CLOSED (service recovered)", { service });
  }
};

export const recordFailure = (service: string): void => {
  const state = getOrCreate(service);

  state.failures++;
  state.lastFailureTime = Date.now();

  if (state.failures >= THRESHOLD) {
    state.state = "OPEN";
    logger.error("Circuit breaker → OPEN", {
      service,
      failures: state.failures,
    });
  }

  if (state.state === "HALF_OPEN") {
    state.state = "OPEN";
    logger.warn("Circuit breaker → OPEN (probe failed)", { service });
  }
};

export const isOpen = (service: string): boolean => {
  const state = getOrCreate(service);
  refreshState(state);
  return state.state === "OPEN";
};

export const getState = (service: string): CircuitBreakerState =>
  getOrCreate(service);

export const reset = (service?: string): void => {
  if (service) {
    services.delete(service);
    logger.info("Circuit breaker reset", { service });
  } else {
    services.clear();
    logger.info("All circuit breakers reset");
  }
};

// ─── Middleware ──────────

export const circuitBreakerMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const serviceMatch = req.path.match(/^\/([a-zA-Z0-9\-]+)-service\//);

  if (!serviceMatch) return next();

  const service = serviceMatch[1] as string;

  if (isOpen(service)) {
    logger.warn("Request blocked by circuit breaker", {
      service,
      method: req.method,
      path: req.path,
    });

    next(
      new ServiceUnavailableError(
        "Service temporarily unavailable due to high failure rate.",
      ),
    );
    return;
  }

  const originalJson = res.json.bind(res);
  res.json = function (body) {
    if (res.statusCode >= 500) {
      recordFailure(service);
    } else {
      recordSuccess(service);
    }
    return originalJson(body);
  };

  next();
};
