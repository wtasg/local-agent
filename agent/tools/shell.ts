import { BaseTool, asNumber, asString, parseObjectInput } from "./common.ts";
import type { ToolExecutionContext, ToolResult } from "../types/index.ts";

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 120_000;

function isPotentiallyDestructive(command: string): boolean {
  const lowered = command.toLowerCase();
  return [
    " rm ",
    "rm -",
    "mv ",
    "chmod ",
    "chown ",
    "rmdir ",
    "truncate ",
    "> /",
  ].some((needle) => lowered.includes(needle));
}

export class ShellTool extends BaseTool {
  name = "shell";
  description = "Execute a shell command locally and return stdout/stderr/exit code";
  inputSchema = {
    type: "object" as const,
    properties: {
      command: { type: "string", description: "Shell command to execute" },
      timeoutMs: { type: "number", description: "Command timeout in milliseconds" },
      cwd: { type: "string", description: "Optional working directory" },
    },
    required: ["command"],
    additionalProperties: false,
  };

  async execute(input: unknown, context: ToolExecutionContext): Promise<ToolResult> {
    if (!context.allowShell) {
      return this.fail("Shell tool is disabled by configuration");
    }

    const obj = parseObjectInput(input);
    const command = asString(obj.command, "command");
    const timeoutMs = Math.min(asNumber(obj.timeoutMs, DEFAULT_TIMEOUT_MS), MAX_TIMEOUT_MS);
    const cwd = typeof obj.cwd === "string" && obj.cwd.trim().length > 0 ? obj.cwd : context.cwd;

    if (context.confirmDestructiveOps && isPotentiallyDestructive(` ${command} `)) {
      const approved = await context.confirm(
        `Command may be destructive: ${command}. Proceed?`,
      );
      if (!approved) {
        return this.fail("Command rejected by confirmation policy");
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort("shell command timed out"), timeoutMs);

    try {
      const process = new Deno.Command("zsh", {
        args: ["-lc", command],
        cwd,
        stdout: "piped",
        stderr: "piped",
        signal: controller.signal,
      });

      const output = await process.output();
      return this.ok({
        command,
        cwd,
        stdout: new TextDecoder().decode(output.stdout),
        stderr: new TextDecoder().decode(output.stderr),
        exitCode: output.code,
        success: output.success,
      });
    } catch (error) {
      return this.fail(String(error));
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
