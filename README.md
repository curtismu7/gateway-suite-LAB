# AI Gateway Suite LAB

Tier: Demo
Repo: https://github.com/curtismu7/gateway-suite-LAB

An agent-access demo, relayed end to end: you pick a preset prompt (access review, prompt injection, jailbreak, exfiltration, PII, tool misuse, malicious content, inter-agent abuse) and watch it travel **Main Agent → AI Gateway (A2A) → Worker Agent → AI Gateway (MCP) → MCP tool → LLM** on a movable ReactFlow diagram, with an SSE trace (handoff / guard / mcp-call / mcp-result / result / blocked, one W3C traceparent per hop) and the rendered answer. Attack prompts are stopped by AI Guard at the gateway; PII prompts come back with `[REDACTED]` fields. The second tab, **Personal Agent**, connects to a remote MCP server (Streamable HTTP, SSE fallback), lists its tools, renders parameter forms from `inputSchema` and calls them, with the OAuth-pending dialog flow in Real mode.

## What is simulated

- **Mock mode (default when Real is not configured).** Everything is in-process and offline: the central agent is a deterministic scenario responder, the AI Guard blocks are scripted, the mock MCP server is a real MCP server on `127.0.0.1` (random port) started inside the server process, and the "LLM" answer is template text. No tenant, no LLM API, no outbound network. Mock-issued values are labelled **MOCK**.
- **Real mode (rule 19).** The server POSTs A2A `message/send` to the configured central agent (`CENTRAL_AGENT_A2A_URL`, optional `CENTRAL_AGENT_A2A_BEARER`, optional `WORKER_TRACE_URL` SSE relay, all from the shared `~/Development/.env`; owner sets them). The Personal Agent connects to a real MCP URL you type. The bearer key is write-only: it is never returned by any API and never echoed.
- **Real not configured**: the Real button is disabled with a how-to tooltip, and `POST /api/mode {"source":"real"}` answers 409 with the same message.

## Run from a clone

```bash
npm ci
npm test          # server (node --test) + web (vitest)
npm run doctor    # preflight: node version, port, netguard, mock agent, an HTTP cycle
npm start         # http://localhost:5750
./scripts/run.sh  # same as npm start (checks the port first)
```

Endpoints: `GET /api/health` (demo-health/1), `GET /api/info`, `GET /api/catalog`, `POST /api/chat` (SSE), `POST /api/mcp/connect|tools/call|disconnect`, `GET /api/mcp/status`, `GET /api/mcp/defaults`, `POST /api/mode`, `POST /api/reset`.

## Ports, and what to do if the port is taken

Default port 5750, allowed range 5750-5759. If it is taken:

```bash
lsof -iTCP:5750 -sTCP:LISTEN -n -P
PORT=<other port> npm start
```

## Mock and Real modes (rule 19)

A visible Mock / Real toggle sits in the header of every page; pressed = current mode, switching needs no restart and reloads all data. Default source is Real if configured, else Mock.

## Health, doctor and reset

`GET /api/health` returns the shelf's `demo-health/1` contract. `npm run doctor` runs the same checks plus a full HTTP cycle (health, guard-blocked chat, Real refused with 409, mock MCP connect/list/call). `npm run reset` bumps the server epoch and clears sessions.

## Docker

```bash
HOST_PORT=5750 docker compose up --build -d
```

OrbStack only (never Docker Desktop). The container is read-only, cap-dropped, and publishes `127.0.0.1:` only. Health check hits `/api/health`. `STANDALONE_ENV` (default `~/Development/.env`) is mounted as an optional `env_file` for Real mode.

## Settings file

Real mode reads the ONE shared settings file `~/Development/.env` (`STANDALONE_ENV` overrides the path): `CENTRAL_AGENT_A2A_URL`, `CENTRAL_AGENT_A2A_BEARER` (write-only), `WORKER_TRACE_URL`. Nothing real lives in this repo; see `.env.example`.
