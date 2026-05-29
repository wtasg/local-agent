# Local Deno Agent

A local-first, tool-using AI agent built with Deno + TypeScript.

## Features

- OpenAI-compatible local LLM integration (llama-server / llama.cpp / vLLM style)
- CLI interface via `deno task start`
- Multi-step execution loop with tool calling
- Extensible tool registry
- Short-term memory with configurable limits
- Safety controls for shell and file operations
- Structured logging and verbose runtime traces
- Basic automated tests

## Requirements

- Deno (latest stable)
- Local LLM server with OpenAI chat completions compatibility

## Quick Start

1. Enter the project directory:

```bash
cd agent
```

1. Configure environment variables:

```bash
cp .env.example .env
```

1. Start the agent:

```bash
deno task start
```

1. Run in one-shot mode:

```bash
deno task start --task "Build a summary of all markdown files in this repository."
```

1. Enable verbose mode:

```bash
deno task start --verbose
```

## Configuration

Environment variables:

```env
LLM_BASE_URL=http://localhost:8080/v1
LLM_MODEL=llama3
LLM_API_KEY=
LLM_MAX_OUTPUT_TOKENS=128

AGENT_VERBOSE=false
AGENT_MAX_ITERATIONS=20
AGENT_MAX_MESSAGES=40
AGENT_MAX_TOKENS=8000
AGENT_ALLOW_SHELL=true
AGENT_CONFIRM_DESTRUCTIVE=true
AGENT_ALLOWED_PATHS=.

LOG_LEVEL=info
```

Compatibility aliases are also supported if `LLM_BASE_URL` / `LLM_MODEL` are not set:

- `LOCAL_LLAMA_SERVER_URL`
- `LOCAL_LLAMA_SERVER_MODEL_NAME`

Example YAML-style equivalent:

```yaml
model:
  baseUrl: http://localhost:8080/v1
  model: llama3

agent:
  verbose: true
  maxIterations: 20

tools:
  shell: true
  fileRead: true
  fileWrite: true
```

## Tooling

Implemented tools:

- `shell`
- `read_file`
- `write_file`
- `list_directory`
- `search`

Tool flow:

1. Agent sends conversation + tool definitions to LLM
2. LLM returns tool calls
3. Agent executes tool(s)
4. Tool results are sent back to LLM
5. Agent repeats until final answer

## Safety

- File access is restricted to `AGENT_ALLOWED_PATHS`
- Shell can be disabled with `AGENT_ALLOW_SHELL=false`
- Destructive operations can require confirmation with `AGENT_CONFIRM_DESTRUCTIVE=true`

## Logging and Observability

- Logs are written to `logs/agent.log`
- Log levels: `debug`, `info`, `warn`, `error`
- Verbose mode shows:
  - planning output
  - tool calls/results
  - iteration progress
  - token usage totals

## Tests

Run tests:

```bash
deno task test
```

## Architecture

```text
agent/
├── main.ts
├── agent.ts
├── llm/
│   └── client.ts
├── tools/
│   ├── shell.ts
│   ├── read_file.ts
│   ├── write_file.ts
│   ├── search.ts
│   ├── list_directory.ts
│   ├── path_guard.ts
│   ├── common.ts
│   ├── registry.ts
│   └── index.ts
├── memory/
│   └── memory.ts
├── config/
│   └── config.ts
├── types/
│   └── index.ts
├── logs/
└── tests/
```

## Adding a New Tool

1. Implement `Tool` in a new file under `tools/`
2. Add its schema, description, and execute method
3. Register it in `tools/index.ts`

No changes are required in the core orchestration loop in `agent.ts`.
