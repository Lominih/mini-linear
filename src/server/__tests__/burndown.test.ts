import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

const mockFindUnique = vi.fn();

vi.mock("@/server/prisma", () => ({
  prisma: {
    sprint: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

import { calculateBurndown } from "@/server/charts/burndown";

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(0, 0, 0, 0);
  return d;
}

describe("calculateBurndown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws TRPCError when sprint is not found", async () => {
    mockFindUnique.mockResolvedValue(null);
    await expect(calculateBurndown("nonexistent")).rejects.toThrow(TRPCError);
  });

  it("returns empty dataPoints for sprint with no issues", async () => {
    mockFindUnique.mockResolvedValue({
      id: "s-1",
      name: "Sprint 1",
      startDate: daysAgo(14),
      endDate: daysAgo(0),
      status: "completed",
      issues: [],
    });

    const result = await calculateBurndown("s-1");
    expect(result.totalIssues).toBe(0);
    expect(result.dataPoints).toEqual([]);
    expect(result.accuracy).toBe(100);
  });

  it("returns empty dataPoints when totalDays <= 0", async () => {
    const today = daysAgo(0);
    mockFindUnique.mockResolvedValue({
      id: "s-1",
      name: "Sprint 1",
      startDate: today,
      endDate: today,
      status: "completed",
      issues: [{ id: "i-1", status: "done", updatedAt: today }],
    });

    const result = await calculateBurndown("s-1");
    expect(result.dataPoints).toEqual([]);
  });

  it("calculates burndown for a completed sprint with all issues done", async () => {
    const startDate = daysAgo(14);
    const endDate = daysAgo(0);

    mockFindUnique.mockResolvedValue({
      id: "s-1",
      name: "Sprint 1",
      startDate,
      endDate,
      status: "completed",
      issues: [
        { id: "i-1", status: "done", updatedAt: daysAgo(10) },
        { id: "i-2", status: "done", updatedAt: daysAgo(5) },
        { id: "i-3", status: "done", updatedAt: daysAgo(1) },
      ],
    });

    const result = await calculateBurndown("s-1");
    expect(result.totalIssues).toBe(3);
    expect(result.sprintName).toBe("Sprint 1");
    expect(result.dataPoints.length).toBeGreaterThan(0);
    // First point should have all issues remaining
    expect(result.dataPoints[0].actual).toBe(3);
    // Last point should have 0 remaining (all completed before end)
    expect(result.dataPoints[result.dataPoints.length - 1].actual).toBe(0);
    expect(result.accuracy).toBeGreaterThanOrEqual(0);
    expect(result.accuracy).toBeLessThanOrEqual(100);
  });

  it("calculates burndown for a completed sprint with partial completion", async () => {
    const startDate = daysAgo(14);
    const endDate = daysAgo(0);

    mockFindUnique.mockResolvedValue({
      id: "s-2",
      name: "Sprint 2",
      startDate,
      endDate,
      status: "completed",
      issues: [
        { id: "i-1", status: "done", updatedAt: daysAgo(10) },
        { id: "i-2", status: "in_progress", updatedAt: daysAgo(2) },
        { id: "i-3", status: "todo", updatedAt: daysAgo(14) },
      ],
    });

    const result = await calculateBurndown("s-2");
    expect(result.totalIssues).toBe(3);
    // Last point should have 2 remaining (only 1 completed)
    expect(result.dataPoints[result.dataPoints.length - 1].actual).toBe(2);
  });

  it("generates correct ideal line", async () => {
    const startDate = daysAgo(10);
    const endDate = daysAgo(0); // 10 days

    mockFindUnique.mockResolvedValue({
      id: "s-3",
      name: "Sprint 3",
      startDate,
      endDate,
      status: "completed",
      issues: [
        { id: "i-1", status: "todo", updatedAt: new Date() },
        { id: "i-2", status: "todo", updatedAt: new Date() },
        { id: "i-3", status: "todo", updatedAt: new Date() },
        { id: "i-4", status: "todo", updatedAt: new Date() },
      ],
    });

    const result = await calculateBurndown("s-3");
    // Ideal line starts at totalIssues
    expect(result.dataPoints[0].ideal).toBe(4);
    // Ideal line ends at 0
    expect(result.dataPoints[result.dataPoints.length - 1].ideal).toBe(0);
  });

  it("stops generating future data points for active sprints", async () => {
    const startDate = daysAgo(5);
    const endDate = daysFromNow(9); // ends in future

    mockFindUnique.mockResolvedValue({
      id: "s-4",
      name: "Sprint 4",
      startDate,
      endDate,
      status: "active",
      issues: [
        { id: "i-1", status: "done", updatedAt: daysAgo(2) },
        { id: "i-2", status: "todo", updatedAt: daysAgo(5) },
      ],
    });

    const result = await calculateBurndown("s-4");
    // Should have data points up to today but not beyond
    const lastPoint = result.dataPoints[result.dataPoints.length - 1];
    const lastDate = new Date(lastPoint.date);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(lastDate.getTime()).toBeLessThan(tomorrow.getTime());
  });
});
