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

// ©¤©¤©¤ GET /api/v1/projects ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤

export async function GET(req: NextRequest) {
  try {
    const user = extractUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));

    const where: Record<string, unknown> = {};

    if (status) where.status = status.toUpperCase();
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
        { key: { contains: search } },
      ];
    }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: {
          owner: {
            select: { id: true, name: true, email: true, avatar: true },
          },
          _count: {
            select: { issues: true, members: true, sprints: true },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.project.count({ where }),
    ]);

    return NextResponse.json({
      data: projects,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/v1/projects error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
