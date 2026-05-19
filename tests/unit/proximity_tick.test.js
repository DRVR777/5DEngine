import { it, expect, describe } from "vitest";
import { mountProximityTick } from "../../src/systems/proximity_tick.js";

function makeColor() {
  const calls = [];
  return { setHSL(...a) { calls.push(a); }, _calls: calls };
}

function makeActions({ computerPos = { u: 0, v: 0 }, screenFront = null, npcDefs = [], npcPositions = {} } = {}) {
  return {
    getComputerPos: () => computerPos,
    getScreenFront: () => screenFront,
    getNpcDefs:     () => npcDefs,
    getNpcPos:      (id) => npcPositions[id] || null,
  };
}

function makeState({ nearNpc = null, nearComputer = false, dialogOpen = false, computerOpen = false } = {}) {
  const state = { nearNpc, nearComputer };
  return {
    get: { dialogOpen: () => dialogOpen, computerOpen: () => computerOpen },
    set: {
      nearComputer: v => { state.nearComputer = v; },
      nearNpc:      n => { state.nearNpc = n; },
    },
    state,
  };
}

const BASE = { heroU: 0, heroV: 0, nowMs: 1000 };

describe("proximity_tick — computer proximity", () => {
  it("hero within 2.5m → nearComputer set true", () => {
    const st = makeState();
    mountProximityTick({ get: st.get, set: st.set, actions: makeActions({ computerPos: { u: 2, v: 0 } }) })
      .tick(0.016, { ...BASE, heroU: 0, heroV: 0 });
    expect(st.state.nearComputer).toBe(true);
  });

  it("hero beyond 2.5m → nearComputer set false", () => {
    const st = makeState({ nearComputer: true });
    mountProximityTick({ get: st.get, set: st.set, actions: makeActions({ computerPos: { u: 10, v: 0 } }) })
      .tick(0.016, BASE);
    expect(st.state.nearComputer).toBe(false);
  });

  it("hero exactly at 2.5m → nearComputer false (boundary is exclusive)", () => {
    const st = makeState();
    mountProximityTick({ get: st.get, set: st.set, actions: makeActions({ computerPos: { u: 2.5, v: 0 } }) })
      .tick(0.016, BASE);
    expect(st.state.nearComputer).toBe(false);
  });
});

describe("proximity_tick — screen pulse", () => {
  it("calls setHSL on screenFront.material.color each tick", () => {
    const color = makeColor();
    const sf = { material: { color } };
    const st = makeState();
    mountProximityTick({ get: st.get, set: st.set, actions: makeActions({ screenFront: sf }) })
      .tick(0.016, BASE);
    expect(color._calls.length).toBe(1);
    expect(color._calls[0][1]).toBeCloseTo(0.5); // saturation
    expect(color._calls[0][2]).toBeCloseTo(0.55); // lightness
  });

  it("no screenFront → no throw", () => {
    const st = makeState();
    expect(() =>
      mountProximityTick({ get: st.get, set: st.set, actions: makeActions() })
        .tick(0.016, BASE)
    ).not.toThrow();
  });
});

describe("proximity_tick — NPC proximity", () => {
  it("NPC within 2.5m + not dialog + not computerOpen → nearNpc set", () => {
    const st = makeState();
    const npcDef = { id: "npc_guard" };
    const actions = makeActions({
      npcDefs: [npcDef],
      npcPositions: { npc_guard: { u: 1, v: 0 } },
    });
    mountProximityTick({ get: st.get, set: st.set, actions })
      .tick(0.016, BASE);
    expect(st.state.nearNpc).toBe(npcDef);
  });

  it("NPC beyond 2.5m → nearNpc remains null", () => {
    const st = makeState();
    const npcDef = { id: "npc_guard" };
    const actions = makeActions({
      npcDefs: [npcDef],
      npcPositions: { npc_guard: { u: 10, v: 0 } },
    });
    mountProximityTick({ get: st.get, set: st.set, actions })
      .tick(0.016, BASE);
    expect(st.state.nearNpc).toBeNull();
  });

  it("dialogOpen → nearNpc not set even if NPC is in range", () => {
    const st = makeState({ dialogOpen: true });
    const actions = makeActions({
      npcDefs: [{ id: "npc_a" }],
      npcPositions: { npc_a: { u: 0.5, v: 0 } },
    });
    mountProximityTick({ get: st.get, set: st.set, actions })
      .tick(0.016, BASE);
    expect(st.state.nearNpc).toBeNull();
  });

  it("computerOpen → nearNpc not set even if NPC is in range", () => {
    const st = makeState({ computerOpen: true });
    const actions = makeActions({
      npcDefs: [{ id: "npc_b" }],
      npcPositions: { npc_b: { u: 0.5, v: 0 } },
    });
    mountProximityTick({ get: st.get, set: st.set, actions })
      .tick(0.016, BASE);
    expect(st.state.nearNpc).toBeNull();
  });

  it("first matching NPC returned when multiple in range", () => {
    const st = makeState();
    const n1 = { id: "npc_1" }, n2 = { id: "npc_2" };
    const actions = makeActions({
      npcDefs: [n1, n2],
      npcPositions: { npc_1: { u: 1, v: 0 }, npc_2: { u: 0.5, v: 0 } },
    });
    mountProximityTick({ get: st.get, set: st.set, actions })
      .tick(0.016, BASE);
    expect(st.state.nearNpc).toBe(n1); // first in list wins
  });

  it("nearNpc reset to null each tick even if was set before", () => {
    const prevNpc = { id: "npc_old" };
    const st = makeState({ nearNpc: prevNpc });
    mountProximityTick({ get: st.get, set: st.set, actions: makeActions() })
      .tick(0.016, BASE);
    expect(st.state.nearNpc).toBeNull();
  });
});
