import type {
  Tool,
  ToolExecutionContext,
  ToolInputSchema,
  ToolResult,
} from "../types/index.ts";

export abstract class BaseTool implements Tool {
  abstract name: string;
  abstract description: string;
  abstract inputSchema: ToolInputSchema;

  abstract execute(input: unknown, context: ToolExecutionContext): Promise<ToolResult>;

  protected ok(data: unknown): ToolResult {
    return { ok: true, data };
  }

  protected fail(error: string): ToolResult {
    return { ok: false, error };
  }
}

export function parseObjectInput(input: unknown): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new Error("Tool input must be a JSON object");
  }
  return input as Record<string, unknown>;
}

export function asString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Field '${field}' must be a non-empty string`);
  }
  return value;
}

export function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  return fallback;
}

export function asNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return fallback;
}
