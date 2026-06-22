import { z } from "zod";
import { router, publicProcedure } from "@/server/trpc";
import { TRPCError } from "@trpc/server";
import { processStateChange, type IssueStatus } from "@/server/state-machine";
import type { Context } from "@/server/context";

// ©¤©¤©¤ Enum Mappers ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤

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

// ©¤©¤©¤ Schemas ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤

const issueStatusSchema = z.enum([
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
  "cancelled",
]);

const bulkStatusChangeSchema = z.object({
  ids: z.array(z.string()).min(1).max(500),
  status: issueStatusSchema,
});

const bulkAssignSchema = z.object({
  ids: z.array(z.string()).min(1).max(500),
  assigneeId: z.string().nullable(),
});

const bulkAddLabelsSchema = z.object({
  ids: z.array(z.string()).min(1).max(500),
  labels: z.array(z.string()).min(1),
});

const bulkRemoveLabelsSchema = z.object({
  ids: z.array(z.string()).min(1).max(500),
  labels: z.array(z.string()).min(1),
});

const bulkDeleteBatchSchema = z.object({
  ids: z.array(z.string()).min(1).max(500),
});

const importCsvSchema = z.object({
  projectId: z.string(),
  csvContent: z.string().min(1),
  assigneeId: z.string().optional(),
});

// ©¤©¤©¤ CSV Parser ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤

interface CsvRow {
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  labels?: string;
  assigneeId?: string;
  dueDate?: string;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  fields.push(current.trim());
  return fields;
}

