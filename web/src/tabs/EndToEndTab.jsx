import React, { useEffect, useRef, useState } from "react";
import FlowDiagram from "../components/FlowDiagram.jsx";
import { chatStream } from "../lib/api.js";
import { humanToolResult } from "./PersonalAgentTab.jsx";

const FLOW_BY_KIND = {
  handoff: "path-delegate",
  mcpcall: "path-worker-mcp",
};

export default function EndToEndTab({ catalog, source }) {
  const [category, setCategory] = useState("access");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [traces, setTraces] = useState([]);
  const [answer, setAnswer] = useState({ text: "", html: "", tool: null, blocked: "", error: "" });
  const [activePath, setActivePath] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [announce, setAnnounce] = useState("");
  const chatRef = useRef(null);
  const traceRef = useRef(null);

  useEffect(() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight }); }, [answer]);
  useEffect(() => { traceRef.current?.scrollTo({ top: traceRef.current.scrollHeight }); }, [traces]);

  const reset = () => {
    setTraces([]); setAnswer({ text: "", html: "", tool: null, blocked: "", error: "" });
    setActivePath(""); setBlocked(false);
  };

  const send = async (text) => {
    const msg = (text ?? message).trim();
    if (!msg || busy) return;
    setBusy(true);
    reset();
    setMessage("");
    setAnnounce("Sending request to central agent");
    try {
      await chatStream(msg, (name, payload) => {
        if (name === "trace") {
          setTraces((t) => [...t, payload]);
          if (payload.kind === "handoff") setActivePath("path-delegate");
          else if (payload.kind === "mcp-call") setActivePath("path-worker-mcp");
          else if (payload.kind === "mcp-result") setActivePath("path-worker-llm");
          else if (payload.kind === "result") setActivePath("");
          else if (payload.kind === "guard") setBlocked(true);
        } else if (name === "token") {
          setAnswer((a) => ({ ...a, text: a.text + (payload.text || "") }));
        } else if (name === "rendered") {
          setAnswer((a) => ({ ...a, html: payload.html || "", tool: payload.tool || null }));
        } else if (name === "blocked") {
          setBlocked(true);
          setAnswer((a) => ({ ...a, blocked: payload.reason || "Blocked by AI Guard." }));
          setAnnounce("Request blocked by AI Guard");
        } else if (name === "error") {
          setAnswer((a) => ({ ...a, error: payload.reason || "Agent request failed" }));
        }
      });
    } catch (e) {
      setAnswer((a) => ({ ...a, error: e.message }));
    } finally { setBusy(false); }
  };

  const categories = catalog?.prompts || [];

  return (
    <section aria-labelledby="e2e-title">
      <h2 id="e2e-title">End to End</h2>
      <p className="muted">One prompt, relayed Main Agent → AI Gateway (A2A) → Worker Agent → AI Gateway (MCP) → MCP tool → LLM. Drag the boxes; Reset layout restores them.</p>

      <FlowDiagram diagram={catalog?.diagram} activePath={activePath} blocked={blocked} speed={speed} />

      <div className="flow-controls">
        <label className="field-inline">Simulate speed
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} data-testid="speed-select" aria-label="Simulate speed">
            <option value={0.5}>0.5×</option>
            <option value={1}>1×</option>
            <option value={2}>2×</option>
          </select>
        </label>
        <span className="chip" data-state={blocked ? "danger" : activePath ? "info" : "ok"} data-testid="flow-state">
          {blocked ? "AI Guard block" : activePath ? "Flow active" : "Idle"}
        </span>
      </div>

      <div className="e2e-grid">
        <aside className="card" aria-label="Preset prompts">
          <h3>Preset prompts</h3>
          <label className="field-inline">Category
            <select value={category} onChange={(e) => setCategory(e.target.value)} data-testid="prompt-category" aria-label="Prompt category">
              {categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </label>
          <div className="prompt-list" role="group" aria-label="Preset prompts for the selected category">
            {(categories.find((c) => c.key === category)?.prompts || []).map((p) => (
              <button key={p} type="button" className="btn small prompt-choice" data-testid="prompt-choice" onClick={() => setMessage(p)}>{p}</button>
            ))}
          </div>
        </aside>

        <section className="card" aria-label="Conversation" ref={chatRef}>
          <h3>Conversation</h3>
          <div className="chat-messages" data-testid="chat">
            {!answer.text && !answer.html && !answer.blocked && !answer.error && <p className="muted">Ask an end-to-end access question or choose a preset prompt.</p>}
            {answer.blocked && <p className="alert" role="alert" data-testid="blocked">Blocked by AI Guard: {answer.blocked}</p>}
            {answer.error && <p className="alert" role="alert" data-testid="chat-error">{answer.error}</p>}
            {answer.html
              ? (
                <div className="md" data-testid="answer">
                  <div dangerouslySetInnerHTML={{ __html: answer.html }} />
                  {answer.tool
                    ? <div className="tool-cards" dangerouslySetInnerHTML={{ __html: humanToolResult(answer.tool) || "" }} />
                    : null}
                </div>
              )
              : answer.text && <pre className="inert" data-testid="answer">{answer.text}</pre>}
          </div>
          <form className="composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <textarea
              rows={2}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ask an end-to-end access question…"
              aria-label="End-to-end prompt"
              data-testid="chat-input"
            />
            <button type="submit" className="btn primary" disabled={busy} data-testid="chat-send">Send</button>
          </form>
        </section>

        <aside className="card" aria-label="Request trace">
          <h3>Trace</h3>
          <div className="trace-list" data-testid="trace" ref={traceRef}>
            {traces.length === 0 && <p className="muted">Request activity appears here.</p>}
            {traces.map((t, i) => (
              <div key={i} className={`trace-item trace-${t.kind}`}>
                <div className="trace-head"><strong>{t.text}</strong><span className="muted small">{t.at}</span></div>
                <code className="small muted">{t.tp}</code>
                {t.detail && <pre className="inert inert--block">{t.detail}</pre>}
              </div>
            ))}
          </div>
        </aside>
      </div>
      <div aria-live="polite" className="visually-hidden">{announce}</div>
    </section>
  );
}
