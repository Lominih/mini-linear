import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "@/server/trpc";
import { TRPCError } from "@trpc/server";
import {
  ViewFiltersSchema,
  buildPrismaWhereClause,
  buildPrismaOrderBy,
} from "@/server/filter-engine";
import {
  computeKanbanBoard,
  prepareKanbanIssues,
} from "@/server/views/kanban";
import {
  computeListView,
  prepareListIssues,
} from "@/server/views/list";
import {
  computeTimelineView,
  prepareTimelineIssues,
  type TimelineGranularity,
} from "@/server/views/timeline";

// ------ Input Schemas ----------------------------------------------------------------------------------------------------------------------

const createViewInput = z.object({
  name: z.string().min(1).max(128),
  type: z.enum(["BOARD", "LIST", "TIMELINE"]),
  filters: ViewFiltersSchema.default({
    groups: [],
    sort: [{ field: "order" as const, direction: "asc" as const }],
  }),
  projectId: z.string(),
});

const updateViewInput = z.object({
  id: z.string(),
  name: z.string().min(1).max(128).optional(),
  filters: ViewFiltersSchema.optional(),
});

const listViewInput = z.object({
  projectId: z.string(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(50),
});

const getByIdInput = z.object({
  id: z.string(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
  timelineGranularity: z.enum(["week", "month"]).default("week"),
});

// ------ View Router --------------------------------------------------------------------------------------------------------------------------

export const viewRouter = router({
  // Create a new view
  create: publicProcedure
    .input(createViewInput)
    .mutation(async ({ ctx, input }) => {
      const { name, type, filters, projectId } = input;

      const project = await ctx.prisma.project.findUnique({
        where: { id: projectId },
      });
      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found.",
        });
      }

      const view = await ctx.prisma.view.create({
        data: {
          name,
          type,
          filters: JSON.stringify(filters),
          projectId,
          userId: ctx.user?.userId ?? "anonymous",
          shared: false,
        },
      });

      return view;
    }),

  // Get a view by ID with computed filtered issues
  getById: publicProcedure
    .input(getByIdInput)
    .query(async ({ ctx, input }) => {
      const { id, page, pageSize, timelineGranularity } = input;

      const view = await ctx.prisma.view.findUnique({
        where: { id },
        include: {
          project: {
            select: { id: true, name: true, key: true },
          },
          user: {
            select: { id: true, name: true, email: true, avatar: true },
          },
        },
      });

      if (!view) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "View not found.",
        });
      }

      // Check access: owner or shared
      const isOwner = ctx.user?.userId && view.userId === ctx.user?.userId;
      if (!isOwner && !view.shared) {
        // Check project membership
        if (ctx.user?.userId) {
          const membership = await ctx.prisma.projectMember.findUnique({
            where: {
              projectId_userId: {
                projectId: view.projectId,
                userId: ctx.user?.userId,
              },
            },
          });
          if (!membership) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "You don't have access to this view.",
            });
          }
        } else {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this view.",
          });
        }
      }

      // Parse filters
      const filters = ViewFiltersSchema.parse(
        typeof view.filters === "string"
          ? JSON.parse(view.filters)
          : view.filters,
      );

      // Fetch issues with Prisma where clause + sort
      const prismaWhere = buildPrismaWhereClause(filters);
      const prismaOrderBy = buildPrismaOrderBy(filters.sort);

      const issues = await ctx.prisma.issue.findMany({
        where: {
          projectId: view.projectId,
          ...(prismaWhere as Record<string, unknown>),
        },
        orderBy: prismaOrderBy as Record<string, string>[],
        include: {
          assignee: {
            select: { id: true, name: true, email: true, avatar: true },
          },
          reporter: {
            select: { id: true, name: true, email: true, avatar: true },
          },
        },
      });

      // Compute view-specific data
      let viewData: unknown;

      switch (view.type) {
        case "BOARD": {
          const kanbanIssues = prepareKanbanIssues(issues);
          viewData = computeKanbanBoard(kanbanIssues, {
            groups: [],
            sort: [{ field: "order", direction: "asc" }],
          });
          break;
        }
        case "LIST": {
          const listIssues = prepareListIssues(issues);
          viewData = computeListView(listIssues, {
            groups: [],
            sort: [{ field: "order", direction: "asc" }],
          }, { page: page ?? 1, pageSize: pageSize ?? 50 });
          break;
        }
        case "TIMELINE": {
          const timelineIssues = prepareTimelineIssues(issues);
          viewData = computeTimelineView(timelineIssues, {
            groups: [],
            sort: [{ field: "order", direction: "asc" }],
          }, timelineGranularity as TimelineGranularity);
          break;
        }
      }

      return {
        ...view,
        filters,
        viewData,
      };
    }),

  // Update a view's name or filters
  update: publicProcedure
    .input(updateViewInput)
    .mutation(async ({ ctx, input }) => {
      const { id, name, filters } = input;

      const existing = await ctx.prisma.view.findUnique({ where: { id } });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "View not found.",
        });
      }

      if (ctx.user?.userId && existing.userId !== ctx.user?.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only update your own views.",
        });
      }

      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (filters !== undefined) updateData.filters = JSON.stringify(filters);

      const view = await ctx.prisma.view.update({
        where: { id },
        data: updateData,
      });

      return view;
    }),

  // Delete a view (only own views)
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.view.findUnique({
        where: { id: input.id },
      });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "View not found.",
        });
      }

      if (ctx.user?.userId && existing.userId !== ctx.user?.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only delete your own views.",
        });
      }

      await ctx.prisma.view.delete({ where: { id: input.id } });
      return { success: true };
    }),

  // List views for a project
  list: publicProcedure
    .input(listViewInput)
    .query(async ({ ctx, input }) => {
      const { projectId, page, pageSize } = input;

      const where = { projectId };
      const [views, total] = await Promise.all([
        ctx.prisma.view.findMany({
          where,
          orderBy: { updatedAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            user: {
              select: { id: true, name: true, email: true, avatar: true },
            },
          },
        }),
        ctx.prisma.view.count({ where }),
      ]);

      return {
        items: views,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    }),

  // Get a shared view by public token (no auth required)
  getShared: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
        page: z.number().int().min(1).optional(),
        pageSize: z.number().int().min(1).max(100).optional(),
        timelineGranularity: z.enum(["week", "month"]).default("week"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { token, page, pageSize, timelineGranularity } = input;

      const view = await ctx.prisma.view.findFirst({
        where: {
          shared: true,
          id: token,
        },
        include: {
          project: {
            select: { id: true, name: true, key: true },
          },
          user: {
            select: { id: true, name: true, email: true, avatar: true },
          },
        },
      });

      if (!view) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Shared view not found.",
        });
      }

      const filters = ViewFiltersSchema.parse(
        typeof view.filters === "string"
          ? JSON.parse(view.filters)
          : view.filters,
      );

      const prismaWhere = buildPrismaWhereClause(filters);
      const prismaOrderBy = buildPrismaOrderBy(filters.sort);

      const issues = await ctx.prisma.issue.findMany({
        where: {
          projectId: view.projectId,
          ...(prismaWhere as Record<string, unknown>),
        },
        orderBy: prismaOrderBy as Record<string, string>[],
        include: {
          assignee: {
            select: { id: true, name: true, email: true, avatar: true },
          },
          reporter: {
            select: { id: true, name: true, email: true, avatar: true },
          },
        },
      });

      let viewData: unknown;

      switch (view.type) {
        case "BOARD": {
          const kanbanIssues = prepareKanbanIssues(issues);
          viewData = computeKanbanBoard(kanbanIssues, {
            groups: [],
            sort: [{ field: "order", direction: "asc" }],
          });
          break;
        }
        case "LIST": {
          const listIssues = prepareListIssues(issues);
          viewData = computeListView(listIssues, {
            groups: [],
            sort: [{ field: "order", direction: "asc" }],
          }, { page: page ?? 1, pageSize: pageSize ?? 50 });
          break;
        }
        case "TIMELINE": {
          const timelineIssues = prepareTimelineIssues(issues);
          viewData = computeTimelineView(timelineIssues, {
            groups: [],
            sort: [{ field: "order", direction: "asc" }],
          }, timelineGranularity as TimelineGranularity);
          break;
        }
      }

      return {
        id: view.id,
        name: view.name,
        type: view.type,
        filters,
        viewData,
        project: view.project,
        createdAt: view.createdAt,
        updatedAt: view.updatedAt,
      };
    }),

  // Toggle sharing for a view
  toggleShare: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.view.findUnique({
        where: { id: input.id },
      });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "View not found.",
        });
      }

      if (ctx.user?.userId && existing.userId !== ctx.user?.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only share your own views.",
        });
      }

      const newSharedState = !existing.shared;

      const view = await ctx.prisma.view.update({
        where: { id: input.id },
        data: { shared: newSharedState },
      });

      return {
        ...view,
        shareToken: newSharedState ? view.id : null,
        shareUrl: newSharedState ? `/shared/${view.id}` : null,
      };
    }),
});

export default viewRouter;



