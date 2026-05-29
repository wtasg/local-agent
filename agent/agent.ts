import type {
  AgentEvent,
  AppConfig,
  ChatMessage,
  TokenUsage,
  ToolExecutionContext,
} from "./types/index.ts";
import { LlmClient } from "./llm/client.ts";
import { Logger } from "./logger.ts";
import { MemoryManager } from "./memory/memory.ts";
import { buildToolExecutionContext, buildToolRegistry } from "./tools/index.ts";
import type { ToolRegistry } from "./tools/registry.ts";

const SYSTEM_PROMPT = [
  "You are a local-first task execution agent.",
  "Be concise, explicit, and execution-oriented.",
  "Use available tools for factual checks and file/system operations.",
  "Break down complex tasks into multi-step plans before execution.",
  "When tools are unavailable or blocked, explain constraints and provide best-effort guidance.",
].join(" ");

export interface LocalAgentOptions {
  onEvent?: (event: AgentEvent) => void;
  confirm?: ToolExecutionContext["confirm"];
}

export class LocalAgent {
  #config: AppConfig;
  #logger: Logger;
  #llm: LlmClient;
  #memory: MemoryManager;
  #toolRegistry: ToolRegistry;
  #toolContext: ToolExecutionContext;
  #usageTotals: TokenUsage;
  #onEvent?: (event: AgentEvent) => void;

  constructor(config: AppConfig, options?: LocalAgentOptions) {
    this.#config = config;
    this.#logger = new Logger(config.logging);
    this.#llm = new LlmClient(config.model, this.#logger);
    this.#memory = new MemoryManager(config.memory, [
      { role: "system", content: SYSTEM_PROMPT },
    ]);
    this.#toolRegistry = buildToolRegistry(config);
    this.#onEvent = options?.onEvent;
    this.#toolContext = buildToolExecutionContext(
      config,
      options?.confirm ?? (async () => !config.agent.confirmDestructiveOps),
    );
    this.#usageTotals = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  }

  async runTask(input: string): Promise<string> {
    this.#appendMessage({ role: "user", content: input });
    await this.#logger.info("Starting task", { input });

    if (this.#config.agent.verbose) {
      await this.#generatePlan(input);
    }

    for (let iteration = 1; iteration <= this.#config.agent.maxIterations; iteration++) {
      this.#emit({ type: "iteration", iteration });

      const response = await this.#llm.chat(this.#memory.all(), {
        tools: this.#toolRegistry.definitions(),
      });
      this.#appendMessage(response.message);

      if (response.usage) {
        this.#accumulateUsage(response.usage);
      }

      const text = response.message.content?.trim();

      const toolCalls = response.message.toolCalls ?? [];
      if (toolCalls.length === 0) {
        const finalText = text && text.length > 0 ? text : "Model returned an empty response.";
        this.#emit({ type: "final", text: finalText });
        await this.#logger.info("Task completed", {
          iteration,
          finishReason: response.finishReason,
          usageTotals: this.#usageTotals,
        });
        return finalText;
      }

      for (const toolCall of toolCalls) {
        this.#emit({ type: "tool_call", name: toolCall.name, arguments: toolCall.arguments });

        const parsedArgs = safeParseJson(toolCall.arguments);
        const result = await this.#toolRegistry.execute(
          toolCall.name,
          parsedArgs,
          this.#toolContext,
        );

        this.#emit({
          type: "tool_result",
          name: toolCall.name,
          ok: result.ok,
          elapsedMs: asElapsedMs(result.metadata),
        });

        await this.#logger.info("Tool executed", {
          name: toolCall.name,
          ok: result.ok,
          metadata: result.metadata,
          error: result.error,
        });

        this.#appendMessage({
          role: "tool",
          toolCallId: toolCall.id,
          name: toolCall.name,
          content: JSON.stringify(result),
        });
      }
    }

    throw new Error(
      `Agent reached max iterations (${this.#config.agent.maxIterations}) without final response`,
    );
  }

  #accumulateUsage(usage: TokenUsage): void {
    this.#usageTotals = {
      promptTokens: this.#usageTotals.promptTokens + usage.promptTokens,
      completionTokens: this.#usageTotals.completionTokens + usage.completionTokens,
      totalTokens: this.#usageTotals.totalTokens + usage.totalTokens,
    };
  }

  usageTotals(): TokenUsage {
    return { ...this.#usageTotals };
  }

  async shutdown(): Promise<void> {
    await this.#logger.info("Agent shutting down");
  }

  #appendMessage(message: ChatMessage): void {
    this.#memory.add(message);
  }

  #emit(event: AgentEvent): void {
    this.#onEvent?.(event);
  }

  async #generatePlan(input: string): Promise<void> {
    try {
      const planResponse = await this.#llm.chat([
        ...this.#memory.all(),
        {
          role: "user",
          content:
            `Create a concise numbered execution plan for this task. Do not execute tools. Task: ${input}`,
        },
      ]);

      const planText = planResponse.message.content?.trim();
      if (!planText) {
        return;
      }

      this.#emit({ type: "plan", text: planText });
      this.#appendMessage({
        role: "assistant",
        content: `Execution plan:\n${planText}`,
      });

      if (planResponse.usage) {
        this.#accumulateUsage(planResponse.usage);
      }
    } catch (error) {
      await this.#logger.warn("Plan generation failed; continuing without explicit plan", {
        error: String(error),
      });
    }
  }
}

function safeParseJson(input: string): unknown {
  if (!input || input.trim().length === 0) {
    return {};
  }

  try {
    return JSON.parse(input) as unknown;
  } catch {
    return { raw: input };
  }
}

function asElapsedMs(
  metadata: Record<string, unknown> | undefined,
): number | undefined {
  const value = metadata?.elapsedMs;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return undefined;
}
