import type { ZodObject } from "zod";
import type { NextFunction, Request, Response } from "express";
import catchAsync from "../utils/catchAsync.js";

const validateRequest = (schema: ZodObject) => {
  return catchAsync(
    async (req: Request, _res: Response, next: NextFunction) => {
      await schema.parseAsync({ body: req.body });
      next();
    },
  );
};

export default validateRequest;
