import { prisma } from "@/server/prisma";
import { verifyAccessToken, type TokenPayload } from "@/server/auth";
import { NextRequest } from "next/server";

// ─── Types ───────────────────────────────────────────────

export interface AuthenticatedUser extends TokenPayload {}

export interface Context {
  prisma: typeof prisma;
  user: AuthenticatedUser | null;
  req?: NextRequest;
}

// ─── Context Creation ────────────────────────────────────

export async function createContext({ req }: { req: NextRequest }): Promise<Context> {
  let user: AuthenticatedUser | null = null;

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

  if (token) {
    const result = verifyAccessToken(token);
    if (result.valid && result.payload) {
      user = result.payload;
    }
  }

  return { prisma, user, req };
}

export type CreateContextFn = typeof createContext;