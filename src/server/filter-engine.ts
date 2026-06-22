import { z } from "zod";

// ─── Filter Types ────────────────────────────────────────────────────────────

export const FilterOperatorSchema = z.enum([
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "in",
  "not_in",
  "gt",
  "gte",
  "lt",
  "lte",
  "is_empty",
  "is_not_empty",
]);

export type FilterOperator = z.infer<typeof FilterOperatorSchema>;

export const FilterFieldSchema = z.enum([
  "status",
  "priority",
  "assigneeId",
  "reporterId",
  "labels",
  "title",
  "description",
  "sprintId",
  "dueDate",
  "createdAt",
  "updatedAt",
  "order",
]);

export type FilterField = z.infer<typeof FilterFieldSchema>;

export const SingleFilterSchema = z.object({
  field: FilterFieldSchema,
  operator: FilterOperatorSchema,
  value: z.union([z.string(), z.number(), z.array(z.string()), z.null()]),
});

export type SingleFilter = z.infer<typeof SingleFilterSchema>;

export const LogicalOperatorSchema = z.enum(["and", "or"]);

export type LogicalOperator = z.infer<typeof LogicalOperatorSchema>;

export const FilterGroupSchema = z.object({
  logic: LogicalOperatorSchema,
  filters: z.array(SingleFilterSchema),
});

export type FilterGroup = z.infer<typeof FilterGroupSchema>;

export const SortOrderSchema = z.object({
  field: z.enum([
    "priority",
    "createdAt",
    "updatedAt",
    "dueDate",
    "title",
    "status",
    "order",
  ]),
  direction: z.enum(["asc", "desc"]),
});

export type SortOrder = z.infer<typeof SortOrderSchema>;

export const ViewFiltersSchema = z.object({
  groups: z.array(FilterGroupSchema).default([]),
  sort: z.array(SortOrderSchema).default([
    { field: "order", direction: "asc" },
  ]),
});

export type ViewFilters = z.infer<typeof ViewFiltersSchema>;

// ─── Priority ordering for sorting (lowercase display values) ────────────────

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4,
};

const STATUS_ORDER: Record<string, number> = {
  backlog: 0,
  todo: 1,
  in_progress: 2,
  in_review: 3,
  done: 4,
  cancelled: 5,
};

// ─── Normalize enum values ───────────────────────────────────────────────────
// Prisma enums are stored as uppercase (BACKLOG, TODO, etc.)
// but our filter/display layer uses lowercase (backlog, todo, etc.)

export function normalizeStatus(value: unknown): string {
  return String(value ?? "backlog").toLowerCase();
}

export function normalizePriority(value: unknown): string {
  return String(value ?? "none").toLowerCase();
}

// ─── Filter Application ──────────────────────────────────────────────────────

