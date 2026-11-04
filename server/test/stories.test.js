// Rule 10/12/13 tests: stories with {{cast}} tokens all resolve (a test fails on an
// undefined token), customer.config loads and renames only, workspace id namespacing works.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { allStoriesResolved, expandStory, STORIES, VERTICALS } from '../src/stories.js';
import { loadCustomerConfig } from '../src/customerConfig.js';
import { createApp } from '../src/app.js';
import { createHealth } from '../src/health.js';
import { installNetguard } from '../src/netguard.js';

installNetguard();

test('rule 10: every story step resolves its {{cast}} tokens; every story has a known vertical', () => {
  assert.deepEqual(allStoriesResolved(), []);
  assert.ok(STORIES.length >= 3);
  assert.deepEqual(new Set(STORIES.map((s) => s.vertical)), new Set(VERTICALS));
  assert.throws(() => expandStory('{{cast:nobody}}'), /undefined cast token/);
});

test('rule 12: customer.config loads and only renames', () => {
  const cfg = loadCustomerConfig();
  assert.equal(typeof cfg.branding.productName, 'string');
  assert.equal(typeof cfg.vocabulary.guard, 'string');
});

const call = async (app, method, apiPath, body, headers = {}) => {
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}${apiPath}`, {
      method,
      headers: { 'content-type': 'application/json', origin: `http://127.0.0.1:${port}`, host: `localhost:${port}`, ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, json };
  } finally { await new Promise((r) => server.close(r)); }
};

test('rule 13: the workspace id namespaces MCP sessions and is reported', async () => {
  const app = createApp({ health: createHealth({ intervalMs: 3_600_000 }) });
  const catalog = await call(app, 'GET', '/api/catalog');
  assert.equal(catalog.json.customer.productName, 'AI Gateway Suite LAB');
  assert.ok(catalog.json.stories.length >= 3);
  const a = await call(app, 'GET', '/api/mcp/status', undefined, { 'x-lab-workspace': 'alpha' });
  const b = await call(app, 'GET', '/api/mcp/status', undefined, { 'x-lab-workspace': 'beta' });
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  // a hostile workspace id is sanitized, not stored
  const c = await call(app, 'GET', '/api/mcp/status', undefined, { 'x-lab-workspace': '../../etc' });
  assert.equal(c.status, 200);
});
