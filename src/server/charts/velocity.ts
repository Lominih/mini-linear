import { prisma } from "@/server/prisma";
import { TRPCError } from "@trpc/server";

// ─── Types ─────────────────────────────────────────────────

export interface VelocityDataPoint {
  sprintId: string;
  sprintName: string;
  startDate: string;
  endDate: string;
  completedIssues: number;
  totalIssues: number;
  completionRate: number; // 0-100
  velocity: number; // issues completed (primary metric)
}

export interface VelocityResult {
  projectId: string;
  sprints: VelocityDataPoint[];
  averageVelocity: number;
  trend: "increasing" | "decreasing" | "stable" | "insufficient_data";
  forecast: {
    nextSprintEstimate: number;
    confidence: "high" | "medium" | "low";
    basedOnSprints: number;
  };
}

// ─── Helpers ───────────────────────────────────────────────

function calculateTrend(velocities: number[]): VelocityResult["trend"] {
  if (velocities.length < 3) return "insufficient_data";

  const recent = velocities.slice(-3);
  const earlier = velocities.slice(0, Math.max(velocities.length - 3, 1));

  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const earlierAvg = earlier.reduce((a, b) => a + b, 0) / earlier.length;

  const threshold = Math.max(earlierAvg * 0.1, 1); // 10% change or at least 1 issue

  if (recentAvg - earlierAvg > threshold) return "increasing";
  if (earlierAvg - recentAvg > threshold) return "decreasing";
  return "stable";
}

// ─── Velocity Calculation ──────────────────────────────────

export async function calculateVelocity(
  projectId: string,
  sprintCount: number = 6
): Promise<VelocityResult> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Project not found",
    });
  }

  // Get completed sprints, most recent first
  const sprints = await prisma.sprint.findMany({
    where: {
      projectId,
      status: "completed",
    },
    include: {
      issues: {
        select: {
          id: true,
          status: true,
        },
      },
    },
    orderBy: { endDate: "desc" },
    take: sprintCount,
  });

  const completedStatuses = new Set(["done", "completed", "closed"]);

  const sprintData: VelocityDataPoint[] = sprints
    .slice()
    .reverse() // chronological order
    .map((sprint) => {
      const totalIssues = sprint.issues.length;
      const completedIssues = sprint.issues.filter((i) =>
        completedStatuses.has(i.status)
      ).length;
      const completionRate =
        totalIssues > 0
          ? Math.round((completedIssues / totalIssues) * 100)
          : 0;

      return {
        sprintId: sprint.id,
        sprintName: sprint.name,
        startDate: sprint.startDate.toISOString().split("T")[0],
        endDate: sprint.endDate.toISOString().split("T")[0],
        completedIssues,
        totalIssues,
        completionRate,
        velocity: completedIssues,
      };
    });

  // Calculate average velocity
  const velocities = sprintData.map((s) => s.velocity);
  const averageVelocity =
    velocities.length > 0
      ? Math.round(
          (velocities.reduce((a, b) => a + b, 0) / velocities.length) * 10
        ) / 10
      : 0;

  const trend = calculateTrend(velocities);

  // Forecast next sprint
  let nextSprintEstimate = averageVelocity;
  let confidence: VelocityResult["forecast"]["confidence"] = "low";

  if (velocities.length >= 5) {
    // Weighted moving average (recent sprints weighted more)
    const weights = velocities.map((_, i) => i + 1);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    nextSprintEstimate =
      Math.round(
        (velocities.reduce((sum, v, i) => sum + v * weights[i], 0) /
          totalWeight) *
          10
      ) / 10;
    confidence = "high";
  } else if (velocities.length >= 3) {
    // Simple average of last 3
    const last3 = velocities.slice(-3);
    nextSprintEstimate =
      Math.round(
        (last3.reduce((a, b) => a + b, 0) / last3.length) * 10
      ) / 10;
    confidence = "medium";
  }

  return {
    projectId,
    sprints: sprintData,
    averageVelocity,
    trend,
    forecast: {
      nextSprintEstimate: Math.round(nextSprintEstimate),
      confidence,
      basedOnSprints: velocities.length,
    },
  };
}
