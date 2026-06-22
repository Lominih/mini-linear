// Account lockout protection against brute force attacks

interface AttemptRecord {
  count: number;
  firstAttempt: number;
  lastAttempt: number;
  lockoutUntil?: number;
}

const attempts = new Map<string, AttemptRecord>();

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATIONS = [1, 5, 15, 30]; // minutes, escalates

function getLockoutDuration(attemptCount: number): number {
  const index = Math.min(Math.floor((attemptCount - MAX_ATTEMPTS) / MAX_ATTEMPTS), LOCKOUT_DURATIONS.length - 1);
  return LOCKOUT_DURATIONS[index] * 60 * 1000;
}

export function recordFailedAttempt(email: string): { locked: boolean; attemptsRemaining: number; lockoutMinutes?: number } {
  const now = Date.now();
  const existing = attempts.get(email);

  if (existing && existing.lockoutUntil && now < existing.lockoutUntil) {
    const lockoutMinutes = Math.ceil((existing.lockoutUntil - now) / 60000);
    return { locked: true, attemptsRemaining: 0, lockoutMinutes };
  }

  if (existing && existing.lockoutUntil && now >= existing.lockoutUntil) {
    attempts.delete(email);
  }

  const record = attempts.get(email) || { count: 0, firstAttempt: now, lastAttempt: now };
  record.count += 1;
  record.lastAttempt = now;

  if (record.count >= MAX_ATTEMPTS) {
    const duration = getLockoutDuration(record.count);
    record.lockoutUntil = now + duration;
    attempts.set(email, record);
    const lockoutMinutes = Math.ceil(duration / 60000);
    return { locked: true, attemptsRemaining: 0, lockoutMinutes };
  }

  attempts.set(email, record);
  return { locked: false, attemptsRemaining: MAX_ATTEMPTS - record.count };
}

export function isLocked(email: string): boolean {
  const record = attempts.get(email);
  if (!record || !record.lockoutUntil) return false;
  if (Date.now() >= record.lockoutUntil) {
    attempts.delete(email);
    return false;
  }
  return true;
}

export function resetAttempts(email: string): void {
  attempts.delete(email);
}

// Cleanup old entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [email, record] of attempts) {
    if (record.lockoutUntil && now >= record.lockoutUntil) {
      attempts.delete(email);
    } else if (!record.lockoutUntil && now - record.lastAttempt > 30 * 60 * 1000) {
      attempts.delete(email);
    }
  }
}, 10 * 60 * 1000);