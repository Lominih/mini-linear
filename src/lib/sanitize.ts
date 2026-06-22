import { z } from "zod";

const MAX_INPUT_LENGTH = 10_000;

export function sanitizeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/<[^>]*>/g, "");
}

export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .slice(0, MAX_INPUT_LENGTH);
}

export function validateAndSanitize<T>(
  schema: z.ZodType<T>,
  data: unknown,
): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);

  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`,
      ),
    };
  }

  const sanitized = deepSanitizeStrings(result.data);
  return { success: true, data: sanitized as T };
}

function deepSanitizeStrings<T>(value: T): T {
  if (typeof value === "string") {
    return sanitizeInput(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => deepSanitizeStrings(item)) as T;
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = deepSanitizeStrings(val);
    }
    return out as T;
  }
  return value;
}