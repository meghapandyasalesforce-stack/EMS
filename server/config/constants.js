/**
 * Application Constants
 * Centralized configuration constants to avoid magic numbers
 */

// Password hashing
export const BCRYPT_SALT_ROUNDS = 10;

// Account lockout configuration
export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours

// Token expiration defaults (can be overridden by env vars)
export const DEFAULT_JWT_ACCESS_EXPIRE = '1h';
export const DEFAULT_JWT_REFRESH_EXPIRE = '30d';

// Password reset token
export const PASSWORD_RESET_TOKEN_EXPIRE_MS = 24 * 60 * 60 * 1000; // 24 hours
export const PASSWORD_RESET_TOKEN_BYTES = 32;

// File upload limits
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_FILE_SIZE_MB = 5;

// Rate limiting defaults (overridable via RATE_LIMIT_WINDOW_MS / RATE_LIMIT_MAX_REQUESTS)
export const DEFAULT_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 2000; // SPA-friendly; admin dashboards fire many GETs
export const LOGIN_RATE_LIMIT_MAX = 5;
export const PASSWORD_RESET_RATE_LIMIT_MAX = 3;
export const PASSWORD_RESET_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/** Resolved from env, falls back to DEFAULT_RATE_LIMIT_WINDOW_MS */
export const getRateLimitWindowMs = () => {
  const parsed = parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10);
  return Number.isFinite(parsed) && parsed >= 1000 ? parsed : DEFAULT_RATE_LIMIT_WINDOW_MS;
};

/** Resolved from env, falls back to DEFAULT_RATE_LIMIT_MAX_REQUESTS (or 10k in non-production) */
export const getRateLimitMaxRequests = () => {
  const parsed = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10);
  if (Number.isFinite(parsed) && parsed >= 1) {
    return parsed;
  }
  return process.env.NODE_ENV === 'production'
    ? DEFAULT_RATE_LIMIT_MAX_REQUESTS
    : 10000;
};

// Database connection
export const DEFAULT_MONGODB_MAX_POOL_SIZE = 10;
export const DEFAULT_MONGODB_MIN_POOL_SIZE = 2;
export const DEFAULT_MONGODB_SERVER_SELECTION_TIMEOUT = 5000;
export const DEFAULT_MONGODB_SOCKET_TIMEOUT = 45000;
export const DEFAULT_MONGODB_CONNECT_TIMEOUT = 10000;

// Server configuration
export const DEFAULT_PORT = 10000;
export const GRACEFUL_SHUTDOWN_TIMEOUT_MS = 10000; // 10 seconds

// Email configuration
export const DEFAULT_EMAIL_PORT = 587;

// Redis configuration
export const DEFAULT_REDIS_PORT = 6379;
export const DEFAULT_REDIS_DB = 0;

// Job queue configuration
export const DEFAULT_QUEUE_CONCURRENCY = 5;
export const DEFAULT_QUEUE_MAX_ATTEMPTS = 3;
export const DEFAULT_QUEUE_BACKOFF_DELAY_MS = 5000;

// Validation limits
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;
export const MIN_NAME_LENGTH = 2;
export const MAX_NAME_LENGTH = 100;
export const MAX_EMAIL_LENGTH = 255;
export const MIN_PHONE_LENGTH = 10;
export const MAX_PHONE_LENGTH = 20;

// Pagination defaults
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 10;
export const MAX_PAGINATION_LIMIT = 100;

// Security
export const MIN_JWT_SECRET_LENGTH = 32;
export const CSRF_TOKEN_BYTES = 32;

