import { prisma } from "@/server/prisma";

// ─── Search Types ─────────────────────────────────────────────────────────────

export interface SearchFilters {
  projectId?: string;
  status?: string;
  priority?: string;
  assigneeId?: string;
  reporterId?: string;
  sprintId?: string;
  labels?: string[];
}

export interface SearchResult {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  projectId: string;
  assigneeId: string | null;
  reporterId: string | null;
  labels: string[];
  createdAt: Date;
  updatedAt: Date;
  rank: number;
  snippet: string | null;
}

// ─── Relevance Scoring ────────────────────────────────────────────────────────

function computeRank(
  title: string,
  description: string | null,
  query: string
): number {
  const lowerQuery = query.toLowerCase();
  const lowerTitle = title.toLowerCase();
  const lowerDesc = (description ?? "").toLowerCase();

  let rank = 0;

  if (lowerTitle === lowerQuery) rank += 100;
  else if (lowerTitle.startsWith(lowerQuery)) rank += 80;
  else if (lowerTitle.includes(lowerQuery)) rank += 60;

  if (lowerDesc.includes(lowerQuery)) rank += 20;

  const queryWords = lowerQuery.split(/\s+/);
  for (const word of queryWords) {
    if (word.length < 2) continue;
    if (lowerTitle.includes(word)) rank += 10;
    if (lowerDesc.includes(word)) rank += 3;
  }

  rank += Math.max(0, 20 - title.length / 5);

  return rank;
}

function extractSnippet(
  text: string | null,
  query: string,
  maxLength: number = 200
): string | null {
  if (!text) return null;

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) {
    const words = query.split(/\s+/);
    for (const word of words) {
      const idx = lowerText.indexOf(word.toLowerCase());
      if (idx !== -1) {
        const start = Math.max(0, idx - 40);
        const end = Math.min(text.length, idx + word.length + 160);
        const snippet = text.slice(start, end);
        return (start > 0 ? "..." : "") + snippet + (end < text.length ? "..." : "");
      }
    }
    return text.slice(0, maxLength) + (text.length > maxLength ? "..." : "");
  }

  const start = Math.max(0, index - 40);
  const end = Math.min(text.length, index + query.length + 160);
  const snippet = text.slice(start, end);
  return (start > 0 ? "..." : "") + snippet + (end < text.length ? "..." : "");
}

// ─── Enum Mappers ─────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, string> = {
  backlog: "BACKLOG",
  todo: "TODO",
  in_progress: "IN_PROGRESS",
  in_review: "IN_REVIEW",
  done: "DONE",
  cancelled: "CANCELLED",
};

const PRIORITY_MAP: Record<string, string> = {
  urgent: "URGENT",
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
  none: "NONE",
};

// ─── Search Functions ─────────────────────────────────────────────────────────

interface IssueRecord {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  projectId: string;
  assigneeId: string | null;
  reporterId: string | null;
  labels: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function searchIssues(
  query: string,
  filters: SearchFilters = {},
  options: { limit?: number; offset?: number } = {}
): Promise<SearchResult[]> {
  const { limit = 20, offset = 0 } = options;

  const where: Record<string, unknown> = {
    OR: [
      { title: { contains: query } },
      { description: { contains: query } },
    ],
  };

  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.status) where.status = STATUS_MAP[filters.status] ?? filters.status;
  if (filters.priority) where.priority = PRIORITY_MAP[filters.priority] ?? filters.priority;
  if (filters.assigneeId) where.assigneeId = filters.assigneeId;
  if (filters.reporterId) where.reporterId = filters.reporterId;
  if (filters.sprintId) where.sprintId = filters.sprintId;
  if (filters.labels && filters.labels.length > 0) {
    where.AND = filters.labels.map((label: string) => ({
      labels: { contains: `"${label}"` },
    }));
  }

  const issues = await prisma.issue.findMany({
    where: where as never,
    take: 1000,
    orderBy: { updatedAt: "desc" },
  });

  const results: SearchResult[] = (issues as IssueRecord[])
    .map((issue: IssueRecord) => {
      const labels = (() => {
        try {
          return JSON.parse(issue.labels ?? "[]");
        } catch {
          return [];
        }
      })();

      return {
        id: issue.id,
        title: issue.title,
        description: issue.description,
        status: issue.status,
        priority: issue.priority,
        projectId: issue.projectId,
        assigneeId: issue.assigneeId,
        reporterId: issue.reporterId,
        labels,
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
        rank: computeRank(issue.title, issue.description, query),
        snippet: extractSnippet(issue.description, query),
      };
    })
    .sort((a: SearchResult, b: SearchResult) => b.rank - a.rank)
    .slice(offset, offset + limit);

  return results;
}

export async function searchIssuesCount(
  query: string,
  filters: SearchFilters = {}
): Promise<number> {
  const where: Record<string, unknown> = {
    OR: [
      { title: { contains: query } },
      { description: { contains: query } },
    ],
  };

  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.status) where.status = STATUS_MAP[filters.status] ?? filters.status;
  if (filters.priority) where.priority = PRIORITY_MAP[filters.priority] ?? filters.priority;
  if (filters.assigneeId) where.assigneeId = filters.assigneeId;
  if (filters.reporterId) where.reporterId = filters.reporterId;
  if (filters.sprintId) where.sprintId = filters.sprintId;
  if (filters.labels && filters.labels.length > 0) {
    (where as Record<string, unknown>).AND = filters.labels.map((label: string) => ({
      labels: { contains: `"${label}"` },
    }));
  }

  return prisma.issue.count({ where: where as never });
}
