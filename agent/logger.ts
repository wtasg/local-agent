import { dirname } from "@std/path";
import type { LogLevel } from "./types/index.ts";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface LoggerOptions {
  level: LogLevel;
  filePath: string;
}

export class Logger {
  #level: LogLevel;
  #filePath: string;

  constructor(options: LoggerOptions) {
    this.#level = options.level;
    this.#filePath = options.filePath;
  }

  async debug(message: string, meta?: unknown): Promise<void> {
    await this.#write("debug", message, meta);
  }

  async info(message: string, meta?: unknown): Promise<void> {
    await this.#write("info", message, meta);
  }

  async warn(message: string, meta?: unknown): Promise<void> {
    await this.#write("warn", message, meta);
  }

  async error(message: string, meta?: unknown): Promise<void> {
    await this.#write("error", message, meta);
  }

  async #write(level: LogLevel, message: string, meta?: unknown): Promise<void> {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.#level]) {
      return;
    }

    const line = JSON.stringify({
      time: new Date().toISOString(),
      level,
      message,
      meta,
    });

    if (level === "error") {
      console.error(line);
    } else if (level === "warn") {
      console.warn(line);
    } else {
      console.log(line);
    }

    await Deno.mkdir(dirname(this.#filePath), { recursive: true });
    await Deno.writeTextFile(this.#filePath, `${line}\n`, { append: true });
  }
}
