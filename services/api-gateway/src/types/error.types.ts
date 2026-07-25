export interface TErrorSource {
  field: string | number;
  message: string;
  code?: string;
}

export interface TErrorResponse {
  success: false;
  message: string;
  errorType: string;
  errors: TErrorSource[];
  stack?: string;
  requestId?: string;
  timestamp?: string;
}
