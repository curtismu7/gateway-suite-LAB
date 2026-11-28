// The default story is Meridian Air, a fictional airline (fleet spec 2026-11-28). The mock world is the same one
// the A2A lab uses; the vertical packs are airlines (default), finance, healthcare, retail.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { CAST, DEFAULT_VERTICAL, SCENARIOS, STORIES, VERTICALS, allStoriesResolved, expandStory, verticalFrom } from '../src/stories.js';
import { loadCustomerConfig } from '../src/customerConfig.js';
import { createApp, PROMPT_CATEGORIES } from '../src/app.js';
import { createHealth } from '../src/health.js';
import { grantsFor, profile, respond } from '../src/mockAgent.js';
import { MOCK_TOOLS, startMockMcpServer } from '../src/mockMcpServer.js';
import { installNetguard } from '../src/netguard.js';

installNetguard();

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PEOPLE = ['dana.olsen', 'alice.chen', 'bob.reyes', 'carol.nguyen', 'dave.okoro', 'erin.walsh'];

// Brand strings of the other packs, and the cloud-estate world this lab had before the swap.
const OTHER_BRANDS = /fabrikam|northwind|contoso|harbor|vellum/i;
const RETIRED = [/prod-db/, /(?<![a-z-])payments-api/, /s3-customer-exports/, /jenkins-ci/, /exports-reader/, /ci-admin/, /jane\.lee|marcus\.hale|sam\.patel|Marcus Hale/, /@example\.invalid/];

test('the default vertical is airlines; four packs, each with a story; unknown ids fall back to the default', () => {
  assert.equal(DEFAULT_VERTICAL, 'airlines');
  assert.deepEqual([...VERTICALS].sort(), ['airlines', 'finance', 'healthcare', 'retail']);
  assert.equal(VERTICALS[0], DEFAULT_VERTICAL);
  assert.deepEqual(new Set(STORIES.map((s) => s.vertical)), new Set(VERTICALS));
  assert.equal(STORIES[0].vertical, 'airlines', 'the first story shown is the airline one');
  for (const bad of [undefined, null, '', 'nope', '__proto__', 'Airlines']) assert.equal(verticalFrom(bad), 'airlines', String(bad));
  for (const v of ['finance', 'healthcare', 'retail']) assert.equal(verticalFrom(v), v, `${v} still selectable`);
  assert.equal(SCENARIOS.airlines.brand, 'Meridian Air');
  assert.equal(CAST.brand.label, 'Meridian Air');
});

