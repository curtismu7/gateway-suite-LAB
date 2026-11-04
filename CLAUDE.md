# gateway-suite-LAB — AI Gateway Suite LAB (Demo tier)

Standalone conversion of the Gateway Demo Suite: a relayed agent chat (Main Agent → AI Gateway (A2A) → Worker Agent → AI Gateway (MCP) → MCP tool → LLM) plus a Personal Agent tab for remote MCP servers. Follow `~/Development/STANDALONE-RULES.md`.

## Run / test

```bash
npm ci && npm test && npm run doctor && npm start   # http://localhost:5750
node ~/Development/demo-kit-base/scripts/conformance.mjs . --new --tier=Demo
```

## The rules that bite

- **Mock/Real toggle (rule 19)**: `POST /api/mode` exactly `{"source":"mock"|"real"}`; Real unconfigured → 409 + how-to (`CENTRAL_AGENT_A2A_URL` in `~/Development/.env`). Default Real if configured else Mock. Never mention Chinese content or real tenant identifiers.
- **Loopback only**: bind 127.0.0.1 unless `GWS_BIND`; Host check + same-origin writes; compose publishes `127.0.0.1:` only (pinned by a test).
- **Netguard**: Mock mode = zero non-loopback outbound (test asserts it). Real mode allows ONLY the configured central agent / trace hosts plus loopback.
- **Secrets**: the bearer key is write-only — never returned by any API, never logged. Mock values labelled MOCK.
- Node 26, tests with a glob (`node --test test/*.test.js`), no `crypto.generateKeyPairSync('ec')`.
- Ports 5750-5759; forbidden ports list in `server/src/safety.js`.
- Diagrams load by name from `server/diagrams` (diagram-studio/1); no hand-built nodes in the UI.
