import { parse } from "@std/flags";
import { loadConfig } from "./config/config.ts";
import { LocalAgent } from "./agent.ts";
import type { AgentEvent } from "./types/index.ts";

function printBanner(): void {
  console.log("Local Deno Agent");
  console.log("Type your task and press Enter. Type 'exit' to quit.");
}

async function readTaskFromCli(initialTask?: string): Promise<string | null> {
  if (initialTask && initialTask.trim().length > 0) {
    return initialTask.trim();
  }

  const input = prompt("> ");
  if (input === null) {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  if (["exit", "quit"].includes(trimmed.toLowerCase())) {
    return null;
  }

  return trimmed;
}

function printEvent(event: AgentEvent): void {
  switch (event.type) {
    case "iteration":
      console.log(`[iteration ${event.iteration}]`);
      break;
    case "plan":
      console.log("[plan]");
      console.log(event.text);
      break;
    case "tool_call":
      console.log(`[tool] ${event.name}(${event.arguments})`);
      break;
    case "tool_result":
      console.log(
        `[tool-result] ${event.name}: ${event.ok ? "ok" : "error"}${event.elapsedMs ? ` (${event.elapsedMs}ms)` : ""}`,
      );
      break;
    case "final":
      break;
  }
}

async function confirmDangerousOperation(message: string): Promise<boolean> {
  const answer = prompt(`${message} [y/N]`);
  return answer !== null && ["y", "yes"].includes(answer.trim().toLowerCase());
}

async function main(): Promise<void> {
  const args = parse(Deno.args, {
    boolean: ["verbose", "help"],
    string: ["task"],
    alias: {
      v: "verbose",
      t: "task",
      h: "help",
    },
  });

  if (args.help) {
    console.log("Usage: deno task start --task 'your task' [--verbose]");
    return;
  }

  const config = loadConfig({
    agent: {
      verbose: Boolean(args.verbose),
      maxIterations: Number(Deno.env.get("AGENT_MAX_ITERATIONS") ?? "20"),
      allowShell: (Deno.env.get("AGENT_ALLOW_SHELL") ?? "true") !== "false",
      confirmDestructiveOps: (Deno.env.get("AGENT_CONFIRM_DESTRUCTIVE") ?? "true") !==
        "false",
      allowedPaths: (Deno.env.get("AGENT_ALLOWED_PATHS") ?? ".").split(",").map((s) => s.trim())
        .filter(Boolean),
    },
  });

  const agent = new LocalAgent(config, {
    onEvent: config.agent.verbose ? printEvent : undefined,
    confirm: confirmDangerousOperation,
  });

  try {
    printBanner();
    let task = await readTaskFromCli(args.task);
    if (!task) {
      console.log("No task provided. Exiting.");
      return;
    }

    while (task) {
      const output = await agent.runTask(task);
      console.log("\nAgent response:\n");
      console.log(output);

      if (args.task) {
        break;
      }

      task = await readTaskFromCli();
    }

    if (config.agent.verbose) {
      const usage = agent.usageTotals();
      console.log("\nToken usage:\n");
      console.log(JSON.stringify(usage, null, 2));
    }
  } catch (error) {
    console.error(`Fatal error: ${String(error)}`);
    Deno.exitCode = 1;
  } finally {
    await agent.shutdown();
  }
}

if (import.meta.main) {
  await main();
}
