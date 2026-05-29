import { assertEquals } from "@std/assert";
import { ReadFileTool } from "../tools/read_file.ts";
import { WriteFileTool } from "../tools/write_file.ts";
import { ListDirectoryTool } from "../tools/list_directory.ts";
import { SearchTool } from "../tools/search.ts";
import type { ToolExecutionContext } from "../types/index.ts";

Deno.test("file tools can write/read/list/search within allowed scope", async () => {
  const root = await Deno.makeTempDir();
  const context: ToolExecutionContext = {
    cwd: root,
    allowShell: false,
    confirmDestructiveOps: false,
    allowedPaths: ["."],
    confirm: async () => true,
  };

  const write = new WriteFileTool();
  const read = new ReadFileTool();
  const list = new ListDirectoryTool();
  const search = new SearchTool();

  const writeResult = await write.execute(
    { path: "docs/notes.txt", content: "hello deno agent", overwrite: true },
    context,
  );
  assertEquals(writeResult.ok, true);

  const readResult = await read.execute({ path: "docs/notes.txt" }, context);
  assertEquals(readResult.ok, true);

  const listResult = await list.execute({ path: "docs", recursive: true }, context);
  assertEquals(listResult.ok, true);

  const searchResult = await search.execute({ query: "deno", mode: "content" }, context);
  assertEquals(searchResult.ok, true);

  await Deno.remove(root, { recursive: true });
});
