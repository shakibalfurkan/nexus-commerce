import type { ErrorRequestHandler } from "express";

// import { logger } from "../lib/logger.js";
import config from "../config/index.js";
import { AppError } from "../errors/AppError.js";
import type { TErrorResponse, TErrorSource } from "../types/error.types.js";
import logger from "../utils/logger.js";

const globalErrorHandler: ErrorRequestHandler = (
  err,
  req,
  res,
  _next,
): void => {
  //! Default error response
  let statusCode = 500;
  let message = "Internal server error";
  let errorSources: TErrorSource[] = [
    {
      field: "unknown",
      message: "An unexpected error occurred",
    },
  ];
  let errorType = "UnknownError";
  let isOperational = false;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    errorType = err.name;
    isOperational = err.isOperational;
    errorSources = [
      {
        field: err.field || "application",
        message: err.message,
      },
    ];
  }

  //! Handle Generic Errors
  else if (err instanceof Error) {
    message = err.message;
    errorSources = [
      {
        field: "server",
        message: err.message,
      },
    ];
  }

  //* Construct error response
  const errorResponse: TErrorResponse = {
    success: false,
    message,
    errorType,
    errors: errorSources,
    requestId: req.requestId!,
    timestamp: new Date().toISOString(),
    ...(config.node_env === "development" && { stack: err?.stack }),
  };

  //* Log error with appropriate level
  const logMetadata = {
    statusCode,
    errorType,
    isOperational,
    method: req.method,
    path: req.path,
    ip: (req.headers["x-forwarded-for"] as string) || req.ip,
    requestId: req.requestId,
  };

  if (statusCode >= 500) {
    logger.error({
      message: `${message} - ${err?.message}`,
      error: err,
      stack: err.stack,
      ...logMetadata,
    });
  } else if (statusCode >= 400) {
    logger.warn({
      message: `${message} - ${err?.message}`,
      ...logMetadata,
    });
  }

  // Handle non-operational errors (programmer errors)
  if (!isOperational) {
    logger.error({
      message: "Non-operational error occurred - this should be investigated",
      error: err,
      ...logMetadata,
    });

    // In production, don't expose internal error details
    if (config.node_env === "production") {
      errorResponse.message = "Internal server error";
      errorResponse.errors = [
        {
          field: "server",
          message: "An unexpected error occurred",
        },
      ];
      delete errorResponse.stack;
    }
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

export default globalErrorHandler;
