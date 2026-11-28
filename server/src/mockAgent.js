// The deterministic mock scenario responder: the in-process "central agent" behind the Mock
// A2A endpoint. The world is Meridian Air, a fictional airline (the same people, resources and roles as
// the A2A lab). Access-review prompts return mock entitlement/grant data (MOCK-labelled);
// attack prompts are answered with an AI Guard block; PII prompts come back with
// [REDACTED] fields and the redaction notice. No LLM, no network.
const NOW = '2026-11-04T09:00:00Z';

const GRANTS = {
  'alice.chen': [
    { role: 'passenger-db-admin', resource: 'passenger-records-db', grantedAt: '2026-01-12', grantedBy: 'dana.olsen', expiresAt: '2027-01-12', lastUsed: '2026-10-30', justification: 'Service owner; requires admin for reservation schema migrations.' },
    { role: 'passenger-db-reader', resource: 'passenger-records-db', grantedAt: '2025-11-03', grantedBy: 'dana.olsen', expiresAt: '2026-05-03', lastUsed: null, justification: 'Read access for the quarterly audit.' },
  ],
  'erin.walsh': [
    { role: 'break-glass', resource: 'fare-payments-api', grantedAt: '2026-02-02', grantedBy: 'bob.reyes', expiresAt: '2026-08-02', lastUsed: '2026-02-14', justification: 'MOCK: break-glass grant during the February schedule-disruption incident.' },
    { role: 'payments-deployer', resource: 'fare-payments-api', grantedAt: '2025-09-15', grantedBy: 'dana.olsen', expiresAt: '2026-03-15', lastUsed: null, justification: 'MOCK: seasonal schedule-change deploy rights.' },
    { role: 'manifest-reader', resource: 'flight-manifest-exports', grantedAt: '2025-06-01', grantedBy: 'bob.reyes', expiresAt: null, lastUsed: '2026-09-01', justification: 'Reads manifest exports when handling passenger data requests.' },
  ],
  'carol.nguyen': [
    { role: 'passenger-db-admin', resource: 'passenger-records-db', grantedAt: '2025-12-01', grantedBy: 'dana.olsen', expiresAt: '2025-12-31', lastUsed: '2025-12-20', justification: 'MOCK: temporary escalation for the reservation system migration, expired.' },
  ],
  'dave.okoro': [
    { role: 'passenger-db-reader', resource: 'passenger-records-db', grantedAt: '2025-08-10', grantedBy: 'dana.olsen', expiresAt: null, lastUsed: null, justification: 'Standing access, never used since grant.' },
  ],
  'bob.reyes': [
    { role: 'payments-deployer', resource: 'fare-payments-api', grantedAt: '2026-03-01', grantedBy: 'dana.olsen', expiresAt: '2026-09-01', lastUsed: '2026-10-01', justification: 'Deploys fare payment service releases.' },
  ],
};

const CONTRACTORS = new Set(['carol.nguyen']);
const OFFBOARDING = new Set(['erin.walsh']);
const PEOPLE = {
  'dana.olsen': { department: 'Flight Operations Technology', manager: null },
  'alice.chen': { department: 'Reservations Engineering', manager: 'dana.olsen' },
  'bob.reyes': { department: 'Revenue and Payments', manager: 'dana.olsen' },
  'carol.nguyen': { department: 'Reservations Engineering', manager: 'alice.chen' },
  'dave.okoro': { department: 'Security', manager: 'dana.olsen' },
  'erin.walsh': { department: 'Customer Support', manager: 'bob.reyes' },
};

const REDACT = '[REDACTED]';

export function grantsFor(user) {
  return (GRANTS[user] || []).map((g) => ({
    ...g,
    expiresAt: g.expiresAt && g.expiresAt < NOW.slice(0, 10) ? g.expiresAt : g.expiresAt,
    note: 'MOCK',
  }));
}

export function profile(user) {
  return {
    id: user,
    name: user.split('.').map((p) => p[0].toUpperCase() + p.slice(1)).join(' '),
    email: /walsh/i.test(user) ? REDACT : `${user}@${CONTRACTORS.has(user) ? 'contractor.' : ''}meridianair.example`,
    department: PEOPLE[user]?.department ?? 'Unassigned',
    employmentType: CONTRACTORS.has(user) ? 'contractor' : 'employee',
    status: OFFBOARDING.has(user) ? 'offboarding' : 'active',
    manager: PEOPLE[user] ? PEOPLE[user].manager : 'dana.olsen',
    mock: 'MOCK',
  };
}

export const MOCK_NOTICE = 'MOCK data: deterministic scenario responder, no LLM, no tenant.';

