// Rate limits
export const THROTTLE = {
  AUTH: { default: { limit: 5, ttl: 60_000 } },
  EMAIL_SEND: { default: { limit: 3, ttl: 60_000 } },
} as const;
