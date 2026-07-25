import axios, { type AxiosInstance, AxiosError } from "axios";
import config from "../../config/index.js";
import logger from "../../utils/logger.js";
import { ServiceUnavailableError } from "../../errors/AppError.js";
import { CircuitBreaker } from "../../cache/circuitBreaker.js";

declare module "axios" {
  interface InternalAxiosRequestConfig {
    metadata?: {
      startTime?: number;
      retryCount?: number;
    };
  }
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

export const internalHeaders = (signature: string, requestId: string) => ({
  "X-Internal-Signature": signature,
  "X-Internal-Timestamp": Date.now().toString(),
  "X-Request-ID": requestId,
});

// ─── Public API ───────────────────────────────────────────────────────────────

export const createUserProfile = async (
  requestBody: Record<string, unknown>,
  signature: string,
  requestId: string,
) => {
  userServiceCircuitBreaker.execute(async () => {
    try {
      const response = await userServiceClient.post(
        "/users/create-profile",
        requestBody,
        { headers: internalHeaders(signature, requestId) },
      );

      logger.info("User profile created", {
        requestId,
        userId: response.data?.id,
      });

      return response.data;
    } catch (error) {
      logger.error("Failed to create user profile", {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new ServiceUnavailableError(
        "Failed to create user profile. Please try again later.",
        "userService",
      );
    }
  });
};

export default userServiceClient;
