import { loadSync } from "@std/dotenv";
import { existsSync } from "@std/fs";
import { resolve } from "@std/path";
import type { AppConfig, LogLevel } from "../types/index.ts";

const DEFAULT_REQUEST_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_RETRIES = 3;

function toBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function toNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toList(value: string | undefined, fallback: string[]): string[] {
  if (!value) return fallback;
  const items = value.split(",").map((item) => item.trim()).filter(Boolean);
  return items.length > 0 ? items : fallback;
}

function toLogLevel(value: string | undefined): LogLevel {
  const normalized = value?.toLowerCase();
  if (
    normalized === "debug" || normalized === "info" || normalized === "warn" ||
    normalized === "error"
  ) {
    return normalized;
  }
  return "info";
}

function loadEnvFiles(): void {
  const localEnv = resolve(Deno.cwd(), ".env");
  const parentEnv = resolve(Deno.cwd(), "..", ".env");

  if (existsSync(localEnv)) {
    loadSync({ envPath: localEnv, export: true });
  }
  if (existsSync(parentEnv)) {
    loadSync({ envPath: parentEnv, export: true });
  }
}

export function loadConfig(overrides?: Partial<AppConfig>): AppConfig {
  loadEnvFiles();

  const baseUrl = Deno.env.get("LLM_BASE_URL") ??
    Deno.env.get("LOCAL_LLAMA_SERVER_URL") ??
    "http://localhost:8080/v1";
  const model = Deno.env.get("LLM_MODEL") ??
    Deno.env.get("LOCAL_LLAMA_SERVER_MODEL_NAME") ??
    "llama3";
  const apiKey = Deno.env.get("LLM_API_KEY") || undefined;

  const config: AppConfig = {
    model: {
      baseUrl,
      model,
      apiKey,
      requestTimeoutMs: toNumber(
        Deno.env.get("LLM_REQUEST_TIMEOUT_MS"),
        DEFAULT_REQUEST_TIMEOUT_MS,
      ),
      maxRetries: toNumber(Deno.env.get("LLM_MAX_RETRIES"), DEFAULT_MAX_RETRIES),
      maxOutputTokens: toNumber(Deno.env.get("LLM_MAX_OUTPUT_TOKENS"), 128),
    },
    agent: {
      verbose: toBoolean(Deno.env.get("AGENT_VERBOSE"), false),
      maxIterations: toNumber(Deno.env.get("AGENT_MAX_ITERATIONS"), 20),
      allowShell: toBoolean(Deno.env.get("AGENT_ALLOW_SHELL"), true),
      confirmDestructiveOps: toBoolean(
        Deno.env.get("AGENT_CONFIRM_DESTRUCTIVE"),
        true,
      ),
      allowedPaths: toList(Deno.env.get("AGENT_ALLOWED_PATHS"), ["."]),
    },
    memory: {
      maxMessages: toNumber(Deno.env.get("AGENT_MAX_MESSAGES"), 40),
      maxTokens: toNumber(Deno.env.get("AGENT_MAX_TOKENS"), 8000),
    },
    logging: {
      level: toLogLevel(Deno.env.get("LOG_LEVEL")),
      filePath: resolve(Deno.cwd(), "logs", "agent.log"),
    },
    tools: {
      shell: toBoolean(Deno.env.get("TOOL_SHELL"), true),
      fileRead: toBoolean(Deno.env.get("TOOL_FILE_READ"), true),
      fileWrite: toBoolean(Deno.env.get("TOOL_FILE_WRITE"), true),
      listDirectory: toBoolean(Deno.env.get("TOOL_LIST_DIRECTORY"), true),
      search: toBoolean(Deno.env.get("TOOL_SEARCH"), true),
    },
  };

  return {
    ...config,
    ...overrides,
    model: { ...config.model, ...overrides?.model },
    agent: { ...config.agent, ...overrides?.agent },
    memory: { ...config.memory, ...overrides?.memory },
    logging: { ...config.logging, ...overrides?.logging },
    tools: { ...config.tools, ...overrides?.tools },
  };
}
