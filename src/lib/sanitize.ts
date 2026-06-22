import { z } from "zod";

const MAX_INPUT_LENGTH = 10_000;

/**
 * Strip HTML tags and escape special characters to prevent XSS.
 */
export function sanitizeHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")          // strip HTML tags
    .replace(/&/g, "&amp;")           // escape &
    .replace(/</g, "&lt;")            // escape <
    .replace(/>/g, "&gt;")            // escape >
    .replace(/"/g, "&quot;")          // escape "
    .replace(/'/g, "&#x27;");         // escape '
}

/**
 * General-purpose input sanitizer: trim whitespace, strip control chars,
 * enforce a maximum length.
 */
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // remove control chars (keep \t \n \r)
    .slice(0, MAX_INPUT_LENGTH);
}

/**
 * Validate unknown data against a Zod schema, then sanitize the resulting
 * string fields. Returns a discriminated-union result for easy handling.
 */
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

  // Deep-sanitize any string values in the parsed output
  const sanitized = deepSanitizeStrings(result.data);

  return { success: true, data: sanitized as T };
}

/**
 * Recursively walk an object/array and sanitize every string value.
 */
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
