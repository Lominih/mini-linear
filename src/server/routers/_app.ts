import { router } from "@/server/trpc";
import { issueRouter } from "./issue";
import { issueBatchRouter } from "./issue-batch";
import { sprintRouter } from "./sprint";
import { notificationRouter } from "./notification";
import { activityRouter } from "./activity";
import { integrationRouter } from "./integration";
import { webhookRouter } from "./webhook";

export const appRouter = router({
  issue: issueRouter,
  issueBatch: issueBatchRouter,
  sprint: sprintRouter,
  notification: notificationRouter,
  activity: activityRouter,
  integration: integrationRouter,
  webhook: webhookRouter,
});

export type AppRouter = typeof appRouter;
