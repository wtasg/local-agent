import { assertEquals } from "@std/assert";
import { MemoryManager } from "../memory/memory.ts";

Deno.test("MemoryManager trims to max messages while preserving system prompt", () => {
  const memory = new MemoryManager(
    { maxMessages: 3, maxTokens: 1000 },
    [{ role: "system", content: "sys" }],
  );

  memory.add({ role: "user", content: "u1" });
  memory.add({ role: "assistant", content: "a1" });
  memory.add({ role: "user", content: "u2" });

  const messages = memory.all();
  assertEquals(messages.length, 3);
  assertEquals(messages[0]?.role, "system");
  assertEquals(messages[1]?.content, "a1");
  assertEquals(messages[2]?.content, "u2");
});

Deno.test("MemoryManager trims by token estimate", () => {
  const memory = new MemoryManager(
    { maxMessages: 10, maxTokens: 4 },
    [{ role: "system", content: "sys" }],
  );

  memory.add({ role: "user", content: "this is long text" });
  const messages = memory.all();

  assertEquals(messages.length, 1);
  assertEquals(messages[0]?.role, "system");
});
