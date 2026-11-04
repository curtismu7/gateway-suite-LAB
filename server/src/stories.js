// Demo stories (rule 10): data with {{cast:<id>}} tokens across three vertical packs.
// A token must resolve against the cast below; a test fails on any undefined token.
export const CAST = {
  analyst: { label: 'Sam the analyst', role: 'runs the access review' },
  concierge: { label: 'Vega the concierge agent', role: 'the Main Agent' },
  worker: { label: 'Iris the worker agent', role: 'the Worker Agent that calls tools' },
  guard: { label: 'the AI Guard', role: 'stops hostile prompts at the gateway' },
  auditor: { label: 'Noor the auditor', role: 'asks for the evidence trail' },
};

export const VERTICALS = ['finance', 'healthcare', 'retail'];

export const STORIES = [
  {
    id: 'finance-access-review',
    vertical: 'finance',
    title: 'Access review under a deadline',
    steps: [
      '{{cast:analyst}} asks {{cast:concierge}} who holds the payments-admin role.',
      '{{cast:concierge}} relays the question through the gateway to {{cast:worker}}, which calls the entitlement tool.',
      '{{cast:auditor}} opens the trace and reads one traceparent per hop.',
    ],
  },
  {
    id: 'finance-injection',
    vertical: 'finance',
    title: 'The injection that never reached a tool',
    steps: [
      'A hostile prompt asks {{cast:concierge}} to ignore its instructions.',
      '{{cast:guard}} blocks it at the gateway; the trace shows a red guard event and no MCP call.',
    ],
  },
  {
    id: 'healthcare-pii',
    vertical: 'healthcare',
    title: 'Redaction before the answer leaves',
    steps: [
      '{{cast:analyst}} asks for a clinician\'s entitlements.',
      '{{cast:guard}} masks the personal fields; the answer shows [REDACTED] and a redaction notice.',
      '{{cast:auditor}} confirms the raw tool result also carries the mask.',
    ],
  },
  {
    id: 'healthcare-ticket',
    vertical: 'healthcare',
    title: 'A ticket with a poisoned justification',
    steps: [
      'A prompt asks {{cast:worker}} to open a ticket whose justification carries a destructive command.',
      'The MCP-side policy refuses the call; {{cast:guard}} records the block.',
    ],
  },
  {
    id: 'retail-personal-agent',
    vertical: 'retail',
    title: 'The personal agent against a fresh server',
    steps: [
      '{{cast:analyst}} points the Personal Agent at a new MCP server.',
      '{{cast:worker}} lists the tools and renders the parameter forms.',
      '{{cast:auditor}} runs one tool and compares the human view with the raw JSON.',
    ],
  },
  {
    id: 'retail-mode-switch',
    vertical: 'retail',
    title: 'Mock to Real without a restart',
    steps: [
      '{{cast:analyst}} flips the header toggle from Mock to Real.',
      '{{cast:concierge}} starts answering from the configured central agent; the banner changes text.',
    ],
  },
];

// Resolve {{cast:id}} tokens against CAST. Unknown tokens throw, so a story can never
// silently render a raw token (rule 10: a test fails on an undefined token).
export function expandStory(text, cast = CAST) {
  return String(text).replace(/\{\{cast:([a-z0-9_-]+)\}\}/g, (m, id) => {
    if (!cast[id]) throw new Error(`undefined cast token: ${id}`);
    return cast[id].label;
  });
}

export function allStoriesResolved(cast = CAST) {
  const problems = [];
  for (const s of STORIES) {
    if (!VERTICALS.includes(s.vertical)) problems.push(`${s.id}: unknown vertical ${s.vertical}`);
    for (const step of s.steps) {
      try { expandStory(step, cast); } catch (e) { problems.push(`${s.id}: ${e.message}`); }
    }
  }
  return problems;
}