function matchesFilter(
  issue: Record<string, unknown>,
  filter: SingleFilter,
): boolean {
  const fieldValue = issue[filter.field];
  const filterValue = filter.value;

  switch (filter.operator) {
    case "equals": {
      if (filterValue === null)
        return fieldValue === null || fieldValue === undefined;
      if (filter.field === "priority" && typeof filterValue === "string") {
        return normalizePriority(fieldValue) === filterValue.toLowerCase();
      }
      if (filter.field === "status" && typeof filterValue === "string") {
        return normalizeStatus(fieldValue) === filterValue.toLowerCase();
      }
      if (filter.field === "labels" && typeof fieldValue === "string") {
        const labels = parseLabels(fieldValue);
        return labels.includes(String(filterValue));
      }
      return String(fieldValue) === String(filterValue);
    }

    case "not_equals": {
      if (filterValue === null)
        return fieldValue !== null && fieldValue !== undefined;
      if (filter.field === "priority" && typeof filterValue === "string") {
        return normalizePriority(fieldValue) !== filterValue.toLowerCase();
      }
      if (filter.field === "status" && typeof filterValue === "string") {
        return normalizeStatus(fieldValue) !== filterValue.toLowerCase();
      }
      return String(fieldValue) !== String(filterValue);
    }

    case "contains": {
      if (filter.field === "labels" && typeof fieldValue === "string") {
        const labels = parseLabels(fieldValue);
        if (typeof filterValue === "string") {
          return labels.some((l) =>
            l.toLowerCase().includes(filterValue.toLowerCase()),
          );
        }
        return false;
      }
      if (typeof fieldValue === "string" && typeof filterValue === "string") {
        return fieldValue.toLowerCase().includes(filterValue.toLowerCase());
      }
      return false;
    }

    case "not_contains": {
      if (filter.field === "labels" && typeof fieldValue === "string") {
        const labels = parseLabels(fieldValue);
        if (typeof filterValue === "string") {
          return !labels.some((l) =>
            l.toLowerCase().includes(filterValue.toLowerCase()),
          );
        }
        return true;
      }
      if (typeof fieldValue === "string" && typeof filterValue === "string") {
        return !fieldValue.toLowerCase().includes(filterValue.toLowerCase());
      }
      return true;
    }

    case "in": {
      if (Array.isArray(filterValue)) {
        if (filter.field === "labels" && typeof fieldValue === "string") {
          const labels = parseLabels(fieldValue);
          return labels.some((l) => filterValue.includes(l));
        }
        if (filter.field === "priority") {
          return filterValue.some(
            (v) => normalizePriority(fieldValue) === String(v).toLowerCase(),
          );
        }
        if (filter.field === "status") {
          return filterValue.some(
            (v) => normalizeStatus(fieldValue) === String(v).toLowerCase(),
          );
        }
        return filterValue.includes(String(fieldValue));
      }
      return false;
    }

    case "not_in": {
      if (Array.isArray(filterValue)) {
        if (filter.field === "labels" && typeof fieldValue === "string") {
          const labels = parseLabels(fieldValue);
          return !labels.some((l) => filterValue.includes(l));
        }
        if (filter.field === "priority") {
          return !filterValue.some(
            (v) => normalizePriority(fieldValue) === String(v).toLowerCase(),
          );
        }
        if (filter.field === "status") {
          return !filterValue.some(
            (v) => normalizeStatus(fieldValue) === String(v).toLowerCase(),
          );
        }
        return !filterValue.includes(String(fieldValue));
      }
      return true;
    }

    case "gt": {
      if (filter.field === "priority" && typeof filterValue === "string") {
        const fieldOrd =
          PRIORITY_ORDER[normalizePriority(fieldValue)] ?? 4;
        const filterOrd = PRIORITY_ORDER[filterValue.toLowerCase()] ?? 4;
        return fieldOrd > filterOrd;
      }
      if (fieldValue === null || fieldValue === undefined) return false;
      return Number(fieldValue) > Number(filterValue);
    }

    case "gte": {
      if (filter.field === "priority" && typeof filterValue === "string") {
        const fieldOrd =
          PRIORITY_ORDER[normalizePriority(fieldValue)] ?? 4;
        const filterOrd = PRIORITY_ORDER[filterValue.toLowerCase()] ?? 4;
        return fieldOrd >= filterOrd;
      }
      if (fieldValue === null || fieldValue === undefined) return false;
      return Number(fieldValue) >= Number(filterValue);
    }

    case "lt": {
      if (filter.field === "priority" && typeof filterValue === "string") {
        const fieldOrd =
          PRIORITY_ORDER[normalizePriority(fieldValue)] ?? 4;
        const filterOrd = PRIORITY_ORDER[filterValue.toLowerCase()] ?? 4;
        return fieldOrd < filterOrd;
      }
      if (fieldValue === null || fieldValue === undefined) return false;
      return Number(fieldValue) < Number(filterValue);
    }

    case "lte": {
      if (filter.field === "priority" && typeof filterValue === "string") {
        const fieldOrd =
          PRIORITY_ORDER[normalizePriority(fieldValue)] ?? 4;
        const filterOrd = PRIORITY_ORDER[filterValue.toLowerCase()] ?? 4;
        return fieldOrd <= filterOrd;
      }
      if (fieldValue === null || fieldValue === undefined) return false;
      return Number(fieldValue) <= Number(filterValue);
    }

    case "is_empty":
      return (
        fieldValue === null ||
        fieldValue === undefined ||
        (typeof fieldValue === "string" && fieldValue.trim() === "") ||
        (fieldValue === "[]")
      );

    case "is_not_empty":
      return !(
        fieldValue === null ||
        fieldValue === undefined ||
        (typeof fieldValue === "string" && fieldValue.trim() === "") ||
        (fieldValue === "[]" || fieldValue === "{}")
      );

    default:
      return true;
  }
}

// ─── Label Parsing (SQLite JSON string) ──────────────────────────────────────

