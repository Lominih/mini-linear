// ─── In-Memory Cache with TTL ─────────────────────────────────────────────────

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

class MemoryCache {
  private store = new Map<string, CacheEntry>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  set(key: string, value: unknown, ttlMs: number = 30_000): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  clear(): void {
    this.store.clear();
  }
}

export const cache = new MemoryCache();

export async function withCache<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const cached = cache.get<T>(key);
  if (cached !== null) return cached;
  const value = await fn();
  cache.set(key, value, ttlMs);
  return value;
}