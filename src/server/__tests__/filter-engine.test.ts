import { describe, it, expect } from "vitest";
import {
  normalizeStatus,
  normalizePriority,
  applyFilters,
  buildPrismaWhereClause,
  buildPrismaOrderBy,
  type ViewFilters,
  type SingleFilter,
  type FilterGroup,
  type SortOrder,
} from "@/server/filter-engine";

// ─── Normalization ───────────────────────────────────────────────────────────

describe("normalizeStatus", () => {
  it("lowercases a string value", () => {
    expect(normalizeStatus("IN_PROGRESS")).toBe("in_progress");
  });

  it("returns fallback for null", () => {
    expect(normalizeStatus(null)).toBe("backlog");
  });

  it("returns fallback for undefined", () => {
    expect(normalizeStatus(undefined)).toBe("backlog");
  });

  it("preserves already-lowercase", () => {
    expect(normalizeStatus("done")).toBe("done");
  });
});

describe("normalizePriority", () => {
  it("lowercases a string value", () => {
    expect(normalizePriority("HIGH")).toBe("high");
  });

  it("returns fallback for null", () => {
    expect(normalizePriority(null)).toBe("none");
  });

  it("preserves already-lowercase", () => {
    expect(normalizePriority("urgent")).toBe("urgent");
  });
});

// ─── applyFilters ────────────────────────────────────────────────────────────

const mockIssues = [
  {
    id: "1",
    title: "Fix login bug",
    description: "Login fails on mobile",
    status: "in_progress",
    priority: "high",
    assigneeId: "user-1",
    reporterId: "user-2",
    labels: '["bug","auth"]',
    sprintId: "sprint-1",
    dueDate: "2026-07-01",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-15T00:00:00Z",
    order: 1,
  },
  {
    id: "2",
    title: "Add dark mode",
    description: "User requested dark mode support",
    status: "todo",
    priority: "medium",
    assigneeId: null,
    reporterId: "user-1",
    labels: '["feature","ui"]',
    sprintId: null,
    dueDate: null,
    createdAt: "2026-06-05T00:00:00Z",
    updatedAt: "2026-06-10T00:00:00Z",
    order: 2,
  },
  {
    id: "3",
    title: "Update README",
    description: null,
    status: "done",
    priority: "low",
    assigneeId: "user-2",
    reporterId: "user-1",
    labels: "[]",
    sprintId: "sprint-1",
    dueDate: "2026-06-15",
    createdAt: "2026-05-20T00:00:00Z",
    updatedAt: "2026-06-14T00:00:00Z",
    order: 3,
  },
];

