import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc";
import { TRPCError } from "@trpc/server";

export const notificationRouter = router({
  // ©¤©¤ List user notifications (unread first) ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤

  list: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(100).default(50),
          cursor: z.string().optional(),
          unreadOnly: z.boolean().default(false),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const { limit = 50, cursor, unreadOnly = false } = input ?? {};

      const where: Record<string, unknown> = {
        userId: ctx.user.userId,
      };

      if (unreadOnly) {
        where.read = false;
      }

      const notifications = await ctx.prisma.notification.findMany({
        where,
        orderBy: [{ read: "asc" }, { createdAt: "desc" }],
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
      });

      let nextCursor: string | undefined;
      if (notifications.length > limit) {
        const next = notifications.pop();
        nextCursor = next?.id;
      }

      return {
        notifications: notifications.map((n) => ({
          ...n,
          link: n.link,
          createdAt: n.createdAt.toISOString(),
        })),
        nextCursor,
      };
    }),

  // ©¤©¤ Mark single notification as read ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤

  markRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const notification = await ctx.prisma.notification.findUnique({
        where: { id: input.id },
      });

      if (!notification) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Notification not found" });
      }

      if (notification.userId !== ctx.user.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });
      }

      return ctx.prisma.notification.update({
        where: { id: input.id },
        data: { read: true },
      });
    }),

  // ©¤©¤ Mark all notifications as read ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await ctx.prisma.notification.updateMany({
      where: {
        userId: ctx.user.userId,
        read: false,
      },
      data: { read: true },
    });

    return { count: result.count };
  }),

  // ©¤©¤ Get unread notification count ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤

  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    const count = await ctx.prisma.notification.count({
      where: {
        userId: ctx.user.userId,
        read: false,
      },
    });

    return { count };
  }),
});
