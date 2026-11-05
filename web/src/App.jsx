import React, { useCallback, useEffect, useState } from "react";
import ShelfLink from "./components/ShelfLink.jsx";
import { getCatalog, getInfo, requestModeSwitch, resetServer } from "./lib/api.js";
import ModeToggle from "./components/ModeToggle.jsx";
import EndToEndTab from "./tabs/EndToEndTab.jsx";
import PersonalAgentTab from "./tabs/PersonalAgentTab.jsx";

export const TABS = [["end-to-end", "End to End"], ["mcp", "Personal Agent"]];
export const FALLBACK_BANNER = "MOCK mode. SIMULATED: the central agent, AI Guard blocks, MCP tools and LLM answer are a deterministic in-process responder. No tenant, no outbound network.";
const read = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* not remembered */ } };
const tabFromHash = () => { const id = window.location.hash.replace(/^#\/?/, "").split("?")[0]; return TABS.some(([t]) => t === id) ? id : "end-to-end"; };
const typing = (t) => !!t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);

export default function App() {
  const [catalog, setCatalog] = useState(null);
  const [info, setInfo] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [tab, setTab] = useState(tabFromHash);
  const [theme, setTheme] = useState(() => (["light", "dark"].includes(read("gws.theme", "")) ? read("gws.theme", "") : "system"));
  const [present, setPresent] = useState(() => read("gws.present", "0") === "1");
  const [announce, setAnnounce] = useState("");

  const loadAll = useCallback(async () => {
    const [c, i] = await Promise.all([getCatalog(), getInfo()]);
    setCatalog(c); setInfo(i);
    return i;
  }, []);
  useEffect(() => { loadAll().catch((e) => setLoadError(e.message)); }, [loadAll]);
  useEffect(() => { const on = () => setTab(tabFromHash()); window.addEventListener("hashchange", on); return () => window.removeEventListener("hashchange", on); }, []);
  useEffect(() => { if (theme === "system") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => { if (present) document.documentElement.dataset.present = "1"; else delete document.documentElement.dataset.present; }, [present]);
  useEffect(() => {
    const on = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
      if (e.key === "p" || e.key === "P") setPresent((v) => { write("gws.present", v ? "0" : "1"); return !v; });
      else if (e.key === "Escape") setPresent((v) => { if (v) write("gws.present", "0"); return false; });
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  const onMode = useCallback(async (next) => {
    try {
      const r = await requestModeSwitch(next);
      setInfo(r);
      setAnnounce(`Mode: ${r.source}.`);
      setCatalog(await getCatalog()); // reload all data after a switch (rule 19)
    } catch (e) { setAnnounce(e.message); }
  }, []);

  const banner = info?.banner ?? FALLBACK_BANNER;

  if (loadError || !catalog) {
    return (
      <>
        <a className="skip" href="#main">Skip to content</a>
        <header><p className="banner">{FALLBACK_BANNER}</p></header>
        <main className="page" id="main" tabIndex={-1}>
          {loadError ? <p className="alert" role="alert">Could not reach the lab server: {loadError}</p> : <p className="muted" role="status">Loading the AI Gateway Suite LAB…</p>}
        </main>
      </>
    );
  }

  const source = info?.source ?? "mock";

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="shell">
        <p className="banner" data-testid="banner" role="note">{banner}</p>
        <div className="shell-bar">
          <div className="shell-brand">
            <span className="head__mark" aria-hidden="true">GWS</span>
            <h1 className="head__title">AI Gateway Suite LAB</h1>
        <ShelfLink />
          </div>
          <div className="shell-right">
            <ModeToggle info={info} onSelect={onMode} />
            <button type="button" className="btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} data-testid="theme">Theme</button>
            <button type="button" className="btn" aria-pressed={present} title="Presenter mode: larger type for a room" onClick={() => setPresent((v) => { write("gws.present", v ? "0" : "1"); return !v; })} data-testid="present">Presenter</button>
            <button type="button" className="btn" onClick={async () => { await resetServer(); setCatalog(await getCatalog()); setAnnounce("Server state reset."); }} data-testid="reset">Reset</button>
          </div>
        </div>
        <nav aria-label="Tabs" className="tabs">
          {TABS.map(([id, label]) => (
            <a key={id} href={`#/${id}`} aria-current={tab === id ? "page" : undefined} className="tab" onClick={() => setTab(id)} data-testid={`tab-${id}`}>{label}</a>
          ))}
        </nav>
      </header>
      <main className="page" id="main" tabIndex={-1}>
        {tab === "mcp"
          ? <PersonalAgentTab source={source} />
          : <EndToEndTab catalog={catalog} source={source} />}
      </main>
      <footer><p className="muted small">{source === "real" ? "Real mode: chat is relayed to the configured central agent." : "Mock mode: every agent, gateway, tool and answer is simulated in-process."}</p></footer>
      <div aria-live="polite" className="visually-hidden">{announce}</div>
    </>
  );
}
