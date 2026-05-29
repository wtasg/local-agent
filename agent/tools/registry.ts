import type {
  Tool,
  ToolDefinition,
  ToolExecutionContext,
  ToolResult,
} from "../types/index.ts";

export class ToolRegistry {
  #tools = new Map<string, Tool>();

  register(tool: Tool): void {
    if (this.#tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    this.#tools.set(tool.name, tool);
  }

  has(name: string): boolean {
    return this.#tools.has(name);
  }

  definitions(): ToolDefinition[] {
    return [...this.#tools.values()].map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));
  }

  async execute(
    name: string,
    input: unknown,
    context: ToolExecutionContext,
  ): Promise<ToolResult> {
    const tool = this.#tools.get(name);
    if (!tool) {
      return { ok: false, error: `Unknown tool: ${name}` };
    }

    const startedAt = performance.now();

    try {
      const result = await tool.execute(input, context);
      const elapsedMs = Math.round(performance.now() - startedAt);
      return {
        ...result,
        metadata: {
          ...(result.metadata ?? {}),
          tool: name,
          elapsedMs,
        },
      };
    } catch (error) {
      const elapsedMs = Math.round(performance.now() - startedAt);
      return {
        ok: false,
        error: String(error),
        metadata: { tool: name, elapsedMs },
      };
    }
  }
}
