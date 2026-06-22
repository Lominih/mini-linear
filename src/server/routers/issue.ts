import { z } from "zod";
import { router, publicProcedure } from "@/server/trpc";
import { TRPCError } from "@trpc/server";
import {
  processStateChange,
  getValidTransitions,
  type IssueStatus,
} from "@/server/state-machine";
import {
  customFieldValueSchema,
} from "@/server/custom-fields";
import { searchIssues, searchIssuesCount } from "@/server/search";
import type { PrismaClient } from "@/generated/prisma/client";

// 鈹€鈹€鈹€ Enum Mappers 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
// API uses lowercase, Prisma enums use uppercase

const STATUS_MAP: Record<string, string> = {
  backlog: "BACKLOG",
  todo: "TODO",
  in_progress: "IN_PROGRESS",
  in_review: "IN_REVIEW",
  done: "DONE",
  cancelled: "CANCELLED",
};

const PRIORITY_MAP: Record<string, string> = {
  urgent: "URGENT",
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
  none: "NONE",
};

const RELATION_TYPE_MAP: Record<string, string> = {
  blocks: "BLOCKS",
  blocked_by: "BLOCKED_BY",
  relates_to: "RELATES_TO",
};

// 鈹€鈹€鈹€ Schemas 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

const issueStatusSchema = z.enum([
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
  "cancelled",
]);

const createIssueSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(50000).optional(),
  projectId: z.string(),
  priority: z.enum(["urgent", "high", "medium", "low", "none"]).default("none"),
  assigneeId: z.string().optional(),
  labels: z.array(z.string()).default([]),
  dueDate: z.string().datetime().optional(),
  parentId: z.string().optional(),
  sprintId: z.string().optional(),
  customFields: customFieldValueSchema.optional(),
});

const updateIssueSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(50000).optional(),
  status: issueStatusSchema.optional(),
  priority: z.enum(["urgent", "high", "medium", "low", "none"]).optional(),
  assigneeId: z.string().nullable().optional(),
  labels: z.array(z.string()).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  sprintId: z.string().nullable().optional(),
  customFields: customFieldValueSchema.optional(),
});

const listIssuesSchema = z.object({
  projectId: z.string().optional(),
  status: issueStatusSchema.optional(),
  priority: z.enum(["urgent", "high", "medium", "low", "none"]).optional(),
  assigneeId: z.string().optional(),
  sprintId: z.string().optional(),
  labels: z.array(z.string()).optional(),
  parentId: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
  orderBy: z.enum(["createdAt", "updatedAt", "priority", "order", "title"]).default("order"),
  orderDirection: z.enum(["asc", "desc"]).default("asc"),
});

const bulkUpdateSchema = z.object({
  ids: z.array(z.string()).min(1).max(100),
  updates: z.object({
    status: issueStatusSchema.optional(),
    priority: z.enum(["urgent", "high", "medium", "low", "none"]).optional(),
    assigneeId: z.string().nullable().optional(),
    sprintId: z.string().nullable().optional(),
    labels: z.array(z.string()).optional(),
  }),
});

const bulkDeleteSchema = z.object({
  ids: z.array(z.string()).min(1).max(100),
});

