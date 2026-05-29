import { dirname } from "@std/path";
import { BaseTool, asBoolean, asString, parseObjectInput } from "./common.ts";
import type { ToolExecutionContext, ToolResult } from "../types/index.ts";
import { PathGuard } from "./path_guard.ts";

export class WriteFileTool extends BaseTool {
  name = "write_file";
  description = "Create or update files in the local workspace";
  inputSchema = {
    type: "object" as const,
    properties: {
      path: { type: "string", description: "Path to write" },
      content: { type: "string", description: "File content" },
      overwrite: { type: "boolean", description: "Allow overwriting existing files" },
    },
    required: ["path", "content"],
    additionalProperties: false,
  };

  async execute(input: unknown, context: ToolExecutionContext): Promise<ToolResult> {
    const obj = parseObjectInput(input);
    const requestedPath = asString(obj.path, "path");
    const content = asString(obj.content, "content");
    const overwrite = asBoolean(obj.overwrite, false);

    try {
      const guard = new PathGuard(context.cwd, context.allowedPaths);
      const filePath = guard.resolveChecked(requestedPath);
      const exists = await pathExists(filePath);

      if (exists && !overwrite) {
        return this.fail("File already exists. Set overwrite=true to replace it.");
      }

      if (exists && context.confirmDestructiveOps) {
        const approved = await context.confirm(`Overwrite file ${requestedPath}?`);
        if (!approved) {
          return this.fail("Overwrite rejected by confirmation policy");
        }
      }

      await Deno.mkdir(dirname(filePath), { recursive: true });
      await Deno.writeTextFile(filePath, content);

      return this.ok({
        path: guard.relativeFromRoot(filePath),
        bytesWritten: new TextEncoder().encode(content).byteLength,
        overwritten: exists,
      });
    } catch (error) {
      return this.fail(String(error));
    }
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}
