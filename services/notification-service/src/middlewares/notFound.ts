import type { Request, Response, NextFunction } from "express";
import { NotFoundError } from "../errors/AppError.js";

export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const error = new NotFoundError(
    `Route ${req.method} ${req.originalUrl} not found`,
  );
  next(error);
};

export default notFoundHandler;
