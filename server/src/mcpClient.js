// The Personal Agent's MCP client: a real MCP client (Streamable HTTP first, SSE fallback)
// plus the OAuth-pending flow used in Real mode only. In Mock mode the URL is the in-process
// mock MCP server on loopback and no OAuth is offered.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

export function validHttpUrl(value, field = 'MCP server URL') {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required`);
  const url = new URL(value.trim());
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`${field} must use http or https`);
  return url.toString().replace(/\/$/, '');
}

export function parseAuthHeader(value) {
  if (!value || !value.trim()) return {};
  const colon = value.indexOf(':');
  if (colon < 0) return { Authorization: `Bearer ${value.trim()}` };
  const key = value.slice(0, colon).trim();
  const headerValue = value.slice(colon + 1).trim();
  return key && headerValue ? { [key]: headerValue } : {};
}

function isTransportError(error) {
  const message = error instanceof Error ? `${error.message} ${String(error.cause || '')}` : String(error);
  return /405|404|not found|method not allowed|socket hang up|ECONNRESET|ECONNREFUSED|other side closed/i.test(message);
}

// A minimal OAuth client provider that parks the authorization URL on the session; the browser
// dialog sends the user to it and /oauth/callback finishes the code exchange. Real mode only.
function sessionAuthProvider(session, redirectUrl, authModule) {
  return {
    get redirectUrl() { return redirectUrl; },
    get clientMetadata() {
      return {
        redirect_uris: [redirectUrl],
        client_name: 'AI Gateway Suite LAB',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
      };
    },
    clientInformation() { return session.oauth.clientInfo; },
    saveClientInformation(info) { session.oauth.clientInfo = info; },
    tokens() { return session.oauth.tokens; },
    saveTokens(tokens) { session.oauth.tokens = tokens; },
    saveCodeVerifier(v) { session.oauth.codeVerifier = v; },
    codeVerifier() {
      if (!session.oauth.codeVerifier) throw new Error('OAuth verifier is unavailable');
      return session.oauth.codeVerifier;
    },
    invalidateCredentials(scope) {
      if (scope === 'all' || scope === 'client') delete session.oauth.clientInfo;
      if (scope === 'all' || scope === 'tokens') delete session.oauth.tokens;
      if (scope === 'all' || scope === 'verifier') delete session.oauth.codeVerifier;
    },
    redirectToAuthorization(url) { session.pendingAuthUrl = url.toString(); },
    ...(authModule ? {} : {}),
  };
}

export async function connectMcp({ url, authHeader, session, baseUrl, authModule }) {
  const headers = parseAuthHeader(authHeader);
  const redirectUrl = new URL('/oauth/callback', baseUrl).toString();
  const authProvider = authHeader && authHeader.trim() ? undefined : sessionAuthProvider(session, redirectUrl, authModule);
  const connect = async (Transport) => {
    const transport = new Transport(new URL(url), { authProvider, requestInit: { headers } });
    session.pendingFinishAuth = (code) => transport.finishAuth(code);
    const client = new Client({ name: 'gateway-suite-lab', version: '1.0.0' }, { capabilities: {} });
    await client.connect(transport);
    return { client, transport };
  };
  try {
    try {
      session.connection = await connect(StreamableHTTPClientTransport);
    } catch (error) {
      if (session.pendingAuthUrl || !isTransportError(error)) throw error;
      session.connection = await connect(SSEClientTransport);
    }
    session.tools = (await session.connection.client.listTools()).tools;
    session.mcpUrl = url;
    session.pendingAuthUrl = undefined;
  } catch (error) {
    if (session.pendingAuthUrl) throw new Error('OAUTH_REDIRECT');
    throw error;
  }
}

export async function disconnectMcp(session) {
  try { await session.connection?.transport?.close(); } catch { /* already closed */ }
  session.connection = undefined;
  session.tools = [];
  session.mcpUrl = undefined;
  session.pendingAuthUrl = undefined;
  session.pendingFinishAuth = undefined;
  session.oauth = {};
}

export function mcpStatus(session) {
  return {
    connected: Boolean(session.connection),
    url: session.mcpUrl || '',
    tools: session.tools || [],
    pendingOAuth: session.pendingAuthUrl,
  };
}

export async function callTool(session, name, args) {
  if (!session.connection) { const e = new Error('Connect to an MCP server first'); e.status = 409; throw e; }
  return session.connection.client.callTool({ name, arguments: args });
}