describe("applyFilters", () => {
  it("returns all issues with empty filter", () => {
    const filters: ViewFilters = { groups: [], sort: [{ field: "order", direction: "asc" }] };
    const result = applyFilters(mockIssues, filters);
    expect(result).toHaveLength(3);
  });

  it("filters by status equals", () => {
    const filters: ViewFilters = {
      groups: [{ logic: "and", filters: [{ field: "status", operator: "equals", value: "in_progress" }] }],
      sort: [{ field: "order", direction: "asc" }],
    };
    const result = applyFilters(mockIssues, filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("filters by priority not_equals", () => {
    const filters: ViewFilters = {
      groups: [{ logic: "and", filters: [{ field: "priority", operator: "not_equals", value: "high" }] }],
      sort: [{ field: "order", direction: "asc" }],
    };
    const result = applyFilters(mockIssues, filters);
    expect(result).toHaveLength(2);
    expect(result.every((i) => i.priority !== "high")).toBe(true);
  });

  it("filters by assigneeId equals", () => {
    const filters: ViewFilters = {
      groups: [{ logic: "and", filters: [{ field: "assigneeId", operator: "equals", value: "user-1" }] }],
      sort: [{ field: "order", direction: "asc" }],
    };
    const result = applyFilters(mockIssues, filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("filters by assigneeId is_empty", () => {
    const filters: ViewFilters = {
      groups: [{ logic: "and", filters: [{ field: "assigneeId", operator: "is_empty", value: null }] }],
      sort: [{ field: "order", direction: "asc" }],
    };
    const result = applyFilters(mockIssues, filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  it("filters by labels contains", () => {
    const filters: ViewFilters = {
      groups: [{ logic: "and", filters: [{ field: "labels", operator: "contains", value: "bug" }] }],
      sort: [{ field: "order", direction: "asc" }],
    };
    const result = applyFilters(mockIssues, filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("filters by title contains", () => {
    const filters: ViewFilters = {
      groups: [{ logic: "and", filters: [{ field: "title", operator: "contains", value: "dark" }] }],
      sort: [{ field: "order", direction: "asc" }],
    };
    const result = applyFilters(mockIssues, filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  it("filters by in operator", () => {
    const filters: ViewFilters = {
      groups: [{ logic: "and", filters: [{ field: "status", operator: "in", value: ["todo", "done"] }] }],
      sort: [{ field: "order", direction: "asc" }],
    };
    const result = applyFilters(mockIssues, filters);
    expect(result).toHaveLength(2);
  });

  it("filters by not_in operator", () => {
    const filters: ViewFilters = {
      groups: [{ logic: "and", filters: [{ field: "status", operator: "not_in", value: ["done"] }] }],
      sort: [{ field: "order", direction: "asc" }],
    };
    const result = applyFilters(mockIssues, filters);
    expect(result).toHaveLength(2);
  });

  it("sorts by priority ascending", () => {
    const filters: ViewFilters = {
      groups: [],
      sort: [{ field: "priority", direction: "asc" }],
    };
    const result = applyFilters(mockIssues, filters);
    expect(result[0].priority).toBe("high"); // urgent=0, high=1, medium=2, low=3
    expect(result[1].priority).toBe("medium");
    expect(result[2].priority).toBe("low");
  });

  it("sorts by title ascending", () => {
    const filters: ViewFilters = {
      groups: [],
      sort: [{ field: "title", direction: "asc" }],
    };
    const result = applyFilters(mockIssues, filters);
    expect(result[0].title).toBe("Add dark mode");
    expect(result[1].title).toBe("Fix login bug");
    expect(result[2].title).toBe("Update README");
  });

  it("supports OR logic across filters", () => {
    const filters: ViewFilters = {
      groups: [{
        logic: "or",
        filters: [
          { field: "priority", operator: "equals", value: "high" },
          { field: "priority", operator: "equals", value: "low" },
        ],
      }],
      sort: [{ field: "order", direction: "asc" }],
    };
    const result = applyFilters(mockIssues, filters);
    expect(result).toHaveLength(2);
  });
});

// ─── buildPrismaWhereClause ──────────────────────────────────────────────────

describe("buildPrismaWhereClause", () => {
  it("returns empty object for no filters", () => {
    const filters: ViewFilters = { groups: [], sort: [] };
    expect(buildPrismaWhereClause(filters)).toEqual({});
  });

  it("builds equals clause for status", () => {
    const filters: ViewFilters = {
      groups: [{ logic: "and", filters: [{ field: "status", operator: "equals", value: "todo" }] }],
      sort: [],
    };
    const clause = buildPrismaWhereClause(filters) as Record<string, unknown>;
    expect(clause).toEqual({ status: "TODO" });
  });

  it("builds contains clause for title with insensitive mode", () => {
    const filters: ViewFilters = {
      groups: [{ logic: "and", filters: [{ field: "title", operator: "contains", value: "bug" }] }],
      sort: [],
    };
    const clause = buildPrismaWhereClause(filters) as Record<string, unknown>;
    expect(clause).toEqual({ title: { contains: "bug", mode: "insensitive" } });
  });

  it("builds gt clause for numeric fields", () => {
    const filters: ViewFilters = {
      groups: [{ logic: "and", filters: [{ field: "order", operator: "gt", value: 5 }] }],
      sort: [],
    };
    const clause = buildPrismaWhereClause(filters) as Record<string, unknown>;
    expect(clause).toEqual({ order: { gt: 5 } });
  });

  it("builds in clause for status arrays", () => {
    const filters: ViewFilters = {
      groups: [{ logic: "and", filters: [{ field: "status", operator: "in", value: ["todo", "done"] }] }],
      sort: [],
    };
    const clause = buildPrismaWhereClause(filters) as Record<string, unknown>;
    expect(clause).toEqual({ status: { in: ["TODO", "DONE"] } });
  });

  it("builds is_empty clause for nullable fields", () => {
    const filters: ViewFilters = {
      groups: [{ logic: "and", filters: [{ field: "assigneeId", operator: "is_empty", value: null }] }],
      sort: [],
    };
    const clause = buildPrismaWhereClause(filters) as Record<string, unknown>;
    expect(clause).toHaveProperty("OR");
  });

  it("builds AND for multiple conditions", () => {
    const filters: ViewFilters = {
      groups: [{
        logic: "and",
        filters: [
          { field: "status", operator: "equals", value: "todo" },
          { field: "priority", operator: "equals", value: "high" },
        ],
      }],
      sort: [],
    };
    const clause = buildPrismaWhereClause(filters) as Record<string, unknown>;
    expect(clause).toHaveProperty("AND");
  });
});

// ─── buildPrismaOrderBy ──────────────────────────────────────────────────────

describe("buildPrismaOrderBy", () => {
  it("returns default order for empty sort", () => {
    const result = buildPrismaOrderBy([]);
    expect(result).toEqual([{ order: "asc" }]);
  });

  it("maps sort orders correctly", () => {
    const sort: SortOrder[] = [
      { field: "priority", direction: "desc" },
      { field: "createdAt", direction: "asc" },
    ];
    const result = buildPrismaOrderBy(sort);
    expect(result).toEqual([
      { priority: "desc" },
      { createdAt: "asc" },
    ]);
  });
});
