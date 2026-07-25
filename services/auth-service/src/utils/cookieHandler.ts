import type { Response } from "express";
import config from "../config/index.js";

export const setCookie = (
  res: Response,
  tokenName: string,
  tokenValue: string,
  maxAge: number = 7 * 24 * 60 * 60 * 1000,
) => {
  const isProd = config.node_env === "production";

  const cookieOptions: Record<string, unknown> = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge,
    path: "/",
    priority: "high",
  };

  res.cookie(tokenName, tokenValue, cookieOptions);
};

export const clearCookie = (res: Response, tokenName: string): void => {
  const isProd = config.node_env === "production";

  res.clearCookie(tokenName, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? ("strict" as const) : "lax",
    path: "/",
  });
};
