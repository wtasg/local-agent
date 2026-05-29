import { walk } from "@std/fs";
import { BaseTool, asBoolean, asNumber, parseObjectInput } from "./common.ts";
import type { ToolExecutionContext, ToolResult } from "../types/index.ts";
import { PathGuard } from "./path_guard.ts";

export class ListDirectoryTool extends BaseTool {
  name = "list_directory";
  description = "List files and folders, optionally recursively";
  inputSchema = {
    type: "object" as const,
    properties: {
      path: { type: "string", description: "Directory path" },
      recursive: { type: "boolean", description: "Whether to recurse" },
      maxDepth: { type: "number", description: "Maximum recursion depth" },
      includeFiles: { type: "boolean", description: "Include files" },
      includeDirs: { type: "boolean", description: "Include directories" },
    },
    additionalProperties: false,
  };

  async execute(input: unknown, context: ToolExecutionContext): Promise<ToolResult> {
    const obj = parseObjectInput(input);
    const requestedPath = typeof obj.path === "string" ? obj.path : ".";
    const recursive = asBoolean(obj.recursive, true);
    const includeFiles = asBoolean(obj.includeFiles, true);
    const includeDirs = asBoolean(obj.includeDirs, true);
    const maxDepth = Math.max(1, asNumber(obj.maxDepth, recursive ? 8 : 1));

    try {
      const guard = new PathGuard(context.cwd, context.allowedPaths);
      const base = guard.resolveChecked(requestedPath);
      const entries: Array<{ path: string; kind: "file" | "directory" }> = [];

      for await (
        const entry of walk(base, {
          maxDepth,
          includeDirs,
          includeFiles,
          followSymlinks: false,
          skip: [/\.git\//],
        })
      ) {
        entries.push({
          path: guard.relativeFromRoot(entry.path),
          kind: entry.isDirectory ? "directory" : "file",
        });
      }

      return this.ok({
        base: guard.relativeFromRoot(base),
        count: entries.length,
        entries,
      });
    } catch (error) {
      return this.fail(String(error));
    }
  }
}
