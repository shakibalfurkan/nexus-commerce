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

export class BadRequestError extends AppError {
  constructor(message = "Bad request", field?: string) {
    super(400, message, true, field);
    this.name = "BadRequestError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized access", field?: string) {
    super(401, message, true, field);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden resource", field?: string) {
    super(403, message, true, field);
    this.name = "ForbiddenError";
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

export class ValidationError extends AppError {
  constructor(message = "Validation failed", field?: string) {
    super(422, message, true, field);
    this.name = "ValidationError";
  }
}

export class InternalServerError extends AppError {
  constructor(message = "Internal server error", field?: string) {
    super(500, message, false, field);
    this.name = "InternalServerError";
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = "Service temporarily unavailable", field?: string) {
    super(503, message, true, field);
    this.name = "ServiceUnavailableError";
  }
}
