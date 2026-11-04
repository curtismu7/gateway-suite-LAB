// Start the lab: netguard first, doctor preflight, then listen on the loopback (or GWS_BIND).
import { installNetguard } from './netguard.js';
import { createApp } from './app.js';
import { allPassed, runChecks } from './doctor.js';
import { assertBindAllowed, bindHost, resolvePort } from './safety.js';
import { startMockMcpServer } from './mockMcpServer.js';
import { realEndpoints } from './env.js';

installNetguard(); // before anything else can open a socket

// In Mock mode the netguard allowlist is empty: loopback only. In Real mode the configured
// central agent host (and trace host, if set) are the only extra outbound hosts allowed.
const { startServer } = await import('./bootstrap.js');
await startServer({
  createApp, runChecks, allPassed, assertBindAllowed, bindHost, resolvePort,
  startMockMcpServer, realEndpoints, realHosts: realEndpoints().hostnames,
  onListen: (host, port, mockMcpUrl) => {
    console.log(`[gateway-suite-LAB] AI Gateway Suite LAB at http://${host}:${port} (${process.env.GWS_BIND ? 'GWS_BIND opt-in' : 'loopback'} bind)`);
    console.log('[gateway-suite-LAB] health: /api/health | info: /api/info | chat: POST /api/chat (SSE) | MCP: POST /api/mcp/connect');
  },
});
