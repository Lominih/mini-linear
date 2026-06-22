import { describe, it, expect, beforeEach } from "vitest";

// We need a fresh module for each describe block to reset internal state.
// Using dynamic imports + vi.resetModules for isolation.

let logSlowQuery: typeof import("@/lib/slow-query-logger")["logSlowQuery"];
let getSlowQueries: typeof import("@/lib/slow-query-logger")["getSlowQueries"];

describe("slow-query-logger", () => {
  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("@/lib/slow-query-logger");
    logSlowQuery = mod.logSlowQuery;
    getSlowQueries = mod.getSlowQueries;
  });

  it("logSlowQuery stores entries", () => {
    logSlowQuery("SELECT 1", 300);
    const queries = getSlowQueries();
    expect(queries).toHaveLength(1);
    expect(queries[0].query).toBe("SELECT 1");
    expect(queries[0].duration).toBe(300);
  });

  it("getSlowQueries returns all entries", () => {
    logSlowQuery("SELECT 1", 250);
    logSlowQuery("SELECT 2", 500);
    logSlowQuery("SELECT 3", 1000);
    expect(getSlowQueries()).toHaveLength(3);
  });

  it("getSlowQueries(threshold) filters correctly", () => {
    logSlowQuery("fast query", 210);
    logSlowQuery("medium query", 500);
    logSlowQuery("slow query", 2000);

    expect(getSlowQueries(500)).toHaveLength(2);
    expect(getSlowQueries(1000)).toHaveLength(1);
    expect(getSlowQueries(2000)).toHaveLength(1);
    expect(getSlowQueries(3000)).toHaveLength(0);
  });

  it("caps at 100 entries", () => {
    for (let i = 0; i < 110; i++) {
      logSlowQuery(`query ${i}`, 250);
    }
    const queries = getSlowQueries();
    expect(queries).toHaveLength(100);
    // Oldest entries should be shifted out — last query should be the most recent
    expect(queries[queries.length - 1].query).toBe("query 109");
  });
});
