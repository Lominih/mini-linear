import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/prisma";
import { verifyAccessToken } from "@/server/auth";

export const dynamic = "force-dynamic";

// ©¤©¤©¤ Auth Helper ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤

function extractUser(req: NextRequest): { userId: string } | null {
  const authHeader = req.headers.get("authorization");
  let token: string | null = null;

  if (authHeader) {
    const parts = authHeader.split(" ");
    if (parts.length === 2 && parts[0] === "Bearer") {
      token = parts[1];
    }
  }

  if (!token) {
    token = req.cookies.get("access-token")?.value ?? null;
  }

  if (!token) return null;

  const result = verifyAccessToken(token);
  if (result.valid && result.payload) {
    return { userId: result.payload.userId };
  }

  return null;
}

// ©¤©¤©¤ GET /api/v1/issues ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤

export async function GET(req: NextRequest) {
  try {
    const user = extractUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const assigneeId = searchParams.get("assigneeId");
    const sprintId = searchParams.get("sprintId");
    const label = searchParams.get("label");
    const search = searchParams.get("search");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));
    const orderBy = searchParams.get("orderBy") ?? "createdAt";
    const orderDirection = searchParams.get("orderDirection") ?? "desc";

    const where: Record<string, unknown> = {};

    if (projectId) where.projectId = projectId;
    if (status) where.status = status.toUpperCase();
    if (priority) where.priority = priority.toUpperCase();
    if (assigneeId) where.assigneeId = assigneeId;
    if (sprintId) where.sprintId = sprintId;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ];
    }

    // Label filtering (stored as JSON array string in SQLite)
    if (label) {
      where.labels = { contains: `"${label}"` };
    }

    const validOrderBy = ["createdAt", "updatedAt", "priority", "order", "title"].includes(orderBy)
      ? orderBy
      : "createdAt";

    const [issues, total] = await Promise.all([
      prisma.issue.findMany({
        where,
        include: {
          assignee: {
            select: { id: true, name: true, email: true, avatar: true },
          },
          reporter: {
            select: { id: true, name: true, email: true, avatar: true },
          },
          project: {
            select: { id: true, name: true, key: true },
          },
          sprint: {
            select: { id: true, name: true, status: true },
          },
        },
        orderBy: { [validOrderBy]: orderDirection as "asc" | "desc" },
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.issue.count({ where }),
    ]);

    // Parse labels and customFields from JSON strings
    const formatted = issues.map((issue) => ({
      ...issue,
      labels: parseJsonArray(issue.labels),
      customFields: parseJson(issue.customFields),
    }));

    return NextResponse.json({
      data: formatted,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/v1/issues error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// ©¤©¤©¤ POST /api/v1/issues ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤

export async function POST(req: NextRequest) {
  try {
    const user = extractUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { title, description, projectId, priority, assigneeId, labels, dueDate, sprintId } = body as {
      title?: string;
      description?: string;
      projectId?: string;
      priority?: string;
      assigneeId?: string;
      labels?: string[];
      dueDate?: string;
      sprintId?: string;
    };

    if (!title || !projectId) {
      return NextResponse.json(
        { error: "title and projectId are required" },
        { status: 400 },
      );
    }

    // Verify project exists
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Get max order for the project
    const maxOrderIssue = await prisma.issue.findFirst({
      where: { projectId },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const issue = await prisma.issue.create({
      data: {
        title,
        description: description ?? undefined,
        projectId,
        reporterId: user.userId,
        status: "BACKLOG",
        priority: (priority?.toUpperCase() ?? "NONE") as never,
        assigneeId: assigneeId ?? undefined,
        labels: JSON.stringify(labels ?? []),
        dueDate: dueDate ? new Date(dueDate) : undefined,
        sprintId: sprintId ?? undefined,
        order: (maxOrderIssue?.order ?? -1) + 1,
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        reporter: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        project: {
          select: { id: true, name: true, key: true },
        },
      },
    });

    return NextResponse.json({
      data: {
        ...issue,
        labels: parseJsonArray(issue.labels),
        customFields: parseJson(issue.customFields),
      },
    }, { status: 201 });
  } catch (error) {
    console.error("POST /api/v1/issues error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// ©¤©¤©¤ Helpers ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤

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
