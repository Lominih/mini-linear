import { prisma } from "@/server/prisma";
import { TRPCError } from "@trpc/server";

// âââ Types âââââââââââââââââââââââââââââââââââââââââââââââââ

export interface RetrospectiveStats {
  sprintId: string;
  sprintName: string;
  startDate: string;
  endDate: string;
  status: string;

  planned: {
    totalIssues: number;
    completedIssues: number;
    incompleteIssues: number;
  };

  carryover: {
    count: number;
    issues: Array<{
      id: string;
      title: string;
      status: string;
      priority: string;
      carriedToSprintId: string | null;
      carriedToSprintName: string | null;
    }>;
  };

  completionRate: number; // 0-100

  cycleTime: {
    averageDays: number;
    medianDays: number;
    minDays: number;
    maxDays: number;
    issueCount: number; // how many issues had completed cycle time
  };

  timeDistribution: Array<{
    status: string;
    totalTimeMs: number;
    totalTimeDays: number;
    percentage: number;
  }>;

  throughput: {
    completedPerDay: number;
    totalCompletedInSprint: number;
    sprintDurationDays: number;
  };
}

// âââ Helpers âââââââââââââââââââââââââââââââââââââââââââââââ

function daysBetween(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return (end.getTime() - start.getTime()) / msPerDay;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

// âââ Main Function âââââââââââââââââââââââââââââââââââââââââ

export async function getSprintRetrospective(
  sprintId: string
): Promise<RetrospectiveStats> {
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    include: {
      issues: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!sprint) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Sprint not found",
    });
  }

  const startDate = new Date(sprint.startDate);
  const endDate = new Date(sprint.endDate);
  const sprintDurationDays = Math.max(daysBetween(startDate, endDate), 1);
  const completedStatuses = new Set(["done", "completed", "closed"]);
  const allIssues = sprint.issues;

  const completedIssues = allIssues.filter((i) =>
    completedStatuses.has(i.status)
  );
  const incompleteIssues = allIssues.filter(
    (i) => !completedStatuses.has(i.status)
  );

  // ©¤©¤ Carryover issues (batched to avoid N+1) ©¤©¤
  const nextSprint = await prisma.sprint.findFirst({
    where: {
      projectId: sprint.projectId,
      startDate: { gt: endDate },
    },
    orderBy: { startDate: "asc" },
    select: { id: true, name: true },
  });

  // Collect unique sprintIds from incomplete issues that differ from current sprint
  const targetSprintIds = [
    ...new Set(
      incompleteIssues
        .filter((i) => i.sprintId && i.sprintId !== sprint.id)
        .map((i) => i.sprintId as string)
    ),
  ];

  // Batch-fetch all target sprints
  const targetSprints = targetSprintIds.length > 0
    ? await prisma.sprint.findMany({
        where: { id: { in: targetSprintIds } },
        select: { id: true, name: true },
      })
    : [];
  const sprintMap = new Map(targetSprints.map((s) => [s.id, s.name]));

  // Batch-check which issues were moved to the next sprint
  let nextSprintIssueIds = new Set<string>();
  if (nextSprint) {
    const issuesInNextSprint = await prisma.issue.findMany({
      where: {
        id: { in: incompleteIssues.map((i) => i.id) },
        sprintId: nextSprint.id,
      },
      select: { id: true },
    });
    nextSprintIssueIds = new Set(issuesInNextSprint.map((i) => i.id));
  }

  const carryoverIssues = incompleteIssues.map((issue) => {
    let carriedToSprintId: string | null = null;
    let carriedToSprintName: string | null = null;

    if (issue.sprintId && issue.sprintId !== sprint.id && sprintMap.has(issue.sprintId)) {
      carriedToSprintId = issue.sprintId;
      carriedToSprintName = sprintMap.get(issue.sprintId) ?? null;
    } else if (nextSprint && nextSprintIssueIds.has(issue.id)) {
      carriedToSprintId = nextSprint.id;
      carriedToSprintName = nextSprint.name;
    }

    return {
      id: issue.id,
      title: issue.title,
      status: issue.status,
      priority: issue.priority,
      carriedToSprintId,
      carriedToSprintName,
    };
  });

  // ââ Completion rate âââââââââââââââââââââââââââââââââââââââ
  const completionRate =
    allIssues.length > 0
      ? Math.round((completedIssues.length / allIssues.length) * 100)
      : 0;

  // ââ Cycle time ââââââââââââââââââââââââââââââââââââââââââââ
  // Cycle time = time from issue creation to completion
  const cycleTimes: number[] = [];
  for (const issue of completedIssues) {
    const createdAt = new Date(issue.createdAt);
    const completedAt = new Date(issue.updatedAt);
    const cycleTimeDays = daysBetween(createdAt, completedAt);
    if (cycleTimeDays >= 0) {
      cycleTimes.push(cycleTimeDays);
    }
  }

  const cycleTime = {
    averageDays:
      cycleTimes.length > 0
        ? Math.round(
            (cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length) * 10
          ) / 10
        : 0,
    medianDays: Math.round(median(cycleTimes) * 10) / 10,
    minDays:
      cycleTimes.length > 0
        ? Math.round(Math.min(...cycleTimes) * 10) / 10
        : 0,
    maxDays:
      cycleTimes.length > 0
        ? Math.round(Math.max(...cycleTimes) * 10) / 10
        : 0,
    issueCount: cycleTimes.length,
  };

  // ââ Time distribution âââââââââââââââââââââââââââââââââââââ
  // Approximate time in each status based on issue lifecycle
  // Since we don't have explicit status change logs, we estimate:
  // - "todo" = time from creation until sprint start (or now)
  // - "in_progress" = estimated ~40% of cycle time for completed issues
  // - "done" = time from completion to sprint end (or now)
  // For incomplete issues, distribute remaining time to their current status

  const statusTotals: Record<string, number> = {};
  const now = new Date();

  for (const issue of allIssues) {
    const createdAt = new Date(issue.createdAt);
    const isCompleted = completedStatuses.has(issue.status);

    if (isCompleted) {
      const completedAt = new Date(issue.updatedAt);
      const totalCycleMs = completedAt.getTime() - createdAt.getTime();

      // Estimate: 25% todo, 50% in_progress, 25% done (buffer before end)
      const todoMs = totalCycleMs * 0.25;
      const progressMs = totalCycleMs * 0.50;
      const doneMs = totalCycleMs * 0.25;

      statusTotals["todo"] = (statusTotals["todo"] || 0) + todoMs;
      statusTotals["in_progress"] =
        (statusTotals["in_progress"] || 0) + progressMs;
      statusTotals["done"] = (statusTotals["done"] || 0) + doneMs;
    } else {
      // Incomplete issue: from creation to now
      const elapsed = Math.min(now.getTime(), endDate.getTime()) - createdAt.getTime();

      if (issue.status === "todo" || issue.status === "backlog") {
        statusTotals["todo"] = (statusTotals["todo"] || 0) + elapsed;
      } else if (
        issue.status === "in_progress" ||
        issue.status === "in-progress"
      ) {
        // Split: 30% todo wait, 70% in progress
        statusTotals["todo"] = (statusTotals["todo"] || 0) + elapsed * 0.3;
        statusTotals["in_progress"] =
          (statusTotals["in_progress"] || 0) + elapsed * 0.7;
      } else {
        // Other statuses (review, testing, etc.) â?treat as in_progress
        statusTotals["in_progress"] =
          (statusTotals["in_progress"] || 0) + elapsed;
      }
    }
  }

  const totalMsAllStatuses = Object.values(statusTotals).reduce(
    (a, b) => a + b,
    0
  );

  const timeDistribution = Object.entries(statusTotals)
    .map(([status, totalTimeMs]) => ({
      status,
      totalTimeMs: Math.round(totalTimeMs),
      totalTimeDays: Math.round((totalTimeMs / (24 * 60 * 60 * 1000)) * 10) / 10,
      percentage:
        totalMsAllStatuses > 0
          ? Math.round((totalTimeMs / totalMsAllStatuses) * 100)
          : 0,
    }))
    .sort((a, b) => b.totalTimeMs - a.totalTimeMs);

  // ââ Throughput âââââââââââââââââââââââââââââââââââââââââââââ
  const throughput = {
    completedPerDay:
      Math.round(
        (completedIssues.length / sprintDurationDays) * 10
      ) / 10,
    totalCompletedInSprint: completedIssues.length,
    sprintDurationDays: Math.round(sprintDurationDays * 10) / 10,
  };

  return {
    sprintId: sprint.id,
    sprintName: sprint.name,
    startDate: sprint.startDate.toISOString().split("T")[0],
    endDate: sprint.endDate.toISOString().split("T")[0],
    status: sprint.status,
    planned: {
      totalIssues: allIssues.length,
      completedIssues: completedIssues.length,
      incompleteIssues: incompleteIssues.length,
    },
    carryover: {
      count: carryoverIssues.filter((i) => i.carriedToSprintId !== null).length,
      issues: carryoverIssues,
    },
    completionRate,
    cycleTime,
    timeDistribution,
    throughput,
  };
}

