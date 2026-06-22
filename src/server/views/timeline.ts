import { applyFilters, normalizeStatus, type ViewFilters } from "@/server/filter-engine";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, format, parseISO } from "date-fns";

// 鈹€鈹€鈹€ Types 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export interface TimelineIssue {
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
  createdAt: Date;
  updatedAt: Date;
  assignee?: { id: string; name: string; email: string; avatar: string | null } | null;
  reporter?: { id: string; name: string; email: string; avatar: string | null } | null;
}

export interface TimelineDay {
  date: string;
  dateLabel: string;
  dayOfWeek: string;
  issues: TimelineIssue[];
}

export interface TimelineGroup {
  label: string;
  startDate: string;
  endDate: string;
  days: TimelineDay[];
  issueCount: number;
}

export interface TimelineView {
  groups: TimelineGroup[];
  startDate: string;
  endDate: string;
  totalIssues: number;
}

export type TimelineGranularity = "week" | "month";

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

// 鈹€鈹€鈹€ Helpers 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

function getIssueDateRange(issue: TimelineIssue): { start: Date; end: Date } {
  const createdAt = new Date(issue.createdAt);
  const dueDate = issue.dueDate
    ? (typeof issue.dueDate === "string" ? parseISO(issue.dueDate) : issue.dueDate)
    : createdAt;
  return {
    start: createdAt < dueDate ? createdAt : dueDate,
    end: createdAt > dueDate ? createdAt : dueDate,
  };
}

function getDayKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

// 鈹€鈹€鈹€ Week Grouping 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

function computeWeeklyTimeline(
  issues: TimelineIssue[],
  filters: ViewFilters,
): TimelineView {
  const filtered = applyFilters(
    issues.map((i) => i as unknown as Record<string, unknown>),
    filters,
  ) as unknown as TimelineIssue[];

  if (filtered.length === 0) {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    return {
      groups: [],
      startDate: getDayKey(weekStart),
      endDate: getDayKey(weekEnd),
      totalIssues: 0,
    };
  }

  let minDate = new Date(filtered[0].createdAt);
  let maxDate = new Date(filtered[0].createdAt);

  for (const issue of filtered) {
    const { start, end } = getIssueDateRange(issue);
    if (start < minDate) minDate = start;
    if (end > maxDate) maxDate = end;
  }

  const weekStart = startOfWeek(minDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(maxDate, { weekStartsOn: 1 });

  const weeks: TimelineGroup[] = [];
  let currentWeekStart = weekStart;

  while (currentWeekStart <= weekEnd) {
    const currentWeekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: currentWeekStart, end: currentWeekEnd });

    const dayGroups: TimelineDay[] = days.map((day) => {
      const dayKey = getDayKey(day);
      const dayIssues = filtered.filter((issue) => {
        const { start, end } = getIssueDateRange(issue);
        return getDayKey(start) <= dayKey && getDayKey(end) >= dayKey;
      });

      return {
        date: dayKey,
        dateLabel: format(day, "MMM d"),
        dayOfWeek: format(day, "EEE"),
        issues: dayIssues,
      };
    });

    const allIssuesInWeek = dayGroups.reduce<TimelineIssue[]>(
      (acc, day) => [
        ...acc,
        ...day.issues.filter((i) => !acc.some((a) => a.id === i.id)),
      ],
      [],
    );

    weeks.push({
      label:
        format(currentWeekStart, "MMM d") +
        " - " +
        format(currentWeekEnd, "MMM d"),
      startDate: getDayKey(currentWeekStart),
      endDate: getDayKey(currentWeekEnd),
      days: dayGroups,
      issueCount: allIssuesInWeek.length,
    });

    currentWeekStart = new Date(currentWeekStart);
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
  }

  return {
    groups: weeks,
    startDate: getDayKey(weekStart),
    endDate: getDayKey(weekEnd),
    totalIssues: filtered.length,
  };
}

// 鈹€鈹€鈹€ Month Grouping 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

function computeMonthlyTimeline(
  issues: TimelineIssue[],
  filters: ViewFilters,
): TimelineView {
  const filtered = applyFilters(
    issues.map((i) => i as unknown as Record<string, unknown>),
    filters,
  ) as unknown as TimelineIssue[];

  if (filtered.length === 0) {
    const now = new Date();
    return {
      groups: [],
      startDate: getDayKey(startOfMonth(now)),
      endDate: getDayKey(endOfMonth(now)),
      totalIssues: 0,
    };
  }

  let minDate = new Date(filtered[0].createdAt);
  let maxDate = new Date(filtered[0].createdAt);

  for (const issue of filtered) {
    const { start, end } = getIssueDateRange(issue);
    if (start < minDate) minDate = start;
    if (end > maxDate) maxDate = end;
  }

  const monthStart = startOfMonth(minDate);
  const monthEnd = endOfMonth(maxDate);

  const months: TimelineGroup[] = [];
  let current = monthStart;

  while (current <= monthEnd) {
    const mStart = startOfMonth(current);
    const mEnd = endOfMonth(current);
    const days = eachDayOfInterval({ start: mStart, end: mEnd });

    const dayGroups: TimelineDay[] = days.map((day) => {
      const dayKey = getDayKey(day);
      const dayIssues = filtered.filter((issue) => {
        const { start, end } = getIssueDateRange(issue);
        return getDayKey(start) <= dayKey && getDayKey(end) >= dayKey;
      });

      return {
        date: dayKey,
        dateLabel: format(day, "MMM d"),
        dayOfWeek: format(day, "EEE"),
        issues: dayIssues,
      };
    });

    const allIssuesInMonth = dayGroups.reduce<TimelineIssue[]>(
      (acc, day) => [
        ...acc,
        ...day.issues.filter((i) => !acc.some((a) => a.id === i.id)),
      ],
      [],
    );

    months.push({
      label: format(mStart, "MMMM yyyy"),
      startDate: getDayKey(mStart),
      endDate: getDayKey(mEnd),
      days: dayGroups,
      issueCount: allIssuesInMonth.length,
    });

    current = new Date(mStart);
    current.setMonth(current.getMonth() + 1);
  }

  return {
    groups: months,
    startDate: getDayKey(monthStart),
    endDate: getDayKey(monthEnd),
    totalIssues: filtered.length,
  };
}

// 鈹€鈹€鈹€ Main Export 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export function computeTimelineView(
  issues: TimelineIssue[],
  filters: ViewFilters,
  granularity: TimelineGranularity = "week",
): TimelineView {
  const safeIssues = Array.isArray(issues) ? issues : [];
  if (granularity === "month") {
    return computeMonthlyTimeline(safeIssues, filters);
  }
  return computeWeeklyTimeline(safeIssues, filters);
}

export function prepareTimelineIssues(rawIssues: unknown[]): TimelineIssue[] {
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

export default computeTimelineView;


