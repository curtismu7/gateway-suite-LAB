// The Personal Agent "Authentication required" dialog is the shared FloatingDialog: it has the movable title bar, and Escape
// closes it the same way Not now does.
import { test, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import PersonalAgentTab from "../tabs/PersonalAgentTab.jsx";

vi.mock("../lib/api.js", () => ({
  mcpStatus: vi.fn(async () => ({ connected: false, tools: [], pendingOAuth: "https://mcp.example/authorize?x=1" })),
  mcpConnect: vi.fn(), mcpDisconnect: vi.fn(), mcpCall: vi.fn(),
}));

beforeEach(() => { vi.stubGlobal("fetch", vi.fn(async () => ({ json: async () => ({}) }))); });

test("the OAuth dialog renders in FloatingDialog, keeps its link and buttons, and Escape closes it", async () => {
  render(<PersonalAgentTab source="real" />);
  const dialog = await screen.findByRole("dialog", { name: "Authentication required" });
  expect(dialog).toHaveAttribute("aria-modal", "true");
  expect(within(dialog).getByTestId("fd-titlebar")).toHaveTextContent("Authentication required");
  expect(within(dialog).getByRole("link", { name: "Authenticate user" })).toHaveAttribute("href", "https://mcp.example/authorize?x=1");
  expect(within(dialog).getByRole("button", { name: "Not now" })).toBeInTheDocument();
  fireEvent.keyDown(document.body, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

test("Not now still closes it", async () => {
  render(<PersonalAgentTab source="real" />);
  const dialog = await screen.findByRole("dialog", { name: "Authentication required" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Not now" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
