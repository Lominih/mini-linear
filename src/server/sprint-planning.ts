import { prisma } from "@/server/prisma";
import { TRPCError } from "@trpc/server";

// ─── Types ─────────────────────────────────────────────────

interface SprintBasic {
  id: string;
  name: string;
  status: string;
  startDate: Date;
  endDate: Date;
  projectId: string;
}

export interface SprintCapacity {
  totalDays: number;
  workingDays: number;
  issueCount: number;
  completedCount: number;
  utilizationPercentage: number;
  isOverloaded: boolean;
  recommendation: string;
}

export interface SuggestedIssue {
  id: string;
  title: string;
  priority: string;
  status: string;
  createdAt: Date;
  dueDate: Date | null;
  matchScore: number;
}

export interface SprintHealth {
  status: "overloaded" | "on_track" | "behind" | "ahead" | "not_started" | "completed";
  completionPercentage: number;
  timeElapsedPercentage: number;
  issuesRemaining: number;
  daysRemaining: number;
  averageIssuesPerDay: number;
  projectedCompletionDate: Date | null;
}

// ─── Helpers ───────────────────────────────────────────────

function countWorkingDays(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);

  while (current <= endDate) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

function daysBetween(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((end.getTime() - start.getTime()) / msPerDay);
}

function getPriorityWeight(priority: string): number {
  switch (priority?.toLowerCase()) {
    case "urgent":
      return 5;
    case "high":
      return 4;
    case "medium":
      return 3;
    case "low":
      return 2;
    case "none":
      return 1;
    default:
      return 3;
  }
}

// ─── Validation ────────────────────────────────────────────

export function startSprintValidation(sprint: SprintBasic): void {
  if (sprint.status !== "planning") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Sprint "${sprint.name}" cannot be started — current status is "${sprint.status}"`,
    });
  }
}

export function completeSprintValidation(sprint: SprintBasic): void {
  if (sprint.status !== "active") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Sprint "${sprint.name}" cannot be completed — current status is "${sprint.status}"`,
    });
  }
}

// ─── Capacity ──────────────────────────────────────────────

export async function validateSprintCapacity(
  sprintId: string,
  maxIssues?: number
): Promise<SprintCapacity> {
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    include: {
      issues: {
        select: { id: true, status: true },
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
  const totalDays = daysBetween(startDate, endDate);
  const workingDays = countWorkingDays(startDate, endDate);
  const issueCount = sprint.issues.length;
  const completedCount = sprint.issues.filter(
    (i) => i.status === "done" || i.status === "completed"
  ).length;

  const effectiveMax = maxIssues ?? workingDays * 3; // heuristic: 3 issues per working day
  const utilizationPercentage =
    effectiveMax > 0 ? Math.round((issueCount / effectiveMax) * 100) : 0;
  const isOverloaded = issueCount > effectiveMax;

  let recommendation: string;
  if (isOverloaded) {
    const excess = issueCount - effectiveMax;
    recommendation = `Sprint is overloaded by ${excess} issues. Consider removing ${Math.ceil(excess / 2)} issues or extending the date range.`;
  } else if (utilizationPercentage > 80) {
    recommendation = "Sprint is near capacity. Consider deferring lower-priority issues.";
  } else if (utilizationPercentage < 30) {
    recommendation = "Sprint has significant spare capacity. Consider pulling in more issues from the backlog.";
  } else {
    recommendation = "Sprint capacity looks healthy.";
  }

  return {
    totalDays,
    workingDays,
    issueCount,
    completedCount,
    utilizationPercentage,
    isOverloaded,
    recommendation,
  };
}

// ─── Auto-Suggest Issues ───────────────────────────────────

export async function suggestIssuesForSprint(
  projectId: string,
  sprintId: string,
  limit: number = 10
): Promise<SuggestedIssue[]> {
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    select: { id: true, projectId: true, startDate: true, endDate: true },
  });

  if (!sprint) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Sprint not found",
    });
  }

  if (sprint.projectId !== projectId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Sprint does not belong to this project",
    });
  }

  // Get issues in backlog (no sprint assigned) for this project
  const backlogIssues = await prisma.issue.findMany({
    where: {
      projectId,
      sprintId: null,
      status: {
        notIn: ["done", "completed", "cancelled"],
      },
    },
    orderBy: [
      { priority: "desc" },
      { createdAt: "asc" },
    ],
  });

  // Score issues based on priority and age
  const now = new Date();
  const scoredIssues = backlogIssues.map((issue) => {
    const priorityScore = getPriorityWeight(issue.priority) * 20;
    const ageInDays = daysBetween(new Date(issue.createdAt), now);
    const ageScore = Math.min(ageInDays * 2, 30); // cap age bonus at 30

    const hasUrgentDueDate =
      issue.dueDate &&
      new Date(issue.dueDate) <= new Date(sprint.endDate);
    const dueDateScore = hasUrgentDueDate ? 25 : 0;

    const matchScore = priorityScore + ageScore + dueDateScore;

    return {
      id: issue.id,
      title: issue.title,
      priority: issue.priority,
      status: issue.status,
      createdAt: issue.createdAt,
      dueDate: issue.dueDate,
      matchScore,
    };
  });

  // Sort by match score descending and return top N
  scoredIssues.sort((a, b) => b.matchScore - a.matchScore);
  return scoredIssues.slice(0, limit);
}

