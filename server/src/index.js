// Start the lab: netguard first, doctor preflight, then listen on the loopback (or GWS_BIND).
import { installNetguard } from './netguard.js';
import { createApp } from './app.js';
import { allPassed, runChecks } from './doctor.js';
import { assertBindAllowed, bindHost, resolvePort } from './safety.js';
import { startMockMcpServer } from './mockMcpServer.js';
import { loadSharedEnv, realEndpoints } from './env.js';

// In Real mode the configured central agent host (and trace host, if set) are the only extra
// outbound hosts the netguard allows; in Mock mode the allowlist is empty (loopback only).
// loadSharedEnv is merged in because the container gets the settings via compose env_file.
installNetguard(realEndpoints({ ...process.env, ...loadSharedEnv() }).hostnames);

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
