import { z } from "zod";

// ─── Field Type Definitions ───────────────────────────────────────────────────

export type CustomFieldType = "text" | "number" | "select" | "multi_select" | "date" | "person";

export interface CustomFieldDefinition {
  id: string;
  name: string;
  type: CustomFieldType;
  required: boolean;
  options?: string[];
  defaultValue?: unknown;
  projectId?: string;
}

export const customFieldDefinitionSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  type: z.enum(["text", "number", "select", "multi_select", "date", "person"]),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
  defaultValue: z.unknown().optional(),
  projectId: z.string().optional(),
});

// ─── Validation Schemas ───────────────────────────────────────────────────────

function validateTextField(value: unknown): { valid: boolean; error?: string } {
  if (value === null || value === undefined) return { valid: true };
  if (typeof value !== "string") return { valid: false, error: "Text field must be a string" };
  return { valid: true };
}

function validateNumberField(value: unknown): { valid: boolean; error?: string } {
  if (value === null || value === undefined) return { valid: true };
  if (typeof value === "number" && !Number.isNaN(value)) return { valid: true };
  return { valid: false, error: "Number field must be a valid number" };
}

function validateSelectField(
  value: unknown,
  options: string[]
): { valid: boolean; error?: string } {
  if (value === null || value === undefined) return { valid: true };
  if (typeof value !== "string") return { valid: false, error: "Select field must be a string" };
  if (!options.includes(value)) {
    return { valid: false, error: `"${value}" is not a valid option. Valid options: ${options.join(", ")}` };
  }
  return { valid: true };
}

function validateMultiSelectField(
  value: unknown,
  options: string[]
): { valid: boolean; error?: string } {
  if (value === null || value === undefined) return { valid: true };
  if (!Array.isArray(value)) return { valid: false, error: "Multi-select field must be an array" };
  for (const item of value) {
    if (typeof item !== "string") return { valid: false, error: "Multi-select items must be strings" };
    if (!options.includes(item)) {
      return { valid: false, error: `"${item}" is not a valid option` };
    }
  }
  return { valid: true };
}

function validateDateField(value: unknown): { valid: boolean; error?: string } {
  if (value === null || value === undefined) return { valid: true };
  if (typeof value !== "string") return { valid: false, error: "Date field must be a string" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { valid: false, error: "Date field must be a valid ISO date string" };
  return { valid: true };
}

function validatePersonField(value: unknown): { valid: boolean; error?: string } {
  if (value === null || value === undefined) return { valid: true };
  if (typeof value !== "string") return { valid: false, error: "Person field must be a user ID string" };
  return { valid: true };
}

// ─── Main Validation ──────────────────────────────────────────────────────────

export function validateCustomFields(
  fields: Record<string, unknown>,
  definitions: CustomFieldDefinition[]
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  for (const def of definitions) {
    const value = fields[def.id];

    // Check required
    if (def.required && (value === null || value === undefined || value === "")) {
      errors[def.id] = `"${def.name}" is required`;
      continue;
    }

    // Skip validation if null/undefined and not required
    if (value === null || value === undefined) continue;

    let result: { valid: boolean; error?: string };

    switch (def.type) {
      case "text":
        result = validateTextField(value);
        break;
      case "number":
        result = validateNumberField(value);
        break;
      case "select":
        result = validateSelectField(value, def.options ?? []);
        break;
      case "multi_select":
        result = validateMultiSelectField(value, def.options ?? []);
        break;
      case "date":
        result = validateDateField(value);
        break;
      case "person":
        result = validatePersonField(value);
        break;
      default:
        result = { valid: false, error: `Unknown field type: ${def.type}` };
    }

    if (!result.valid && result.error) {
      errors[def.id] = result.error;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

// ─── Defaults & Merge Helpers ─────────────────────────────────────────────────

export function getDefaultCustomFields(
  definitions: CustomFieldDefinition[]
): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  for (const def of definitions) {
    if (def.defaultValue !== undefined) {
      defaults[def.id] = def.defaultValue;
    }
  }
  return defaults;
}

export function mergeCustomFields(
  existing: Record<string, unknown>,
  updates: Record<string, unknown>,
  definitions: CustomFieldDefinition[]
): Record<string, unknown> {
  const merged = { ...existing };

  for (const [key, value] of Object.entries(updates)) {
    const def = definitions.find((d) => d.id === key);
    if (!def) continue;

    // Setting to null/undefined removes the value
    if (value === null || value === undefined) {
      delete merged[key];
    } else {
      merged[key] = value;
    }
  }

  return merged;
}

export function parseCustomFields(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed;
    }
    return {};
  } catch {
    return {};
  }
}

export function serializeCustomFields(fields: Record<string, unknown>): string {
  return JSON.stringify(fields);
}

// ─── Zod Schemas for API Input ────────────────────────────────────────────────

export const customFieldValueSchema = z.record(z.string(), z.unknown());

export const createCustomFieldDefinitionSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["text", "number", "select", "multi_select", "date", "person"]),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
  defaultValue: z.unknown().optional(),
  projectId: z.string().optional(),
});
