// ─── TTL Constants (in seconds) ───

export const TTL = {
  USER_PROFILE: 300, // 5 minutes

  USER_EXISTS: 600, // 10 minutes

  USER_ROLE: 3600, // 1 hour

  DEFAULT: 300, // 5 minutes

  NEGATIVE_CACHE: 60, // 1 minute
} as const;

// ─── Cache Key Builders ───

const SERVICE_PREFIX = "user-service" as const;

export function userProfileKey(userId: string): string {
  return `${SERVICE_PREFIX}:user:${userId}:profile`;
}

export function userEmailKey(email: string): string {
  const normalizedEmail = email.toLowerCase().trim();
  return `${SERVICE_PREFIX}:user:email:${normalizedEmail}`;
}

export function userExistsKey(identifier: string): string {
  return `${SERVICE_PREFIX}:user:exists:${identifier}`;
}

export function userListKey(
  cursor: string | undefined,
  filters: string,
): string {
  const cursorPart = cursor ?? "start";
  return `${SERVICE_PREFIX}:users:list:${cursorPart}:${filters}`;
}

export function negativeCacheKey(key: string): string {
  return `${key}:notfound`;
}
