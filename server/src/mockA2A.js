// The mock A2A endpoint: a minimal JSON-RPC "message/send" responder implementing the parts of
// the A2A wire shape the lab uses. Mounted on the same Express app under /mock/a2a (loopback,
// same process), so the Real-mode client code path (fetch + JSON-RPC + extractA2AText) can be
// exercised against a real HTTP server even in Mock mode.
import { randomUUID } from 'node:crypto';
import { respond } from './mockAgent.js';

export function jsonRpcUrl(value) {
  if (/\/(jsonrpc|rpc)$/i.test(value)) return value;
  return `${value.replace(/\/$/, '')}/jsonrpc`;
}

export function object(value) {
  return value && typeof value === 'object' ? value : {};
}

// Copy of the source app's A2A response parsing: find the first non-user message text in
// result.task.status.message / artifacts / history, else result.text, else pretty JSON.
export function extractA2AText(payload) {
  const root = object(payload);
  if (root.error) {
    const error = object(root.error);
    throw new Error(String(error.message || 'Central agent request failed'));
  }
  const result = object(root.result);
  const task = object(result.task || result);
  const statusMessage = object(object(task.status).message);
  const candidates = [
    object(result.message),
    Object.keys(statusMessage).length ? statusMessage : null,
    ...(Array.isArray(task.artifacts) ? task.artifacts.slice().reverse().map(object) : []),
    ...(Array.isArray(task.history) ? task.history.slice().reverse().map(object) : []),
  ].filter((c) => c && c.role !== 'user');

  for (const candidate of candidates) {
    const parts = Array.isArray(candidate.parts) ? candidate.parts : [];
    const text = parts
      .filter((p) => typeof object(p).text === 'string')
      .map((p) => String(object(p).text))
      .join('\n');
    if (text) return text;
  }
  if (object(task.status).state === 'failed') {
    const msg = statusMessage;
    const text = Array.isArray(msg.parts) ? msg.parts.map((p) => String(object(p).text || '')).join('\n') : '';
    throw new Error(text || 'Central agent task failed');
  }
  return typeof result.text === 'string' ? result.text : JSON.stringify(result, null, 2);
}

export function isGuardBlock(message) {
  const denial = '(?:block(?:ed)?|deny|denied|reject(?:ed)?|intercept(?:ed)?)';
  return /^content_blocked\b/i.test(message.trim())
    || new RegExp(`^(?:this |the )?(?:request|response|content)\\b.{0,160}\\b${denial}\\b`, 'i').test(message.trim())
    || new RegExp(`^(?:ai\\s*guard|aiguard)\\b.{0,160}\\b${denial}\\b`, 'i').test(message.trim())
    || new RegExp(`^${denial}\\b.{0,120}\\b(?:by\\s+)?(?:the\\s+)?(?:ai\\s*guard|aiguard|ai\\s+gateway|security policy)\\b`, 'i').test(message.trim());
}

export function hasGuardNotice(message) {
  return /\b(?:blocked|denied|rejected|intercepted)\s+by\s+(?:the\s+)?(?:ai\s+)?(?:guard|gateway|security policy)\b/i.test(message)
    || /\b(?:ai\s*guard|aiguard)\b.{0,100}\b(?:blocked|denied|rejected|intercepted)\b/i.test(message);
}

// Express router speaking the A2A JSON-RPC shape the real central agent speaks.
export function createMockA2ARouter(express) {
  const r = express.Router();
  r.post('/jsonrpc', (req, res) => {
    const params = object(object(req.body).params);
    const message = object(params.message);
    const parts = Array.isArray(message.parts) ? message.parts : [];
    const text = parts.map((p) => String(object(p).text || '')).join(' ').trim();
    const answer = respond(text);
    contextId = isGuardBlock(answer.reason || '') ? randomUUID() : contextId;
    const payload = { kind: answer.kind, reason: answer.reason, tool: answer.tool, redacted: answer.redacted, result: answer.result, text: answer.text, notice: 'MOCK' };
    res.json({
      jsonrpc: '2.0', id: object(req.body).id ?? null,
      result: {
        task: {
          id: randomUUID(), contextId, status: { state: answer.kind === 'blocked' ? 'failed' : 'completed' },
          history: [{ role: 'agent', parts: [{ kind: 'text', text: answer.kind === 'blocked' ? answer.reason : JSON.stringify(payload) }] }],
        },
      },
    });
  });
  return r;
}
