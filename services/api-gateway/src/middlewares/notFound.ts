import type { Request, Response, NextFunction } from "express";
import { NotFoundError } from "../errors/AppError.js";
import logger from "../utils/logger.js";

export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  logger.warn({
    message: "Route not found",
    path: req.originalUrl,
    method: req.method,
    ip: req.ip,
  });

  const error = new NotFoundError(
    `Route ${req.method} ${req.originalUrl} not found`,
  );
  next(error);
};

export default notFoundHandler;
