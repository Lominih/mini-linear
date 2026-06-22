import { initTRPC, TRPCError } from "@trpc/server";
import { type Context } from "@/server/context";

// ─── tRPC Initialization ─────────────────────────────────

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof Error
            ? error.cause.message
            : error.cause,
      },
    };
  },
});

// ─── Router & Procedure Builders ─────────────────────────

export const router = t.router;
export const publicProcedure = t.procedure;

// Middleware that requires authentication
const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this resource",
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user, // guaranteed non-null
    },
  });
});

export const protectedProcedure = t.procedure.use(enforceAuth);

export { t };