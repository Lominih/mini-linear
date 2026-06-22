import { describe, it, expect } from "vitest";
import {
  validateCustomFields,
  getDefaultCustomFields,
  mergeCustomFields,
  parseCustomFields,
  serializeCustomFields,
  type CustomFieldDefinition,
} from "@/server/custom-fields";

const FIELD_DEFS: CustomFieldDefinition[] = [
  { id: "cf_text", name: "Summary", type: "text", required: false },
  { id: "cf_number", name: "Story Points", type: "number", required: false },
  { id: "cf_select", name: "Severity", type: "select", required: true, options: ["low", "medium", "high", "critical"] },
  { id: "cf_multi", name: "Tags", type: "multi_select", required: false, options: ["backend", "frontend", "infra"] },
  { id: "cf_date", name: "Due Date", type: "date", required: false },
  { id: "cf_person", name: "Reviewer", type: "person", required: false },
];

// ─── validateCustomFields ────────────────────────────────────────────────────

describe("validateCustomFields", () => {
  it("returns valid for empty fields with no required definitions", () => {
    const defs: CustomFieldDefinition[] = [
      { id: "f1", name: "Optional", type: "text", required: false },
    ];
    const result = validateCustomFields({}, defs);
    expect(result.valid).toBe(true);
    expect(Object.keys(result.errors)).toHaveLength(0);
  });

  it("returns valid for null optional fields", () => {
    const defs: CustomFieldDefinition[] = [
      { id: "f1", name: "Optional", type: "text", required: false },
    ];
    const result = validateCustomFields({ f1: null }, defs);
    expect(result.valid).toBe(true);
  });

  it("flags required fields as errors when missing", () => {
    const result = validateCustomFields({}, FIELD_DEFS);
    expect(result.valid).toBe(false);
    expect(result.errors.cf_select).toContain("required");
  });

  it("validates text field type", () => {
    const result = validateCustomFields({ cf_text: 123, cf_select: "low" }, FIELD_DEFS);
    expect(result.valid).toBe(false);
    expect(result.errors.cf_text).toContain("string");
  });

  it("accepts valid text field", () => {
    const result = validateCustomFields({ cf_text: "hello", cf_select: "low" }, FIELD_DEFS);
    expect(result.valid).toBe(true);
  });

  it("validates number field type", () => {
    const result = validateCustomFields({ cf_number: "not a number", cf_select: "low" }, FIELD_DEFS);
    expect(result.valid).toBe(false);
    expect(result.errors.cf_number).toContain("number");
  });

  it("accepts valid number field", () => {
    const result = validateCustomFields({ cf_number: 42, cf_select: "medium" }, FIELD_DEFS);
    expect(result.valid).toBe(true);
  });

  it("rejects NaN for number field", () => {
    const result = validateCustomFields({ cf_number: NaN, cf_select: "low" }, FIELD_DEFS);
    expect(result.valid).toBe(false);
  });

  it("validates select field against allowed options", () => {
    const result = validateCustomFields({ cf_select: "invalid" }, FIELD_DEFS);
    expect(result.valid).toBe(false);
    expect(result.errors.cf_select).toContain("not a valid option");
  });

  it("accepts valid select option", () => {
    const result = validateCustomFields({ cf_select: "high" }, FIELD_DEFS);
    expect(result.valid).toBe(true);
  });

  it("validates multi_select items against allowed options", () => {
    const result = validateCustomFields({ cf_select: "low", cf_multi: ["backend", "unknown"] }, FIELD_DEFS);
    expect(result.valid).toBe(false);
    expect(result.errors.cf_multi).toContain("not a valid option");
  });

  it("accepts valid multi_select array", () => {
    const result = validateCustomFields({ cf_select: "low", cf_multi: ["backend", "frontend"] }, FIELD_DEFS);
    expect(result.valid).toBe(true);
  });

  it("rejects non-array for multi_select", () => {
    const result = validateCustomFields({ cf_select: "low", cf_multi: "backend" }, FIELD_DEFS);
    expect(result.valid).toBe(false);
    expect(result.errors.cf_multi).toContain("array");
  });

  it("validates date field format", () => {
    const result = validateCustomFields({ cf_select: "low", cf_date: "not-a-date" }, FIELD_DEFS);
    expect(result.valid).toBe(false);
    expect(result.errors.cf_date).toContain("valid ISO date string");
  });

  it("accepts valid date string", () => {
    const result = validateCustomFields({ cf_select: "low", cf_date: "2026-07-01" }, FIELD_DEFS);
    expect(result.valid).toBe(true);
  });

  it("validates person field type", () => {
    const result = validateCustomFields({ cf_select: "low", cf_person: 123 }, FIELD_DEFS);
    expect(result.valid).toBe(false);
    expect(result.errors.cf_person).toContain("string");
  });

  it("accepts valid person field", () => {
    const result = validateCustomFields({ cf_select: "low", cf_person: "user-1" }, FIELD_DEFS);
    expect(result.valid).toBe(true);
  });

  it("collects multiple errors at once", () => {
    const result = validateCustomFields(
      { cf_text: 123, cf_number: "bad", cf_select: "nope" },
      FIELD_DEFS
    );
    expect(result.valid).toBe(false);
    expect(Object.keys(result.errors).length).toBeGreaterThanOrEqual(2);
  });
});

