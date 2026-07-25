import type { Request, Response, NextFunction } from "express";

const DANGEROUS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /data:text\/html/gi,
];

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(value)) {
        return escapeHtml(value);
      }
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value && typeof value === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      sanitized[key] = sanitizeValue(val);
    }
    return sanitized;
  }

  return value;
}

export function sanitizationMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeValue(req.body) as Record<string, unknown>;
  }

  if (req.query && typeof req.query === "object") {
    for (const [key, value] of Object.entries(req.query)) {
      const sanitized = sanitizeValue(value);
      if (typeof sanitized === "string") {
        req.query[key] = sanitized as string;
      }
    }
  }

  next();
}
