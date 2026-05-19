import { it, expect, describe } from "vitest";
import { mountFpsTick } from "../../src/systems/fps_tick.js";

function makeFps({ fpsFrames = 0, fpsDisplay = 0, fpsWindowT = 0 } = {}) {
  const s = { fpsFrames, fpsDisplay, fpsWindowT };
  const log = [];
  const get = { fpsFrames: () => s.fpsFrames, fpsDisplay: () => s.fpsDisplay, fpsWindowT: () => s.fpsWindowT };
  const set = { fpsFrames: v => { s.fpsFrames = v; }, fpsDisplay: v => { s.fpsDisplay = v; }, fpsWindowT: v => { s.fpsWindowT = v; } };
  const actions = { onNewFps: fps => log.push(fps) };
  const { tick } = mountFpsTick({ get, set, actions });
  const el = { textContent: "" };
  return { s, log, el, tick };
}

describe("fps_tick — frame counting", () => {
  it("increments fpsFrames on each tick", () => {
    const { s, el, tick } = makeFps({ fpsWindowT: 0 });
    tick(500, el);
    expect(s.fpsFrames).toBe(1);
    tick(600, el);
    expect(s.fpsFrames).toBe(2);
  });

  it("does not update fpsDisplay before 1000ms elapses", () => {
    const { s, el, tick } = makeFps({ fpsWindowT: 0, fpsDisplay: 42 });
    tick(999, el);
    expect(s.fpsDisplay).toBe(42);
  });

  it("does not call onNewFps before 1000ms elapses", () => {
    const { log, el, tick } = makeFps({ fpsWindowT: 0 });
    tick(999, el);
    expect(log).toHaveLength(0);
  });
});

describe("fps_tick — window expiry", () => {
  it("updates fpsDisplay when elapsed >= 1000ms", () => {
    const { s, el, tick } = makeFps({ fpsWindowT: 0, fpsFrames: 59 });
    tick(1000, el); // frame 60, elapsed=1000
    expect(s.fpsDisplay).toBe(60);
  });

  it("resets fpsFrames to 0 after window expires", () => {
    const { s, el, tick } = makeFps({ fpsWindowT: 0, fpsFrames: 59 });
    tick(1000, el);
    expect(s.fpsFrames).toBe(0);
  });

  it("resets fpsWindowT to now after window expires", () => {
    const { s, el, tick } = makeFps({ fpsWindowT: 0 });
    tick(1234, el);
    expect(s.fpsWindowT).toBe(1234);
  });

  it("calls onNewFps with the computed fps value", () => {
    const { log, el, tick } = makeFps({ fpsWindowT: 0, fpsFrames: 29 });
    tick(1000, el); // 30 frames / 1.0s = 30 fps
    expect(log).toHaveLength(1);
    expect(log[0]).toBe(30);
  });

  it("accumulates correctly across two windows", () => {
    const { s, log, el, tick } = makeFps({ fpsWindowT: 0 });
    for (let i = 1; i <= 60; i++) tick(i * 16, el); // ~60 frames over ~960ms
    for (let i = 61; i <= 120; i++) tick(i * 16, el); // second window
    expect(log.length).toBeGreaterThanOrEqual(1);
    expect(log[0]).toBeGreaterThan(0);
  });
});

describe("fps_tick — DOM update", () => {
  it("sets element textContent to '<fps> FPS'", () => {
    const { el, tick } = makeFps({ fpsWindowT: 0, fpsFrames: 59 });
    tick(1000, el); // triggers display update to 60
    expect(el.textContent).toBe("60 FPS");
  });

  it("shows previous fpsDisplay before window expires", () => {
    const { el, tick } = makeFps({ fpsWindowT: 0, fpsDisplay: 55 });
    tick(500, el);
    expect(el.textContent).toBe("55 FPS");
  });

  it("is null-safe — no error when el is null", () => {
    const { tick } = makeFps({ fpsWindowT: 0 });
    expect(() => tick(500, null)).not.toThrow();
  });
});

describe("fps_tick — fuzz", () => {
  it("fpsDisplay is always a non-negative integer", () => {
    for (let i = 0; i < 20; i++) {
      const { s, el, tick } = makeFps({ fpsWindowT: 0 });
      const frames = Math.floor(Math.random() * 120) + 1;
      const elapsed = 1000 + Math.random() * 500;
      for (let f = 0; f < frames; f++) tick(elapsed * (f + 1) / frames, el);
      tick(elapsed + 1, el);
      expect(s.fpsDisplay).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(s.fpsDisplay)).toBe(true);
    }
  });
});
