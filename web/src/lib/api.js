// Same origin only: every URL is a path.
export async function getJson(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
export async function postJson(path, body = {}) {
  const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.message || `HTTP ${r.status}`);
  return data;
}
export const getInfo = () => getJson("/api/info");
export const getCatalog = () => getJson("/api/catalog");
export const getMcpDefaults = () => getJson("/api/mcp/defaults");
// Rule 19: switch the runtime mode. Real unconfigured -> 409 with the server's how-to message.
export const requestModeSwitch = (source) => postJson("/api/mode", { source });
export const resetServer = () => postJson("/api/reset");

// POST /api/chat and read the SSE event stream. onEvent(name, payload) per frame.
export async function chatStream(message, onEvent, signal) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message }),
    signal,
  });
  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Request failed (${res.status})`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary;
    while ((boundary = buffer.indexOf("\n\n")) >= 0) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const name = frame.match(/^event: (.+)$/m)?.[1];
      const data = frame.match(/^data: (.+)$/m)?.[1];
      if (name && data) onEvent(name, JSON.parse(data));
    }
  }
}

export const mcpConnect = (url, authHeader = "") => postJson("/api/mcp/connect", { url, authHeader });
export const mcpStatus = () => getJson("/api/mcp/status");
export const mcpDisconnect = () => postJson("/api/mcp/disconnect");
export const mcpCall = (name, args) => postJson("/api/mcp/tools/call", { name, arguments: args });
