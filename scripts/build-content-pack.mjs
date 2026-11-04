// Builds content-pack.json for the Learning Hub from the app's own data, so the pack cannot drift.
//   node scripts/build-content-pack.mjs        (writes content-pack.json)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const { PROMPT_CATEGORIES } = await import(pathToFileURL(path.join(ROOT, 'server/src/app.js')));

const tryCard = (c) => ({
  id: `try-${c.key}`,
  label: c.label,
  description: `Send a preset prompt from the "${c.label}" category through the relayed agent flow.`,
  group: 'try-it',
  action: { type: 'route', href: '/#/end-to-end' },
  terms: ['a2a', 'ai-guard', 'mcp-gateway', 'mock-mode', 'personal-agent'],
});

const glossary = [
  { id: 'a2a', term: 'A2A handoff', definition: 'The message/send relay from the Main Agent to the Worker Agent through the AI Gateway, carried as JSON-RPC. The trace list shows one traceparent per hop.' },
  { id: 'ai-guard', term: 'AI Guard', definition: 'The gateway-side guard that can stop a prompt before it reaches a tool or an LLM. In this lab the blocks are produced by the deterministic mock responder; Real mode shows the configured agent\'s own guard behaviour.' },
  { id: 'mcp-gateway', term: 'AI Gateway (MCP traffic)', definition: 'The gateway hop between the Worker Agent and its MCP tools, where tool misuse and data-loss policies are enforced.' },
  { id: 'mock-mode', term: 'MOCK labels', definition: 'Mock-issued values in this lab are labelled MOCK. Real mode uses the configured central agent; its bearer key stays write-only and is never returned by any API.' },
  { id: 'personal-agent', term: 'Personal Agent', definition: 'The second tab: connect to a remote MCP server (Streamable HTTP, SSE fallback), list its tools, render parameter forms from inputSchema and call them. Mock mode connects to the in-process mock MCP server on loopback.' },
];

export function buildPack() {
  return {
    schema: 'demo-content-pack/1',
    id: 'gateway-suite-lab',
    title: 'AI Gateway Suite LAB',
    version,
    demo: { id: 'gateway-suite-lab', name: 'AI Gateway Suite LAB', catalog: 'D01', baseUrl: 'http://localhost:5750', doctor: '/api/health', tags: ['ai-gateway', 'a2a', 'mcp', 'ai-guard', 'prompt-injection', 'data-loss', 'agents', 'mock', 'simulated'] },
    glossary,
    cards: PROMPT_CATEGORIES.map(tryCard),
    sources: [
      { id: 'mcp-spec', title: 'Model Context Protocol', url: 'https://modelcontextprotocol.io', kind: 'standard', use: 'The wire protocol the Personal Agent speaks', status: 'read', checked: '2026-11-04' },
    ],
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fs.writeFileSync(path.join(ROOT, 'content-pack.json'), JSON.stringify(buildPack(), null, 2) + '\n');
  console.log('content-pack.json written');
}