const searchSchema = z.object({
  query: z.string().min(1),
  projectId: z.string().optional(),
  status: issueStatusSchema.optional(),
  priority: z.enum(["urgent", "high", "medium", "low", "none"]).optional(),
  assigneeId: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

const reorderSchema = z.object({
  projectId: z.string(),
  ids: z.array(z.string()).min(1),
  targetIndex: z.number().int().min(0),
  status: issueStatusSchema.optional(),
});

const addRelationSchema = z.object({
  fromIssueId: z.string(),
  toIssueId: z.string(),
  type: z.enum(["blocks", "blocked_by", "relates_to"]),
});

const removeRelationSchema = z.object({
  fromIssueId: z.string(),
  toIssueId: z.string(),
  type: z.enum(["blocks", "blocked_by", "relates_to"]),
});

// 鈹€鈹€鈹€ Helpers 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

function parseLabels(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseIssueFields(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed;
    }
    return {};
  } catch {
    return {};
  }
}

async function checkCircularDependency(
  prisma: PrismaClient,
  fromIssueId: string,
  toIssueId: string
): Promise<boolean> {
  const visited = new Set<string>();
  const queue = [toIssueId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === fromIssueId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    const relations = await prisma.issueRelation.findMany({
      where: { fromIssueId: current, type: "BLOCKS" as never },
      select: { toIssueId: true },
    });

    for (const rel of relations) {
      if (!visited.has(rel.toIssueId)) {
        queue.push(rel.toIssueId);
      }
    }
  }

  return false;
}

interface IssueListItem {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  projectId: string;
  assigneeId: string | null;
  reporterId: string;
  labels: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  assignee: { id: string; name: string; email: string; avatar: string | null } | null;
  reporter: { id: string; name: string; email: string; avatar: string | null } | null;
}

interface RelationResult {
  id: string;
  fromIssueId: string;
  toIssueId: string;
  type: string;
  toIssue?: { id: string; title: string; status: string; priority: string; assigneeId: string | null };
  fromIssue?: { id: string; title: string; status: string; priority: string; assigneeId: string | null };
}

// 鈹€鈹€鈹€ Router 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export const issueRouter = router({
  // 鈹€鈹€ Create 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

  create: publicProcedure.input(createIssueSchema).mutation(async ({ ctx, input }: { ctx, input }) => {
    const {
      title,
      description,
      projectId,
      priority,
      assigneeId,
      labels,
      dueDate,
      parentId,
      sprintId,
      customFields,
    } = input;

    if (parentId) {
      const parent = await ctx.prisma.issue.findUnique({ where: { id: parentId } });
      if (!parent) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Parent issue not found" });
      }
      if (parent.projectId !== projectId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Parent issue must be in the same project",
        });
      }
    }

    const maxOrderIssue = await ctx.prisma.issue.findFirst({
      where: { projectId },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const order = (maxOrderIssue?.order ?? -1) + 1;

    const issue = await ctx.prisma.issue.create({
      data: {
        title,
        description: description ?? null,
        status: STATUS_MAP.backlog,
        priority: PRIORITY_MAP[priority] ?? PRIORITY_MAP.none,
        assigneeId: assigneeId ?? null,
        reporterId: "system",
        projectId,
        sprintId: sprintId ?? null,
        labels: JSON.stringify(labels),
        dueDate: dueDate ? new Date(dueDate) : null,
        parentId: parentId ?? null,
        order,
        customFields: customFields ? JSON.stringify(customFields) : "{}",
      },
    });

    return issue;
  }),

  // 鈹€鈹€ Get By ID 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }: { ctx, input }) => {
      const issue = await ctx.prisma.issue.findUnique({
        where: { id: input.id },
        include: {
          comments: {
            orderBy: { createdAt: "asc" },
            include: {
              author: {
                select: { id: true, name: true, email: true, avatar: true },
              },
            },
          },
          assignee: {
            select: { id: true, name: true, email: true, avatar: true },
          },
          reporter: {
            select: { id: true, name: true, email: true, avatar: true },
          },
          project: true,
          sprint: true,
        },
      });

      if (!issue) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Issue not found" });
      }

      const outgoingRelations = await ctx.prisma.issueRelation.findMany({
        where: { fromIssueId: input.id },
        include: {
          toIssue: {
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
              assigneeId: true,
            },
          },
        },
      });

      const incomingRelations = await ctx.prisma.issueRelation.findMany({
        where: { toIssueId: input.id },
        include: {
          fromIssue: {
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
              assigneeId: true,
            },
          },
        },
      });

      const subtasks = await ctx.prisma.issue.findMany({
        where: { parentId: input.id },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          assigneeId: true,
          order: true,
        },
        orderBy: { order: "asc" },
      });

      const parentIssue = issue.parentId
        ? await ctx.prisma.issue.findUnique({
            where: { id: issue.parentId },
            select: { id: true, title: true, status: true },
          })
        : null;

      return {
        ...issue,
        labels: parseLabels(issue.labels),
        customFields: parseIssueFields(issue.customFields),
        relations: {
          blocks: (outgoingRelations as RelationResult[])
            .filter((r) => r.type === "BLOCKS")
            .map((r) => ({ ...r, issue: r.toIssue })),
          blockedBy: (incomingRelations as RelationResult[])
            .filter((r) => r.type === "BLOCKS")
            .map((r) => ({ ...r, issue: r.fromIssue })),
          relatesTo: [
            ...(outgoingRelations as RelationResult[]).filter((r) => r.type === "RELATES_TO"),
            ...(incomingRelations as RelationResult[]).filter((r) => r.type === "RELATES_TO"),
          ].map((r: RelationResult) => ({
            ...r,
            issue: r.toIssue ?? r.fromIssue,
          })),
        },
        subtasks,
        parentIssue,
      };
    }),

  // 鈹€鈹€ Update 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

  update: publicProcedure.input(updateIssueSchema).mutation(async ({ ctx, input }: { ctx, input }) => {
    const { id, ...updates } = input;

    const existing = await ctx.prisma.issue.findUnique({ where: { id } });
    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Issue not found" });
    }

    const updateData: Record<string, unknown> = {};

    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.priority !== undefined) updateData.priority = PRIORITY_MAP[updates.priority] ?? updates.priority;
    if (updates.labels !== undefined) updateData.labels = JSON.stringify(updates.labels);
    if (updates.assigneeId !== undefined) updateData.assigneeId = updates.assigneeId;
    if (updates.sprintId !== undefined) updateData.sprintId = updates.sprintId;

    if (updates.dueDate !== undefined) {
      updateData.dueDate = updates.dueDate ? new Date(updates.dueDate) : null;
    }

    if (updates.status !== undefined && updates.status !== existing.status) {
      processStateChange(
        existing.status.toLowerCase() as IssueStatus,
        updates.status,
        existing.projectId
      );
      updateData.status = STATUS_MAP[updates.status] ?? updates.status;
    }

    if (updates.customFields !== undefined) {
      const existingFields = parseIssueFields(existing.customFields);
      updateData.customFields = JSON.stringify({
        ...existingFields,
        ...updates.customFields,
      });
    }

    const issue = await ctx.prisma.issue.update({
      where: { id },
      data: updateData,
    });

    return issue;
  }),

  // 鈹€鈹€ Delete 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }: { ctx, input }) => {
      const existing = await ctx.prisma.issue.findUnique({ where: { id: input.id } });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Issue not found" });
      }

      await ctx.prisma.issue.deleteMany({
        where: { parentId: input.id },
      });

      await ctx.prisma.issueRelation.deleteMany({
        where: {
          OR: [
            { fromIssueId: input.id },
            { toIssueId: input.id },
          ],
        },
      });

      const issue = await ctx.prisma.issue.delete({
        where: { id: input.id },
      });

      return issue;
    }),

  // 鈹€鈹€ List 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

  list: publicProcedure.input(listIssuesSchema).query(async ({ ctx, input }: { ctx, input }) => {
    const {
      projectId,
      status,
      priority,
      assigneeId,
      sprintId,
      labels,
      parentId,
      limit,
      cursor,
      orderBy,
      orderDirection,
    } = input;

    const where: Record<string, unknown> = {};

    if (projectId) where.projectId = projectId;
    if (status) where.status = STATUS_MAP[status] ?? status;
    if (priority) where.priority = PRIORITY_MAP[priority] ?? priority;
    if (assigneeId) where.assigneeId = assigneeId;
    if (sprintId) where.sprintId = sprintId;
    if (parentId !== undefined) where.parentId = parentId;

    if (labels && labels.length > 0) {
      (where as Record<string, unknown>).AND = labels.map((label: string) => ({
        labels: { contains: `"${label}"` },
      }));
    }

    if (cursor) {
      const cursorItem = await ctx.prisma.issue.findUnique({
        where: { id: cursor },
        select: { order: true, id: true },
      });
      if (cursorItem) {
        where.order = { gt: cursorItem.order };
      }
    }

    const orderByClause: Record<string, string> = {};
    orderByClause[orderBy] = orderDirection;

    const issues = await ctx.prisma.issue.findMany({
      where: where as never,
      take: limit + 1,
      orderBy: orderByClause,
      include: {
        assignee: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        reporter: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });

    let nextCursor: string | undefined;
    if (issues.length > limit) {
      const nextItem = issues.pop();
      nextCursor = nextItem?.id;
    }

    return {
      items: issues.map((issue: IssueListItem) => ({
        ...issue,
        labels: parseLabels(issue.labels),
      })),
      nextCursor,
    };
  }),

  // 鈹€鈹€ Bulk Update 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

  bulkUpdate: publicProcedure.input(bulkUpdateSchema).mutation(async ({ ctx, input }: { ctx, input }) => {
    const { ids, updates } = input;

    const issues = await ctx.prisma.issue.findMany({
      where: { id: { in: ids } },
      select: { id: true, status: true, projectId: true },
    });

    if (issues.length === 0) {
      throw new TRPCError({ code: "NOT_FOUND", message: "No issues found" });
    }

    if (updates.status) {
      for (const issue of issues) {
        if (issue.status !== (STATUS_MAP[updates.status] ?? updates.status)) {
          processStateChange(
            issue.status.toLowerCase() as IssueStatus,
            updates.status,
            issue.projectId
          );
        }
      }
    }

    const updateData: Record<string, unknown> = {};
    if (updates.status) updateData.status = STATUS_MAP[updates.status] ?? updates.status;
    if (updates.priority !== undefined) updateData.priority = PRIORITY_MAP[updates.priority] ?? updates.priority;
    if (updates.assigneeId !== undefined) updateData.assigneeId = updates.assigneeId;
    if (updates.sprintId !== undefined) updateData.sprintId = updates.sprintId;
    if (updates.labels !== undefined) updateData.labels = JSON.stringify(updates.labels);

    const result = await ctx.prisma.issue.updateMany({
      where: { id: { in: ids } },
      data: updateData,
    });

    return { updated: result.count };
  }),

  // 鈹€鈹€ Bulk Delete 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

  bulkDelete: publicProcedure.input(bulkDeleteSchema).mutation(async ({ ctx, input }: { ctx, input }) => {
    const { ids } = input;

    await ctx.prisma.issue.deleteMany({
      where: { parentId: { in: ids } },
    });

    await ctx.prisma.issueRelation.deleteMany({
      where: {
        OR: [
          { fromIssueId: { in: ids } },
          { toIssueId: { in: ids } },
        ],
      },
    });

    const result = await ctx.prisma.issue.deleteMany({
      where: { id: { in: ids } },
    });

    return { deleted: result.count };
  }),

  // 鈹€鈹€ Search 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

  search: publicProcedure.input(searchSchema).query(async ({ input }) => {
    const { query, projectId, status, priority, assigneeId, limit, offset } = input;

    const [items, total] = await Promise.all([
      searchIssues(
        query,
        { projectId, status, priority, assigneeId },
        { limit, offset }
      ),
      searchIssuesCount(query, { projectId, status, priority, assigneeId }),
    ]);

    return { items, total, limit, offset };
  }),

  // 鈹€鈹€ Reorder 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

  reorder: publicProcedure.input(reorderSchema).mutation(async ({ ctx, input }: { ctx, input }) => {
    const { projectId, ids, targetIndex, status } = input;

    const where: Record<string, unknown> = { projectId };
    if (status) where.status = STATUS_MAP[status] ?? status;

    const allIssues = await ctx.prisma.issue.findMany({
      where: where as never,
      orderBy: { order: "asc" },
      select: { id: true, order: true },
    });

    const draggedSet = new Set(ids);
    const remaining = allIssues.filter(
      (i: { id: string; order: number }) => !draggedSet.has(i.id)
    );
    const dragged = allIssues.filter(
      (i: { id: string; order: number }) => draggedSet.has(i.id)
    );

    const reordered = [
      ...remaining.slice(0, targetIndex),
      ...dragged,
      ...remaining.slice(targetIndex),
    ];

    const updates = reordered.map(
      (issue: { id: string; order: number }, index: number) =>
        ctx.prisma.issue.update({
          where: { id: issue.id },
          data: { order: index },
        })
    );

    await ctx.prisma.$transaction(updates);
    return { reordered: reordered.length };
  }),

  // 鈹€鈹€ Subtasks 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

  getSubtasks: publicProcedure
    .input(z.object({ issueId: z.string() }))
    .query(async ({ ctx, input }: { ctx, input }) => {
      const parent = await ctx.prisma.issue.findUnique({ where: { id: input.issueId } });
      if (!parent) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Issue not found" });
      }

      const subtasks = await ctx.prisma.issue.findMany({
        where: { parentId: input.issueId },
        orderBy: { order: "asc" },
        include: {
          assignee: {
            select: { id: true, name: true, email: true, avatar: true },
          },
        },
      });

      return subtasks.map(
        (st: { labels: string | null; [key: string]: unknown }) => ({
          ...st,
          labels: parseLabels(st.labels),
        })
      );
    }),

  // 鈹€鈹€ Relations 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

  addRelation: publicProcedure
    .input(addRelationSchema)
    .mutation(async ({ ctx, input }: { ctx, input }) => {
      const { fromIssueId, toIssueId, type } = input;
      const prismaRelationType = RELATION_TYPE_MAP[type] ?? type;

      if (fromIssueId === toIssueId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot create a relation from an issue to itself",
        });
      }

      const [source, target] = await Promise.all([
        ctx.prisma.issue.findUnique({ where: { id: fromIssueId } }),
        ctx.prisma.issue.findUnique({ where: { id: toIssueId } }),
      ]);

      if (!source || !target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Issue not found" });
      }

      if (type === "blocks") {
        const hasCycle = await checkCircularDependency(
          ctx.prisma,
          fromIssueId,
          toIssueId
        );
        if (hasCycle) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Adding this relation would create a circular dependency",
          });
        }
      }

      const existing = await ctx.prisma.issueRelation.findFirst({
        where: { fromIssueId, toIssueId, type: prismaRelationType as never },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This relation already exists",
        });
      }

      const relation = await ctx.prisma.issueRelation.create({
        data: {
          fromIssueId,
          toIssueId,
          type: prismaRelationType as never,
        },
        include: {
          fromIssue: {
            select: { id: true, title: true, status: true },
          },
          toIssue: {
            select: { id: true, title: true, status: true },
          },
        },
      });

      return relation;
    }),

  removeRelation: publicProcedure
    .input(removeRelationSchema)
    .mutation(async ({ ctx, input }: { ctx, input }) => {
      const { fromIssueId, toIssueId, type } = input;
      const prismaRelationType = RELATION_TYPE_MAP[type] ?? type;

      const relation = await ctx.prisma.issueRelation.findFirst({
        where: { fromIssueId, toIssueId, type: prismaRelationType as never },
      });

      if (!relation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Relation not found" });
      }

      await ctx.prisma.issueRelation.delete({ where: { id: relation.id } });

      return { success: true };
    }),

  // 鈹€鈹€ Get valid state transitions 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

  getValidTransitions: publicProcedure
    .input(z.object({ issueId: z.string() }))
    .query(async ({ ctx, input }: { ctx, input }) => {
      const issue = await ctx.prisma.issue.findUnique({
        where: { id: input.issueId },
        select: { status: true, projectId: true },
      });

      if (!issue) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Issue not found" });
      }

      return getValidTransitions(issue.status.toLowerCase() as IssueStatus, issue.projectId);
    }),

  // 鈹€鈹€ Get transitive relations 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

  getTransitiveRelations: publicProcedure
    .input(z.object({ issueId: z.string(), type: z.enum(["blocks", "blocked_by"]) }))
    .query(async ({ ctx, input }: { ctx, input }) => {
      const visited = new Set<string>();
      const results: Array<{ id: string; title: string; status: string }> = [];
      const prismaType = "BLOCKS" as never;

      async function traverse(currentId: string, depth: number) {
        if (depth > 10 || visited.has(currentId)) return;
        visited.add(currentId);

        if (input.type === "blocks") {
          const relations = await ctx.prisma.issueRelation.findMany({
            where: { fromIssueId: currentId, type: prismaType },
            select: {
              toIssue: { select: { id: true, title: true, status: true } },
            },
          });
          for (const rel of relations) {
            results.push(rel.toIssue);
            await traverse(rel.toIssue.id, depth + 1);
          }
        } else {
          const relations = await ctx.prisma.issueRelation.findMany({
            where: { toIssueId: currentId, type: prismaType },
            select: {
              fromIssue: { select: { id: true, title: true, status: true } },
            },
          });
          for (const rel of relations) {
            results.push(rel.fromIssue);
            await traverse(rel.fromIssue.id, depth + 1);
          }
        }
      }

      await traverse(input.issueId, 0);
      return results;
    }),
});







