import type { ChatMessage, MemoryConfig } from "../types/index.ts";

function estimateTokens(messages: ChatMessage[]): number {
  const chars = messages.reduce((sum, message) => sum + message.content.length, 0);
  return Math.ceil(chars / 4);
}

export class MemoryManager {
  #messages: ChatMessage[];
  #config: MemoryConfig;

  constructor(config: MemoryConfig, initialMessages: ChatMessage[] = []) {
    this.#config = config;
    this.#messages = [...initialMessages];
    this.#trim();
  }

  add(message: ChatMessage): void {
    this.#messages.push(message);
    this.#trim();
  }

  addMany(messages: ChatMessage[]): void {
    this.#messages.push(...messages);
    this.#trim();
  }

  all(): ChatMessage[] {
    return [...this.#messages];
  }

  clearToSystemPrompt(): void {
    const system = this.#messages.find((message) => message.role === "system");
    this.#messages = system ? [system] : [];
  }

  #trim(): void {
    while (this.#messages.length > this.#config.maxMessages) {
      const systemIndex = this.#messages.findIndex((message) => message.role === "system");
      if (systemIndex === 0) {
        this.#messages.splice(1, 1);
      } else {
        this.#messages.shift();
      }
    }

    while (estimateTokens(this.#messages) > this.#config.maxTokens && this.#messages.length > 1) {
      const removeIndex = this.#messages[0]?.role === "system" ? 1 : 0;
      this.#messages.splice(removeIndex, 1);
    }
  }
}
