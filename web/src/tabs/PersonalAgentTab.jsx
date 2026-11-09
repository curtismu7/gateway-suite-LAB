import React, { useCallback, useEffect, useState } from "react";
import { mcpCall, mcpConnect, mcpDisconnect, mcpStatus } from "../lib/api.js";
import FloatingDialog from "../floating-dialog/FloatingDialog";

function escapeHtml(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function formatDate(v) {
  if (!v) return "—";
  const d = new Date(String(v));
  return Number.isNaN(d.valueOf()) ? escapeHtml(v) : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// Human renderers, modelled on the source app's renderers (profiles, grant rows with
// Active / Expired / Never-used tags, holders, tickets). Input is data from our own mock
// server or the user's configured MCP server; escaped before it lands in HTML.
export function renderGrantRows(grants = []) {
  return grants.map((g) => {
    const expired = Boolean(g.expiresAt && new Date(g.expiresAt) < new Date());
    const stale = Boolean(g.grantedAt && g.lastUsed === null);
    const tag = expired ? '<span class="tag tag-danger">Expired</span>' : stale ? '<span class="tag tag-warn">Never used</span>' : '<span class="tag tag-ok">Active</span>';
    return `<article class="grant"><div class="grant-head"><strong>${escapeHtml(g.role)}</strong><span>on ${escapeHtml(g.resource)}</span>${tag}</div><div class="muted small">Granted ${formatDate(g.grantedAt)} by ${escapeHtml(g.grantedBy)} · expires ${formatDate(g.expiresAt)} · last used ${formatDate(g.lastUsed)}</div><div class="small">${escapeHtml(g.justification || "")}</div></article>`;
  }).join("");
}

export function humanToolResult(data) {
  if (!data || typeof data !== "object") return null;
  if (data.error) {
    const known = data.knownUsers || data.knownResources || data.knownRoles;
    return `<div class="alert">${escapeHtml(data.error)}</div>${data.requested ? `<p>Requested: <strong>${escapeHtml(data.requested)}</strong></p>` : ""}${Array.isArray(known) ? `<p class="small">Known values: ${known.map(escapeHtml).join(", ")}</p>` : ""}`;
  }
  if (data.user && Array.isArray(data.entitlements)) {
    const u = data.user;
    const type = u.employmentType === "contractor" ? '<span class="tag tag-warn">Contractor</span>' : '<span class="tag tag-ok">Employee</span>';
    return `<div class="kv"><span>User</span><strong>${escapeHtml(u.name || u.id)} ${type}</strong><span>Email</span><strong class="mono">${escapeHtml(u.email)}</strong><span>Department</span><strong>${escapeHtml(u.department)}</strong></div><p class="small"><strong>${data.entitlements.length}</strong> entitlement${data.entitlements.length === 1 ? "" : "s"}</p>${data.entitlements.length ? renderGrantRows(data.entitlements) : '<p class="muted">No grants found.</p>'}`;
  }
  if (Array.isArray(data.holders)) {
    return `<p class="small"><strong>${data.holders.length}</strong> grant${data.holders.length === 1 ? "" : "s"} on <strong>${escapeHtml(data.role)}</strong></p>${renderGrantRows(data.holders)}${Array.isArray(data.knownRoles) ? `<p class="small muted">Known roles: ${data.knownRoles.map(escapeHtml).join(", ")}</p>` : ""}`;
  }
  if (data.resource && Array.isArray(data.grants)) {
    return `<p class="small">Access on <strong>${escapeHtml(data.resource)}</strong> — <strong>${data.grants.length}</strong> grant${data.grants.length === 1 ? "" : "s"}</p>${renderGrantRows(data.grants)}`;
  }
  if (data.ticket) {
    const t = data.ticket;
    return `<div class="kv"><span>Ticket</span><strong class="mono">${escapeHtml(t.id)}</strong><span>Title</span><strong>${escapeHtml(t.title)}</strong><span>Status</span><strong>${escapeHtml(t.status)}</strong></div><p class="small">Open tickets: ${escapeHtml(data.openTickets ?? "—")}</p>`;
  }
  return null;
}

function ToolForm({ tool, onResult }) {
  const properties = tool.inputSchema?.properties || {};
  const required = new Set(tool.inputSchema?.required || []);
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const args = {};
      for (const [k, schema] of Object.entries(properties)) {
        const v = values[k];
        if (v === undefined || v === "") continue;
        args[k] = schema.type === "number" || schema.type === "integer" ? Number(v) : schema.type === "boolean" ? v === "true" : schema.type === "object" || schema.type === "array" ? JSON.parse(v) : v;
      }
      const out = await mcpCall(tool.name, args);
      onResult(out.result);
    } catch (err) {
      setError(err.message);
      onResult(null);
    } finally { setBusy(false); }
  };

  return (
    <form className="tool-form" onSubmit={submit} data-testid="tool-form">
      {Object.keys(properties).length === 0 && <p className="muted">This tool has no parameters.</p>}
      {Object.entries(properties).map(([key, schema]) => (
        <label key={key} className="field-inline">{key}{required.has(key) ? " *" : ""}
          {schema.enum || schema.type === "boolean" ? (
            <select data-name={key} value={values[key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}>
              <option value="">{schema.type === "boolean" ? "Choose true or false" : "Choose an option"}</option>
              {(schema.enum || ["true", "false"]).map((o) => <option key={String(o)} value={String(o)}>{String(o)}</option>)}
            </select>
          ) : schema.type === "object" || schema.type === "array" ? (
            <textarea rows={2} data-name={key} placeholder={schema.type === "array" ? "[]" : "{}"} value={values[key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))} />
          ) : (
            <input type={schema.type === "number" || schema.type === "integer" ? "number" : "text"} data-name={key} value={values[key] ?? ""} title={schema.description} onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))} />
          )}
        </label>
      ))}
      <button type="submit" className="btn primary" disabled={busy}>Run tool</button>
      {error && <p className="alert" role="alert">{error}</p>}
    </form>
  );
}

