import { NextRequest, NextResponse } from 'next/server';

interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  keyGenerator?: (req: NextRequest) => string;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const store = new Map<string, RateLimitEntry>();

const MAX_STORE_SIZE = 10_000;

let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 60_000;

function cleanupExpiredEntries(): void {
  const now = Date.now();

  // Run periodic full cleanup only at configured intervals
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  // Remove expired entries
  for (const [key, entry] of store) {
    if (now > entry.resetTime) {
      store.delete(key);
    }
  }

  // If still over max after cleanup, evict oldest entries
  if (store.size > MAX_STORE_SIZE) {
    const entries = [...store.entries()]
      .sort((a, b) => a[1].resetTime - b[1].resetTime);

    const toRemove = entries.slice(0, store.size - MAX_STORE_SIZE);
    for (const [key] of toRemove) {
      store.delete(key);
    }
  }
}

function defaultKeyGenerator(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip ?? '127.0.0.1';
}

export function rateLimit(options: RateLimitOptions = {}) {
  const {
    windowMs = 60000,
    max = 100,
    keyGenerator = defaultKeyGenerator,
  } = options;

  return function middleware(req: NextRequest): NextResponse | void {
    cleanupExpiredEntries();

    const key = keyGenerator(req);
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || now > entry.resetTime) {
      store.set(key, { count: 1, resetTime: now + windowMs });
      return;
    }

    entry.count++;

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      return NextResponse.json(
        { error: 'Too Many Requests' },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfter) },
        },
      );
    }
  };
}

export const globalLimiter = rateLimit({ windowMs: 60000, max: 100 });
export const apiLimiter = rateLimit({ windowMs: 60000, max: 30 });
export const authLimiter = rateLimit({ windowMs: 60000, max: 10 });
