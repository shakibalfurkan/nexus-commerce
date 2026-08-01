import { ZodError } from "zod";

// ─── Error Response Types (shared across all services) ───

export interface TErrorSource {
  field: string | number;
  message: string;
  code?: string;
}

export interface TSimplifiedError {
  statusCode: number;
  message: string;
  errorType: string;
  isOperational: boolean;
  errorSources: TErrorSource[];
}

export interface TErrorResponse {
  success: false;
  message: string;
  errorType: string;
  errors: TErrorSource[];
  requestId?: string;
  stack?: string;
  timestamp?: string;
}

// ─── Zod Error Handler (shared across services) ───

export function handleZodError(err: ZodError): TSimplifiedError {
  const errorSources: TErrorSource[] = err.issues.map((issue) => {
    return {
      field: issue?.path[issue.path.length - 1] as string,
      message: issue.message,
      code: issue.code,
    };
  });
  const statusCode = 400;
  return {
    statusCode,
    message: "Validation failed",
    errorType: "ValidationError",
    isOperational: true,
    errorSources,
  };
}
