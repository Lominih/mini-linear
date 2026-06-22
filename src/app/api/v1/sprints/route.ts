import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/prisma";
import { verifyAccessToken } from "@/server/auth";

export const dynamic = "force-dynamic";

function extractUser(req: NextRequest): { userId: string } | null {
  const authHeader = req.headers.get("authorization");
  let token: string | null = null;
  if (authHeader) {
    const parts = authHeader.split(" ");
    if (parts.length === 2 && parts[0] === "Bearer") token = parts[1];
  }
  if (!token) token = req.cookies.get("access-token")?.value ?? null;
  if (!token) return null;
  const result = verifyAccessToken(token);
  if (result.valid && result.payload) return { userId: result.payload.userId };
  return null;
}

// ©¤©¤©¤ GET /api/v1/sprints ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤

export async function GET(req: NextRequest) {
  try {
    const user = extractUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const status = searchParams.get("status");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));

    const where: Record<string, unknown> = {};

    if (projectId) where.projectId = projectId;
    if (status) where.status = status.toUpperCase();

    const [sprints, total] = await Promise.all([
      prisma.sprint.findMany({
        where,
        include: {
          project: {
            select: { id: true, name: true, key: true },
          },
          _count: {
            select: { issues: true },
          },
        },
        orderBy: { startDate: "desc" },
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.sprint.count({ where }),
    ]);

    const enriched = sprints.map((sprint) => {
      const now = new Date();
      const startDate = new Date(sprint.startDate);
      const endDate = new Date(sprint.endDate);
      const totalDuration = endDate.getTime() - startDate.getTime();
      const elapsed = now.getTime() - startDate.getTime();
      const timeProgress =
        totalDuration > 0
          ? Math.min(Math.max(elapsed / totalDuration, 0), 1)
          : 0;

      return {
        ...sprint,
        timeProgress,
        isOverdue: now > endDate && sprint.status !== "COMPLETED",
      };
    });

    return NextResponse.json({
      data: enriched,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/v1/sprints error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
