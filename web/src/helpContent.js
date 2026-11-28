// What the Help dialog says. Plain, and as hedged as the rest of the lab (rule 2): what was measured, what is simulated, what is UNVERIFIED.
export const HELP_SECTIONS = [
  {
    heading: "What this lab is",
    body: [
      "An agent-access demo, relayed end to end: you pick a preset prompt and watch it travel Main Agent → AI Gateway (A2A) → Worker Agent → AI Gateway (MCP) → MCP tool → LLM on a movable diagram, with an SSE trace (one W3C traceparent per hop) and the rendered answer.",
      "A second tab, Personal Agent, connects to a remote MCP server, lists its tools, renders parameter forms from inputSchema and calls them."
    ]
  },
  {
    heading: "What was measured, and what was not",
    body: [
      "Mock mode (the default when Real is not configured) is entirely in-process: the central agent is a deterministic scenario responder, AI Guard blocks are scripted, the mock MCP server is a real MCP server on loopback started inside the server process, and the LLM answer is template text. Mock-issued values are labelled MOCK.",
      "Real mode relays A2A message/send to a central agent configured by the owner (CENTRAL_AGENT_A2A_URL); the bearer key is write-only and never echoed. Whether the configured central agent's guard behaviour matches a production gateway is UNVERIFIED — it depends on the tenant configuration, not this lab.",
      "Attack prompts are stopped by AI Guard at the gateway and PII prompts come back with [REDACTED] fields; those rules are this lab's scripted safety layer, not a measured product reading."
    ]
  },
  {
    heading: "How to use the page",
    body: [
      "Tabs: End to End, Personal Agent, Talk track.",
      "On End to End, pick a category in Prompt category (Access review, Prompt injection · blocked, Jailbreak · blocked, Data exfiltration · sanitized, Personal data · sanitized, Tool misuse · blocked by MCP, Malicious content · conditional, Inter-agent abuse · alert only), click a preset prompt button, then Send. Drag the diagram boxes; Reset layout restores them.",
      "On Personal Agent, type an MCP URL and press Connect, pick a tool, then Run tool (Disconnect leaves the server). In Real mode an OAuth-pending dialog may open the authorization page.",
      "The header has the Mock/Real mode select, theme, Present, Talk track, Help, and Reset. Reset clears server state (catalog, sessions, issued mock values)."
    ]
  },
  {
    heading: "Mock and Real",
    body: [
      "A visible Mock / Real toggle sits in the header; switching needs no restart and reloads all data. Default is Real if configured, else Mock.",
      "Real not configured: the Real choice is disabled with a how-to tooltip and POST /api/mode answers 409. In Real mode chat is relayed to the configured central agent; in Mock mode every agent, gateway, tool and answer is simulated in-process.",
      "Real mode reaches only the hosts in the owner's configuration (netguard); nothing else leaves this machine in either mode."
    ]
  }
];
