import { randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Generate a cryptographically secure CSRF token (32 random bytes → 64-char hex).
 */
export function generateCsrfToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Constant-time comparison of a supplied token against the expected secret.
 * Returns `false` for any length mismatch (no timing leak).
 */
export function validateCsrfToken(token: string, secret: string): boolean {
  if (!token || !secret) return false;

  const tokenBuf = Buffer.from(token, "hex");
  const secretBuf = Buffer.from(secret, "hex");

  if (tokenBuf.length !== secretBuf.length) return false;

  return timingSafeEqual(tokenBuf, secretBuf);
}
