// Runtime netguard: loopback only, plus an allowlist of Real-mode endpoint hosts.
// In Mock mode the allowlist is empty, so every non-loopback attempt is refused and recorded.
// In Real mode the app legitimately calls the configured central agent host (and, if set, the
// worker trace SSE host): those are the ONLY extra hosts allowed. The mock MCP server is a
// loopback HTTP server, so it needs no exception.
import dns from 'node:dns';
import net from 'node:net';
import dgram from 'node:dgram';
import { isLoopbackHost } from './safety.js';

let active = null;

export function allowedOutboundHosts(list = []) {
  return new Set((list || []).filter(Boolean).map((h) => String(h).toLowerCase()));
}

// (Re)install the guard with the given extra host allowlist. Installing over an existing guard
// with the same allowlist is a no-op; with a different one it rewrites the fetch guard only.
export function installNetguard(allow = []) {
  const allowSet = allowedOutboundHosts(allow);
  if (active) { active.allow = allowSet; return active; }
  const attempts = [];
  const real = {
    connect: net.Socket.prototype.connect, lookup: dns.lookup, fetch: globalThis.fetch, send: dgram.Socket.prototype.send, udpConnect: dgram.Socket.prototype.connect,
    plookup: dns.promises.lookup,
  };
  const RESOLVERS = ['resolve', 'resolve4', 'resolve6', 'resolveAny', 'resolveCaa', 'resolveCname', 'resolveMx', 'resolveNaptr', 'resolveNs', 'resolvePtr', 'resolveSoa', 'resolveSrv', 'resolveTxt', 'reverse'];
  const savedResolvers = [];
  const blockedResolver = (name, target) => function guardedResolve(host, ...rest) {
    const h = String(host);
    if (isLoopbackHost(h)) return target.apply(this, [host, ...rest]);
    attempts.push(`dns:${h}`);
    const err = new Error(`network blocked: ${h}`);
    const cb = rest.find((r) => typeof r === 'function');
    if (cb) return cb(err);
    return Promise.reject(err);
  };
  for (const holder of [dns, dns.promises, dns.Resolver.prototype, dns.promises.Resolver.prototype]) {
    for (const name of RESOLVERS) {
      if (typeof holder[name] !== 'function') continue;
      const orig = holder[name];
      savedResolvers.push([holder, name, orig]);
      holder[name] = blockedResolver(name, orig);
    }
  }
  const hostOf = (rawArgs) => {
    const args = Array.isArray(rawArgs[0]) ? rawArgs[0] : rawArgs;
    const a = args[0];
    if (a && typeof a === 'object' && !Array.isArray(a)) return a.path ? 'unix-socket' : (a.host || 'localhost');
    if (typeof a === 'string' && Number.isNaN(Number(a))) return 'unix-socket';
    return typeof args[1] === 'string' ? args[1] : 'localhost';
  };
  const outboundOk = (host) => isLoopbackHost(host) || allowSet.has(String(host).toLowerCase());
  net.Socket.prototype.connect = function guardedConnect(...args) {
    const host = hostOf(args);
    if (!outboundOk(host)) { attempts.push(`socket:${host}`); throw new Error(`network blocked: ${host}`); }
    return real.connect.apply(this, args);
  };
  dns.lookup = function guardedLookup(host, ...rest) {
    if (!outboundOk(host) && host !== '0.0.0.0' && host !== '::') {
      attempts.push(`dns:${host}`);
      const cb = rest.find((r) => typeof r === 'function');
      return cb?.(new Error(`network blocked: ${host}`));
    }
    return real.lookup.call(dns, host, ...rest);
  };
  dns.promises.lookup = async function guardedPromiseLookup(host, ...rest) {
    if (!outboundOk(host) && host !== '0.0.0.0' && host !== '::') { attempts.push(`dns:${host}`); throw new Error(`network blocked: ${host}`); }
    return real.plookup.call(dns.promises, host, ...rest);
  };
  globalThis.fetch = async function guardedFetch(input, init) {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    if (!outboundOk(url.hostname)) { attempts.push(`fetch:${url.hostname}`); throw new Error(`network blocked: ${url.hostname}`); }
    return real.fetch(input, init);
  };
  dgram.Socket.prototype.send = function guardedSend(...args) {
    const rest = args.slice(1);
    const addr = typeof rest[1] === 'number' ? rest[3] : rest[1];
    const ok = addr === undefined || typeof addr === 'function' || (typeof addr === 'string' && outboundOk(addr));
    if (!ok) { attempts.push(`udp:${addr}`); throw new Error(`network blocked: ${addr}`); }
    return real.send.apply(this, args);
  };
  dgram.Socket.prototype.connect = function guardedUdpConnect(port, address, cb) {
    const addr = typeof address === 'function' ? undefined : address;
    const ok = addr === undefined || (typeof addr === 'string' && outboundOk(addr));
    if (!ok) { attempts.push(`udp-connect:${addr}`); throw new Error(`network blocked: ${addr}`); }
    return real.udpConnect.call(this, port, address, cb);
  };
  active = { allow: allowSet, attempts };
  return active;
}

export function netguardAttempts() { return active ? active.attempts : []; }

// Proves the guard works by trying to leave and checking every attempt is refused and recorded.
// Self-test attempts are never counted as real attempts.
export async function netguardSelfTest() {
  const guard = installNetguard();
  const before = guard.attempts.length;
  const tried = [];
  const refused = async (label, fn) => { try { await fn(); tried.push(`${label}: NOT blocked`); } catch (e) { tried.push(/network blocked/.test(e.message) ? `${label}: blocked` : `${label}: failed differently (${e.message})`); } };
  await refused('fetch', () => fetch('http://self-test.invalid/', { signal: AbortSignal.timeout(2000) }));
  await refused('socket', () => new Promise((_, rej) => { const s = new net.Socket(); s.on('error', rej); try { s.connect(80, 'self-test.invalid'); } catch (e) { rej(e); } }));
  await refused('socket-ip', () => new Promise((_, rej) => { try { const s = net.connect({ host: ['192', '0', '2', '1'].join('.'), port: 80 }); s.on('error', rej); } catch (e) { rej(e); } }));
  await refused('dns', () => new Promise((res, rej) => dns.lookup('self-test.invalid', (e) => (e ? rej(e) : res()))));
  await refused('dns-resolve', () => dns.promises.resolve4('self-test.invalid'));
  await refused('udp', () => { const s = dgram.createSocket('udp4'); try { s.send('x', 9, 'self-test.invalid'); } finally { s.close(); } });
  await refused('udp-connect', () => { const s = dgram.createSocket('udp4'); try { s.connect(9, 'self-test.invalid'); } finally { s.close(); } });
  await refused('fetch-allowlisted-but-unconfigured', () => fetch('http://self-test-allowlist.invalid/', { signal: AbortSignal.timeout(2000) }));
  const blocked = guard.attempts.length - before;
  guard.attempts.length = before;
  return { ok: tried.every((t) => t.endsWith(': blocked')) && blocked === 8, blocked, detail: tried.join('; ') };
}
