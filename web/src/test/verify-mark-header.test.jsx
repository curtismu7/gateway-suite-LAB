import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import React from "react";
import App from "../App.jsx";

// The header shows this lab's own Verified / In progress mark, read from the same /api/shelf call the Shelf link makes (through the lab-proxy
// that call reaches the shelf, whose payload lists every demo with its mark). The lab's own /api/shelf has no demos, so there is no mark then.
vi.mock("../lib/api.js", () => ({
  getInfo: vi.fn(async () => ({ source: "mock", realAvailable: false, realReason: "x", banner: "B", epoch: 0 })),
  getCatalog: vi.fn(async () => ({ banner: "B", source: "mock", prompts: [], diagram: { schema: "diagram-studio/1", id: "gateway-e2e", title: "End to End", lede: "", groups: {}, nodes: [], edges: [], paths: [] } })),
  getMcpDefaults: vi.fn(async () => ({ source: "mock", mockMcpUrl: "http://127.0.0.1:9/mock/mcp" })),
  requestModeSwitch: vi.fn(),
  resetServer: vi.fn(async () => ({ ok: true, epoch: 1 })),
  chatStream: vi.fn(),
  mcpConnect: vi.fn(),
  mcpStatus: vi.fn(async () => ({ connected: false, tools: [], pendingOAuth: "" })),
  mcpDisconnect: vi.fn(),
  mcpCall: vi.fn(),
}));

const mark = (status, label, extra = {}) => ({ status, label, note: "", updatedAt: "2026-11-15", source: "shipped", ...extra });
function withShelf(payload) {
  const real = globalThis.fetch;
  globalThis.fetch = (url, init) => (url === "/api/shelf" ? Promise.resolve(new Response(JSON.stringify(payload))) : real ? real(url, init) : Promise.reject(new Error("no network")));
  return () => { globalThis.fetch = real; };
}
afterEach(cleanup);

describe("verification mark in the header", () => {
  it("shows this lab's own mark in the top menu, and no other lab's", async () => {
    const restore = withShelf({ shelfUrl: "http://shelf.example", demos: [{ id: "other-lab", verification: mark("in-progress", "In progress") }, { id: "gateway-suite-lab", verification: mark("verified", "Verified", { note: "Every preset run on the mock" }) }] });
    try {
      render(<App />);
      const bar = within(await screen.findByRole("banner"));
      expect(await bar.findByText("Verified")).toBeInTheDocument();
      expect(bar.queryByText("In progress")).toBeNull();
      expect(document.querySelectorAll(".verify")).toHaveLength(1);
      expect(bar.getByText("Verified").closest(".top-menu")).not.toBeNull();
      expect(bar.getByText("Verified").closest(".verify")).toHaveAttribute("title", expect.stringContaining("Every preset run on the mock"));
    } finally { restore(); }
  });

  it("shows nothing when the lab is opened on its own port (its /api/shelf has no demos) or the shelf has no mark for it", async () => {
    for (const payload of [{ shelfUrl: "http://shelf.example" }, { shelfUrl: "http://shelf.example", demos: [{ id: "gateway-suite-lab", verification: null }] }]) {
      const restore = withShelf(payload);
      try {
        const { unmount } = render(<App />);
        const bar = within(await screen.findByRole("banner"));
        expect(await bar.findByRole("link", { name: "Shelf" })).toBeInTheDocument(); // the shelf answered, and still no badge
        expect(document.querySelector(".verify")).toBeNull();
        unmount();
      } finally { restore(); }
    }
  });
});
