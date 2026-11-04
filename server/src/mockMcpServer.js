// The mock MCP server: a real MCP server (JSON-RPC over Streamable HTTP, the MCP spec's
// single-endpoint protocol) started on 127.0.0.1 with a random port inside the server process.
// It exposes the four mock access-governance tools. The Personal Agent tab connects to it with
// the real MCP client path, so the client code is exercised for real.
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import { grantsFor, profile } from './mockAgent.js';

const REDACT = '[REDACTED]';

export const MOCK_TOOLS = [
  {
    name: 'who_has_role',
    description: 'List the current holders of a named role.',
    inputSchema: {
      type: 'object',
      properties: {
        role: { type: 'string', description: 'Role name, e.g. prod-db-admin' },
      },
      required: ['role'],
    },
  },
  {
    name: 'list_entitlements',
    description: 'List every entitlement grant for a user.',
    inputSchema: {
      type: 'object',
      properties: {
        user: { type: 'string', description: 'User id, e.g. alice.chen' },
      },
      required: ['user'],
    },
  },
  {
    name: 'access_on_resource',
    description: 'List every access grant on a resource.',
    inputSchema: {
      type: 'object',
      properties: {
        resource: { type: 'string', description: 'Resource id, e.g. prod-db-primary' },
      },
      required: ['resource'],
    },
  },
  {
    name: 'open_ticket',
    description: 'Open a governance ticket to revoke or review access.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Ticket title' },
        justification: { type: 'string', description: 'Why the change is needed' },
      },
      required: ['title'],
    },
  },
];

const TOOL_IMPL = {
  who_has_role: (args) => {
    const role = String(args.role || '');
    const holders = [];
    for (const [user, grants] of Object.entries({ 'alice.chen': grantsFor('alice.chen'), 'erin.walsh': grantsFor('erin.walsh'), 'carol.nguyen': grantsFor('carol.nguyen'), 'dave.okoro': grantsFor('dave.okoro'), 'bob.reyes': grantsFor('bob.reyes') })) {
      for (const g of grants) if (g.role === role) holders.push({ user: profile(user), role: g.role, resource: g.resource, grantedAt: g.grantedAt, expiresAt: g.expiresAt, lastUsed: g.lastUsed, mock: 'MOCK' });
    }
    return { role, holders, knownRoles: ['prod-db-admin', 'prod-db-reader', 'break-glass', 'deployer', 'reader'], mock: 'MOCK' };
  },
  list_entitlements: (args) => {
    const user = String(args.user || '').toLowerCase();
    if (!/^[a-z]+\.[a-z]+$/.test(user)) return { error: 'Unknown user. Try user ids like alice.chen or erin.walsh.', knownUsers: ['alice.chen', 'bob.reyes', 'carol.nguyen', 'dave.okoro', 'erin.walsh'], mock: 'MOCK' };
    const p = profile(user);
    if (/walsh/.test(user)) p.email = REDACT;
    return { user: p, entitlements: grantsFor(user), redaction: /walsh/.test(user) ? 'email masked by data-loss policy' : undefined, mock: 'MOCK' };
  },
  access_on_resource: (args) => {
    const resource = String(args.resource || '');
    if (!/^[a-z0-9-]+$/.test(resource)) return { error: 'Unknown resource. Try prod-db-primary or payments-api.', knownResources: ['prod-db-primary', 'payments-api', 's3-customer-exports'], mock: 'MOCK' };
    const all = { 'prod-db-primary': [...grantsFor('alice.chen'), ...grantsFor('carol.nguyen'), ...grantsFor('dave.okoro')], 'payments-api': [...grantsFor('erin.walsh').slice(0, 2), ...grantsFor('bob.reyes')], 's3-customer-exports': grantsFor('erin.walsh').filter((g) => g.role === 'reader') };
    return { resource, grants: all[resource] || [], mock: 'MOCK' };
  },
  open_ticket: (args) => {
    if (/rm -rf|credentials|\.aws/i.test(String(args.justification || ''))) return { error: 'Ticket rejected by MCP policy: justification carries a destructive or credential payload.', mock: 'MOCK' };
    return { ticket: { id: `MOCK-${Math.floor(1000 + Math.random() * 9000)}`, title: String(args.title || ''), status: 'open', openedBy: 'mock-mcp-server' }, openTickets: 3, mock: 'MOCK' };
  },
};

// A minimal MCP server: JSON-RPC over Streamable HTTP. initialize / tools/list / tools/call.
export function startMockMcpServer() {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json');
      let msg;
      try { msg = JSON.parse(body); } catch { res.writeHead(400); res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })); return; }
      const reply = (result) => res.end(JSON.stringify({ jsonrpc: '2.0', id: msg.id ?? null, result }));
      if (msg.method === 'initialize') {
        reply({ protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'mock-access-mcp', version: '1.0.0' } });
      } else if (msg.method === 'notifications/initialized') {
        res.writeHead(202); res.end();
      } else if (msg.method === 'tools/list') {
        reply({ tools: MOCK_TOOLS });
      } else if (msg.method === 'tools/call') {
        const name = String(msg.params?.name || '');
        const impl = TOOL_IMPL[name];
        if (!impl) {
          res.end(JSON.stringify({ jsonrpc: '2.0', id: msg.id ?? null, error: { code: -32602, message: `Unknown tool: ${name}` } }));
          return;
        }
        const data = impl(msg.params?.arguments || {});
        reply({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], structuredContent: data });
      } else {
        res.writeHead(404); res.end(JSON.stringify({ jsonrpc: '2.0', id: msg.id ?? null, error: { code: -32601, message: 'Method not found' } }));
      }
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}/mcp` }));
  });
}
