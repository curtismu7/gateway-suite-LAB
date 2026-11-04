// Bootstrap: doctor preflight, mock MCP server (loopback, random port), then listen.
import { installNetguard, netguardAttempts } from './netguard.js';

export async function startServer({
  createApp, runChecks, allPassed, assertBindAllowed, bindHost, resolvePort,
  startMockMcpServer, realEndpoints, realHosts = [], onListen,
}) {
  const checks = await runChecks();
  if (!allPassed(checks)) {
    for (const c of checks.filter((x) => x.level === 'fail')) console.error(`[gateway-suite-LAB] refusing to start: ${c.id}: ${c.detail}`);
    process.exit(1);
  }
  const host = assertBindAllowed(bindHost(), process.env);
  const port = resolvePort();
  const mock = await startMockMcpServer();
  const app = createApp();
  app.locals.mockMcpUrl = mock.url;
  const server = app.listen(port, host, () => {
    onListen?.(host, port, mock.url);
  });
  server.on('close', () => { try { mock.server.close(); } catch { /* already down */ } });
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { try { mock.server.close(); } catch { /* already down */ } server.close(() => process.exit(0)); });
  return { server, mockMcp: mock };
}
