// Opened from Customer Agent LAB (UC-TOOL3 routes here): the strip and the header Back button show; nothing is preselected.
// The banner is itself a role=note here, so the negative case looks for the named strip.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { returnLinkFor } from "../return-link/returnTargets.js";

vi.mock("../lib/api.js", () => ({
  getInfo: vi.fn(async () => ({ source: "mock", realAvailable: false, realReason: "x", banner: "B", epoch: 0 })),
  getCatalog: vi.fn(async () => ({
    banner: "B", source: "mock",
    prompts: [{ key: "access", label: "Access review", prompts: ["List all entitlements for alice.chen"] }],
    diagram: {
      schema: "diagram-studio/1", id: "gateway-e2e", title: "End to End", lede: "", groups: {},
      nodes: [
        { id: "main", group: "main", label: "Main Agent", sub: [], x: 0, y: 0 },
        { id: "worker", group: "worker", label: "Worker Agent", sub: [], x: 3, y: 0 },
      ],
      edges: [{ id: "e1", from: "main", to: "worker", label: "A2A handoff" }],
      paths: [{ id: "path-delegate", label: "delegation", hops: ["main", "worker"] }],
    },
  })),
  getMcpDefaults: vi.fn(async () => ({ source: "mock", mockMcpUrl: "http://127.0.0.1:9/mock/mcp" })),
  requestModeSwitch: vi.fn(),
  resetServer: vi.fn(async () => ({ ok: true, epoch: 1 })),
  chatStream: vi.fn(),
  mcpConnect: vi.fn(),
  mcpStatus: vi.fn(async () => ({ connected: false, tools: [], pendingOAuth: "" })),
  mcpDisconnect: vi.fn(async () => ({ ok: true })),
  mcpCall: vi.fn(),
}));
import App from "../App.jsx";

const NOTE = { name: "Opened from Customer Agent LAB" };
afterEach(() => { cleanup(); window.history.replaceState(null, "", "/"); });

describe("return link", () => {
  it("the vendored files match return-link.sha256, which names the parent commit", () => {
    const dir = path.join(process.cwd(), "src", "return-link");
    const text = fs.readFileSync(path.join(dir, "return-link.sha256"), "utf8");
    expect(text.split("\n")[0]).toMatch(/^# vendored byte for byte from curtismu7\/AI-DEMO-Standalone shared\/return-link at [0-9a-f]{7,40}/);
    const pins = text.split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split(/\s+/));
    expect(pins.map(([, f]) => f).sort()).toEqual(["ReturnLink.jsx", "ReturnLink.test.jsx", "returnTargets.js"]);
    for (const [h, f] of pins) expect(createHash("sha256").update(fs.readFileSync(path.join(dir, f))).digest("hex"), f).toBe(h);
  });

  it("?from=customer-agent: banner first, strip right below, header Back in the tools", async () => {
    window.history.replaceState(null, "", "/?from=customer-agent&uc=UC-TOOL3&vertical=banking");
    render(<App />);
    const note = await screen.findByRole("note", NOTE);
    expect(note.textContent).toContain("UC-TOOL3");
    expect(screen.getByTestId("banner").nextElementSibling).toBe(note);
    expect(document.querySelector(".shell-right > button.return-link--header")).not.toBeNull();
    expect(screen.getAllByRole("button", { name: /Back to Customer Agent LAB/ })).toHaveLength(2);
  });

  it("no from, an unknown from or a bad id: no strip, no button", async () => {
    for (const q of ["/", "/?from=elsewhere&uc=UC-TOOL3", "/?from=customer-agent&uc=%3Cb%3E", "/?from=customer-agent&uc=UC-TOOL3&vertical=a%20b"]) {
      window.history.replaceState(null, "", q);
      render(<App />);
      await screen.findByTestId("banner");
      await screen.findByRole("heading", { level: 1 });
      expect(screen.queryByRole("button", { name: /Back to/ })).toBeNull();
      expect(screen.queryByRole("note", NOTE)).toBeNull();
      cleanup();
    }
  });

  it("Back goes to the proxy path behind the lab proxy, to the direct URL on the app's own port", () => {
    window.history.replaceState(null, "", "/gateway-suite/?from=customer-agent&uc=UC-TOOL3");
    expect(returnLinkFor("gateway-suite-lab").href).toBe("/customer-agent/?returned=gateway-suite-lab&uc=UC-TOOL3");
    window.history.replaceState(null, "", "/?from=customer-agent&uc=UC-TOOL3");
    expect(returnLinkFor("gateway-suite-lab").href).toBe("http://127.0.0.1:5603/?returned=gateway-suite-lab&uc=UC-TOOL3");
  });
});
