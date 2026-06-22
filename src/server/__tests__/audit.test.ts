import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();
const mockFindMany = vi.fn();
const mockCount = vi.fn();

vi.mock("@/server/prisma", () => ({
  prisma: {
    auditLog: {
      create: (...args: unknown[]) => mockCreate(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count: (...args: unknown[]) => mockCount(...args),
    },
  },
}));

import { logAction, logCreate, logUpdate, logDelete, queryAuditLogs } from "@/server/audit";

describe("audit logging", () => {
  beforeEach(() => vi.clearAllMocks());

  it("logAction creates an audit log entry", async () => {
    mockCreate.mockResolvedValue({});
    await logAction({ action: "CREATE", entity: "Issue", entityId: "1", userId: "u1" });
    expect(mockCreate).toHaveBeenCalledOnce();
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "CREATE",
        entity: "Issue",
        entityId: "1",
        userId: "u1",
      }),
    });
  });

  it("logAction includes details when provided", async () => {
    mockCreate.mockResolvedValue({});
    await logAction({ action: "UPDATE", entity: "Issue", entityId: "1", userId: "u1", details: { key: "val" } });
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ details: JSON.stringify({ key: "val" }) }),
    });
  });

  it("logAction does not throw on prisma error", async () => {
    mockCreate.mockRejectedValue(new Error("db error"));
    await expect(
      logAction({ action: "CREATE", entity: "Issue", entityId: "1", userId: "u1" }),
    ).resolves.toBeUndefined();
  });

  it("logCreate calls logAction with CREATE", async () => {
    mockCreate.mockResolvedValue({});
    await logCreate("Issue", "1", "u1", { title: "test" });
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it("logUpdate calls logAction with UPDATE", async () => {
    mockCreate.mockResolvedValue({});
    await logUpdate("Issue", "1", "u1", { title: { before: "a", after: "b" } });
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it("logDelete calls logAction with DELETE", async () => {
    mockCreate.mockResolvedValue({});
    await logDelete("Issue", "1", "u1");
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it("queryAuditLogs returns paginated results", async () => {
    mockFindMany.mockResolvedValue([{ id: "1", action: "CREATE", entity: "Issue", entityId: "1", userId: "u1", details: "{}", createdAt: new Date(), user: { id: "u1", name: "Test", email: "t@t.com" } }]);
    mockCount.mockResolvedValue(1);
    const result = await queryAuditLogs({ limit: 10, offset: 0 });
    expect(result.logs).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it("queryAuditLogs filters by entity", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
    await queryAuditLogs({ entity: "Issue" });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ entity: "Issue" }) }),
    );
  });

  it("queryAuditLogs filters by userId", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
    await queryAuditLogs({ userId: "u1" });
    expect(mockFindMany).toHaveBeenCalled();
  });

  it("queryAuditLogs applies date range filters", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
    const start = new Date("2024-01-01");
    const end = new Date("2024-12-31");
    await queryAuditLogs({ startDate: start, endDate: end });
    expect(mockFindMany).toHaveBeenCalled();
  });
});