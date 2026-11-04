// Safety rules. Pure functions plus two tiny middlewares. No I/O.
//  1. Loopback bind only unless GWS_BIND is set on purpose.
//  2. Host header must be a loopback name (or LAB_ALLOWED_HOSTS).
//  3. A write must be same-origin.
//  4. Every host in shipped text is reserved (.invalid / .example) or loopback — except the
//     Real-mode configured endpoints, allowed only while mode is real.
//  5. Ports are 5750-5759 and never one of the forbidden ones.
//  6. Shipped text carries no key-looking string and no literal JWT.

export function isLoopbackHost(host) {
  const h = String(host).toLowerCase().replace(/^\[|\]$/g, '');
  return h === 'localhost' || h === '::1' || /^127(\.\d{1,3}){3}$/.test(h);
}

export function bindHost(env = process.env) { return env.GWS_BIND || '127.0.0.1'; }

export function assertBindAllowed(host, env = process.env) {
  if (isLoopbackHost(host) || env.GWS_BIND) return host;
  throw new Error(`refusing to bind ${host}: loopback only. Set GWS_BIND to opt in.`);
}

export const PORT_MIN = 5750;
export const PORT_MAX = 5759;
export const DEFAULT_PORT = 5750;
const FORBIDDEN_PORTS = new Set([5000, 8080, 5173, 3900, 4000, 4400, 4510, 4600, 4601, 4840, 18080, 19080, 19090]);
export function portProblem(port) {
  if (!Number.isInteger(port)) return 'PORT is not an integer';
  if (FORBIDDEN_PORTS.has(port)) return `port ${port} is reserved for something else`;
  if (port < PORT_MIN || port > PORT_MAX) return `port ${port} is outside ${PORT_MIN}-${PORT_MAX}`;
  return null;
}
export function resolvePort(env = process.env) {
  const port = env.PORT === undefined || env.PORT === '' ? DEFAULT_PORT : Number(env.PORT);
  const problem = portProblem(port);
  if (problem) throw new Error(problem);
  return port;
}

export function isReservedHost(host) {
  const h = String(host).toLowerCase().replace(/\.$/, '');
  return /(^|\.)(invalid|example)$/.test(h) || /^example\.(com|net|org)$/.test(h);
}

const NETWORK_URL = /\b(?:https?|wss?|ftp|sftp|ssh|smtp|tcp|udp):\/\/([^\s/?#"'<>\\]+)/gi;
const EMAIL = /[A-Za-z0-9._%+-]{1,64}@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)/g;
const IPV4 = /\b\d{1,3}(?:\.\d{1,3}){3}\b/g;
const stripAuthority = (a) => a.replace(/^[^@]*@/, '').replace(/:\d+$/, '');

// Hostnames or IPs in text that are not reserved and not loopback. `allow` lists extra
// hostnames (the Real-mode configured endpoints) that are permitted while Real mode is on.
export function scanHosts(text, allow = []) {
  const allowed = new Set(allow.map((h) => String(h).toLowerCase()));
  const found = new Set();
  const s = String(text);
  for (const m of s.matchAll(NETWORK_URL)) found.add(stripAuthority(m[1]).toLowerCase());
  for (const m of s.matchAll(EMAIL)) found.add(m[1].toLowerCase());
  for (const m of s.matchAll(IPV4)) found.add(m[0]);
  return [...found].filter((h) => !isReservedHost(h) && !isLoopbackHost(h) && !allowed.has(h)).sort();
}

// Any "sk-" secret that is not an obviously fake sk-MOCK- value, and any literal JWT.
export function scanKeys(text) {
  const s = String(text);
  const keys = [...s.matchAll(/\bsk-(?!MOCK-)[A-Za-z0-9_-]{8,}/g)].map((m) => `${m[0].slice(0, 8)}...`);
  const jwts = [...s.matchAll(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/g)].map((m) => `${m[0].slice(0, 8)}...(jwt)`);
  return [...keys, ...jwts];
}

// Free text from a caller: control characters stripped, length capped. Rendered as text, never as markup.
export function cleanText(value, max = 500) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, ' ').trim().slice(0, max);
}

// Extra Host names this lab answers to: LAB_ALLOWED_HOSTS, comma separated, validated host names.
const HOSTNAME = /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;
export function allowedExtraHosts(env = process.env) {
  const extra = String(env.LAB_ALLOWED_HOSTS || '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
  for (const h of extra) if (!HOSTNAME.test(h)) throw new Error(`LAB_ALLOWED_HOSTS: not a host name: ${h}`);
  return new Set(extra);
}

export function hostCheck(req, res, next) {
  const raw = String(req.headers.host || '');
  const host = raw.startsWith('[') ? raw.slice(0, raw.indexOf(']') + 1) : raw.replace(/:\d+$/, '');
  if (!isLoopbackHost(host) && !allowedExtraHosts().has(host.toLowerCase())) {
    return res.status(403).json({ error: 'bad_host', message: 'Host must be loopback or on LAB_ALLOWED_HOSTS' });
  }
  next();
}

const WRITE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
export function sameOriginWrites(req, res, next) {
  if (!WRITE.has(req.method)) return next();
  const site = req.headers['sec-fetch-site'];
  if (site && site !== 'same-origin' && site !== 'none') return res.status(403).json({ error: 'cross_origin', message: 'writes must be same-origin' });
  const origin = req.headers.origin;
  if (origin) {
    let ok = false;
    try { ok = new URL(origin).host === req.headers.host; } catch { /* malformed */ }
    if (!ok) return res.status(403).json({ error: 'cross_origin', message: 'writes must be same-origin' });
  }
  next();
}
