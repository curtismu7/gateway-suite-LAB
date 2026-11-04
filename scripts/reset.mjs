#!/usr/bin/env node
// Reset a running gateway-suite-LAB: bumps the epoch and clears chat/MCP sessions.
//   node scripts/reset.mjs [base-url]      (default http://localhost:${PORT:-5750})
// Loopback only: refuses any other host. Needs the server already running.
import { isLoopbackHost } from '../server/src/safety.js';

export async function reset(base = `http://localhost:${process.env.PORT || 5750}`) {
  const u = new URL(base);
  if (!isLoopbackHost(u.hostname)) throw new Error(`refusing ${u.hostname}: loopback only`);
  let r;
  try { r = await fetch(new URL('/api/reset', u), { method: 'POST', headers: { 'content-type': 'application/json', origin: u.origin }, body: '{}' }); }
  catch { throw new Error(`no lab is listening at ${u.origin}; start it first (npm start) or pass the base URL`); }
  if (!r.ok) throw new Error(`reset failed: HTTP ${r.status}`);
  return r.json();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  reset(process.argv[2]).then((j) => console.log(`reset: ok (epoch ${j.epoch})`), (e) => { console.error(e.message); process.exit(1); });
}
