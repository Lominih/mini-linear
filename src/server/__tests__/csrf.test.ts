import { describe, it, expect } from "vitest";
import { generateCsrfToken, validateCsrfToken } from "@/lib/csrf";

describe("csrf", () => {
  describe("generateCsrfToken", () => {
    it("returns a 64-char hex string", () => {
      const token = generateCsrfToken();
      expect(token).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(token)).toBe(true);
    });

    it("two calls return different tokens", () => {
      const token1 = generateCsrfToken();
      const token2 = generateCsrfToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe("validateCsrfToken", () => {
    it("returns true for valid token+secret", () => {
      const token = generateCsrfToken();
      expect(validateCsrfToken(token, token)).toBe(true);
    });

    it("returns false for tampered token", () => {
      const token = generateCsrfToken();
      // Flip last character
      const tampered = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
      expect(validateCsrfToken(tampered, token)).toBe(false);
    });

    it("returns false for empty token", () => {
      const token = generateCsrfToken();
      expect(validateCsrfToken("", token)).toBe(false);
    });

    it("returns false for missing token (undefined)", () => {
      expect(validateCsrfToken(undefined as unknown as string, "abc")).toBe(false);
    });

    it("returns false for wrong secret", () => {
      const token = generateCsrfToken();
      const other = generateCsrfToken();
      expect(validateCsrfToken(token, other)).toBe(false);
    });
  });
});