function parseLabels(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function matchesFilterGroup(
  issue: Record<string, unknown>,
  group: FilterGroup,
): boolean {
  if (group.filters.length === 0) return true;

  if (group.logic === "and") {
    return group.filters.every((f) => matchesFilter(issue, f));
  }
  return group.filters.some((f) => matchesFilter(issue, f));
}

export function applyFilters<T extends Record<string, unknown>>(
  issues: T[],
  filters: ViewFilters,
): T[] {
  let result = issues;

  if (filters.groups.length > 0) {
    result = result.filter((issue) =>
      filters.groups.every((group) => matchesFilterGroup(issue, group)),
    );
  }

  if (filters.sort.length > 0) {
    result = [...result].sort((a, b) => {
      for (const sort of filters.sort) {
        let comparison = 0;
        const aVal = a[sort.field];
        const bVal = b[sort.field];

        if (sort.field === "priority") {
          const aOrd = PRIORITY_ORDER[normalizePriority(aVal)] ?? 4;
          const bOrd = PRIORITY_ORDER[normalizePriority(bVal)] ?? 4;
          comparison = aOrd - bOrd;
        } else if (sort.field === "status") {
          const aOrd = STATUS_ORDER[normalizeStatus(aVal)] ?? 99;
          const bOrd = STATUS_ORDER[normalizeStatus(bVal)] ?? 99;
          comparison = aOrd - bOrd;
        } else if (sort.field === "title") {
          comparison = String(aVal ?? "").localeCompare(String(bVal ?? ""));
        } else if (
          sort.field === "createdAt" ||
          sort.field === "updatedAt" ||
          sort.field === "dueDate"
        ) {
          const aTime = aVal ? new Date(String(aVal)).getTime() : 0;
          const bTime = bVal ? new Date(String(bVal)).getTime() : 0;
          comparison = aTime - bTime;
        } else if (sort.field === "order") {
          comparison = Number(aVal ?? 0) - Number(bVal ?? 0);
        }

        if (comparison !== 0) {
          return sort.direction === "asc" ? comparison : -comparison;
        }
      }
      return 0;
    });
  }

  return result;
}

// ─── Prisma Where Clause Builder ─────────────────────────────────────────────

export function buildPrismaWhereClause(
  filters: ViewFilters,
): Record<string, unknown> {
  const conditions: Record<string, unknown>[] = [];

  for (const group of filters.groups) {
    for (const filter of group.filters) {
      const condition = buildSinglePrismaCondition(filter);
      if (condition) {
        conditions.push(condition);
      }
    }
  }

  if (conditions.length === 0) return {};

  const logic =
    filters.groups.length > 0 ? filters.groups[0].logic : "and";

  if (conditions.length === 1) {
    return conditions[0];
  }

  return logic === "and" ? { AND: conditions } : { OR: conditions };
}

function buildSinglePrismaCondition(
  filter: SingleFilter,
): Record<string, unknown> | null {
  const { field, operator, value } = filter;

  // For status/priority filters, uppercase the value for Prisma enum matching
  function prismaEnumValue(val: unknown): string {
    return String(val).toUpperCase();
  }

  switch (operator) {
    case "equals":
      if (field === "status" || field === "priority") {
        return { [field]: prismaEnumValue(value) };
      }
      return value === null
        ? { [field]: null }
        : { [field]: { equals: value } };

    case "not_equals":
      if (field === "status" || field === "priority") {
        return { [field]: { not: prismaEnumValue(value) } };
      }
      return value === null
        ? { [field]: { not: null } }
        : { [field]: { not: value } };

    case "contains":
      if (field === "labels" && typeof value === "string") {
        // SQLite: labels stored as JSON string, use contains on the string
        return { labels: { contains: value } };
      }
      return { [field]: { contains: String(value), mode: "insensitive" } };

    case "not_contains":
      if (field === "labels" && typeof value === "string") {
        return { NOT: { labels: { contains: value } } };
      }
      return {
        [field]: {
          not: { contains: String(value), mode: "insensitive" },
        },
      };

    case "in":
      if (Array.isArray(value)) {
        if (field === "status") {
          return { [field]: { in: value.map(prismaEnumValue) } };
        }
        if (field === "priority") {
          return { [field]: { in: value.map(prismaEnumValue) } };
        }
        return { [field]: { in: value } };
      }
      return null;

    case "not_in":
      if (Array.isArray(value)) {
        if (field === "status") {
          return { [field]: { notIn: value.map(prismaEnumValue) } };
        }
        if (field === "priority") {
          return { [field]: { notIn: value.map(prismaEnumValue) } };
        }
        return { [field]: { notIn: value } };
      }
      return null;

    case "gt":
      return { [field]: { gt: value } };

    case "gte":
      return { [field]: { gte: value } };

    case "lt":
      return { [field]: { lt: value } };

    case "lte":
      return { [field]: { lte: value } };

    case "is_empty":
      return {
        OR: [
          { [field]: null },
          { [field]: "" },
          ...(field === "labels" ? [{ [field]: "[]" }] : []),
        ],
      };

    case "is_not_empty":
      return {
        AND: [
          { [field]: { not: null } },
          { [field]: { not: "" } },
        ],
      };

    default:
      return null;
  }
}

export function buildPrismaOrderBy(
  sort: SortOrder[],
): Record<string, string>[] {
  if (sort.length === 0) {
    return [{ order: "asc" }];
  }

  return sort.map((s) => ({
    [s.field]: s.direction,
  }));
}