export default function PersonalAgentTab({ source }) {
  const [url, setUrl] = useState("");
  const [state, setState] = useState({ connected: false, tools: [], pendingOAuth: "" });
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // In Mock mode, default the URL to the in-process mock MCP server.
    fetch("/api/mcp/defaults").then((r) => r.json()).then((d) => { if (d.mockMcpUrl && !url) setUrl(d.mockMcpUrl); }).catch(() => {});
    mcpStatus().then(setState).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  const connect = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const s = await mcpConnect(url.trim());
      setState(s);
      setSelected(null); setResult(null);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const disconnect = async () => {
    try { await mcpDisconnect(); } catch { /* best effort */ }
    setState({ connected: false, tools: [], pendingOAuth: "" });
    setSelected(null); setResult(null);
  };

  const notNow = useCallback(() => setState((s) => ({ ...s, pendingOAuth: "" })), []);

  const showResult = (r) => {
    setResult(r);
  };

  const parsed = result ? (result.structuredContent ?? null) : null;
  const human = parsed ? humanToolResult(parsed) : null;

  return (
    <section aria-labelledby="mcp-title">
      <h2 id="mcp-title">Personal Agent</h2>
      <p className="muted">Connect to a remote MCP server, discover its tools, run them. {source === "mock" ? "Mock mode offers the in-process mock MCP server (loopback, MOCK-labelled data); no OAuth." : "Real mode: enter a real MCP server URL. If it requires OAuth, a dialog opens the authorization page and the callback completes the flow."}</p>

      <form className="mcp-connect" onSubmit={connect}>
        <label className="field-inline grow">MCP server URL
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-mcp-server.example/mcp" required data-testid="mcp-url" />
        </label>
        <button type="submit" className="btn primary" disabled={busy} data-testid="mcp-connect">Connect</button>
        {state.connected && <button type="button" className="btn" onClick={disconnect} data-testid="mcp-disconnect">Disconnect</button>}
        <span className="chip" data-state={state.connected ? "ok" : "neutral"} data-testid="mcp-state">{state.connected ? `${state.tools.length} tools` : "Disconnected"}</span>
      </form>
      {error && <p className="alert" role="alert" data-testid="mcp-error">{error}</p>}

      {/* Shared FloatingDialog (movable, resizable). Pop-out is off: the dialog holds a target="_blank" link, which the
          floating-dialog README says not to put in a popped-out window. */}
      <FloatingDialog isOpen={Boolean(state.pendingOAuth)} onClose={notNow} title="Authentication required" testId="oauth-dialog"
        defaultWidth={420} defaultHeight={null} minHeight={160} footer={null} disablePopOut>
        <p>The remote MCP server requires you to authenticate before its tools can be used.</p>
        <div className="actions">
          <a className="btn primary" href={state.pendingOAuth || "#"} target="_blank" rel="noreferrer">Authenticate user</a>
          <button type="button" className="btn" onClick={notNow}>Not now</button>
        </div>
      </FloatingDialog>

      <div className="mcp-grid">
        <aside className="card" aria-label="Discovered tools">
          <h3>Tools <span className="chip" data-testid="tool-count">{state.tools.length}</span></h3>
          <div className="tool-list">
            {!state.connected && <p className="muted">Connect to an MCP server to discover tools.</p>}
            {state.connected && state.tools.length === 0 && <p className="muted">No tools available on this server.</p>}
            {state.tools.map((t) => (
              <button key={t.name} type="button" className="btn small tool-item" aria-pressed={selected?.name === t.name} onClick={() => { setSelected(t); setResult(null); }} data-testid={`tool-${t.name}`}>
                <strong>{t.title || t.name}</strong>
                <span className="small muted">{t.description || t.name}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="card" aria-label="Tool detail">
          {!selected && <p className="muted">Select a discovered tool to inspect its inputs and run it.</p>}
          {selected && (
            <>
              <h3 data-testid="tool-title">{selected.title || selected.name}</h3>
              <p className="small muted">{selected.description || "No description provided."}</p>
              <ToolForm tool={selected} onResult={showResult} />
              {result && (
                <div className="tool-result" data-testid="tool-result">
                  <h4>Result</h4>
                  {human ? <div dangerouslySetInnerHTML={{ __html: human }} /> : <p className="muted">No human-readable view for this result shape.</p>}
                  <details><summary>Raw JSON</summary><pre className="inert inert--block">{JSON.stringify(result, null, 2)}</pre></details>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </section>
  );
}
