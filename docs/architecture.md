# Architecture

## Process model

One Node process (Express 4, ESM):

- `server/src/index.js` — entry: installs the netguard first, runs the doctor preflight, starts the mock MCP server on loopback (random port), then listens.
- `server/src/app.js` — the Express app: `/api` routes, the loopback `/mock/a2a/jsonrpc` endpoint, static `web/dist`, `/oauth/callback`.
- `server/src/mode.js` + `env.js` — runtime Mock/Real source and the shared settings read (`~/Development/.env`, existence only).
- `server/src/mockAgent.js` — the deterministic scenario responder behind Mock mode (access review answers, guard blocks, PII redaction).
- `server/src/mockA2A.js` — the mock A2A JSON-RPC endpoint and the Real-mode response parsing helpers (`extractA2AText`, `isGuardBlock`, `hasGuardNotice`, `jsonRpcUrl`).
- `server/src/mockMcpServer.js` — a minimal MCP server (initialize / tools/list / tools/call over Streamable HTTP) on 127.0.0.1 with four access-governance tools.
- `server/src/mcpClient.js` — the real MCP SDK client (Streamable HTTP then SSE fallback) plus the OAuth-pending provider for Real mode.
- `server/src/safety.js`, `netguard.js`, `health.js`, `doctor.js`, `trace.js` — the standard plumbing: loopback bind, Host check, same-origin writes, port range, netguard, demo-health/1, W3C traceparent per hop.
- `server/diagrams/gateway-e2e.json` — diagram-studio/1 data; the UI loads it by name (`/api/diagram`, `/api/catalog`).

## Request paths

**End to End, Mock**: browser → `POST /api/chat` → the in-process scenario responder → SSE events (trace / mcp-call / mcp-result / token / rendered / blocked / done) with a traceparent per hop.

**End to End, Real**: browser → `POST /api/chat` → server POSTs A2A `message/send` to `CENTRAL_AGENT_A2A_URL` (with the write-only bearer and a traceparent header) → `extractA2AText` → guard detection → same SSE shape.

**Personal Agent**: browser → `POST /api/mcp/connect` → real MCP SDK client → mock MCP server (Mock, pre-filled from `/api/mcp/defaults`) or a user-typed real URL (Real; OAuth-pending dialog if the server redirects to authorization). Tools are listed from `tools/list`; `tools/call` proxies arguments; results render human views (profiles, grant rows with Active/Expired/Never-used tags, holders, tickets) plus raw JSON.

## Web

React + Vite (`web/`), `@xyflow/react` for the flow diagram (movable boxes, Reset restores served positions, speed control). Two tabs, shared `standalone-ui.css` tokens, no colour literals in app CSS.
