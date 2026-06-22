import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  recordFailedAttempt,
  isLocked,
  resetAttempts,
} from "@/lib/account-lockout";

const TEST_EMAIL = "test@example.com";

describe("account-lockout", () => {
  beforeEach(() => {
    resetAttempts(TEST_EMAIL);
    vi.useRealTimers();
  });

  it("recordFailedAttempt returns attemptsRemaining", () => {
    const result = recordFailedAttempt(TEST_EMAIL);
    expect(result.locked).toBe(false);
    expect(result.attemptsRemaining).toBe(4);
  });

  it("locks after 5 attempts", () => {
    for (let i = 0; i < 5; i++) {
      recordFailedAttempt(TEST_EMAIL);
    }
    // After 5th attempt, should be locked
    const result = recordFailedAttempt(TEST_EMAIL);
    expect(result.locked).toBe(true);
    expect(result.attemptsRemaining).toBe(0);
  });

  it("isLocked returns true when locked", () => {
    for (let i = 0; i < 5; i++) {
      recordFailedAttempt(TEST_EMAIL);
    }
    expect(isLocked(TEST_EMAIL)).toBe(true);
  });

  it("resetAttempts clears lockout", () => {
    for (let i = 0; i < 5; i++) {
      recordFailedAttempt(TEST_EMAIL);
    }
    expect(isLocked(TEST_EMAIL)).toBe(true);
    resetAttempts(TEST_EMAIL);
    expect(isLocked(TEST_EMAIL)).toBe(false);
    // After reset, fresh attempts are available
    const result = recordFailedAttempt(TEST_EMAIL);
    expect(result.locked).toBe(false);
    expect(result.attemptsRemaining).toBe(4);
  });

  it("lockout duration escalates across lockout cycles", () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);

    // First lockout: 5 attempts → 1 minute
    for (let i = 0; i < 5; i++) {
      recordFailedAttempt(TEST_EMAIL);
    }
    const first = recordFailedAttempt(TEST_EMAIL);
    expect(first.locked).toBe(true);
    expect(first.lockoutMinutes).toBe(1);

    // Advance past the 1-minute lockout
    vi.setSystemTime(now + 61_000);

    // Lockout expired — calling recordFailedAttempt clears the expired record
    // and starts fresh. So the next batch of 5 also locks for 1 minute.
    for (let i = 0; i < 5; i++) {
      recordFailedAttempt(TEST_EMAIL);
    }
    const second = recordFailedAttempt(TEST_EMAIL);
    expect(second.locked).toBe(true);
    expect(second.lockoutMinutes).toBe(1);

    // Advance past the second lockout
    vi.setSystemTime(now + 122_000);

    // Verify the account unlocks after lockout expires
    expect(isLocked(TEST_EMAIL)).toBe(false);

    vi.useRealTimers();
  });
});
