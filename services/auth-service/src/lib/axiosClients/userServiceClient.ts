import axios, { type AxiosInstance, AxiosError } from "axios";
import config from "../../config/index.js";
import logger from "../../utils/logger.js";
import { ServiceUnavailableError } from "@nexus/errors";
import { CircuitBreaker } from "../../cache/circuitBreaker.js";
import createInternalSignature from "../../utils/createInternalSignature.js";
import { UserRoles } from "../../generated/prisma/enums.js";

declare module "axios" {
  interface InternalAxiosRequestConfig {
    metadata?: {
      startTime?: number;
      retryCount?: number;
    };
  }
}

/**
 * Internal client for user-service — the source of truth for user state.
 *
 * auth-service NEVER reads or writes user-service's database; profiles are
 * created through these signed internal endpoints (HMAC over the exact request
 * body + a 5-minute timestamp window, verified by user-service's
 * `verifyInternalCall`).
 *
 * One endpoint per role, mirroring user-service's role-split profile routes, so
 * no role branching lives in this client.
 */

export type TProvisionableRole =
  | typeof UserRoles.CUSTOMER
  | typeof UserRoles.SELLER
  | typeof UserRoles.ADMIN;

/** user-service mounts one router per role, so each role owns its own prefix. */
const PROFILE_ENDPOINTS: Record<TProvisionableRole, string> = {
  CUSTOMER: "/customers/profile",
  SELLER: "/sellers/profile",
  ADMIN: "/admins/profile",
};

export interface CreateUserProfileInput {
  id: string;
  email: string;
  role: TProvisionableRole;
  /** Role-specific profile fields (no role key — the endpoint selects the role). */
  profile: Record<string, unknown>;
}

const createUserServiceClient = (): AxiosInstance =>
  axios.create({
    baseURL: config.user_service_url!,
    timeout: 10_000,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },

    httpAgent: {
      keepAlive: true,
      maxSockets: 50,
      maxFreeSockets: 10,
      timeout: 60_000,
      freeSocketTimeout: 30_000,
    },
    httpsAgent: {
      keepAlive: true,
      maxSockets: 50,
      maxFreeSockets: 10,
      timeout: 60_000,
      freeSocketTimeout: 30_000,
    },
  });

const userServiceClient = createUserServiceClient();

// --- Request Interceptor --------------------------------------------------------

userServiceClient.interceptors.request.use(
  (cfg) => {
    cfg.metadata = { startTime: Date.now() };

    logger.info("→ User Service request", {
      method: cfg.method?.toUpperCase(),
      url: cfg.url,
      requestId: cfg.headers["X-Request-ID"],
    });

    return cfg;
  },
  (err) => {
    logger.error("Request setup failed", { error: err?.message });
    return Promise.reject(err);
  },
);

// --- Response Interceptor ----------------------------------------------------------

userServiceClient.interceptors.response.use(
  (response) => {
    const responseTime =
      Date.now() - (response.config.metadata?.startTime ?? Date.now());

    logger.info("← User Service response", {
      status: response.status,
      url: response.config.url,
      responseTime: `${responseTime}ms`,
      requestId: response.config.headers["X-Request-ID"],
    });

    return response;
  },

  async (err: AxiosError) => {
    const requestId = err.config?.headers["X-Request-ID"] as string;
    const retryCount = (err.config?.metadata?.retryCount ?? 0) as number;
    const MAX_RETRIES = 3;

    logger.error("User Service error", {
      status: err.response?.status,
      message: err.message,
      url: err.config?.url,
      requestId,
      retryCount,
    });

    // retry on transient / rate-limit / server errors with exponential back-off
    const isRetryable = [408, 429, 500, 502, 503, 504].includes(
      err.response?.status ?? 0,
    );

    if (retryCount < MAX_RETRIES && err.response?.status && isRetryable) {
      const backoff = Math.pow(2, retryCount) * 1000;

      logger.warn("Retrying User Service request", {
        requestId,
        attempt: retryCount + 1,
        backoff,
      });

      await new Promise((resolve) => setTimeout(resolve, backoff));

      if (err.config) {
        err.config.metadata = {
          ...err.config.metadata,
          retryCount: retryCount + 1,
        };
        return userServiceClient.request(err.config);
      }
    }

    // log specific failure modes for easier debugging
    if (err.response?.status === 401)
      logger.error("Unauthorized access to User Service", { requestId });
    if (err.code === "ECONNABORTED")
      logger.error("User Service request timed out", { requestId });

    return Promise.reject(err);
  },
);

const userServiceCircuitBreaker = new CircuitBreaker({
  name: "UserServiceCircuitBreaker",
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const internalHeaders = (signature: string, timestamp: string, requestId: string) => ({
  "X-Internal-Signature": signature,
  "X-Internal-Timestamp": timestamp,
  "X-Request-ID": requestId,
});

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Creates the account owner's profile in user-service.
 *
 * Resolves only when user-service confirmed the write; every failure (including
 * an open circuit) surfaces as `ServiceUnavailableError` so callers can roll
 * back the credential they just created instead of reporting a false success.
 */
export const createUserProfile = async (
  input: CreateUserProfileInput,
  requestId: string,
): Promise<void> => {
  const requestBody = {
    id: input.id,
    email: input.email,
    profile: input.profile,
  };

  const timestamp = Date.now().toString();
  const signature = createInternalSignature(
    "POST",
    PROFILE_ENDPOINTS[input.role],
    requestBody,
    timestamp,
    config.internal_service_secret,
  );

  return userServiceCircuitBreaker.execute(async () => {
    try {
      const response = await userServiceClient.post(
        PROFILE_ENDPOINTS[input.role],
        requestBody,
        { headers: internalHeaders(signature, timestamp, requestId) },
      );

      logger.info("User profile created", {
        requestId,
        userId: response.data?.id,
        role: input.role,
      });
    } catch (error) {
      logger.error("Failed to create user profile", {
        requestId,
        role: input.role,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new ServiceUnavailableError(
        "Failed to create user profile. Please try again later.",
        "userService",
      );
    }
  });
};

export const restoreUser = async (userId: string, requestId = "restore"): Promise<void> => {
  const path = `/users/${userId}/restore`;
  const body = {};
  const timestamp = Date.now().toString();
  const signature = createInternalSignature(
    "POST",
    path,
    body,
    timestamp,
    config.internal_service_secret!,
  );
  await userServiceClient.post(path, body, {
    headers: {
      "X-Internal-Signature": signature,
      "X-Internal-Timestamp": timestamp,
      "X-Request-ID": requestId,
    },
  });
};
