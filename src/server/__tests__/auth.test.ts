import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import jwt from "jsonwebtoken";
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  validateEmail,
  validatePassword,
  type TokenPayload,
} from "@/server/auth";

const TEST_PAYLOAD: TokenPayload = {
  userId: "user-1",
  email: "test@example.com",
  role: "MEMBER",
};

// ─── Password Utilities ──────────────────────────────────────────────────────

describe("Password Utilities", () => {
  describe("hashPassword", () => {
    it("returns a hash different from the plaintext", async () => {
      const hash = await hashPassword("MyPassword123");
      expect(hash).not.toBe("MyPassword123");
      expect(hash.length).toBeGreaterThan(0);
    });

    it("produces different hashes for the same input (salt)", async () => {
      const hash1 = await hashPassword("MyPassword123");
      const hash2 = await hashPassword("MyPassword123");
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("verifyPassword", () => {
    it("returns true for a correct password", async () => {
      const hash = await hashPassword("MyPassword123");
      const result = await verifyPassword("MyPassword123", hash);
      expect(result).toBe(true);
    });

    it("returns false for an incorrect password", async () => {
      const hash = await hashPassword("MyPassword123");
      const result = await verifyPassword("WrongPassword", hash);
      expect(result).toBe(false);
    });
  });
});

// ─── JWT Utilities ───────────────────────────────────────────────────────────

describe("JWT Utilities", () => {
  describe("generateAccessToken", () => {
    it("returns a valid JWT string", () => {
      const token = generateAccessToken(TEST_PAYLOAD);
      expect(typeof token).toBe("string");
      const parts = token.split(".");
      expect(parts).toHaveLength(3);
    });
  });

  describe("generateRefreshToken", () => {
    it("returns a valid JWT string", () => {
      const token = generateRefreshToken(TEST_PAYLOAD);
      expect(typeof token).toBe("string");
      const parts = token.split(".");
      expect(parts).toHaveLength(3);
    });
  });

  describe("generateTokenPair", () => {
    it("returns both tokens with numeric expiresIn", () => {
      const pair = generateTokenPair(TEST_PAYLOAD);
      expect(pair.accessToken).toBeDefined();
      expect(pair.refreshToken).toBeDefined();
      expect(typeof pair.expiresIn).toBe("number");
      expect(pair.expiresIn).toBeGreaterThan(0);
    });
  });

  describe("verifyAccessToken", () => {
    it("validates a token it generated", () => {
      const token = generateAccessToken(TEST_PAYLOAD);
      const result = verifyAccessToken(token);
      expect(result.valid).toBe(true);
      expect(result.payload).toBeDefined();
      expect(result.payload!.userId).toBe(TEST_PAYLOAD.userId);
      expect(result.payload!.email).toBe(TEST_PAYLOAD.email);
      expect(result.payload!.role).toBe(TEST_PAYLOAD.role);
    });

    it("rejects a token signed with a different secret", () => {
      const token = jwt.sign(TEST_PAYLOAD, "wrong-secret");
      const result = verifyAccessToken(token);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid token");
    });

    it("rejects an expired token", () => {
      const token = jwt.sign(TEST_PAYLOAD, process.env.JWT_SECRET || "mini-linear-dev-secret-change-in-production", {
        expiresIn: "-1s",
      });
      const result = verifyAccessToken(token);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Token expired");
    });

    it("rejects garbage input", () => {
      const result = verifyAccessToken("not-a-jwt");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid token");
    });
  });

  describe("verifyRefreshToken", () => {
    it("validates a refresh token it generated", () => {
      const token = generateRefreshToken(TEST_PAYLOAD);
      const result = verifyRefreshToken(token);
      expect(result.valid).toBe(true);
      expect(result.payload!.userId).toBe(TEST_PAYLOAD.userId);
    });

    it("rejects an access token as a refresh token", () => {
      const accessToken = generateAccessToken(TEST_PAYLOAD);
      const result = verifyRefreshToken(accessToken);
      expect(result.valid).toBe(false);
    });

    it("rejects an expired refresh token", () => {
      const token = jwt.sign(TEST_PAYLOAD, process.env.JWT_REFRESH_SECRET || "mini-linear-refresh-secret-change-in-production", {
        expiresIn: "-1s",
      });
      const result = verifyRefreshToken(token);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Refresh token expired");
    });
  });
});

// ─── Validation Helpers ──────────────────────────────────────────────────────

describe("validateEmail", () => {
  it("accepts valid email addresses", () => {
    expect(validateEmail("user@example.com")).toBe(true);
    expect(validateEmail("name.last@domain.co")).toBe(true);
    expect(validateEmail("a+b@c.com")).toBe(true);
  });

  it("rejects invalid email addresses", () => {
    expect(validateEmail("")).toBe(false);
    expect(validateEmail("notanemail")).toBe(false);
    expect(validateEmail("@domain.com")).toBe(false);
    expect(validateEmail("user@")).toBe(false);
    expect(validateEmail("user @example.com")).toBe(false);
  });
});

describe("validatePassword", () => {
  it("accepts a strong password", () => {
    const result = validatePassword("StrongPass1");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects short passwords", () => {
    const result = validatePassword("Ab1");
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual("Password must be at least 8 characters long");
  });

  it("rejects passwords without uppercase", () => {
    const result = validatePassword("lowercase1");
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual("Password must contain at least one uppercase letter");
  });

  it("rejects passwords without lowercase", () => {
    const result = validatePassword("UPPERCASE1");
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual("Password must contain at least one lowercase letter");
  });

  it("rejects passwords without numbers", () => {
    const result = validatePassword("NoNumberHere");
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual("Password must contain at least one number");
  });

  it("collects multiple errors", () => {
    const result = validatePassword("short");
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});
