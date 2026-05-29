import { assertEquals } from "@std/assert";
import { ToolRegistry } from "../tools/registry.ts";
import type { Tool, ToolExecutionContext } from "../types/index.ts";

class EchoTool implements Tool {
  name = "echo";
  description = "echo";
  inputSchema = { type: "object" as const, properties: {}, additionalProperties: true };

  async execute(input: unknown): Promise<{ ok: true; data: unknown }> {
    return { ok: true, data: input };
  }
}

const context: ToolExecutionContext = {
  cwd: Deno.cwd(),
  allowShell: true,
  confirmDestructiveOps: false,
  allowedPaths: ["."],
  confirm: async () => true,
};

Deno.test("ToolRegistry registers and executes tool", async () => {
  const registry = new ToolRegistry();
  registry.register(new EchoTool());

  const result = await registry.execute("echo", { hello: "world" }, context);
  assertEquals(result.ok, true);
  assertEquals(result.data, { hello: "world" });
});

Deno.test("ToolRegistry returns structured error for unknown tool", async () => {
  const registry = new ToolRegistry();
  const result = await registry.execute("missing", {}, context);
  assertEquals(result.ok, false);
  assertEquals(result.error, "Unknown tool: missing");
});
