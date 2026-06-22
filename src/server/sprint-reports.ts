import { prisma } from "@/server/prisma";
import { TRPCError } from "@trpc/server";
import { calculateBurndown, type BurndownResult } from "@/server/charts/burndown";
import { calculateVelocity, type VelocityResult } from "@/server/charts/velocity";
import { getSprintRetrospective, type RetrospectiveStats } from "@/server/retrospective";

// ─── Types ─────────────────────────────────────────────────

export interface SprintSummary {
  sprintId: string;
  sprintName: string;
  startDate: string;
  endDate: string;
  status: string;
  goal: string | null;
  description: string | null;

  planned: {
    totalIssues: number;
    storyPoints: number | null;
  };

  completed: {
    totalIssues: number;
    completionRate: number;
  };

  carryover: {
    count: number;
    percentage: number;
  };

  duration: {
    totalDays: number;
    workingDays: number;
  };
}

export interface BurndownAccuracyReport {
  sprintId: string;
  sprintName: string;
  accuracy: number;
  deviation: "ahead" | "on_track" | "behind";
  averageDeviation: number; // average daily deviation from ideal
  dataPoints: BurndownResult["dataPoints"];
}

export interface VelocityTrendReport {
  projectId: string;
  currentSprintVelocity: number | null;
  previousSprintVelocities: Array<{
    sprintName: string;
    velocity: number;
    completionRate: number;
  }>;
  averageVelocity: number;
  trend: VelocityResult["trend"];
  forecast: VelocityResult["forecast"];
}

export interface SprintReport {
  summary: SprintSummary;
  burndown: BurndownAccuracyReport;
  velocity: VelocityTrendReport;
  retrospective: RetrospectiveStats;
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

// ─── Sprint Summary ────────────────────────────────────────

export async function generateSprintSummary(
  sprintId: string
): Promise<SprintSummary> {
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
  const completedStatuses = new Set(["done", "completed", "closed"]);

  const totalIssues = sprint.issues.length;
  const completedIssues = sprint.issues.filter((i) =>
    completedStatuses.has(i.status)
  ).length;
  const carryoverCount = totalIssues - completedIssues;

  return {
    sprintId: sprint.id,
    sprintName: sprint.name,
    startDate: sprint.startDate.toISOString().split("T")[0],
    endDate: sprint.endDate.toISOString().split("T")[0],
    status: sprint.status,
    goal: sprint.goal,
    description: sprint.description,
    planned: {
      totalIssues,
      storyPoints: null, // Story points not in current schema
    },
    completed: {
      totalIssues: completedIssues,
      completionRate:
        totalIssues > 0
          ? Math.round((completedIssues / totalIssues) * 100)
          : 0,
    },
    carryover: {
      count: carryoverCount,
      percentage:
        totalIssues > 0
          ? Math.round((carryoverCount / totalIssues) * 100)
          : 0,
    },
    duration: {
      totalDays: daysBetween(startDate, endDate),
      workingDays: countWorkingDays(startDate, endDate),
    },
  };
}

// ─── Burndown Accuracy ─────────────────────────────────────

export async function generateBurndownAccuracyReport(
  sprintId: string
): Promise<BurndownAccuracyReport> {
  const burndown = await calculateBurndown(sprintId);

  const validPoints = burndown.dataPoints.filter(
    (p) => p.actual !== null
  );

  let deviation: BurndownAccuracyReport["deviation"] = "on_track";
  if (validPoints.length >= 2) {
    const lastPoint = validPoints[validPoints.length - 1];
    if (lastPoint.actual < lastPoint.ideal - 1) {
      deviation = "ahead";
    } else if (lastPoint.actual > lastPoint.ideal + 1) {
      deviation = "behind";
    }
  }

  const totalDeviation = validPoints.reduce(
    (sum, p) => sum + Math.abs(p.actual - p.ideal),
    0
  );
  const averageDeviation =
    validPoints.length > 0
      ? Math.round((totalDeviation / validPoints.length) * 10) / 10
      : 0;

  return {
    sprintId: burndown.sprintId,
    sprintName: burndown.sprintName,
    accuracy: burndown.accuracy,
    deviation,
    averageDeviation,
    dataPoints: burndown.dataPoints,
  };
}

// ─── Velocity Trend ────────────────────────────────────────

export async function generateVelocityTrendReport(
  projectId: string,
  currentSprintId?: string
): Promise<VelocityTrendReport> {
  const velocityData = await calculateVelocity(projectId, 10);

  let currentSprintVelocity: number | null = null;

  if (currentSprintId) {
    const sprint = await prisma.sprint.findUnique({
      where: { id: currentSprintId },
      include: {
        issues: { select: { status: true } },
      },
    });

    if (sprint) {
      const completedStatuses = new Set(["done", "completed", "closed"]);
      currentSprintVelocity = sprint.issues.filter((i) =>
        completedStatuses.has(i.status)
      ).length;
    }
  }

  return {
    projectId,
    currentSprintVelocity,
    previousSprintVelocities: velocityData.sprints.map((s) => ({
      sprintName: s.sprintName,
      velocity: s.velocity,
      completionRate: s.completionRate,
    })),
    averageVelocity: velocityData.averageVelocity,
    trend: velocityData.trend,
    forecast: velocityData.forecast,
  };
}

// ─── Full Sprint Report ────────────────────────────────────

export async function generateSprintReport(
  sprintId: string
): Promise<SprintReport> {
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    select: { projectId: true },
  });

  if (!sprint) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Sprint not found",
    });
  }

  const [summary, burndown, velocity, retrospective] = await Promise.all([
    generateSprintSummary(sprintId),
    generateBurndownAccuracyReport(sprintId),
    generateVelocityTrendReport(sprint.projectId, sprintId),
    getSprintRetrospective(sprintId),
  ]);

  return {
    summary,
    burndown,
    velocity,
    retrospective,
  };
}
