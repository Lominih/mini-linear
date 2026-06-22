import { NextRequest } from "next/server";
import { verifyAccessToken, type TokenPayload } from "@/server/auth";

// ─── Types ───────────────────────────────────────────────

export interface AuthContext {
  authenticated: true;
  user: TokenPayload;
}

export interface UnauthContext {
  authenticated: false;
  user: null;
}

export type AuthResult = AuthContext | UnauthContext;

// ─── Token Extraction ────────────────────────────────────

export function extractTokenFromHeader(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;

  return parts[1];
}

export function extractTokenFromCookie(request: NextRequest): string | null {
  return request.cookies.get("access-token")?.value ?? null;
}

// ─── Authentication ──────────────────────────────────────

export function authenticateRequest(request: NextRequest): AuthResult {
  // Try Authorization header first, then cookie
  const token = extractTokenFromHeader(request) ?? extractTokenFromCookie(request);

  if (!token) {
    return { authenticated: false, user: null };
  }

  const result = verifyAccessToken(token);

  if (!result.valid || !result.payload) {
    return { authenticated: false, user: null };
  }

  return { authenticated: true, user: result.payload };
}

// ─── Route Handler Wrapper ───────────────────────────────

export type AuthenticatedHandler = (
  request: NextRequest,
  context: AuthContext,
) => Promise<Response>;

export type UnauthenticatedHandler = (
  request: NextRequest,
) => Promise<Response>;

export function withAuth(handler: AuthenticatedHandler): UnauthenticatedHandler {
  return async (request: NextRequest): Promise<Response> => {
    const auth = authenticateRequest(request);

    if (!auth.authenticated) {
      return Response.json(
        { error: "Unauthorized", message: "Authentication required" },
        { status: 401 },
      );
    }

    return handler(request, auth);
  };
}
