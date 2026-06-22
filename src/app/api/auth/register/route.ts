import { NextRequest } from "next/server";
import { SystemRole } from "@/generated/prisma/client";
import { hashPassword, validateEmail, validatePassword, generateTokenPair } from "@/server/auth";
import { z } from "zod";

import { prisma } from "@/server/prisma";

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: z.string().min(8),
});

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          error: "Validation error",
          message: "Invalid input",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { email, name, password } = parsed.data;

    // Validate email format
    if (!validateEmail(email)) {
      return Response.json(
        { error: "Validation error", message: "Invalid email format" },
        { status: 400 },
      );
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return Response.json(
        {
          error: "Validation error",
          message: "Password does not meet requirements",
          details: { password: passwordValidation.errors },
        },
        { status: 400 },
      );
    }

    // Check for existing user
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return Response.json(
        { error: "Conflict", message: "An account with this email already exists" },
        { status: 409 },
      );
    }

    // Hash password and create user
    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        role: SystemRole.MEMBER,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    // Generate tokens
    const tokens = generateTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Log the registration in audit
    try {
      await prisma.auditLog.create({
        data: {
          action: "REGISTER",
          entity: "User",
          entityId: user.id,
          userId: user.id,
          details: JSON.stringify({ email: user.email }),
        },
      });
    } catch {
      // Don't fail registration if audit logging fails
    }

    return Response.json(
      {
        user,
        ...tokens,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Registration error:", error);
    return Response.json(
      { error: "Internal server error", message: "Failed to create account" },
      { status: 500 },
    );
  }
}
