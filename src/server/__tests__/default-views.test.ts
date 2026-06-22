import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreateMany = vi.fn();

const mockPrisma = {
  view: {
    createMany: (...args: unknown[]) => mockCreateMany(...args),
  },
} as any;

vi.mock("@/server/prisma", () => ({
  prisma: { view: { createMany: (...args: unknown[]) => mockCreateMany(...args) } },
}));

import { createDefaultViews } from "@/server/default-views";

describe("createDefaultViews", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates 3 default views", async () => {
    mockCreateMany.mockResolvedValue({ count: 3 });
    await createDefaultViews(mockPrisma, "proj-1", "user-1");
    expect(mockCreateMany).toHaveBeenCalledOnce();
    const arg = mockCreateMany.mock.calls[0][0];
    expect(arg.data).toHaveLength(3);
  });

  it("includes All Issues view as LIST type", async () => {
    mockCreateMany.mockResolvedValue({ count: 3 });
    await createDefaultViews(mockPrisma, "proj-1", "user-1");
    const views = mockCreateMany.mock.calls[0][0].data;
    const allIssues = views.find((v: any) => v.name === "All Issues");
    expect(allIssues).toBeDefined();
    expect(allIssues.type).toBe("LIST");
  });

  it("includes Board view as BOARD type", async () => {
    mockCreateMany.mockResolvedValue({ count: 3 });
    await createDefaultViews(mockPrisma, "proj-1", "user-1");
    const views = mockCreateMany.mock.calls[0][0].data;
    const board = views.find((v: any) => v.name === "Board");
    expect(board).toBeDefined();
    expect(board.type).toBe("BOARD");
  });

  it("includes My Issues view", async () => {
    mockCreateMany.mockResolvedValue({ count: 3 });
    await createDefaultViews(mockPrisma, "proj-1", "user-1");
    const views = mockCreateMany.mock.calls[0][0].data;
    const myIssues = views.find((v: any) => v.name === "My Issues");
    expect(myIssues).toBeDefined();
  });

  it("replaces __currentUserId__ placeholder with actual userId", async () => {
    mockCreateMany.mockResolvedValue({ count: 3 });
    await createDefaultViews(mockPrisma, "proj-1", "user-42");
    const views = mockCreateMany.mock.calls[0][0].data;
    const myIssues = views.find((v: any) => v.name === "My Issues");
    const filters = JSON.parse(myIssues.filters);
    const filterVal = filters.groups[0].filters[0].value;
    expect(filterVal).toBe("user-42");
  });

  it("assigns correct projectId", async () => {
    mockCreateMany.mockResolvedValue({ count: 3 });
    await createDefaultViews(mockPrisma, "proj-99", "user-1");
    const views = mockCreateMany.mock.calls[0][0].data;
    expect(views.every((v: any) => v.projectId === "proj-99")).toBe(true);
  });

  it("assigns correct userId to all views", async () => {
    mockCreateMany.mockResolvedValue({ count: 3 });
    await createDefaultViews(mockPrisma, "proj-1", "user-7");
    const views = mockCreateMany.mock.calls[0][0].data;
    expect(views.every((v: any) => v.userId === "user-7")).toBe(true);
  });

  it("serializes filters as JSON string", async () => {
    mockCreateMany.mockResolvedValue({ count: 3 });
    await createDefaultViews(mockPrisma, "proj-1", "user-1");
    const views = mockCreateMany.mock.calls[0][0].data;
    views.forEach((v: any) => {
      expect(typeof v.filters).toBe("string");
      expect(() => JSON.parse(v.filters)).not.toThrow();
    });
  });
});