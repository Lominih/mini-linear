import { applyFilters, normalizeStatus, type ViewFilters } from "@/server/filter-engine";

// 鈹€鈹€鈹€ Types 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export interface KanbanIssue {
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

export interface KanbanColumn {
  status: string;
  label: string;
  issues: KanbanIssue[];
  count: number;
}

export interface KanbanBoard {
  columns: KanbanColumn[];
  totalIssues: number;
}

// 鈹€鈹€鈹€ Status Definitions 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

const STATUS_COLUMNS: { status: string; label: string }[] = [
  { status: "backlog", label: "Backlog" },
  { status: "todo", label: "Todo" },
  { status: "in_progress", label: "In Progress" },
  { status: "in_review", label: "In Review" },
  { status: "done", label: "Done" },
  { status: "cancelled", label: "Cancelled" },
];

// 鈹€鈹€鈹€ Label Parser (SQLite JSON string) 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

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

// 鈹€鈹€鈹€ Kanban Board Computation 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export function computeKanbanBoard(
  issues: KanbanIssue[],
  filters: ViewFilters,
): KanbanBoard {
  const safeIssues = Array.isArray(issues) ? issues : [];
  const filtered = applyFilters(
    safeIssues.map((i) => i as unknown as Record<string, unknown>),
    filters,
  ) as unknown as KanbanIssue[];

  // Group by status, maintaining sort order within each group
  const grouped = new Map<string, KanbanIssue[]>();
  for (const col of STATUS_COLUMNS) {
    grouped.set(col.status, []);
  }

  for (const issue of filtered) {
    const status = normalizeStatus(issue.status);
    const existing = grouped.get(status);
    if (existing) {
      existing.push(issue);
    } else {
      grouped.set(status, [issue]);
    }
  }

  const columns: KanbanColumn[] = STATUS_COLUMNS.map(({ status, label }) => {
    const columnIssues = grouped.get(status) || [];
    return { status, label, issues: columnIssues, count: columnIssues.length };
  });

  return { columns, totalIssues: filtered.length };
}

export function prepareKanbanIssues(rawIssues: unknown[]): KanbanIssue[] {
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

export default computeKanbanBoard;


