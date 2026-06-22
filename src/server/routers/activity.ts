import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc";
import { TRPCError } from "@trpc/server";

// ©¤©¤©¤ Activity Types ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤

const ACTIVITY_ACTION_MAP: Record<string, string> = {
  CREATE: "created",
  UPDATE: "updated",
  DELETE: "deleted",
  ARCHIVE: "archived",
  ASSIGN: "assigned",
  COMMENT: "commented on",
};

const ENTITY_LABEL_MAP: Record<string, string> = {
  Issue: "issue",
  Sprint: "sprint",
  Project: "project",
  Comment: "comment",
};

// ©¤©¤©¤ Helpers ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤

function parseDetails(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed;
    }
    return {};
  } catch {
    return {};
  }
}

function formatActivityMessage(
  action: string,
  entity: string,
  details: Record<string, unknown>,
  entityTitle?: string | null,
): string {
  const verb = ACTIVITY_ACTION_MAP[action] ?? action.toLowerCase();
  const noun = ENTITY_LABEL_MAP[entity] ?? entity.toLowerCase();
  const title = entityTitle ? ` "${entityTitle}"` : "";

  // Special formatting for specific actions
  if (action === "ASSIGN" && typeof details.assigneeId === "string") {
    return `Assigned ${noun}${title}`;
  }

  if (action === "UPDATE" && details.changes) {
    const changes = details.changes as Record<string, { before: unknown; after: unknown }>;
    const fields = Object.keys(changes);
    if (fields.length === 1) {
      return `Changed ${fields[0]} on ${noun}${title}`;
    }
    return `Updated ${fields.length} fields on ${noun}${title}`;
  }

  if (action === "COMMENT") {
    return `Commented on ${noun}${title}`;
  }

  return `${noun.charAt(0).toUpperCase() + noun.slice(1)}${title} ${verb}`;
}

// ©¤©¤©¤ Router ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤

export const activityRouter = router({
  // ©¤©¤ List recent activity for a project ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤

  list: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        limit: z.number().int().min(1).max(100).default(50),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { projectId, limit, cursor } = input;

      // Get all issue IDs for this project
      const issueIds = (
        await ctx.prisma.issue.findMany({
          where: { projectId },
          select: { id: true },
        })
      ).map((i) => i.id);

      // Also get sprint IDs for the project
      const sprintIds = (
        await ctx.prisma.sprint.findMany({
          where: { projectId },
          select: { id: true },
        })
      ).map((s) => s.id);

      const entityFilters = [
        { entity: "Issue", entityId: { in: issueIds } },
        { entity: "Sprint", entityId: { in: sprintIds } },
        { entity: "Project", entityId: projectId },
      ];

      const logs = await ctx.prisma.auditLog.findMany({
        where: {
          OR: entityFilters,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
      });

      let nextCursor: string | undefined;
      if (logs.length > limit) {
        const next = logs.pop();
        nextCursor = next?.id;
      }

      // Batch-fetch entity titles to avoid N+1 queries
      const uniqueEntityIds = [...new Set(
        logs.filter((l) => l.entity === "Issue" || l.entity === "Sprint").map((l) => l.entityId)
      )];

      const issueTitles = new Map<string, string>();
      const sprintNames = new Map<string, string>();

      const issueIdsToFetch = logs.filter((l) => l.entity === "Issue").map((l) => l.entityId);
      const sprintIdsToFetch = logs.filter((l) => l.entity === "Sprint").map((l) => l.entityId);

      const [issues, sprints] = await Promise.all([
        issueIdsToFetch.length > 0
          ? ctx.prisma.issue.findMany({
              where: { id: { in: [...new Set(issueIdsToFetch)] } },
              select: { id: true, title: true },
            })
          : Promise.resolve([]),
        sprintIdsToFetch.length > 0
          ? ctx.prisma.sprint.findMany({
              where: { id: { in: [...new Set(sprintIdsToFetch)] } },
              select: { id: true, name: true },
            })
          : Promise.resolve([]),
      ]);

      for (const issue of issues) {
        issueTitles.set(issue.id, issue.title);
      }
      for (const sprint of sprints) {
        sprintNames.set(sprint.id, sprint.name);
      }

      const enrichedLogs = logs.map((log) => {
        let entityTitle: string | null = null;

        if (log.entity === "Issue") {
          entityTitle = issueTitles.get(log.entityId) ?? null;
        } else if (log.entity === "Sprint") {
          entityTitle = sprintNames.get(log.entityId) ?? null;
        }

        const details = parseDetails(log.details);

        return {
          id: log.id,
          action: log.action,
          entity: log.entity,
          entityId: log.entityId,
          message: formatActivityMessage(log.action, log.entity, details, entityTitle),
          details,
          user: log.user,
          createdAt: log.createdAt.toISOString(),
        };
      });

      return {
        activities: enrichedLogs,
        nextCursor,
      };
    }),

  // ©¤©¤ Get activity for a specific issue ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤

  getByIssue: protectedProcedure
    .input(
      z.object({
        issueId: z.string(),
        limit: z.number().int().min(1).max(100).default(50),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { issueId, limit, cursor } = input;

      const issue = await ctx.prisma.issue.findUnique({
        where: { id: issueId },
        select: { id: true, title: true },
      });

      if (!issue) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Issue not found" });
      }

      const logs = await ctx.prisma.auditLog.findMany({
        where: {
          entity: "Issue",
          entityId: issueId,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
      });

      let nextCursor: string | undefined;
      if (logs.length > limit) {
        const next = logs.pop();
        nextCursor = next?.id;
      }

      const enrichedLogs = logs.map((log) => {
        const details = parseDetails(log.details);

        return {
          id: log.id,
          action: log.action,
          entity: log.entity,
          entityId: log.entityId,
          message: formatActivityMessage(log.action, log.entity, details, issue.title),
          details,
          user: log.user,
          createdAt: log.createdAt.toISOString(),
        };
      });

      return {
        activities: enrichedLogs,
        nextCursor,
      };
    }),
});
