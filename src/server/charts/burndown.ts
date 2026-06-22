import { prisma } from "@/server/prisma";
import { TRPCError } from "@trpc/server";

// ─── Types ─────────────────────────────────────────────────

export interface BurndownDataPoint {
  date: string;
  ideal: number;
  actual: number;
}

export interface BurndownResult {
  sprintId: string;
  sprintName: string;
  startDate: string;
  endDate: string;
  totalIssues: number;
  dataPoints: BurndownDataPoint[];
  accuracy: number; // 0-100, how close actual is to ideal
}

// ─── Helpers ───────────────────────────────────────────────

function toDateKey(date: Date): string {
  return date.toISOString().split("T")[0];
}

function daysBetween(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((end.getTime() - start.getTime()) / msPerDay);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// ─── Burndown Calculation ──────────────────────────────────

export async function calculateBurndown(
  sprintId: string
): Promise<BurndownResult> {
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    include: {
      issues: {
        select: {
          id: true,
          status: true,
          updatedAt: true,
        },
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
  const totalIssues = sprint.issues.length;

  if (totalIssues === 0) {
    return {
      sprintId: sprint.id,
      sprintName: sprint.name,
      startDate: toDateKey(startDate),
      endDate: toDateKey(endDate),
      totalIssues: 0,
      dataPoints: [],
      accuracy: 100,
    };
  }

  const totalDays = daysBetween(startDate, endDate);
  if (totalDays <= 0) {
    return {
      sprintId: sprint.id,
      sprintName: sprint.name,
      startDate: toDateKey(startDate),
      endDate: toDateKey(endDate),
      totalIssues,
      dataPoints: [],
      accuracy: 100,
    };
  }

  // Build a map of completion dates: for each issue that's done,
  // record the date it was completed (using updatedAt)
  const completedStatuses = new Set(["done", "completed", "closed"]);
  const completionDates: Date[] = [];

  for (const issue of sprint.issues) {
    if (completedStatuses.has(issue.status)) {
      const completedAt = new Date(issue.updatedAt);
      // Clamp to sprint range
      if (completedAt < startDate) {
        completionDates.push(startDate);
      } else if (completedAt > endDate) {
        completionDates.push(endDate);
      } else {
        completionDates.push(completedAt);
      }
    }
  }

  // Generate data points for each day of the sprint
  const dataPoints: BurndownDataPoint[] = [];
  const now = new Date();

  for (let dayIndex = 0; dayIndex <= totalDays; dayIndex++) {
    const currentDate = addDays(startDate, dayIndex);
    const dateKey = toDateKey(currentDate);

    // Ideal: linear decrease from totalIssues to 0
    const ideal = totalIssues - (totalIssues / totalDays) * dayIndex;

    // Actual: count issues still open at end of this day
    const endOfDay = addDays(currentDate, 1);
    const completedByDay = completionDates.filter(
      (cd) => cd < endOfDay
    ).length;
    const actual = totalIssues - completedByDay;

    dataPoints.push({
      date: dateKey,
      ideal: Math.round(ideal * 100) / 100,
      actual,
    });

    // Stop generating future data points if sprint hasn't started yet
    // or we've passed today for active sprints
    if (sprint.status === "active" && currentDate > now) {
      break;
    }
  }

  // Calculate accuracy: mean absolute difference between ideal and actual
  // normalized to a 0-100 scale (100 = perfect)
  let totalDiff = 0;
  let count = 0;
  for (const point of dataPoints) {
    if (point.ideal > 0) {
      totalDiff += Math.abs(point.actual - point.ideal) / totalIssues;
      count++;
    }
  }
  const accuracy =
    count > 0
      ? Math.round(Math.max(0, (1 - totalDiff / count) * 100))
      : 100;

  return {
    sprintId: sprint.id,
    sprintName: sprint.name,
    startDate: toDateKey(startDate),
    endDate: toDateKey(endDate),
    totalIssues,
    dataPoints,
    accuracy,
  };
}
