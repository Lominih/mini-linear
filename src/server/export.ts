import { prisma } from "@/server/prisma";
import { TRPCError } from "@trpc/server";

// ©¤©¤©¤ Types ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤

export interface ExportProjectData {
  project: {
    id: string;
    name: string;
    description: string | null;
    key: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    owner: {
      id: string;
      name: string;
      email: string;
    };
  };
  members: Array<{
    id: string;
    role: string;
    user: {
      id: string;
      name: string;
      email: string;
    };
  }>;
  issues: Array<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    labels: string[];
    customFields: Record<string, unknown>;
    assignee: { id: string; name: string; email: string } | null;
    reporter: { id: string; name: string; email: string };
    sprintId: string | null;
    parentId: string | null;
    dueDate: string | null;
    order: number;
    createdAt: string;
    updatedAt: string;
  }>;
  sprints: Array<{
    id: string;
    name: string;
    description: string | null;
    goal: string | null;
    status: string;
    startDate: string;
    endDate: string;
    issueCount: number;
    createdAt: string;
    updatedAt: string;
  }>;
  views: Array<{
    id: string;
    name: string;
    type: string;
    filters: Record<string, unknown>;
    shared: boolean;
  }>;
  exportedAt: string;
  version: string;
}

// ©¤©¤©¤ Export Functions ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤

/**
 * Export all data for a project.
 */
export async function exportProjectData(projectId: string): Promise<ExportProjectData> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      owner: {
        select: { id: true, name: true, email: true },
      },
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      },
      issues: {
        include: {
          assignee: {
            select: { id: true, name: true, email: true },
          },
          reporter: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { order: "asc" },
      },
      sprints: {
        include: {
          _count: {
            select: { issues: true },
          },
        },
        orderBy: { startDate: "desc" },
      },
      views: true,
    },
  });

  if (!project) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Project not found",
    });
  }

  return {
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      key: project.key,
      status: project.status,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      owner: project.owner,
    },
    members: project.members.map((m) => ({
      id: m.id,
      role: m.role,
      user: m.user,
    })),
    issues: project.issues.map((issue) => ({
      id: issue.id,
      title: issue.title,
      description: issue.description,
      status: issue.status,
      priority: issue.priority,
      labels: parseJsonArray(issue.labels),
      customFields: parseJson(issue.customFields),
      assignee: issue.assignee,
      reporter: issue.reporter,
      sprintId: issue.sprintId,
      parentId: issue.parentId,
      dueDate: issue.dueDate?.toISOString() ?? null,
      order: issue.order,
      createdAt: issue.createdAt.toISOString(),
      updatedAt: issue.updatedAt.toISOString(),
    })),
    sprints: project.sprints.map((sprint) => ({
      id: sprint.id,
      name: sprint.name,
      description: sprint.description,
      goal: sprint.goal,
      status: sprint.status,
      startDate: sprint.startDate.toISOString(),
      endDate: sprint.endDate.toISOString(),
      issueCount: sprint._count.issues,
      createdAt: sprint.createdAt.toISOString(),
      updatedAt: sprint.updatedAt.toISOString(),
    })),
    views: project.views.map((view) => ({
      id: view.id,
      name: view.name,
      type: view.type,
      filters: parseJson(view.filters),
      shared: view.shared,
    })),
    exportedAt: new Date().toISOString(),
    version: "1.0.0",
  };
}

/**
 * Export issues only (lightweight).
 */
export async function exportIssues(projectId: string) {
  const issues = await prisma.issue.findMany({
    where: { projectId },
    include: {
      assignee: {
        select: { id: true, name: true, email: true },
      },
      reporter: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { order: "asc" },
  });

  return issues.map((issue) => ({
    id: issue.id,
    title: issue.title,
    description: issue.description,
    status: issue.status,
    priority: issue.priority,
    labels: parseJsonArray(issue.labels),
    customFields: parseJson(issue.customFields),
    assignee: issue.assignee,
    reporter: issue.reporter,
    sprintId: issue.sprintId,
    parentId: issue.parentId,
    dueDate: issue.dueDate?.toISOString() ?? null,
    order: issue.order,
    createdAt: issue.createdAt.toISOString(),
    updatedAt: issue.updatedAt.toISOString(),
  }));
}

// ©¤©¤©¤ Helpers ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤

function parseJsonArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJson(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}