// ─── Sprint Health Check ───────────────────────────────────

export async function checkSprintHealth(sprintId: string): Promise<SprintHealth> {
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    include: {
      issues: {
        select: { id: true, status: true },
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
  const now = new Date();

  const totalDays = daysBetween(startDate, endDate);
  const totalDuration = endDate.getTime() - startDate.getTime();
  const elapsed = now.getTime() - startDate.getTime();
  const remaining = Math.max(endDate.getTime() - now.getTime(), 0);

  const totalIssues = sprint.issues.length;
  const completedCount = sprint.issues.filter(
    (i) => i.status === "done" || i.status === "completed"
  ).length;
  const issuesRemaining = totalIssues - completedCount;

  const completionPercentage =
    totalIssues > 0 ? Math.round((completedCount / totalIssues) * 100) : 0;
  const timeElapsedPercentage =
    totalDuration > 0
      ? Math.round(Math.min(Math.max(elapsed / totalDuration, 0), 1) * 100)
      : 0;

  const daysRemaining = Math.ceil(remaining / (24 * 60 * 60 * 1000));
  const elapsedDays = totalDays - daysRemaining;
  const averageIssuesPerDay =
    elapsedDays > 0 ? completedCount / elapsedDays : 0;

  // Project completion date based on current velocity
  let projectedCompletionDate: Date | null = null;
  if (averageIssuesPerDay > 0 && issuesRemaining > 0) {
    const daysToComplete = issuesRemaining / averageIssuesPerDay;
    projectedCompletionDate = new Date(
      now.getTime() + daysToComplete * 24 * 60 * 60 * 1000
    );
  } else if (completedCount === totalIssues && totalIssues > 0) {
    projectedCompletionDate = now;
  }

  // Determine health status
  let status: SprintHealth["status"];
  if (sprint.status === "completed") {
    status = "completed";
  } else if (sprint.status === "planning") {
    status = "not_started";
  } else {
    const ratio =
      timeElapsedPercentage > 0
        ? completionPercentage / timeElapsedPercentage
        : completionPercentage > 0
        ? Infinity
        : 0;

    if (completionPercentage >= 100) {
      status = "ahead";
    } else if (ratio >= 1.1) {
      status = "ahead";
    } else if (ratio >= 0.85) {
      status = "on_track";
    } else {
      status = issuesRemaining > 0 && daysRemaining <= 0 ? "overloaded" : "behind";
    }
  }

  return {
    status,
    completionPercentage,
    timeElapsedPercentage,
    issuesRemaining,
    daysRemaining,
    averageIssuesPerDay: Math.round(averageIssuesPerDay * 10) / 10,
    projectedCompletionDate,
  };
}
