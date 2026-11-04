// Mock / Real. Rule 19: runtime server-side mode, POST /api/mode with exactly {source}, GET /api/info
// returns {source, realAvailable, realReason}. Default: Real if configured, else Mock. A switch needs
// no restart. Real = the configured central A2A agent (CENTRAL_AGENT_A2A_URL / WORKER_A2A_URL in the
// shared settings file ~/Development/.env). Mock = the deterministic in-process agent, fully offline.
import { loadSharedEnv, realEndpoints } from './env.js';

export const NO_REAL = 'Real mode is not configured. Set CENTRAL_AGENT_A2A_URL (and optionally CENTRAL_AGENT_A2A_BEARER) in ~/Development/.env, restart the lab, and the Real button lights up. Until then the in-process mock agent answers in Mock mode.';

export const MODES = ['mock', 'real'];

export function realConfigured(env = process.env) {
  return realEndpoints({ ...env, ...loadSharedEnv() }).configured;
}

export function createMode({ env = process.env } = {}) {
  const canReal = realConfigured(env);
  const state = { source: canReal ? 'real' : 'mock' };
  return {
    info: () => ({ source: state.source, realAvailable: canReal, realReason: canReal ? null : NO_REAL }),
    source: () => state.source,
    set: (source) => { state.source = source; },
  };
}
