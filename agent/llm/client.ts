import type {
  ChatOptions,
  ChatCompletionResult,
  ChatMessage,
  ModelConfig,
  TokenUsage,
} from "../types/index.ts";
import type { Logger } from "../logger.ts";

interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  tool_call_id?: string;
}

interface OpenAIToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface OpenAIToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAIResponse {
  id: string;
  choices: Array<{
    index: number;
    finish_reason: string | null;
    message: {
      role: "assistant";
      content: string | null;
      reasoning_content?: string | null;
      tool_calls?: OpenAIToolCall[];
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function candidateCompletionUrls(baseUrl: string): string[] {
  const normalized = normalizeBaseUrl(baseUrl);

  if (normalized.endsWith("/chat/completions")) {
    return [normalized];
  }

  if (normalized.endsWith("/v1")) {
    return [`${normalized}/chat/completions`];
  }

  return [
    `${normalized}/chat/completions`,
    `${normalized}/v1/chat/completions`,
  ];
}

function toUsage(
  usage: OpenAIResponse["usage"] | undefined,
): TokenUsage | undefined {
  if (!usage) return undefined;
  return {
    promptTokens: usage.prompt_tokens ?? 0,
    completionTokens: usage.completion_tokens ?? 0,
    totalTokens: usage.total_tokens ?? 0,
  };
}

function toOpenAIMessages(messages: ChatMessage[]): OpenAIMessage[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
    name: message.name,
    tool_call_id: message.toolCallId,
  }));
}

function toOpenAITools(
  options: ChatOptions | undefined,
): OpenAIToolDefinition[] | undefined {
  if (!options?.tools || options.tools.length === 0) {
    return undefined;
  }

  return options.tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: tool.inputSchema.type,
        properties: tool.inputSchema.properties,
        required: tool.inputSchema.required ?? [],
        additionalProperties: tool.inputSchema.additionalProperties ?? false,
      },
    },
  }));
}

export class LlmClient {
  #config: ModelConfig;
  #logger: Logger;

  constructor(config: ModelConfig, logger: Logger) {
    this.#config = config;
    this.#logger = logger;
  }

  async chat(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): Promise<ChatCompletionResult> {
    const urls = candidateCompletionUrls(this.#config.baseUrl);
    const tools = toOpenAITools(options);
    const payload = {
      model: this.#config.model,
      messages: toOpenAIMessages(messages),
      temperature: 0.2,
      max_tokens: this.#config.maxOutputTokens,
      ...(tools ? { tools, tool_choice: "auto" } : {}),
    };

    let attempt = 0;
    let lastError: unknown;
    let urlIndex = 0;

    while (attempt <= this.#config.maxRetries) {
      attempt += 1;
      const url = urls[Math.min(urlIndex, urls.length - 1)] ?? urls[0]!;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort("request timed out");
      }, this.#config.requestTimeoutMs);

      try {
        await this.#logger.debug("Sending chat completion request", {
          attempt,
          url,
          model: this.#config.model,
          messages: messages.length,
          promptMessages: payload.messages,
          tools: tools?.map((tool) => tool.function.name) ?? [],
        });

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(this.#config.apiKey
              ? { authorization: `Bearer ${this.#config.apiKey}` }
              : {}),
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!response.ok) {
          const responseText = await response.text();
          const retriable = response.status >= 500 || response.status === 429;

          if (response.status === 404 && urlIndex < urls.length - 1) {
            urlIndex += 1;
            throw new Error(
              `LLM endpoint not found at ${url}; trying alternate endpoint`,
            );
          }

          if (!retriable) {
            throw new Error(
              `LLM request failed (${response.status}): ${responseText}`,
            );
          }

          throw new Error(
            `LLM request failed (${response.status}): ${responseText}`,
          );
        }

        const data = (await response.json()) as OpenAIResponse;
        const choice = data.choices[0];
        if (!choice) {
          throw new Error("LLM response did not include any choices");
        }

        const result: ChatCompletionResult = {
          message: {
            role: "assistant",
            content: pickAssistantContent(choice.message),
            toolCalls: (choice.message.tool_calls ?? []).map((call) => ({
              id: call.id,
              name: call.function.name,
              arguments: call.function.arguments,
            })),
          },
          usage: toUsage(data.usage),
          finishReason: choice.finish_reason ?? undefined,
        };

        await this.#logger.debug("Received chat completion response", {
          finishReason: result.finishReason,
          usage: result.usage,
          toolCalls: result.message.toolCalls?.length ?? 0,
          assistantMessage: result.message,
        });

        return result;
      } catch (error) {
        lastError = error;
        const errorText = String(error);
        const nonRetriable =
          errorText.includes("failed (400)") ||
          errorText.includes("failed (401)") ||
          errorText.includes("failed (403)") ||
          errorText.includes("failed (404)");

        await this.#logger.warn("Chat request attempt failed", {
          attempt,
          maxRetries: this.#config.maxRetries,
          error: errorText,
        });

        if (nonRetriable) {
          break;
        }

        if (attempt > this.#config.maxRetries) {
          break;
        }

        const backoffMs = Math.min(1000 * attempt, 3000);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      } finally {
        clearTimeout(timeoutId);
      }
    }

    throw new Error(`LLM chat request failed after retries: ${String(lastError)}`);
  }
}

function pickAssistantContent(
  message: { content: string | null; reasoning_content?: string | null },
): string {
  const content = message.content?.trim();
  if (content && content.length > 0) {
    return content;
  }

  const reasoning = message.reasoning_content?.trim();
  if (reasoning && reasoning.length > 0) {
    return reasoning;
  }

  return "";
}
