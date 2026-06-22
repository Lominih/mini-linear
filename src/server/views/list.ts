import { applyFilters, normalizeStatus, type ViewFilters } from "@/server/filter-engine";

// 鈹€鈹€鈹€ Types 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export interface ListIssue {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  labels: string[];
  assigneeId: string | null;
  reporterId: string | null;
  sprintId: string | null;
  dueDate: Date | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  assignee?: { id: string; name: string; email: string; avatar: string | null } | null;
  reporter?: { id: string; name: string; email: string; avatar: string | null } | null;
}

export interface ListResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

// 鈹€鈹€鈹€ Label Parser 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

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

// 鈹€鈹€鈹€ List View Computation 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export function computeListView<T extends ListIssue>(
  issues: T[],
  filters: ViewFilters,
  options: { page?: number; pageSize?: number } = {},
): ListResult<T> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 50));
  const safeIssues = Array.isArray(issues) ? issues : [];

  const filtered = applyFilters(
    safeIssues.map((i) => i as unknown as Record<string, unknown>),
    filters,
  ) as unknown as T[];

  const total = filtered.length;
  const totalPages = Math.ceil(total / pageSize);
  const startIdx = (page - 1) * pageSize;
  const items = filtered.slice(startIdx, startIdx + pageSize);

  return { items, total, page, pageSize, totalPages, hasMore: page < totalPages };
}

export function prepareListIssues(rawIssues: unknown[]): ListIssue[] {
  const safeRaw = Array.isArray(rawIssues) ? rawIssues : [];
  return safeRaw.map((raw: Record<string, unknown>) => ({
    id: raw.id,
    title: raw.title,
    description: raw.description ?? null,
    status: normalizeStatus(raw.status),
    priority: String(raw.priority ?? "none").toLowerCase(),
    labels: parseLabels(raw.labels),
    assigneeId: raw.assigneeId ?? null,
    reporterId: raw.reporterId ?? null,
    sprintId: raw.sprintId ?? null,
    dueDate: raw.dueDate ?? null,
    order: raw.order ?? 0,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    assignee: raw.assignee ?? null,
    reporter: raw.reporter ?? null,
  }));
}

export default computeListView;


