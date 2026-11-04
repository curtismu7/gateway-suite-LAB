// The one shared settings file, ~/Development/.env (or STANDALONE_ENV). Read-only: only whether
// the Real-mode variables exist is ever reported; values are never returned, never logged.
import fs from 'node:fs';

const CANDIDATES = () => {
  const list = [];
  if (process.env.STANDALONE_ENV) {
    // STANDALONE_ENV is strict: tests (and any caller) use it to isolate from the author's
    // machine, so a miss must NOT fall through to the default location.
    list.push(process.env.STANDALONE_ENV);
    return list;
  }
  list.push(`${process.env.HOME}/Development/.env`);
  return list;
};

export function loadSharedEnv() {
  for (const f of CANDIDATES()) {
    try {
      const text = fs.readFileSync(f, 'utf8');
      const out = {};
      for (const line of text.split('\n')) {
        const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
        if (m && !(m[1] in out)) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
      return out;
    } catch { /* next candidate */ }
  }
  return {};
}

export function realEndpoints(env = process.env) {
  const e = { ...env, ...loadSharedEnv() };
  const agentUrl = e.CENTRAL_AGENT_A2A_URL || e.WORKER_A2A_URL || '';
  const agentBearer = e.CENTRAL_AGENT_A2A_BEARER || '';
  const traceUrl = e.WORKER_TRACE_URL || '';
  const hostOf = (u) => { try { return new URL(u).hostname; } catch { return ''; } };
  return {
    agentUrl, agentBearer, traceUrl,
    hostnames: [...new Set([hostOf(agentUrl), hostOf(traceUrl)].filter(Boolean))],
    configured: Boolean(agentUrl),
  };
}
