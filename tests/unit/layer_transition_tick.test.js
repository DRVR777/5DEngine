import { it, expect, describe } from "vitest";
import { mountLayerTransitionTick } from "../../src/systems/layer_transition_tick.js";

function makeActions({ currentLayerId = 1, boundaryResult = null, bldgNames = {} } = {}) {
  let layerId = currentLayerId;
  const log = { transitions: [], toasts: [], sfx: [] };
  return {
    get: { layerId: () => layerId },
    actions: {
      boundaryAt: (u, v, bldgs) => boundaryResult,
      bldgName: id => bldgNames[id] || `Building ${id}`,
      logTransition: (from, to) => { layerId = to; log.transitions.push({ from, to }); },
      showToast: (msg, type, dur) => log.toasts.push({ msg, type, dur }),
      playSfx: (str, vol) => log.sfx.push({ str, vol }),
    },
    log,
  };
}

const BASE = { heroU: 5, heroV: 5, buildings: [] };

describe("layer_transition_tick — no-op when layer unchanged", () => {
  it("outside → outside (same layer 1) → no transition", () => {
    const { get, actions, log } = makeActions({ currentLayerId: 1, boundaryResult: null });
    mountLayerTransitionTick({ get, actions }).tick(0.016, BASE);
    expect(log.transitions.length).toBe(0);
    expect(log.toasts.length).toBe(0);
    expect(log.sfx.length).toBe(0);
  });

  it("inside building A → inside same building A → no transition", () => {
    const { get, actions, log } = makeActions({ currentLayerId: 2, boundaryResult: { targetLayerId: 2 } });
    mountLayerTransitionTick({ get, actions }).tick(0.016, BASE);
    expect(log.transitions.length).toBe(0);
  });
});

describe("layer_transition_tick — entering a building", () => {
  it("outside (1) → inside building (2) → logTransition called", () => {
    const { get, actions, log } = makeActions({ currentLayerId: 1, boundaryResult: { targetLayerId: 2 } });
    mountLayerTransitionTick({ get, actions }).tick(0.016, BASE);
    expect(log.transitions.length).toBe(1);
    expect(log.transitions[0]).toEqual({ from: 1, to: 2 });
  });

  it("entering building → showToast with 'Entered ...' message", () => {
    const { get, actions, log } = makeActions({ currentLayerId: 1, boundaryResult: { targetLayerId: 2 }, bldgNames: { 2: "City Hall" } });
    mountLayerTransitionTick({ get, actions }).tick(0.016, BASE);
    expect(log.toasts.length).toBe(1);
    expect(log.toasts[0].msg).toContain("City Hall");
    expect(log.toasts[0].type).toBe("info");
  });

  it("entering building → playSfx with 320Hz tone", () => {
    const { get, actions, log } = makeActions({ currentLayerId: 1, boundaryResult: { targetLayerId: 2 } });
    mountLayerTransitionTick({ get, actions }).tick(0.016, BASE);
    expect(log.sfx[0].str).toContain("320");
  });
});

describe("layer_transition_tick — exiting a building", () => {
  it("inside (2) → outside (targetLayer=1) → logTransition called", () => {
    const { get, actions, log } = makeActions({ currentLayerId: 2, boundaryResult: null });
    mountLayerTransitionTick({ get, actions }).tick(0.016, BASE);
    expect(log.transitions[0]).toEqual({ from: 2, to: 1 });
  });

  it("exiting → showToast 'Outside'", () => {
    const { get, actions, log } = makeActions({ currentLayerId: 2, boundaryResult: null });
    mountLayerTransitionTick({ get, actions }).tick(0.016, BASE);
    expect(log.toasts[0].msg).toBe("Outside");
  });

  it("exiting → playSfx with 180Hz tone", () => {
    const { get, actions, log } = makeActions({ currentLayerId: 2, boundaryResult: null });
    mountLayerTransitionTick({ get, actions }).tick(0.016, BASE);
    expect(log.sfx[0].str).toContain("180");
  });
});

describe("layer_transition_tick — layerId updates after transition", () => {
  it("after entering building, layerId = targetLayer", () => {
    const { get, actions } = makeActions({ currentLayerId: 1, boundaryResult: { targetLayerId: 3 } });
    const sys = mountLayerTransitionTick({ get, actions });
    sys.tick(0.016, BASE);
    expect(get.layerId()).toBe(3);
  });

  it("two consecutive same-to-same ticks → only one transition fires", () => {
    const { get, actions, log } = makeActions({ currentLayerId: 1, boundaryResult: { targetLayerId: 2 } });
    const sys = mountLayerTransitionTick({ get, actions });
    sys.tick(0.016, BASE); // triggers transition: 1→2, layerId=2
    sys.tick(0.016, BASE); // now layerId=2, targetLayer=2 → no transition
    expect(log.transitions.length).toBe(1);
  });
});

describe("layer_transition_tick — fuzz", () => {
  it("never throws for 20 random states", () => {
    for (let i = 0; i < 20; i++) {
      const inside = Math.random() > 0.5 ? { targetLayerId: Math.floor(Math.random() * 5) + 1 } : null;
      const { get, actions } = makeActions({ currentLayerId: Math.floor(Math.random() * 5) + 1, boundaryResult: inside });
      expect(() => mountLayerTransitionTick({ get, actions }).tick(0.016, BASE)).not.toThrow();
    }
  });
});