test('customer.config: the shipped file says airlines; a saved finance/retail config keeps working; an unknown one falls back', () => {
  assert.equal(loadCustomerConfig().vertical, 'airlines');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gws-cfg-'));
  try {
    const mk = (vertical) => {
      const f = path.join(dir, `${vertical ?? 'none'}.json`);
      fs.writeFileSync(f, JSON.stringify({ branding: { productName: 'X' }, vocabulary: {}, ...(vertical === undefined ? {} : { vertical }) }));
      return loadCustomerConfig(f).vertical;
    };
    assert.equal(mk('finance'), 'finance');
    assert.equal(mk('retail'), 'retail');
    assert.equal(mk('mystery'), 'airlines');
    assert.equal(mk(undefined), 'airlines');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('undefined-token test covers the airlines pack: every airline story resolves, and a missing token is reported', () => {
  assert.deepEqual(allStoriesResolved(), []);
  const air = STORIES.filter((s) => s.vertical === 'airlines');
  assert.ok(air.length >= 2);
  assert.ok(air.some((s) => s.steps.some((t) => t.includes('{{cast:brand}}'))), 'the airline story takes its brand from the pack, not hard-coded');
  const { brand, ...withoutBrand } = CAST;
  assert.ok(allStoriesResolved(withoutBrand).some((p) => p.startsWith('airlines-') && /undefined cast token: brand/.test(p)));
  assert.throws(() => expandStory('{{cast:airline-nobody}}'), /undefined cast token/);
  const ids = STORIES.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, 'story ids are unique');
});

test('the airline run shows Meridian Air: catalog default, scenario, first story', async () => {
  const server = http.createServer(createApp({ health: createHealth({ intervalMs: 3_600_000 }) }));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/catalog`, { headers: { host: `localhost:${port}` } });
    const cat = await res.json();
    assert.equal(cat.customer.vertical, 'airlines');
    assert.equal(cat.scenario.brand, 'Meridian Air');
    assert.match(cat.scenario.summary, /fictional airline/);
    assert.equal(cat.stories[0].vertical, 'airlines');
    assert.deepEqual(cat.verticals, VERTICALS);
    // no other pack's brand or retired identifier anywhere in what the default page is built from
    const text = JSON.stringify(cat) + STORIES.filter((s) => s.vertical === 'airlines').flatMap((s) => s.steps).map((t) => expandStory(t)).join('\n');
    assert.doesNotMatch(text, OTHER_BRANDS);
    for (const re of RETIRED) assert.doesNotMatch(text, re);
  } finally { await new Promise((r) => server.close(r)); }
});

test('the mock world is Meridian Air: people, resources, roles and .example emails; every grant is internally consistent', () => {
  const resources = new Set(['passenger-records-db', 'fare-payments-api', 'flight-manifest-exports']);
  const roles = new Set(['passenger-db-admin', 'passenger-db-reader', 'break-glass', 'payments-deployer', 'manifest-reader']);
  for (const id of PEOPLE) {
    const p = profile(id);
    assert.match(p.email, /^(\[REDACTED\]|[a-z.]+@(contractor\.)?meridianair\.example)$/, id);
    assert.notEqual(p.department, 'Engineering');
    if (p.manager) assert.ok(PEOPLE.includes(p.manager), `${id}'s manager exists`);
    for (const g of grantsFor(id)) {
      assert.ok(resources.has(g.resource), `${id}: resource ${g.resource}`);
      assert.ok(roles.has(g.role), `${id}: role ${g.role}`);
      assert.ok(PEOPLE.includes(g.grantedBy), `${id}: grantedBy ${g.grantedBy}`);
    }
  }
  assert.equal(profile('carol.nguyen').employmentType, 'contractor');
  assert.equal(profile('bob.reyes').employmentType, 'employee');
  assert.equal(profile('erin.walsh').status, 'offboarding');
});

test('every preset prompt is understood by the mock responder (a renamed prompt that no longer matches falls to the generic reply), and no reply names an old brand or retired identifier', () => {
  const generic = respond('zzz').text;
  // These three were answered generically before the swap too (checked against origin/main with the names mapped back): the
  // responder matches user ids, not "Carol Nguyen", and its regex says "who has access" where the prompt says "Does anyone have".
  // Not part of this change; the other 16 presets must keep their answers.
  const ALREADY_GENERIC = new Set([
    'Does Carol Nguyen still need passenger-db-admin? Her grant expired in December.',
    'List all entitlements for Erin Walsh',
    'List all entitlements for Carol Nguyen',
  ]);
  for (const c of PROMPT_CATEGORIES) {
    for (const p of c.prompts) {
      const r = respond(p);
      if (!ALREADY_GENERIC.has(p)) assert.notEqual(r.text, generic, `prompt falls through to the generic reply: ${p}`);
      const flat = JSON.stringify(r);
      assert.doesNotMatch(flat, OTHER_BRANDS, p);
      for (const re of RETIRED) assert.doesNotMatch(flat, re, `${p} -> ${re}`);
    }
  }
  for (const t of MOCK_TOOLS) assert.doesNotMatch(JSON.stringify(t), OTHER_BRANDS);
});

test('flight-manifest-exports: the responder and the MCP tool both return Erin\'s manifest-reader grant (a renamed role must not empty the answer)', async () => {
  for (const q of ['Who has access to flight-manifest-exports who is no longer active?', 'Does anyone have access to flight-manifest-exports who is no longer active?']) {
    const r = respond(q);
    assert.equal(r.kind, 'tool', q);
    assert.equal(r.tool, 'access_on_resource', q);
    assert.ok(r.result.grants.length > 0, `no grants returned for: ${q}`);
    assert.ok(r.result.grants.every((g) => g.resource === 'flight-manifest-exports' && g.role === 'manifest-reader'), q);
  }
  const { server, url } = await startMockMcpServer();
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'access_on_resource', arguments: { resource: 'flight-manifest-exports' } } }) });
    const j = await res.json();
    const text = j.result?.content?.[0]?.text;
    const out = text ? JSON.parse(text) : j.result;
    assert.ok(Array.isArray(out.grants) && out.grants.length > 0, 'the MCP tool returned no grants for flight-manifest-exports');
    assert.ok(out.grants.every((g) => g.role === 'manifest-reader'));
  } finally { server.close(); }
});

test('a person who is not seeded gets no grants and an Unassigned profile (nothing invented)', () => {
  assert.deepEqual(grantsFor('nobody.here'), []);
  assert.equal(profile('nobody.here').department, 'Unassigned');
});

test('no shipped text names a retired identifier or another pack brand', () => {
  const SKIP = new Set(['node_modules', 'dist', '.git']);
  const files = [];
  const walk = (dir) => {
    for (const n of fs.readdirSync(dir)) {
      if (SKIP.has(n)) continue;
      const f = path.join(dir, n);
      if (fs.statSync(f).isDirectory()) walk(f);
      else if (/\.(js|jsx|mjs|md|json|yml|yaml|html|css|sh)$/.test(n) && n !== 'package-lock.json' && n !== 'airlineDefault.test.js') files.push(f);
    }
  };
  for (const d of ['server', 'web/src', 'scripts', 'docs']) walk(path.join(ROOT, d));
  for (const f of ['README.md', 'CLAUDE.md', 'content-pack.json']) files.push(path.join(ROOT, f));
  assert.ok(files.length > 30, `${files.length} files scanned`);
  const hits = [];
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    for (const re of [OTHER_BRANDS, ...RETIRED.slice(0, 6)]) if (re.test(text)) hits.push(`${path.relative(ROOT, f)}: ${re}`);
  }
  assert.deepEqual(hits, []);
});
