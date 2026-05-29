export type LogLevel = "debug" | "info" | "warn" | "error";

export type Role = "system" | "user" | "assistant" | "tool";

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface ChatMessage {
  role: Role;
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatCompletionResult {
  message: ChatMessage;
  usage?: TokenUsage;
  finishReason?: string;
}

export interface ToolInputSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
}

export interface ToolResult {
  ok: boolean;
  data?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface ToolExecutionContext {
  cwd: string;
  allowShell: boolean;
  confirmDestructiveOps: boolean;
  allowedPaths: string[];
  confirm: (message: string) => Promise<boolean>;
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
  execute(input: unknown, context: ToolExecutionContext): Promise<ToolResult>;
}

export interface ModelConfig {
  baseUrl: string;
  model: string;
  apiKey?: string;
  requestTimeoutMs: number;
  maxRetries: number;
  maxOutputTokens: number;
}

export interface AgentConfig {
  verbose: boolean;
  maxIterations: number;
  allowShell: boolean;
  confirmDestructiveOps: boolean;
  allowedPaths: string[];
}

export interface MemoryConfig {
  maxMessages: number;
  maxTokens: number;
}

export interface LoggingConfig {
  level: LogLevel;
  filePath: string;
}

export interface ToolFlags {
  shell: boolean;
  fileRead: boolean;
  fileWrite: boolean;
  listDirectory: boolean;
  search: boolean;
}

export interface AppConfig {
  model: ModelConfig;
  agent: AgentConfig;
  memory: MemoryConfig;
  logging: LoggingConfig;
  tools: ToolFlags;
}

export interface ChatOptions {
  tools?: ToolDefinition[];
}

export type AgentEvent =
  | { type: "iteration"; iteration: number }
  | { type: "plan"; text: string }
  | { type: "tool_call"; name: string; arguments: string }
  | { type: "tool_result"; name: string; ok: boolean; elapsedMs?: number }
  | { type: "final"; text: string };
