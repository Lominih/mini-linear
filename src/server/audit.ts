import { prisma } from "@/server/prisma";
import { AuditAction } from "@/generated/prisma/client";

// 鈹€鈹€鈹€ Types 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export interface AuditLogEntry {
  action: AuditAction;
  entity: string;
  entityId: string;
  userId: string;
  details?: Record<string, unknown>;
}

export interface AuditLogQuery {
  entity?: string;
  entityId?: string;
  userId?: string;
  action?: AuditAction;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditLogResult {
  logs: Array<{
    id: string;
    action: AuditAction;
    entity: string;
    entityId: string;
    userId: string;
    details: string;
    createdAt: Date;
    user: {
      id: string;
      name: string;
      email: string;
    };
  }>;
  total: number;
}

// 鈹€鈹€鈹€ Core Functions 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export async function logAction(entry: AuditLogEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        userId: entry.userId,
        details: JSON.stringify(entry.details ?? {}),
      },
    });
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}

export async function logCreate(
  entity: string,
  entityId: string,
  userId: string,
  data?: Record<string, unknown>,
): Promise<void> {
  return logAction({
    action: "CREATE",
    entity,
    entityId,
    userId,
    details: { data },
  });
}

export async function logUpdate(
  entity: string,
  entityId: string,
  userId: string,
  changes?: Record<string, { before: unknown; after: unknown }>,
): Promise<void> {
  return logAction({
    action: "UPDATE",
    entity,
    entityId,
    userId,
    details: { changes },
  });
}

export async function logDelete(
  entity: string,
  entityId: string,
  userId: string,
): Promise<void> {
  return logAction({
    action: "DELETE",
    entity,
    entityId,
    userId,
  });
}

export async function logAssign(
  entity: string,
  entityId: string,
  userId: string,
  assigneeId: string,
): Promise<void> {
  return logAction({
    action: "ASSIGN",
    entity,
    entityId,
    userId,
    details: { assigneeId },
  });
}

export async function logComment(
  issueId: string,
  userId: string,
  commentId: string,
): Promise<void> {
  return logAction({
    action: "COMMENT",
    entity: "Issue",
    entityId: issueId,
    userId,
    details: { commentId },
  });
}

// 鈹€鈹€鈹€ Query Functions 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export async function queryAuditLogs(query: AuditLogQuery): Promise<AuditLogResult> {
  const { entity, entityId, userId, action, startDate, endDate, limit = 50, offset = 0 } = query;

  const where: Record<string, unknown> = {};

  if (entity) where.entity = entity;
  if (entityId) where.entityId = entityId;
  if (userId) where.userId = userId;
  if (action) where.action = action;

  if (startDate || endDate) {
    const createdAt: Record<string, Date> = {};
    if (startDate) createdAt.gte = startDate;
    if (endDate) createdAt.lte = endDate;
    where.createdAt = createdAt;
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total };
}

// 鈹€鈹€鈹€ tRPC Middleware for Auto-Logging 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

import { TRPCError } from "@trpc/server";
import { type Context } from "@/server/context";

export async function auditMiddleware<TInput, TOutput>(
  ctx: Context,
  entity: string,
  action: AuditAction,
  handler: () => Promise<TOutput>,
  options?: {
    getEntityId?: (result: TOutput) => string;
    getDetails?: (input: TInput, result: TOutput) => Record<string, unknown>;
    input?: TInput;
  },
): Promise<TOutput> {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required for audited actions",
    });
  }

  try {
    const result = await handler();

    const entityId = options?.getEntityId?.(result) ?? "unknown";
    const details = options?.getDetails?.(options.input as TInput, result) ?? {};

    await logAction({
      action,
      entity,
      entityId,
      userId: ctx.user.userId,
      details,
    });

    return result;
  } catch (error) {
    throw error;
  }
}
