import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

import type { TErrorResponse, TErrorSource } from "../types/error.types.js";
// import { logger } from "../lib/logger.js";
import config from "../config/index.js";
import { Prisma } from "../generated/prisma/client.js";
import handleZodError from "../errors/handleZodError.js";
import { AppError } from "../errors/AppError.js";
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

  //! Handle Zod Validation Errors
  if (err instanceof ZodError) {
    const simplifiedError = handleZodError(err);

    statusCode = simplifiedError.statusCode;
    message = simplifiedError.message;
    errorType = simplifiedError.errorType;
    errorSources = simplifiedError.errorSources;
    isOperational = simplifiedError.isOperational;
  }

  //! Handle Prisma Errors
  else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    isOperational = true;

    switch (err.code) {
      //! Unique constraint violation
      case "P2002":
        statusCode = 409;
        message = "Resource already exists";
        errorType = "DuplicateError";
        const target = err.meta?.target as string[];
        errorSources = [
          {
            field: target?.[0] || "unknown",
            message: `${target?.[0] || "Field"} already exists`,
            code: err.code,
          },
        ];
        break;

      //! Record not found
      case "P2025":
        statusCode = 404;
        message = "Resource not found";
        errorType = "NotFoundError";
        errorSources = [
          {
            field: "id",
            message: (err.meta?.cause as string) || "Record not found",
            code: err.code,
          },
        ];
        break;

      //! Foreign key constraint failed
      case "P2003":
        statusCode = 400;
        message = "Invalid reference";
        errorType = "ForeignKeyError";
        errorSources = [
          {
            field: (err.meta?.field_name as string) || "reference",
            message: "Referenced record does not exist",
            code: err.code,
          },
        ];
        break;

      //! Required field missing
      case "P2011":
        statusCode = 400;
        message = "Null constraint violation";
        errorType = "ValidationError";
        errorSources = [
          {
            field: (err.meta?.constraint as string) || "unknown",
            message: "Required field is missing",
            code: err.code,
          },
        ];
        break;

      //! Invalid value for field type
      case "P2006":
        statusCode = 400;
        message = "Invalid data type";
        errorType = "ValidationError";
        errorSources = [
          {
            field: (err.meta?.column_name as string) || "unknown",
            message: `Invalid value provided for ${err.meta?.column_name || "field"}`,
            code: err.code,
          },
        ];
        break;

      //! Database connection error
      case "P1001":
      case "P1002":
      case "P1008":
        statusCode = 503;
        message = "Database connection failed";
        errorType = "DatabaseError";
        isOperational = false;
        errorSources = [
          {
            field: "database",
            message: "Unable to connect to database",
            code: err.code,
          },
        ];
        break;

      //! Query timeout
      case "P2024":
        statusCode = 408;
        message = "Request timeout";
        errorType = "TimeoutError";
        errorSources = [
          {
            field: "query",
            message: "Database operation timed out",
            code: err.code,
          },
        ];
        break;

      default:
        statusCode = 400;
        message = "Database operation failed";
        errorType = "DatabaseError";
        errorSources = [
          {
            field: "database",
            message: err.message,
            code: err.code,
          },
        ];
    }
  }

  //! Handle Prisma Validation Errors
  else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    message = "Invalid query parameters";
    errorType = "ValidationError";
    isOperational = true;
    errorSources = [
      {
        field: "query",
        message: "Invalid data provided to database query",
      },
    ];
  }

  //! Handle Prisma Initialization Errors
  else if (err instanceof Prisma.PrismaClientInitializationError) {
    statusCode = 503;
    message = "Database initialization failed";
    errorType = "DatabaseError";
    isOperational = false;
    errorSources = [
      {
        field: "database",
        message: "Failed to initialize database connection",
        code: err.errorCode as string,
      },
    ];
  }

  //! Handle Redis Errors
  else if (err.name === "RedisError" || err.message?.includes("Redis")) {
    statusCode = 503;
    message = "Cache service unavailable";
    errorType = "CacheError";
    isOperational = true;
    errorSources = [
      {
        field: "cache",
        message: "Redis operation failed - operating in degraded mode",
      },
    ];
  }

  //! Handle Custom Application Errors
  else if (err instanceof AppError) {
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

  //! Handle JWT Errors
  else if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid authentication token";
    errorType = "AuthenticationError";
    isOperational = true;
    errorSources = [
      {
        field: "token",
        message: "Token is malformed or invalid",
      },
    ];
  } else if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Authentication token expired";
    errorType = "AuthenticationError";
    isOperational = true;
    errorSources = [
      {
        field: "token",
        message: "Token has expired, please login again",
      },
    ];
  }

  //! Handle Multer Errors (File Upload)
  else if (err.name === "MulterError") {
    statusCode = 400;
    message = "File upload failed";
    errorType = "FileUploadError";
    isOperational = true;
    errorSources = [
      {
        field: "file",
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
