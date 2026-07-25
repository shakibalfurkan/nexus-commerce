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
  requestId: string;
  stack?: string;
  timestamp?: string;
}
