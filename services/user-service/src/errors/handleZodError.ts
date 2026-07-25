import { ZodError } from "zod";
import type { TErrorSource, TSimplifiedError } from "../types/error.types.js";

const handleZodError = (err: ZodError): TSimplifiedError => {
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
};

export default handleZodError;
