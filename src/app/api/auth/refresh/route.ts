import { NextRequest } from "next/server";
import { prisma } from "@/server/prisma";
import jwt from "jsonwebtoken";
import {
  verifyRefreshToken,
  generateAccessToken,
  generateRefreshToken,
} from "@/server/auth";



export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json().catch(() => ({}));
    const refreshToken =
      body.refreshToken ?? request.cookies.get("refresh-token")?.value;

    if (!refreshToken) {
      return Response.json(
        { error: "Bad request", message: "Refresh token required" },
        { status: 400 },
      );
    }

    // Verify the refresh token
    const result = verifyRefreshToken(refreshToken);

    if (!result.valid || !result.payload) {
      return Response.json(
        { error: "Unauthorized", message: result.error ?? "Invalid refresh token" },
        { status: 401 },
      );
    }

    const { userId, email, role } = result.payload;

    // Confirm user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      return Response.json(
        { error: "Unauthorized", message: "User no longer exists" },
        { status: 401 },
      );
    }

    // Generate new token pair
    const tokens = {
      accessToken: generateAccessToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      }),
      refreshToken: generateRefreshToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      }),
    };

    // Decode to get expiresIn
    const decoded = jwt.decode(tokens.accessToken) as jwt.JwtPayload | null;
    const expiresIn = decoded?.exp
      ? decoded.exp - Math.floor(Date.now() / 1000)
      : 604800;

    return Response.json({
      ...tokens,
      expiresIn,
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    return Response.json(
      { error: "Internal server error", message: "Failed to refresh token" },
      { status: 500 },
    );
  }
}