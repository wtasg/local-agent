import { BaseTool, asString, parseObjectInput } from "./common.ts";
import type { ToolExecutionContext, ToolResult } from "../types/index.ts";
import { PathGuard } from "./path_guard.ts";

export class ReadFileTool extends BaseTool {
  name = "read_file";
  description = "Read text or JSON files from the local workspace";
  inputSchema = {
    type: "object" as const,
    properties: {
      path: { type: "string", description: "Path to file" },
      as: { type: "string", enum: ["text", "json"] },
    },
    required: ["path"],
    additionalProperties: false,
  };

  async execute(input: unknown, context: ToolExecutionContext): Promise<ToolResult> {
    const obj = parseObjectInput(input);
    const requestedPath = asString(obj.path, "path");
    const format = obj.as === "json" ? "json" : "text";

    try {
      const guard = new PathGuard(context.cwd, context.allowedPaths);
      const filePath = guard.resolveChecked(requestedPath);
      const content = await Deno.readTextFile(filePath);

      if (format === "json") {
        const parsed = JSON.parse(content) as unknown;
        return this.ok({ path: guard.relativeFromRoot(filePath), json: parsed });
      }

      return this.ok({ path: guard.relativeFromRoot(filePath), content });
    } catch (error) {
      return this.fail(String(error));
    }
  }
}
