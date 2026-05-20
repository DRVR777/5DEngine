import { describe, expect, it, vi } from "vitest";
import { mountLoadCheckOverlay } from "../../src/bridges/load_check_overlay.js";

function makeEl(id) {
  return { id, style: {}, title: "", onclick: null };
}

function makeDocument() {
  const map = new Map(["loadCheckOverlay", "pullWorkingBtn", "loadCheckYes", "loadCheckNo"].map(id => [id, makeEl(id)]));
  return {
    getElementById: vi.fn(id => map.get(id) || null),
    el: id => map.get(id),
  };
}

function mount(overrides = {}) {
  const doc = makeDocument();
  const win = { _loadingDismissed: false };
  const locationRef = { reload: vi.fn() };
  const intervals = [];
  const timeouts = [];
  const actions = {
    showToast: vi.fn(),
    setTimeout: vi.fn((fn, ms) => { timeouts.push({ fn, ms }); return `t${timeouts.length}`; }),
    setInterval: vi.fn((fn, ms) => { intervals.push({ fn, ms }); return `i${intervals.length}`; }),
    clearInterval: vi.fn(),
  };
  const fetchFn = overrides.fetchFn || vi.fn(url => {
    if (url.endsWith("/status")) return Promise.resolve({ json: () => Promise.resolve({ workingSha: "abc123" }) });
    if (url.endsWith("/verify")) return Promise.resolve({ json: () => Promise.resolve({ ok: true, sha: "def456" }) });
    if (url.endsWith("/pull-working")) return Promise.resolve({ json: () => Promise.resolve({ ok: true, sha: "good789" }) });
    return Promise.reject(new Error("bad url"));
  });
  const api = mountLoadCheckOverlay({
    documentRef: doc,
    windowRef: win,
    locationRef,
    fetchFn,
    confirmFn: overrides.confirmFn || vi.fn(() => true),
    actions,
  });
  return { api, doc, win, locationRef, intervals, timeouts, actions, fetchFn };
}

describe("mountLoadCheckOverlay", () => {
  it("checks git status and preserves 500ms observer plus 4000ms load-check delay", async () => {
    const { doc, win, intervals, timeouts, actions, fetchFn } = mount();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(fetchFn).toHaveBeenCalledWith("http://localhost:3001/api/git/status");
    expect(doc.el("pullWorkingBtn").style.display).toBe("block");
    expect(doc.el("pullWorkingBtn").title).toBe("Pull last working build: abc123");
    expect(intervals[0].ms).toBe(500);
    win._loadingDismissed = true;
    intervals[0].fn();
    expect(actions.clearInterval).toHaveBeenCalledWith("i1");
    expect(timeouts[0].ms).toBe(4000);
  });

  it("yes button verifies working build and preserves success toast duration", async () => {
    const env = mount();
    env.api.showLoadCheck();
    await env.doc.el("loadCheckYes").onclick();
    expect(env.fetchFn).toHaveBeenCalledWith("http://localhost:3001/api/git/verify", { method: "POST" });
    expect(env.actions.showToast).toHaveBeenCalledWith("Marked as working build ✓ (def456)", "success", 3000);
    expect(env.doc.el("loadCheckOverlay").style.display).toBe("none");
  });

  it("pull working uses confirmation, toast durations, and 1800ms reload delay", async () => {
    const { doc, locationRef, timeouts, actions, fetchFn } = mount();
    await doc.el("pullWorkingBtn").onclick();
    expect(actions.showToast).toHaveBeenCalledWith("Fetching working build…", "info", 5000);
    expect(fetchFn).toHaveBeenCalledWith("http://localhost:3001/api/git/pull-working", { method: "POST" });
    expect(actions.showToast).toHaveBeenCalledWith("Switched to working build good789 — reloading…", "success", 2000);
    expect(timeouts[0].ms).toBe(1800);
    timeouts[0].fn();
    expect(locationRef.reload).toHaveBeenCalled();
  });

  it("reports server failures with preserved danger durations", async () => {
    const env = mount({ fetchFn: vi.fn(() => Promise.reject(new Error("offline"))) });
    env.api.showLoadCheck();
    await env.doc.el("loadCheckYes").onclick();
    expect(env.actions.showToast).toHaveBeenCalledWith("Server not running — tag skipped", "danger", 2500);
    await env.doc.el("pullWorkingBtn").onclick();
    expect(env.actions.showToast).toHaveBeenCalledWith("Server not running — cannot pull", "danger", 3000);
  });
});
