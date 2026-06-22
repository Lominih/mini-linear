import { describe, it, expect, beforeEach, vi } from "vitest";
import { cache, withCache } from "@/lib/cache";

describe("cache", () => {
  beforeEach(() => {
    cache.clear();
  });

  it("cache.set and cache.get work", () => {
    cache.set("key1", "value1", 5000);
    expect(cache.get("key1")).toBe("value1");
  });

  it("cache.get returns null for expired entries", async () => {
    cache.set("key2", "value2", 1); // 1ms TTL
    // Wait for expiry
    await new Promise((r) => setTimeout(r, 10));
    expect(cache.get("key2")).toBeNull();
  });

  it("cache.has returns correct boolean", () => {
    expect(cache.has("key3")).toBe(false);
    cache.set("key3", "value3", 5000);
    expect(cache.has("key3")).toBe(true);
  });

  it("cache.delete removes entry", () => {
    cache.set("key4", "value4", 5000);
    expect(cache.has("key4")).toBe(true);
    cache.delete("key4");
    expect(cache.has("key4")).toBe(false);
    expect(cache.get("key4")).toBeNull();
  });

  it("cache.clear removes all entries", () => {
    cache.set("a", 1, 5000);
    cache.set("b", 2, 5000);
    cache.set("c", 3, 5000);
    cache.clear();
    expect(cache.get("a")).toBeNull();
    expect(cache.get("b")).toBeNull();
    expect(cache.get("c")).toBeNull();
  });

  it("withCache caches function results", async () => {
    let callCount = 0;
    const fn = vi.fn(async () => {
      callCount++;
      return "computed";
    });

    const result1 = await withCache("cached-key", 5000, fn);
    const result2 = await withCache("cached-key", 5000, fn);

    expect(result1).toBe("computed");
    expect(result2).toBe("computed");
    expect(fn).toHaveBeenCalledOnce();
  });

  it("withCache recomputes after TTL", async () => {
    let callCount = 0;
    const fn = vi.fn(async () => {
      callCount++;
      return callCount;
    });

    const result1 = await withCache("ttl-key", 1, fn);
    expect(result1).toBe(1);

    await new Promise((r) => setTimeout(r, 10));

    const result2 = await withCache("ttl-key", 1, fn);
    expect(result2).toBe(2);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
