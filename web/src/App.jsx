import React, { useCallback, useEffect, useState } from "react";
import ShelfLink from "./components/ShelfLink.jsx";
import VerifyMark from "./components/VerifyMark.jsx";
import { getCatalog, getInfo, requestModeSwitch, resetServer } from "./lib/api.js";
import TopMenu from "./top-menu/TopMenu.jsx";
import HelpDialog from "./help-dialog/HelpDialog.jsx";
import { HELP_SECTIONS } from "./helpContent";
// Opened from Customer Agent LAB (UC-TOOL3 routes here): strip + header Back only. Nothing is preselected.
import ReturnLink from "./return-link/ReturnLink.jsx";
import EndToEndTab from "./tabs/EndToEndTab.jsx";
import PersonalAgentTab from "./tabs/PersonalAgentTab.jsx";
import TalkTrackTab from "./tabs/TalkTrackTab.jsx";

export const TABS = [["end-to-end", "End to End"], ["mcp", "Personal Agent"], ["talk", "Talk track"]];
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
  const [helpOpen, setHelpOpen] = useState(false);
  const [theme, setThemeState] = useState(() => (["light", "dark"].includes(read("gws.theme", "")) ? read("gws.theme", "") : "system"));
  const setTheme = (t) => { write("gws.theme", t === "system" ? "" : t); setThemeState(t); };
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

  const loaded = !loadError && !!catalog;
  const banner = loaded ? (info?.banner ?? FALLBACK_BANNER) : FALLBACK_BANNER;
  const source = info?.source ?? "mock";

  // Standard app shell (STANDALONE-UI-PATTERNS section 1): the Core Dark shell bar first, then <main> whose first child is the
  // simulation banner; the hand-off strip goes right below the banner. Loading and error states keep the same order.
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="shell-bar">
        <span className="shell-brand">
          <span className="shell-logo" aria-hidden="true">GWS</span>
          <h1>AI Gateway Suite LAB</h1>
          {loaded && (source === "real"
            ? <span className="shell-badge shell-badge--real" data-testid="mode-badge">Real</span>
            : <span className="shell-badge" data-testid="mode-badge">Mock</span>)}
        </span>
        <nav className="shell-nav" aria-label="Tabs">
          {TABS.map(([id, label]) => (
            <a key={id} href={`#/${id}`} aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)} data-testid={`tab-${id}`}>{label}</a>
          ))}
        </nav>
        {loaded && (
          <TopMenu
            mode={{ value: source === "real" ? "real" : "mock", onChange: onMode, realAvailable: info ? info.realAvailable === true : null, realHint: info?.realReason }}
            theme={{ value: theme === "system" ? "auto" : theme, onChange: setTheme }}
            present={{ active: present, onToggle: () => setPresent((v) => { write("gws.present", v ? "0" : "1"); return !v; }), label: "Present" }}
            help={{ onClick: () => setHelpOpen(true), title: "What this lab is, and what is simulated" }}
            version={info?.version || null}
            onReset={async () => { await resetServer(); setCatalog(await getCatalog()); setAnnounce("Server state reset."); }}
            talkTrack={{ active: tab === "talk", onToggle: () => { if (tab !== "talk") window.location.hash = "#/talk"; } }}
          >
            <ShelfLink />
            <VerifyMark id="gateway-suite-lab" />
            <ReturnLink app="gateway-suite-lab" variant="header" />
          </TopMenu>
        )}
      </header>
      <main className="page" id="main" tabIndex={-1}>
        <p className="banner" data-testid={loaded ? "banner" : undefined} role="note">{banner}</p>
        {loaded && <ReturnLink app="gateway-suite-lab" />}
        {!loaded
          ? (loadError ? <p className="alert" role="alert">Could not reach the lab server: {loadError}</p> : <p className="muted" role="status">Loading the AI Gateway Suite LAB…</p>)
          : tab === "mcp"
            ? <PersonalAgentTab source={source} />
            : tab === "talk"
              ? <TalkTrackTab />
              : <EndToEndTab catalog={catalog} source={source} />}
      </main>
      <HelpDialog isOpen={helpOpen} onClose={() => setHelpOpen(false)} sections={HELP_SECTIONS} docsUrl="https://github.com/curtismu7/gateway-suite-LAB#readme" />
      <footer><p className="muted small">{source === "real" ? "Real mode: chat is relayed to the configured central agent." : "Mock mode: every agent, gateway, tool and answer is simulated in-process."}</p></footer>
      <div aria-live="polite" className="visually-hidden">{announce}</div>
    </>
  );
}
