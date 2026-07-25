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
  stack?: string;
  timestamp?: string;
}
