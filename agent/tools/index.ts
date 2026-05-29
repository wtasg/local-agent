import type { AppConfig, ToolExecutionContext } from "../types/index.ts";
import { ToolRegistry } from "./registry.ts";
import { ShellTool } from "./shell.ts";
import { ReadFileTool } from "./read_file.ts";
import { WriteFileTool } from "./write_file.ts";
import { ListDirectoryTool } from "./list_directory.ts";
import { SearchTool } from "./search.ts";

export function buildToolRegistry(config: AppConfig): ToolRegistry {
  const registry = new ToolRegistry();

  if (config.tools.shell) registry.register(new ShellTool());
  if (config.tools.fileRead) registry.register(new ReadFileTool());
  if (config.tools.fileWrite) registry.register(new WriteFileTool());
  if (config.tools.listDirectory) registry.register(new ListDirectoryTool());
  if (config.tools.search) registry.register(new SearchTool());

  return registry;
}

export function buildToolExecutionContext(
  config: AppConfig,
  confirm: ToolExecutionContext["confirm"],
): ToolExecutionContext {
  return {
    cwd: Deno.cwd(),
    allowShell: config.agent.allowShell,
    confirmDestructiveOps: config.agent.confirmDestructiveOps,
    allowedPaths: config.agent.allowedPaths,
    confirm,
  };
}