function parseCsv(content: string): CsvRow[] {
  const lines = content.split(/\r?\n/).filter((line: string) => line.trim().length > 0);
  if (lines.length < 2) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "CSV must have a header row and at least one data row",
    });
  }

  const headers = parseCsvLine(lines[0]).map((h: string) =>
    h.toLowerCase().replace(/\s+/g, "_")
  );

  const requiredHeaders = ["title"];
  for (const h of requiredHeaders) {
    if (!headers.includes(h)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Missing required column: "${h}". Found columns: ${headers.join(", ")}`,
      });
    }
  }

  const validStatuses = ["backlog", "todo", "in_progress", "in_review", "done", "cancelled"];
  const validPriorities = ["urgent", "high", "medium", "low", "none"];

  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};

    headers.forEach((header: string, index: number) => {
      if (index < values.length) {
        row[header] = values[index];
      }
    });

    if (!row.title || row.title.length === 0) continue;

    const csvRow: CsvRow = {
      title: row.title,
      description: row.description || undefined,
    };

    if (row.status && validStatuses.includes(row.status)) {
      csvRow.status = row.status;
    }

    if (row.priority && validPriorities.includes(row.priority)) {
      csvRow.priority = row.priority;
    }

    if (row.labels) {
      csvRow.labels = row.labels;
    }

    if (row.assignee_id || row.assigneeid) {
      csvRow.assigneeId = row.assignee_id || row.assigneeid;
    }

    if (row.due_date || row.duedate) {
      csvRow.dueDate = row.due_date || row.duedate;
    }

    rows.push(csvRow);
  }

  return rows;
}

function parseLabels(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ©¤©¤ Router ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤

export const issueBatchRouter = router({
  // ©¤©¤ Bulk Status Change ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤

  bulkStatusChange: publicProcedure
    .input(bulkStatusChangeSchema)
    .mutation(async ({ ctx, input }) => {
      const { ids, status } = input;

      // Validate that all issues exist
      const issues = await ctx.prisma.issue.findMany({
        where: { id: { in: ids } },
        select: { id: true, status: true, projectId: true },
      });

      if (issues.length !== ids.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "One or more issues not found",
        });
      }

      // Validate state transitions
      for (const issue of issues) {
        processStateChange(
          issue.status.toLowerCase() as IssueStatus,
          status as IssueStatus,
        );
      }

      const targetStatus = STATUS_MAP[status] ?? status.toUpperCase();

      const result = await ctx.prisma.issue.updateMany({
        where: { id: { in: ids } },
        data: { status: targetStatus as never },
      });

      return { updated: result.count };
    }),

  // ©¤©¤ Bulk Assign ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤

  bulkAssign: publicProcedure
    .input(bulkAssignSchema)
    .mutation(async ({ ctx, input }) => {
      const { ids, assigneeId } = input;

      // Validate all issues exist
      const count = await ctx.prisma.issue.count({
        where: { id: { in: ids } },
      });

      if (count !== ids.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "One or more issues not found",
        });
      }

      const result = await ctx.prisma.issue.updateMany({
        where: { id: { in: ids } },
        data: { assigneeId },
      });

      return { updated: result.count };
    }),

  // ©¤©¤ Bulk Add Labels ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤

  bulkAddLabels: publicProcedure
    .input(bulkAddLabelsSchema)
    .mutation(async ({ ctx, input }) => {
      const { ids, labels } = input;

      const issues = await ctx.prisma.issue.findMany({
        where: { id: { in: ids } },
        select: { id: true, labels: true },
      });

      interface IssueLabel {
        id: string;
        labels: string;
      }

      const updates = issues.map((issue: IssueLabel) => {
        const existingLabels = parseLabels(issue.labels);
        const mergedLabels = [...new Set([...existingLabels, ...labels])];
        return ctx.prisma.issue.update({
          where: { id: issue.id },
          data: { labels: JSON.stringify(mergedLabels) },
        });
      });

      await ctx.prisma.$transaction(updates);

      return { updated: updates.length };
    }),

  // ©¤©¤ Bulk Remove Labels ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤

  bulkRemoveLabels: publicProcedure
    .input(bulkRemoveLabelsSchema)
    .mutation(async ({ ctx, input }) => {
      const { ids, labels } = input;
      const labelsToRemove = new Set(labels);

      const issues = await ctx.prisma.issue.findMany({
        where: { id: { in: ids } },
        select: { id: true, labels: true },
      });

      interface IssueLabel {
        id: string;
        labels: string;
      }

      const updates = issues.map((issue: IssueLabel) => {
        const existingLabels = parseLabels(issue.labels);
        const filtered = existingLabels.filter((l: string) => !labelsToRemove.has(l));
        return ctx.prisma.issue.update({
          where: { id: issue.id },
          data: { labels: JSON.stringify(filtered) },
        });
      });

      await ctx.prisma.$transaction(updates);

      return { updated: updates.length };
    }),

  // ©¤©¤ Bulk Delete ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤

  bulkDelete: publicProcedure
    .input(bulkDeleteBatchSchema)
    .mutation(async ({ ctx, input }) => {
      const { ids } = input;

      await ctx.prisma.issue.deleteMany({
        where: { parentId: { in: ids } },
      });

      await ctx.prisma.issueRelation.deleteMany({
        where: {
          OR: [
            { fromIssueId: { in: ids } },
            { toIssueId: { in: ids } },
          ],
        },
      });

      const result = await ctx.prisma.issue.deleteMany({
        where: { id: { in: ids } },
      });

      return { deleted: result.count };
    }),

  // ©¤©¤ Import from CSV ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤

  importFromCsv: publicProcedure
    .input(importCsvSchema)
    .mutation(async ({ ctx, input }) => {
      const { projectId, csvContent, assigneeId } = input;

      const project = await ctx.prisma.project.findUnique({
        where: { id: projectId },
      });
      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }

      const rows = parseCsv(csvContent);

      if (rows.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No valid rows found in CSV",
        });
      }

      const maxOrderIssue = await ctx.prisma.issue.findFirst({
        where: { projectId },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      let nextOrder = (maxOrderIssue?.order ?? -1) + 1;

      const created: string[] = [];
      const errors: Array<{ row: number; error: string }> = [];

      const insertPromises = rows.map((row: CsvRow, index: number) => {
        return ctx.prisma.issue
          .create({
            data: {
              title: row.title,
              description: row.description ?? null,
              status: row.status ? (STATUS_MAP[row.status] ?? STATUS_MAP.backlog) : STATUS_MAP.backlog,
              priority: row.priority ? (PRIORITY_MAP[row.priority] ?? PRIORITY_MAP.none) : PRIORITY_MAP.none,
              assigneeId: row.assigneeId ?? assigneeId ?? null,
              reporterId: "system",
              projectId,
              labels: row.labels
                ? JSON.stringify(row.labels.split(",").map((l: string) => l.trim()))
                : "[]",
              dueDate: row.dueDate ? new Date(row.dueDate) : null,
              order: nextOrder++,
              customFields: "{}",
            },
          })
          .then((issue: { id: string }) => {
            created.push(issue.id);
          })
          .catch((err: unknown) => {
            errors.push({
              row: index + 2,
              error: err instanceof Error ? err.message : "Unknown error",
            });
          });
      });

      await Promise.all(insertPromises);

      return {
        imported: created.length,
        errors,
        total: rows.length,
      };
    }),
});
