export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly field?: string | undefined;
  public readonly timestamp: string;

  constructor(
    statusCode: number,
    message: string,
    isOperational = true,
    field?: string,
  ) {
    super(message);

    this.statusCode = statusCode;
    this.isOperational = isOperational;

    this.field = field;

    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found", field?: string) {
    super(404, message, true, field);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource conflict", field?: string) {
    super(409, message, true, field);
    this.name = "ConflictError";
  }
}

export class InternalServerError extends AppError {
  constructor(message = "Internal server error", field?: string) {
    super(500, message, false, field);
    this.name = "InternalServerError";
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = "Too many requests", field?: string) {
    super(429, message, true, field);
    this.name = "TooManyRequestsError";
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = "Service temporarily unavailable", field?: string) {
    super(503, message, true, field);
    this.name = "ServiceUnavailableError";
  }
}

export class GatewayTimeoutError extends AppError {
  constructor(message = "Gateway timeout", field?: string) {
    super(504, message, true, field);
    this.name = "GatewayTimeoutError";
  }
}
