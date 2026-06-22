export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "LOGIN"
  | "LOGOUT"
  | "REGISTER"
  | "PASSWORD_CHANGE"
  | "PERMISSION_DENIED";

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  userId?: string;
  action: AuditAction;
  resource?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

interface LogAuditParams {
  userId?: string;
  action: AuditAction;
  resource?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

const MAX_LOG_ENTRIES = 1_000;

const auditLogs: AuditLogEntry[] = [];

let idCounter = 0;

/**
 * Record an audit log entry. Keeps at most MAX_LOG_ENTRIES in memory
 * (oldest entries are evicted first).
 */
export function logAudit(params: LogAuditParams): void {
  const entry: AuditLogEntry = {
    id: `audit_${Date.now()}_${++idCounter}`,
    timestamp: new Date(),
    ...params,
  };

  auditLogs.push(entry);

  // Evict oldest entries when over capacity
  if (auditLogs.length > MAX_LOG_ENTRIES) {
    auditLogs.splice(0, auditLogs.length - MAX_LOG_ENTRIES);
  }
}

/**
 * Return a shallow copy of all stored audit log entries (newest last).
 */
export function getAuditLogs(): readonly AuditLogEntry[] {
  return auditLogs;
}