// ─── getDefaultCustomFields ──────────────────────────────────────────────────

describe("getDefaultCustomFields", () => {
  it("returns defaults from definitions", () => {
    const defs: CustomFieldDefinition[] = [
      { id: "f1", name: "Text", type: "text", defaultValue: "hello" },
      { id: "f2", name: "Num", type: "number", defaultValue: 42 },
    ];
    const result = getDefaultCustomFields(defs);
    expect(result).toEqual({ f1: "hello", f2: 42 });
  });

  it("excludes fields without defaults", () => {
    const defs: CustomFieldDefinition[] = [
      { id: "f1", name: "Text", type: "text" },
    ];
    const result = getDefaultCustomFields(defs);
    expect(result).toEqual({});
  });
});

// ─── mergeCustomFields ───────────────────────────────────────────────────────

describe("mergeCustomFields", () => {
  it("adds new values", () => {
    const existing = { cf_text: "hello" };
    const updates = { cf_number: 42 };
    const result = mergeCustomFields(existing, updates, FIELD_DEFS);
    expect(result).toEqual({ cf_text: "hello", cf_number: 42 });
  });

  it("updates existing values", () => {
    const existing = { cf_text: "old" };
    const updates = { cf_text: "new" };
    const result = mergeCustomFields(existing, updates, FIELD_DEFS);
    expect(result.cf_text).toBe("new");
  });

  it("removes values set to null", () => {
    const existing = { cf_text: "value", cf_number: 5 };
    const updates = { cf_text: null };
    const result = mergeCustomFields(existing, updates, FIELD_DEFS);
    expect(result.cf_text).toBeUndefined();
    expect(result.cf_number).toBe(5);
  });

  it("removes values set to undefined", () => {
    const existing = { cf_text: "value" };
    const updates = { cf_text: undefined };
    const result = mergeCustomFields(existing, updates, FIELD_DEFS);
    expect(result.cf_text).toBeUndefined();
  });

  it("ignores unknown field keys", () => {
    const existing = { cf_text: "value" };
    const updates = { unknown_field: "test" };
    const result = mergeCustomFields(existing, updates, FIELD_DEFS);
    expect(result).toEqual({ cf_text: "value" });
  });

  it("does not mutate the original object", () => {
    const existing = { cf_text: "old" };
    const updates = { cf_text: "new" };
    mergeCustomFields(existing, updates, FIELD_DEFS);
    expect(existing.cf_text).toBe("old");
  });
});

// ─── parseCustomFields / serializeCustomFields ────────────────────────────────

describe("parseCustomFields", () => {
  it("parses a valid JSON string", () => {
    const result = parseCustomFields('{"key": "value"}');
    expect(result).toEqual({ key: "value" });
  });

  it("returns empty object for null input", () => {
    expect(parseCustomFields(null)).toEqual({});
  });

  it("returns empty object for empty string", () => {
    expect(parseCustomFields("")).toEqual({});
  });

  it("returns empty object for invalid JSON", () => {
    expect(parseCustomFields("not json")).toEqual({});
  });

  it("returns empty object for array input", () => {
    expect(parseCustomFields("[1,2,3]")).toEqual({});
  });

  it("returns empty object for string input", () => {
    expect(parseCustomFields('"just a string"')).toEqual({});
  });
});

describe("serializeCustomFields", () => {
  it("serializes an object to JSON string", () => {
    const result = serializeCustomFields({ key: "value" });
    expect(result).toBe('{"key":"value"}');
  });

  it("serializes an empty object", () => {
    const result = serializeCustomFields({});
    expect(result).toBe("{}");
  });
});

describe("parseCustomFields + serializeCustomFields roundtrip", () => {
  it("roundtrips correctly", () => {
    const original = { a: 1, b: "hello", c: true, d: null };
    const serialized = serializeCustomFields(original);
    const parsed = parseCustomFields(serialized);
    expect(parsed).toEqual(original);
  });
});
