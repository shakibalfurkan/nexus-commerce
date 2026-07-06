import type {
  CursorPaginationParams,
  CursorPaginationResult,
} from "../types/database.types.js";

// ─── Cursor Encoding / Decoding ───

const CURSOR_ENCODING = "base64url" as const;

export function encodeCursor(createdAt: Date, id: string): string {
  const cursorData = {
    createdAt: createdAt.toISOString(),
    id,
  };
  return Buffer.from(JSON.stringify(cursorData)).toString(CURSOR_ENCODING);
}

export function decodeCursor(cursor: string): { createdAt: Date; id: string } {
  try {
    const decoded = Buffer.from(cursor, CURSOR_ENCODING).toString("utf-8");
    const parsed = JSON.parse(decoded) as { createdAt: string; id: string };

    if (!parsed.createdAt || !parsed.id) {
      throw new Error("Invalid cursor format: missing required fields");
    }

    return {
      createdAt: new Date(parsed.createdAt),
      id: parsed.id,
    };
  } catch (error) {
    throw new Error(
      `Invalid cursor format. Cursor must be a valid base64url-encoded JSON object with 'createdAt' and 'id' fields.`,
    );
  }
}

export function buildCursorWhere(
  cursor: { createdAt: Date; id: string },
  additionalWhere: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    ...additionalWhere,
    OR: [
      {
        createdAt: { gt: cursor.createdAt },
      },
      {
        createdAt: cursor.createdAt,
        id: { gt: cursor.id },
      },
    ],
  };
}

export function paginateResult<T extends { createdAt: Date; id: string }>(
  results: T[],
  limit: number,
): CursorPaginationResult<T> {
  const hasMore = results.length > limit;

  const data = hasMore ? results.slice(0, limit) : results;

  const lastRecord = data[data.length - 1];
  const nextCursor = lastRecord
    ? encodeCursor(lastRecord.createdAt, lastRecord.id)
    : null;

  return {
    data,
    nextCursor,
    hasMore,
  };
}

export function parsePaginationParams(
  params: CursorPaginationParams,
): Required<CursorPaginationParams> {
  return {
    cursor: params.cursor ?? "",
    limit: Math.min(Math.max(params.limit, 1), 100),
  };
}
