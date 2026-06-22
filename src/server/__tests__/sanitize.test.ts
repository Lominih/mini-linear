import { describe, it, expect } from "vitest";
import { z } from "zod";
import { sanitizeHtml, sanitizeInput, validateAndSanitize } from "@/lib/sanitize";

describe("sanitize", () => {
  describe("sanitizeHtml", () => {
    it("escapes HTML tags and special characters", () => {
      expect(sanitizeHtml("<b>bold</b><script>alert('x')</script>")).toBe(
        "&lt;b&gt;bold&lt;/b&gt;&lt;script&gt;alert(&#x27;x&#x27;)&lt;/script&gt;"
      );
    });

    it("escapes special characters", () => {
      expect(sanitizeHtml('& < > " \'')).toBe(
        "&amp; &lt; &gt; &quot; &#x27;"
      );
    });

    it("handles empty string", () => {
      expect(sanitizeHtml("")).toBe("");
    });

    it("handles nested tags", () => {
      expect(sanitizeHtml("<div><span>text</span></div>")).toBe(
        "&lt;div&gt;&lt;span&gt;text&lt;/span&gt;&lt;/div&gt;"
      );
    });
  });

  describe("sanitizeInput", () => {
    it("trims whitespace", () => {
      expect(sanitizeInput("  hello  ")).toBe("hello");
    });

    it("removes control characters", () => {
      expect(sanitizeInput("a\x00b\x07c\x7fd")).toBe("abcd");
      expect(sanitizeInput("a\tb\nc\rd")).toBe("a\tb\nc\rd");
    });

    it("enforces length limit", () => {
      const long = "x".repeat(15_000);
      expect(sanitizeInput(long)).toHaveLength(10_000);
    });
  });

  describe("validateAndSanitize", () => {
    it("works with Zod schema", () => {
      const schema = z.object({ name: z.string(), age: z.number() });
      const result = validateAndSanitize(schema, { name: "  Alice  ", age: 30 });
      expect(result).toEqual({ success: true, data: { name: "Alice", age: 30 } });
    });

    it("returns errors for invalid data", () => {
      const schema = z.object({ name: z.string(), age: z.number() });
      const result = validateAndSanitize(schema, { name: 123, age: "not a number" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });
  });
});