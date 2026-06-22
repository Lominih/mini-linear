import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "@/server/trpc";
import { TRPCError } from "@trpc/server";
import { startSprintValidation, completeSprintValidation } from "@/server/sprint-planning";

// 鈹€鈹€鈹€ Schemas 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

const sprintStatusEnum = z.enum(["planning", "active", "completed"]);

const createSprintSchema = z.object({
  name: z.string().min(1, "Sprint name is required").max(100),
  description: z.string().max(500).optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  goal: z.string().max(500).optional(),
  projectId: z.string().min(1, "Project ID is required"),
});

const updateSprintSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  goal: z.string().max(500).optional(),
});

const addIssuesSchema = z.object({
  sprintId: z.string().min(1),
  issueIds: z.array(z.string().min(1)).min(1, "At least one issue is required"),
});

const removeIssuesSchema = z.object({
  sprintId: z.string().min(1),
  issueIds: z.array(z.string().min(1)).min(1, "At least one issue is required"),
});

const reorderIssuesSchema = z.object({
  sprintId: z.string().min(1),
  issueIds: z.array(z.string().min(1)).min(1, "At least one issue is required"),
});

// 鈹€鈹€鈹€ Router 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export const sprintRouter = router({
  /**
   * Create a new sprint
   */
  create: protectedProcedure
    .input(createSprintSchema)
    .mutation(async ({ ctx, input }) => {
      const { prisma } = ctx;

      if (input.endDate <= input.startDate) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "End date must be after start date",
        });
      }

      const project = await prisma.project.findUnique({
        where: { id: input.projectId },
      });

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      // Check for overlapping active sprints
      const overlappingSprint = await prisma.sprint.findFirst({
        where: {
          projectId: input.projectId,
          status: "active",
          OR: [
            {
              startDate: { lte: input.endDate },
              endDate: { gte: input.startDate },
            },
          ],
        },
      });

      if (overlappingSprint) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Sprint dates overlap with active sprint "${overlappingSprint.name}"`,
        });
      }

      const sprint = await prisma.sprint.create({
        data: {
          name: input.name,
          description: input.description,
          startDate: input.startDate,
          endDate: input.endDate,
          goal: input.goal,
          projectId: input.projectId,
          status: "planning",
        },
        include: {
          _count: {
            select: { issues: true },
          },
        },
      });

      return sprint;
    }),

  /**
   * Get sprint by ID with all issues and progress stats
   */
  getById: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx;

      const sprint = await prisma.sprint.findUnique({
        where: { id: input.id },
        include: {
          issues: {
            orderBy: { order: "asc" },
          },
          _count: {
            select: { issues: true },
          },
        },
      });

      if (!sprint) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Sprint not found",
        });
      }

      const completedIssues = sprint.issues.filter(
        (issue) => issue.status === "done" || issue.status === "completed"
      );

      const inProgressIssues = sprint.issues.filter(
        (issue) => issue.status === "in_progress" || issue.status === "in-progress"
      );

      const totalIssues = sprint.issues.length;
      const completedCount = completedIssues.length;
      const inProgressCount = inProgressIssues.length;
      const todoCount = totalIssues - completedCount - inProgressCount;

      const now = new Date();
      const startDate = new Date(sprint.startDate);
      const endDate = new Date(sprint.endDate);
      const totalDuration = endDate.getTime() - startDate.getTime();
      const elapsed = now.getTime() - startDate.getTime();
      const timeProgress =
        totalDuration > 0
          ? Math.min(Math.max(elapsed / totalDuration, 0), 1)
          : 0;
      const issueProgress = totalIssues > 0 ? completedCount / totalIssues : 0;

      let health: "on_track" | "ahead" | "behind" | "overloaded" | "not_started";
      if (sprint.status === "completed") {
        health = issueProgress >= 0.9 ? "on_track" : "behind";
      } else if (sprint.status === "planning") {
        health = "not_started";
      } else {
        health =
          issueProgress >= timeProgress
            ? issueProgress > timeProgress + 0.1
              ? "ahead"
              : "on_track"
            : timeProgress - issueProgress > 0.2
            ? "overloaded"
            : "behind";
      }

      return {
        ...sprint,
        stats: {
          totalIssues,
          completedCount,
          inProgressCount,
          todoCount,
          completionPercentage:
            totalIssues > 0 ? Math.round((completedCount / totalIssues) * 100) : 0,
          timeProgress: Math.round(timeProgress * 100),
          issueProgress: Math.round(issueProgress * 100),
          health,
        },
      };
    }),

  /**
   * Update sprint details (only planning sprints)
   */
  update: protectedProcedure
    .input(updateSprintSchema)
    .mutation(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const { id, ...data } = input;

      const sprint = await prisma.sprint.findUnique({ where: { id } });

      if (!sprint) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Sprint not found",
        });
      }

      if (sprint.status !== "planning") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only planning sprints can be updated",
        });
      }

      if (data.startDate && data.endDate && data.endDate <= data.startDate) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "End date must be after start date",
        });
      }

      const updated = await prisma.sprint.update({
        where: { id },
        data,
        include: {
          _count: {
            select: { issues: true },
          },
        },
      });

      return updated;
    }),

  /**
   * Delete a sprint (only planning sprints with no issues)
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { prisma } = ctx;

      const sprint = await prisma.sprint.findUnique({
        where: { id: input.id },
        include: { _count: { select: { issues: true } } },
      });

      if (!sprint) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Sprint not found",
        });
      }

      if (sprint.status !== "planning") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only planning sprints can be deleted",
        });
      }

      if (sprint._count.issues > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete a sprint that has issues. Remove all issues first.",
        });
      }

      await prisma.sprint.delete({ where: { id: input.id } });

      return { success: true, deletedId: input.id };
    }),

  /**
   * List sprints for a project with optional status filter
   */
  list: publicProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        status: sprintStatusEnum.optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx;

      const where: Record<string, unknown> = {
        projectId: input.projectId,
      };

      if (input.status) {
        where.status = input.status;
      }

      const sprints = await prisma.sprint.findMany({
        where,
        include: {
          _count: {
            select: { issues: true },
          },
          issues: {
            select: { status: true },
          },
        },
        orderBy: { startDate: "desc" },
      });

      return sprints.map((sprint) => {
        const completedCount = sprint.issues.filter(
          (i) => i.status === "done" || i.status === "completed"
        ).length;
        const totalIssues = sprint.issues.length;

        return {
          id: sprint.id,
          name: sprint.name,
          description: sprint.description,
          startDate: sprint.startDate,
          endDate: sprint.endDate,
          goal: sprint.goal,
          status: sprint.status,
          projectId: sprint.projectId,
          createdAt: sprint.createdAt,
          updatedAt: sprint.updatedAt,
          totalIssues,
          completedCount,
          completionPercentage:
            totalIssues > 0 ? Math.round((completedCount / totalIssues) * 100) : 0,
        };
      });
    }),

  /**
   * Start a sprint (set status to active)
   */
  start: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { prisma } = ctx;

      const sprint = await prisma.sprint.findUnique({
        where: { id: input.id },
      });

      if (!sprint) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Sprint not found",
        });
      }

      startSprintValidation(sprint);

      // Ensure no other sprint is active in the same project
      const activeSprint = await prisma.sprint.findFirst({
        where: {
          projectId: sprint.projectId,
          status: "active",
          id: { not: sprint.id },
        },
      });

      if (activeSprint) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot start sprint "${sprint.name}" 鈥?sprint "${activeSprint.name}" is already active. Complete it first.`,
        });
      }

      const updated = await prisma.sprint.update({
        where: { id: input.id },
        data: { status: "active" },
        include: {
          _count: { select: { issues: true } },
        },
      });

      return updated;
    }),

  /**
   * Complete a sprint (set status to completed)
   */
  complete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { prisma } = ctx;

      const sprint = await prisma.sprint.findUnique({
        where: { id: input.id },
      });

      if (!sprint) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Sprint not found",
        });
      }

      completeSprintValidation(sprint);

      const updated = await prisma.sprint.update({
        where: { id: input.id },
        data: { status: "completed" },
        include: {
          _count: { select: { issues: true } },
        },
      });

      return updated;
    }),

  /**
   * Add issues to a sprint (from backlog)
   */
  addIssues: protectedProcedure
    .input(addIssuesSchema)
    .mutation(async ({ ctx, input }) => {
      const { prisma } = ctx;

      const sprint = await prisma.sprint.findUnique({
        where: { id: input.sprintId },
      });

      if (!sprint) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Sprint not found",
        });
      }

      if (sprint.status === "completed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot add issues to a completed sprint",
        });
      }

      // Validate all issues exist and belong to the same project
      const issues = await prisma.issue.findMany({
        where: {
          id: { in: input.issueIds },
        },
        select: { id: true, projectId: true, title: true, sprintId: true },
      });

      if (issues.length !== input.issueIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "One or more issues not found",
        });
      }

      const wrongProject = issues.find((i) => i.projectId !== sprint.projectId);
      if (wrongProject) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Issue "${wrongProject.title}" does not belong to this project`,
        });
      }

      const alreadyAssigned = issues.filter((i) => i.sprintId === sprint.id);
      if (alreadyAssigned.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `${alreadyAssigned.length} issue(s) are already in this sprint`,
        });
      }

      // Get current max order in the sprint
      const maxOrderIssue = await prisma.issue.findFirst({
        where: { sprintId: sprint.id },
        orderBy: { order: "desc" },
        select: { order: true },
      });

      let nextOrder = (maxOrderIssue?.order ?? -1) + 1;

      const updates = input.issueIds.map((issueId) =>
        prisma.issue.update({
          where: { id: issueId },
          data: {
            sprintId: sprint.id,
            order: nextOrder++,
          },
        })
      );

      await prisma.$transaction(updates);

      const updatedSprint = await prisma.sprint.findUnique({
        where: { id: sprint.id },
        include: {
          issues: { orderBy: { order: "asc" } },
          _count: { select: { issues: true } },
        },
      });

      return updatedSprint;
    }),

  /**
   * Remove issues from a sprint (return to backlog)
   */
  removeIssues: protectedProcedure
    .input(removeIssuesSchema)
    .mutation(async ({ ctx, input }) => {
      const { prisma } = ctx;

      const sprint = await prisma.sprint.findUnique({
        where: { id: input.sprintId },
      });

      if (!sprint) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Sprint not found",
        });
      }

      if (sprint.status === "completed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot remove issues from a completed sprint",
        });
      }

      const issues = await prisma.issue.findMany({
        where: {
          id: { in: input.issueIds },
          sprintId: sprint.id,
        },
        select: { id: true, sprintId: true },
      });

      if (issues.length !== input.issueIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "One or more issues are not in this sprint",
        });
      }

      const updates = input.issueIds.map((issueId) =>
        prisma.issue.update({
          where: { id: issueId },
          data: { sprintId: null, order: 0 },
        })
      );

      await prisma.$transaction(updates);

      const updatedSprint = await prisma.sprint.findUnique({
        where: { id: sprint.id },
        include: {
          issues: { orderBy: { order: "asc" } },
          _count: { select: { issues: true } },
        },
      });

      return updatedSprint;
    }),

  /**
   * Reorder issues within a sprint
   */
  reorderIssues: protectedProcedure
    .input(reorderIssuesSchema)
    .mutation(async ({ ctx, input }) => {
      const { prisma } = ctx;

      const sprint = await prisma.sprint.findUnique({
        where: { id: input.sprintId },
      });

      if (!sprint) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Sprint not found",
        });
      }

      // Verify all issues belong to this sprint
      const issues = await prisma.issue.findMany({
        where: {
          id: { in: input.issueIds },
          sprintId: sprint.id,
        },
        select: { id: true, sprintId: true },
      });

      if (issues.length !== input.issueIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "One or more issues are not in this sprint",
        });
      }

      const updates = input.issueIds.map((issueId, index) =>
        prisma.issue.update({
          where: { id: issueId },
          data: { order: index },
        })
      );

      await prisma.$transaction(updates);

      const reorderedIssues = await prisma.issue.findMany({
        where: { sprintId: sprint.id },
        orderBy: { order: "asc" },
      });

      return reorderedIssues;
    }),
});


