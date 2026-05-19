import { it, expect, describe } from "vitest";
import { mountGrenadeWarnTick } from "../../src/systems/grenade_warn_tick.js";

function makeEl() {
  return { style: { display: "none", opacity: "1", transform: "" } };
}

function makeState({ el = makeEl() } = {}) {
  const actions = { getWarnEl: () => el };
  return { actions, el };
}

function makeGrenade({ u = 0, v = 0, fuse = 1.5 } = {}) {
  return { u, v, fuse };
}

describe("grenade_warn_tick — display control", () => {
  it("near grenade (fuse<2, dist<6) → display block", () => {
    const { actions, el } = makeState();
    const g = makeGrenade({ u: 2, v: 0, fuse: 1.0 });
    mountGrenadeWarnTick({ actions }).tick(0.016, { grenades: [g], heroU: 0, heroV: 0, nowMs: 0 });
    expect(el.style.display).toBe("block");
  });

  it("no grenades → display none", () => {
    const { actions, el } = makeState();
    mountGrenadeWarnTick({ actions }).tick(0.016, { grenades: [], heroU: 0, heroV: 0, nowMs: 0 });
    expect(el.style.display).toBe("none");
  });

  it("grenade far away (>6m) → display none", () => {
    const { actions, el } = makeState();
    const g = makeGrenade({ u: 10, v: 0, fuse: 1.0 });
    mountGrenadeWarnTick({ actions }).tick(0.016, { grenades: [g], heroU: 0, heroV: 0, nowMs: 0 });
    expect(el.style.display).toBe("none");
  });

  it("grenade fuse >= 2s → display none even if close", () => {
    const { actions, el } = makeState();
    const g = makeGrenade({ u: 2, v: 0, fuse: 2.5 });
    mountGrenadeWarnTick({ actions }).tick(0.016, { grenades: [g], heroU: 0, heroV: 0, nowMs: 0 });
    expect(el.style.display).toBe("none");
  });

  it("null el → does not throw", () => {
    const actions = { getWarnEl: () => null };
    expect(() =>
      mountGrenadeWarnTick({ actions }).tick(0.016, { grenades: [makeGrenade()], heroU: 0, heroV: 0, nowMs: 0 })
    ).not.toThrow();
  });
});

describe("grenade_warn_tick — pulse animation", () => {
  it("near grenade → opacity set (not default)", () => {
    const { actions, el } = makeState();
    const g = makeGrenade({ u: 2, v: 0, fuse: 1.0 });
    mountGrenadeWarnTick({ actions }).tick(0.016, { grenades: [g], heroU: 0, heroV: 0, nowMs: 0 });
    expect(parseFloat(el.style.opacity)).toBeGreaterThan(0.5);
  });

  it("near grenade → transform includes scale", () => {
    const { actions, el } = makeState();
    const g = makeGrenade({ u: 2, v: 0, fuse: 1.0 });
    mountGrenadeWarnTick({ actions }).tick(0.016, { grenades: [g], heroU: 0, heroV: 0, nowMs: 0 });
    expect(el.style.transform).toContain("scale(");
  });

  it("two grenades — only need one near to warn", () => {
    const { actions, el } = makeState();
    const far = makeGrenade({ u: 20, v: 0, fuse: 1.0 });
    const near = makeGrenade({ u: 2, v: 0, fuse: 0.5 });
    mountGrenadeWarnTick({ actions }).tick(0.016, { grenades: [far, near], heroU: 0, heroV: 0, nowMs: 0 });
    expect(el.style.display).toBe("block");
  });
});
