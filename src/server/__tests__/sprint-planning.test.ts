import { describe, it, expect, vi } from "vitest";

// Mock prisma before importing sprint-planning
vi.mock("@/server/prisma", () => ({
  prisma: {},
}));

import { startSprintValidation, completeSprintValidation } from "@/server/sprint-planning";

// ─── Sprint Validation (sync, no DB) ────────────────────────────────────────

describe("startSprintValidation", () => {
  it("accepts a sprint in planning status", () => {
    expect(() =>
      startSprintValidation({
        id: "s-1",
        name: "Sprint 1",
        status: "planning",
        startDate: new Date("2026-07-01"),
        endDate: new Date("2026-07-14"),
        projectId: "proj-1",
      })
    ).not.toThrow();
  });

  it("throws for sprint in active status", () => {
    expect(() =>
      startSprintValidation({
        id: "s-1",
        name: "Sprint 1",
        status: "active",
        startDate: new Date("2026-07-01"),
        endDate: new Date("2026-07-14"),
        projectId: "proj-1",
      })
    ).toThrow(/cannot be started/);
  });

  it("throws for sprint in completed status", () => {
    expect(() =>
      startSprintValidation({
        id: "s-1",
        name: "Sprint 1",
        status: "completed",
        startDate: new Date("2026-07-01"),
        endDate: new Date("2026-07-14"),
        projectId: "proj-1",
      })
    ).toThrow(/cannot be started/);
  });

  it("includes sprint name in error message", () => {
    expect(() =>
      startSprintValidation({
        id: "s-1",
        name: "My Sprint",
        status: "active",
        startDate: new Date("2026-07-01"),
        endDate: new Date("2026-07-14"),
        projectId: "proj-1",
      })
    ).toThrow(/My Sprint/);
  });

  it("includes current status in error message", () => {
    expect(() =>
      startSprintValidation({
        id: "s-1",
        name: "Sprint 1",
        status: "active",
        startDate: new Date("2026-07-01"),
        endDate: new Date("2026-07-14"),
        projectId: "proj-1",
      })
    ).toThrow(/active/);
  });
});

describe("completeSprintValidation", () => {
  it("accepts a sprint in active status", () => {
    expect(() =>
      completeSprintValidation({
        id: "s-1",
        name: "Sprint 1",
        status: "active",
        startDate: new Date("2026-07-01"),
        endDate: new Date("2026-07-14"),
        projectId: "proj-1",
      })
    ).not.toThrow();
  });

  it("throws for sprint in planning status", () => {
    expect(() =>
      completeSprintValidation({
        id: "s-1",
        name: "Sprint 1",
        status: "planning",
        startDate: new Date("2026-07-01"),
        endDate: new Date("2026-07-14"),
        projectId: "proj-1",
      })
    ).toThrow(/cannot be completed/);
  });

  it("throws for sprint in completed status", () => {
    expect(() =>
      completeSprintValidation({
        id: "s-1",
        name: "Sprint 1",
        status: "completed",
        startDate: new Date("2026-07-01"),
        endDate: new Date("2026-07-14"),
        projectId: "proj-1",
      })
    ).toThrow(/cannot be completed/);
  });

  it("includes sprint name in error message", () => {
    expect(() =>
      completeSprintValidation({
        id: "s-1",
        name: "Old Sprint",
        status: "planning",
        startDate: new Date("2026-07-01"),
        endDate: new Date("2026-07-14"),
        projectId: "proj-1",
      })
    ).toThrow(/Old Sprint/);
  });
});
