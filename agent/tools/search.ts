import { walk } from "@std/fs";
import { BaseTool, asNumber, asString, parseObjectInput } from "./common.ts";
import type { ToolExecutionContext, ToolResult } from "../types/index.ts";
import { PathGuard } from "./path_guard.ts";

type SearchMode = "name" | "content" | "both";

export class SearchTool extends BaseTool {
  name = "search";
  description = "Search file names and text content in workspace files";
  inputSchema = {
    type: "object" as const,
    properties: {
      query: { type: "string", description: "Search query" },
      path: { type: "string", description: "Base path" },
      mode: { type: "string", enum: ["name", "content", "both"] },
      maxResults: { type: "number", description: "Maximum results" },
    },
    required: ["query"],
    additionalProperties: false,
  };

  async execute(input: unknown, context: ToolExecutionContext): Promise<ToolResult> {
    const obj = parseObjectInput(input);
    const query = asString(obj.query, "query").toLowerCase();
    const requestedPath = typeof obj.path === "string" ? obj.path : ".";
    const mode = toMode(obj.mode);
    const maxResults = Math.max(1, Math.min(asNumber(obj.maxResults, 50), 200));

    try {
      const guard = new PathGuard(context.cwd, context.allowedPaths);
      const base = guard.resolveChecked(requestedPath);
      const results: Array<Record<string, unknown>> = [];

      for await (const entry of walk(base, {
        includeDirs: false,
        includeFiles: true,
        followSymlinks: false,
        skip: [/\.git\//],
      })) {
        if (results.length >= maxResults) break;

        const relPath = guard.relativeFromRoot(entry.path);
        const nameMatch = relPath.toLowerCase().includes(query);

        if ((mode === "name" || mode === "both") && nameMatch) {
          results.push({ path: relPath, match: "name" });
          continue;
        }

        if (mode === "content" || mode === "both") {
          const content = await safeReadText(entry.path);
          if (content && content.toLowerCase().includes(query)) {
            const line = firstMatchingLine(content, query);
            results.push({ path: relPath, match: "content", line });
          }
        }
      }

      return this.ok({
        base: guard.relativeFromRoot(base),
        query,
        mode,
        count: results.length,
        results,
      });
    } catch (error) {
      return this.fail(String(error));
    }
  }
}

function toMode(value: unknown): SearchMode {
  if (value === "name" || value === "content" || value === "both") {
    return value;
  }
  return "both";
}

async function safeReadText(path: string): Promise<string | null> {
  try {
    return await Deno.readTextFile(path);
  } catch {
    return null;
  }
}

function firstMatchingLine(content: string, query: string): string {
  const lines = content.split("\n");
  const found = lines.find((line) => line.toLowerCase().includes(query));
  return found ? found.trim().slice(0, 300) : "";
}
