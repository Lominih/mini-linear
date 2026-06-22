import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma before importing search
const mockFindMany = vi.fn();
const mockCount = vi.fn();

vi.mock("@/server/prisma", () => ({
  prisma: {
    issue: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count: (...args: unknown[]) => mockCount(...args),
    },
  },
}));

import { searchIssues, searchIssuesCount } from "@/server/search";

// ─── Search Issues ───────────────────────────────────────────────────────────

describe("searchIssues", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when no issues match", async () => {
    mockFindMany.mockResolvedValue([]);
    const results = await searchIssues("nonexistent");
    expect(results).toEqual([]);
    expect(mockFindMany).toHaveBeenCalledOnce();
  });

  it("returns ranked results sorted by rank descending", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "1",
        title: "Login bug",
        description: "Login fails on mobile",
        status: "IN_PROGRESS",
        priority: "HIGH",
        projectId: "proj-1",
        assigneeId: "user-1",
        reporterId: "user-2",
        labels: '["bug"]',
        createdAt: new Date("2026-06-01"),
        updatedAt: new Date("2026-06-15"),
      },
      {
        id: "2",
        title: "Fix the login",
        description: "The login page is broken",
        status: "TODO",
        priority: "MEDIUM",
        projectId: "proj-1",
        assigneeId: null,
        reporterId: "user-1",
        labels: '["auth"]',
        createdAt: new Date("2026-06-02"),
        updatedAt: new Date("2026-06-14"),
      },
    ]);

    const results = await searchIssues("login");
    expect(results).toHaveLength(2);
    // Both should have rank > 0
    expect(results[0].rank).toBeGreaterThan(0);
    expect(results[1].rank).toBeGreaterThan(0);
    // Results should be sorted by rank
    expect(results[0].rank).toBeGreaterThanOrEqual(results[1].rank);
  });

  it("parses labels from JSON string", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "1",
        title: "Test",
        description: null,
        status: "BACKLOG",
        priority: "NONE",
        projectId: "proj-1",
        assigneeId: null,
        reporterId: "user-1",
        labels: '["bug","ui","urgent"]',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const results = await searchIssues("test");
    expect(results[0].labels).toEqual(["bug", "ui", "urgent"]);
  });

  it("handles empty labels gracefully", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "1",
        title: "Test",
        description: null,
        status: "BACKLOG",
        priority: "NONE",
        projectId: "proj-1",
        assigneeId: null,
        reporterId: "user-1",
        labels: "[]",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const results = await searchIssues("test");
    expect(results[0].labels).toEqual([]);
  });

  it("applies project filter", async () => {
    mockFindMany.mockResolvedValue([]);
    await searchIssues("test", { projectId: "proj-1" });
    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.where.projectId).toBe("proj-1");
  });

  it("applies status filter with enum mapping", async () => {
    mockFindMany.mockResolvedValue([]);
    await searchIssues("test", { status: "in_progress" });
    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.where.status).toBe("IN_PROGRESS");
  });

  it("applies priority filter with enum mapping", async () => {
    mockFindMany.mockResolvedValue([]);
    await searchIssues("test", { priority: "urgent" });
    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.where.priority).toBe("URGENT");
  });

  it("applies limit and offset", async () => {
    mockFindMany.mockResolvedValue([]);
    await searchIssues("test", {}, { limit: 5, offset: 10 });
    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.take).toBe(1000); // fetches up to 1000 then slices
  });

  it("applies labels filter with AND conditions", async () => {
    mockFindMany.mockResolvedValue([]);
    await searchIssues("test", { labels: ["bug", "ui"] });
    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.where.AND).toHaveLength(2);
  });

  it("extracts snippets from descriptions", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "1",
        title: "Bug Report",
        description: "This is a detailed description about the login bug that occurs frequently",
        status: "BACKLOG",
        priority: "NONE",
        projectId: "proj-1",
        assigneeId: null,
        reporterId: "user-1",
        labels: "[]",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const results = await searchIssues("login");
    expect(results[0].snippet).toBeTruthy();
    expect(results[0].snippet).toContain("login");
  });
});

// ─── Search Issues Count ─────────────────────────────────────────────────────

describe("searchIssuesCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the count from prisma", async () => {
    mockCount.mockResolvedValue(42);
    const count = await searchIssuesCount("test");
    expect(count).toBe(42);
  });

  it("applies filters to count query", async () => {
    mockCount.mockResolvedValue(5);
    await searchIssuesCount("test", { projectId: "proj-1" });
    const callArgs = mockCount.mock.calls[0][0];
    expect(callArgs.where.projectId).toBe("proj-1");
  });
});
