import { assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import { ShellTool } from "../tools/shell.ts";
import type { ToolExecutionContext } from "../types/index.ts";

function contextFor(root: string, overrides?: Partial<ToolExecutionContext>): ToolExecutionContext {
  return {
    cwd: root,
    allowShell: true,
    confirmDestructiveOps: false,
    allowedPaths: ["."],
    confirm: async () => true,
    ...overrides,
  };
}

Deno.test("ShellTool returns disabled error when shell is not allowed", async () => {
  const root = await Deno.makeTempDir();
  try {
    const shell = new ShellTool();
    const result = await shell.execute(
      { command: "echo should-not-run" },
      contextFor(root, { allowShell: false }),
    );

    assertEquals(result.ok, false);
    assertEquals(result.error, "Shell tool is disabled by configuration");
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("ShellTool runs commands inside allowed root", async () => {
  const root = await Deno.makeTempDir();
  try {
    const shell = new ShellTool();
    const result = await shell.execute({ command: "pwd" }, contextFor(root));

    assertEquals(result.ok, true);
    const data = result.data as { cwd: string; stdout: string; success: boolean };
    assertEquals(data.cwd, root);
    assertEquals(data.stdout.trim(), root);
    assertEquals(data.success, true);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("ShellTool accepts relative cwd inside allowed scope", async () => {
  const root = await Deno.makeTempDir();
  try {
    const workspace = join(root, "workspace");
    await Deno.mkdir(workspace);

    const shell = new ShellTool();
    const result = await shell.execute(
      { command: "pwd", cwd: "workspace" },
      contextFor(root),
    );

    assertEquals(result.ok, true);
    const data = result.data as { cwd: string; stdout: string };
    assertEquals(data.cwd, workspace);
    assertEquals(data.stdout.trim(), workspace);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("ShellTool rejects absolute cwd outside allowed scope", async () => {
  const root = await Deno.makeTempDir();
  const outside = await Deno.makeTempDir();
  const marker = join(outside, "marker.txt");
  try {
    const shell = new ShellTool();
    const result = await shell.execute(
      { command: "touch marker.txt", cwd: outside },
      contextFor(root),
    );

    assertEquals(result.ok, false);
    assertStringIncludes(result.error ?? "", "Path is outside allowed scope");
    assertEquals(await exists(marker), false);
  } finally {
    await Deno.remove(root, { recursive: true });
    await Deno.remove(outside, { recursive: true });
  }
});

Deno.test("ShellTool rejects cwd traversal outside allowed scope", async () => {
  const parent = await Deno.makeTempDir();
  const root = join(parent, "root");
  await Deno.mkdir(root);
  const marker = join(parent, "marker.txt");

  try {
    const shell = new ShellTool();
    const result = await shell.execute(
      { command: "touch marker.txt", cwd: ".." },
      contextFor(root),
    );

    assertEquals(result.ok, false);
    assertStringIncludes(result.error ?? "", "Path is outside allowed scope");
    assertEquals(await exists(marker), false);
  } finally {
    await Deno.remove(parent, { recursive: true });
  }
});

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}
