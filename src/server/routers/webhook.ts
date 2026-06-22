import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc";
import { TRPCError } from "@trpc/server";
import {
  registerWebhook,
  updateWebhook,
  deleteWebhook,
  dispatchWebhook,
  getWebhookLogs,
  getValidWebhookEvents,
  type WebhookEventType,
} from "@/server/webhooks";

// ─── Schemas ─────────────────────────────────────────────────────────────────

const webhookEventEnum = z.enum([
  "ISSUE_CREATED",
  "ISSUE_UPDATED",
  "ISSUE_DELETED",
  "ISSUE_STATUS_CHANGED",
  "ISSUE_ASSIGNED",
  "COMMENT_CREATED",
  "SPRINT_STARTED",
  "SPRINT_COMPLETED",
  "PROJECT_UPDATED",
]);

const createWebhookSchema = z.object({
  projectId: z.string().min(1),
  url: z.string().url("Must be a valid URL"),
  secret: z.string().min(16).max(256).optional(),
  events: z.array(webhookEventEnum).min(1, "At least one event is required"),
});

const updateWebhookSchema = z.object({
  id: z.string().min(1),
  url: z.string().url().optional(),
  secret: z.string().min(16).max(256).optional(),
  events: z.array(webhookEventEnum).optional(),
  active: z.boolean().optional(),
});

const getLogsSchema = z.object({
  webhookId: z.string().min(1),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
  status: z.enum(["pending", "success", "failed"]).optional(),
});

const testWebhookSchema = z.object({
  webhookId: z.string().min(1),
});

// ─── Router ──────────────────────────────────────────────────────────────────

export const webhookRouter = router({
  /**
   * Create a new webhook for a project.
   */
  create: protectedProcedure
    .input(createWebhookSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify project exists
      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
      });

      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }

      const webhook = await registerWebhook({
        projectId: input.projectId,
        url: input.url,
        secret: input.secret,
        events: input.events,
      });

      return webhook;
    }),

  /**
   * Get a webhook by ID.
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const webhook = await ctx.prisma.webhook.findUnique({
        where: { id: input.id },
        include: {
          project: {
            select: { id: true, name: true, key: true },
          },
          _count: {
            select: { logs: true },
          },
        },
      });

      if (!webhook) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Webhook not found" });
      }

      return {
        ...webhook,
        events: parseEvents(webhook.events),
      };
    }),

  /**
   * List webhooks for a project.
   */
  list: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const webhooks = await ctx.prisma.webhook.findMany({
        where: { projectId: input.projectId },
        include: {
          _count: {
            select: { logs: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return webhooks.map((wh) => ({
        ...wh,
        events: parseEvents(wh.events),
      }));
    }),

  /**
   * Update an existing webhook.
   */
  update: protectedProcedure
    .input(updateWebhookSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.webhook.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Webhook not found" });
      }

      const updated = await updateWebhook(input.id, {
        url: input.url,
        secret: input.secret,
        events: input.events,
        active: input.active,
      });

      return {
        ...updated,
        events: parseEvents(updated.events),
      };
    }),

  /**
   * Delete a webhook.
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.webhook.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Webhook not found" });
      }

      await deleteWebhook(input.id);
      return { success: true };
    }),

  /**
   * Toggle webhook active status.
   */
  toggle: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.webhook.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Webhook not found" });
      }

      const updated = await updateWebhook(input.id, { active: !existing.active });

      return {
        ...updated,
        events: parseEvents(updated.events),
      };
    }),

  /**
   * Test a webhook by sending a ping event.
   */
  test: protectedProcedure
    .input(testWebhookSchema)
    .mutation(async ({ ctx, input }) => {
      const webhook = await ctx.prisma.webhook.findUnique({
        where: { id: input.webhookId },
      });

      if (!webhook) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Webhook not found" });
      }

      const results = await dispatchWebhook("PROJECT_UPDATED" as WebhookEventType, webhook.projectId, {
        test: true,
        message: "Webhook test ping",
        webhookId: webhook.id,
        timestamp: new Date().toISOString(),
      });

      return {
        webhookId: webhook.id,
        url: webhook.url,
        deliveries: results,
      };
    }),

  /**
   * Get delivery logs for a webhook.
   */
  getLogs: protectedProcedure
    .input(getLogsSchema)
    .query(async ({ ctx, input }) => {
      const webhook = await ctx.prisma.webhook.findUnique({
        where: { id: input.webhookId },
      });

      if (!webhook) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Webhook not found" });
      }

      const result = await getWebhookLogs(input.webhookId, {
        limit: input.limit,
        offset: input.offset,
        status: input.status,
      });

      return result;
    }),

  /**
   * Get all valid webhook event types.
   */
  getEventTypes: protectedProcedure.query(() => {
    return getValidWebhookEvents();
  }),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseEvents(raw: string): WebhookEventType[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}
