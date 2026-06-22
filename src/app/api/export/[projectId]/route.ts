import { NextRequest, NextResponse } from "next/server";
import { exportProjectData } from "@/server/export";
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const user = extractUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;

  try {
    const data = await exportProjectData(projectId);

    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") ?? "json";

    if (format === "download") {
      const filename = `mini-linear-export-${projectId}.json`;
      return new NextResponse(JSON.stringify(data, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}