const SLOW_THRESHOLD_MS = 200;
const MAX_ENTRIES = 100;

interface SlowQueryEntry {
  query: string;
  duration: number;
  timestamp: number;
  params?: unknown[];
}

const slowQueries: SlowQueryEntry[] = [];

export function logSlowQuery(query: string, durationMs: number, params?: unknown[]): void {
  if (durationMs < SLOW_THRESHOLD_MS) return;
  const entry: SlowQueryEntry = {
    query,
    duration: durationMs,
    timestamp: Date.now(),
    params,
  };
  slowQueries.push(entry);
  if (slowQueries.length > MAX_ENTRIES) {
    slowQueries.shift();
  }
}

export function getSlowQueries(thresholdMs?: number): SlowQueryEntry[] {
  if (thresholdMs === undefined) return [...slowQueries];
  return slowQueries.filter((q) => q.duration >= thresholdMs);
}