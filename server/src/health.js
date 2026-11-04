// GET /api/health, contract demo-health/1 (demo-shelf docs/health-contract.md). Public, GET only, no extra fields.
import fs from 'node:fs';
import express from 'express';
import { allPassed, runChecks as defaultChecks } from './doctor.js';

const { version } = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const DEMO = { id: 'gateway-suite-LAB', name: 'AI Gateway Suite LAB', version };

export function createHealth({ runChecks = defaultChecks, now = () => new Date(), intervalMs = 60_000 } = {}) {
  let last = { state: 'unknown', at: null };
  async function refresh() {
    try { last = { state: allPassed(await runChecks()) ? 'ready' : 'broken', at: now().toISOString() }; }
    catch { last = { state: 'unknown', at: now().toISOString() }; }
  }
  const ready = refresh();
  const timer = setInterval(refresh, intervalMs);
  timer.unref();

  const router = express.Router();
  router.get('/', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ schema: 'demo-health/1', at: last.at || now().toISOString(), state: last.state, runtime: 'offline', demo: DEMO });
  });
  router.all('/', (_req, res) => res.set('Allow', 'GET').status(405).json({ error: 'method_not_allowed' }));
  return { router, refresh, ready, stop: () => clearInterval(timer) };
}
