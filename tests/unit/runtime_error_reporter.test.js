import { describe, expect, it, vi } from "vitest";
import { mountRuntimeErrorReporter } from "../../src/bridges/runtime_error_reporter.js";

function makeWindow() {
  const listeners = {};
  return {
    addEventListener: vi.fn((type, fn) => { listeners[type] = fn; }),
    dispatch: (type, event) => listeners[type](event),
  };
}

describe("mountRuntimeErrorReporter", () => {
  it("installs wave hook and posts uncaught errors to the preserved API", () => {
    const win = makeWindow();
    const fetchFn = vi.fn(() => Promise.resolve());
    const api = mountRuntimeErrorReporter({
      windowRef: win,
      fetchFn,
      nowIso: () => "2026-05-19T00:00:00.000Z",
    });
    win._5DErrorWave(3);
    expect(api.getWaveHint()).toBe(3);
    win.dispatch("error", {
      message: "boom",
      filename: "index.html",
      lineno: 2577,
      error: { stack: "stack" },
    });
    expect(fetchFn).toHaveBeenCalledWith("http://localhost:3001/api/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "uncaught",
        message: "boom",
        filename: "index.html",
        lineno: 2577,
        stack: "stack",
        wave: 3,
        timestamp: "2026-05-19T00:00:00.000Z",
      }),
    });
  });

  it("posts unhandled rejection messages and swallows fetch failures", () => {
    const win = makeWindow();
    const fetchFn = vi.fn(() => ({ catch: vi.fn() }));
    mountRuntimeErrorReporter({ windowRef: win, fetchFn, nowIso: () => "t" });
    win.dispatch("unhandledrejection", { reason: { message: "bad promise" } });
    expect(fetchFn).toHaveBeenCalledWith("http://localhost:3001/api/errors", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        type: "unhandledrejection",
        message: "bad promise",
        wave: 0,
        timestamp: "t",
      }),
    }));
  });

  it("does not throw if fetch throws synchronously", () => {
    const win = makeWindow();
    mountRuntimeErrorReporter({ windowRef: win, fetchFn: () => { throw new Error("offline"); } });
    expect(() => win.dispatch("error", { message: "x" })).not.toThrow();
  });
});