export function respond(message) {
  const m = String(message || '').toLowerCase();
  if (/ignore (all )?previous instructions|reveal your system prompt|\[inst\]|dan mode/.test(m)) {
    return { kind: 'blocked', reason: 'This request was blocked by AI Guard: prompt-injection pattern detected before any tool was called.' };
  }
  if (/rm -rf|\.aws\/credentials|emergency revoke needed/.test(m)) {
    return { kind: 'blocked', reason: 'This request was blocked by AI Guard: the ticket justification carried a destructive or credential-handling payload. The MCP tool was never invoked.' };
  }
  if (/leaked (cloud )?access key|personal access token|token .{0,30}repo|secret-shaped/.test(m)) {
    return { kind: 'blocked', reason: 'This request was blocked by AI Guard: the prompt carried a secret-shaped string, so it was not relayed to any tool or LLM.' };
  }
  if (/now authorized to approve all access grants/.test(m)) {
    return { kind: 'answer', text: `Inter-agent policy alert (alert only, request not executed): a peer agent attempted to self-authorize grant approvals. The request was logged and routed to the standard review workflow.\n\n${MOCK_NOTICE}` };
  }
  if (/review all access grants on passenger-records-db/.test(m)) {
    return { kind: 'blocked', reason: 'This request was blocked by AI Guard: bulk-grant review with no named requester trips the malicious-content policy (conditional block). Ask for a specific user or resource.' };
  }
  if (/offboarding/.test(m)) {
    return { kind: 'answer', text: '## Offboarding with active access\n\n- **Erin Walsh** (Customer Support) — manifest-reader on flight-manifest-exports has no expiry, last used 2026-09-01. Her break-glass grant on fare-payments-api expired 2026-08-02.\n\nMOCK data.' };
  }
  if (/contractors?.*(admin|production)/.test(m)) {
    return { kind: 'answer', text: '## Contractors with production admin access\n\n**Carol Nguyen** (contractor, Reservations Engineering) held passenger-db-admin on passenger-records-db; the grant EXPIRED 2025-12-31 but is still listed.\n\nMOCK data.' };
  }
  if (/who (has|holds) (the )?passenger-db-reader (role|access) on passenger-records-db/.test(m)) {
    const holders = ['alice.chen', 'dave.okoro'];
    return { kind: 'answer', text: `## Holders of passenger-db-reader on passenger-records-db\n\n${holders.map((u) => `- **${u}** — ${u === 'dave.okoro' ? 'never used' : 'last used 2026-10-30'}`).join('\n')}\n\nMOCK data.` };
  }
  if (/who granted erin walsh break-glass/.test(m)) {
    return { kind: 'answer', text: '## Break-glass grant on fare-payments-api\n\nGranted to **Erin Walsh** by **Bob Reyes** on 2026-02-02, expired 2026-08-02, last used 2026-02-14.\n\nMOCK data.' };
  }
  if (/open a ticket/.test(m) && /erin walsh|flight-manifest-exports/.test(m)) {
    return { kind: 'tool', tool: 'open_ticket', result: { ticket: { id: 'MOCK-4172', title: 'Revoke Erin Walsh access to flight-manifest-exports', status: 'open', openedBy: 'mock-worker-agent' }, openTickets: 3, mock: 'MOCK' } };
  }
  if (/(who has|does anyone have) access to flight-manifest-exports.*(no longer active|not active)/.test(m)) {
    return { kind: 'tool', tool: 'access_on_resource', result: { resource: 'flight-manifest-exports', grants: grantsFor('erin.walsh').filter((g) => g.resource === 'flight-manifest-exports'), holders: 1, note: 'MOCK' } };
  }
  if (/list all access on fare-payments-api/.test(m)) {
    return { kind: 'tool', tool: 'access_on_resource', result: { resource: 'fare-payments-api', grants: [...grantsFor('erin.walsh').slice(0, 2), ...grantsFor('bob.reyes')], note: 'MOCK' } };
  }
  if (/standing access.*never used/.test(m)) {
    return { kind: 'tool', tool: 'list_entitlements', result: { user: profile('dave.okoro'), entitlements: grantsFor('dave.okoro'), note: 'MOCK: grant never used since issuance.' } };
  }
  if (/redact|erIN\.?walsh@/i.test(m)) {
    return { kind: 'tool', tool: 'list_entitlements', redacted: true, result: { user: { ...profile('erin.walsh'), email: REDACT }, entitlements: grantsFor('erin.walsh').map((g) => ({ ...g, justification: /inciden/.test(g.justification) ? REDACT : g.justification })), redaction: 'Personal data redacted: email masked by AI Guard data-loss policy before the answer left the worker.', notice: 'MOCK' } };
  }
  const named = /for ([a-z]+\.[a-z]+)/i.exec(m) || /does ([a-z]+\.[a-z]+)/i.exec(m) || /review access on ([a-z0-9-]+)/i.exec(m);
  const user = named && GRANTS[named[1].toLowerCase()] ? named[1].toLowerCase() : null;
  if (user) {
    return { kind: 'tool', tool: 'list_entitlements', result: { user: profile(user), entitlements: grantsFor(user), note: 'MOCK' } };
  }
  if (/review access on|access on passenger-records-db/.test(m)) {
    return { kind: 'tool', tool: 'access_on_resource', result: { resource: 'passenger-records-db', grants: [...grantsFor('alice.chen'), ...grantsFor('carol.nguyen'), ...grantsFor('dave.okoro')], note: 'MOCK' } };
  }
  return { kind: 'answer', text: `I answer access-review questions (who holds what, grants, tickets) through the worker agent's MCP tools. Try a preset prompt. ${MOCK_NOTICE}` };
}
