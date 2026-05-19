import { it, expect, describe } from "vitest";
import { mountNpcMoveTick } from "../../src/systems/npc_move_tick.js";

function makeNpc(id, { u = 5, v = 5, fleeT = 0, fleeAng = 0, wanderSpeed = 2 } = {}) {
  return { id, _fleeT: fleeT, _fleeAng: fleeAng, wanderSpeed };
}

function makeMesh({ heading = 0, hasRing = false } = {}) {
  const pos = { x: 0, y: 0, z: 0 };
  const ring = hasRing ? { material: { opacity: 0 } } : null;
  return { heading, ring, group: { position: { set: (x, y, z) => { pos.x = x; pos.y = y; pos.z = z; } }, rotation: { y: 0 } }, _pos: pos };
}

function makeActions({ npcPositions = {}, wanderResult = 1.0 } = {}) {
  const setPosLog = [];
  const wanderLog = [];
  return {
    actions: {
      getPos: id => npcPositions[id] || { x: 0, y: 0, z: 0, u: 5, v: 5 },
      setPos: (id, x, y, z, u, v) => { setPosLog.push({ id, u, v }); if (npcPositions[id]) { npcPositions[id].u = u; npcPositions[id].v = v; } },
      wanderStep: (id, h, spd, dt) => { wanderLog.push({ id, h }); return wanderResult; },
      clampToArena: () => {},
      toRenderPos: id => { const p = npcPositions[id] || { u: 5, v: 5 }; return { x: p.u, y: 0, z: p.v }; },
    },
    setPosLog,
    wanderLog,
  };
}

const BASE = { nowMs: 10000, heroU: 0, heroV: 0, dialogOpen: false, lastHeroShotT: 0 }; // nowSec=10, shot 10s ago

describe("npc_move_tick — flee trigger", () => {
  it("sets _fleeT when gunshot within 8m", () => {
    const n = makeNpc("npc1", { u: 3, v: 3 }); // dist=hypot(3,3)≈4.2 < 8
    const m = makeMesh();
    const npcMeshes = new Map([["npc1", m]]);
    const { actions } = makeActions({ npcPositions: { npc1: { x: 0, y: 0, z: 0, u: 3, v: 3 } } });
    mountNpcMoveTick({ actions }).tick(0.016, {
      ...BASE, nowMs: 1000, lastHeroShotT: 0.95, // nowSec=1.0, shot 50ms ago < 120ms
      npcDefs: [n], npcMeshes,
    });
    expect(n._fleeT).toBeCloseTo(2.5 - 0.016); // set to 2.5, then 1 frame decrement
  });

  it("no flee trigger when gunshot > 120ms ago", () => {
    const n = makeNpc("npc1", { u: 3, v: 3 });
    const m = makeMesh();
    const { actions } = makeActions({ npcPositions: { npc1: { x: 0, y: 0, z: 0, u: 3, v: 3 } } });
    mountNpcMoveTick({ actions }).tick(0.016, {
      ...BASE, nowMs: 1000, lastHeroShotT: 0, // nowSec=1.0, shot 1s ago > 120ms
      npcDefs: [n], npcMeshes: new Map([["npc1", m]]),
    });
    expect(n._fleeT).toBe(0); // unchanged
  });

  it("no flee trigger when npc beyond 8m", () => {
    const n = makeNpc("npc1");
    const m = makeMesh();
    const { actions } = makeActions({ npcPositions: { npc1: { x: 0, y: 0, z: 0, u: 10, v: 10 } } }); // dist>8
    mountNpcMoveTick({ actions }).tick(0.016, {
      ...BASE, nowMs: 1000, lastHeroShotT: 0.95,
      npcDefs: [n], npcMeshes: new Map([["npc1", m]]),
    });
    expect(n._fleeT).toBe(0);
  });
});

describe("npc_move_tick — flee movement", () => {
  it("while fleeing → setPos called (NPC moves)", () => {
    const n = makeNpc("npc1", { fleeT: 0.5, fleeAng: 0 }); // fleeAng=0 → north
    const m = makeMesh();
    const { actions, setPosLog } = makeActions({ npcPositions: { npc1: { x: 0, y: 0, z: 0, u: 5, v: 5 } } });
    mountNpcMoveTick({ actions }).tick(0.016, { ...BASE, npcDefs: [n], npcMeshes: new Map([["npc1", m]]) });
    expect(setPosLog.length).toBe(1);
    expect(setPosLog[0].id).toBe("npc1");
  });

  it("while fleeing → _fleeT decremented by dt", () => {
    const n = makeNpc("npc1", { fleeT: 0.5 });
    const m = makeMesh();
    const { actions } = makeActions({ npcPositions: { npc1: { x: 0, y: 0, z: 0, u: 5, v: 5 } } });
    mountNpcMoveTick({ actions }).tick(0.016, { ...BASE, npcDefs: [n], npcMeshes: new Map([["npc1", m]]) });
    expect(n._fleeT).toBeCloseTo(0.484);
  });

  it("while fleeing → wanderStep not called", () => {
    const n = makeNpc("npc1", { fleeT: 0.5 });
    const m = makeMesh();
    const { actions, wanderLog } = makeActions({ npcPositions: { npc1: { x: 0, y: 0, z: 0, u: 5, v: 5 } } });
    mountNpcMoveTick({ actions }).tick(0.016, { ...BASE, npcDefs: [n], npcMeshes: new Map([["npc1", m]]) });
    expect(wanderLog.length).toBe(0);
  });
});

describe("npc_move_tick — wander", () => {
  it("not fleeing + dialogOpen=false → wanderStep called", () => {
    const n = makeNpc("npc1", { fleeT: 0 });
    const m = makeMesh();
    const { actions, wanderLog } = makeActions({ npcPositions: { npc1: { x: 0, y: 0, z: 0, u: 5, v: 5 } } });
    mountNpcMoveTick({ actions }).tick(0.016, { ...BASE, npcDefs: [n], npcMeshes: new Map([["npc1", m]]) });
    expect(wanderLog.length).toBe(1);
  });

  it("dialogOpen=true → wanderStep not called", () => {
    const n = makeNpc("npc1", { fleeT: 0 });
    const m = makeMesh();
    const { actions, wanderLog } = makeActions({ npcPositions: { npc1: { x: 0, y: 0, z: 0, u: 5, v: 5 } } });
    mountNpcMoveTick({ actions }).tick(0.016, { ...BASE, dialogOpen: true, npcDefs: [n], npcMeshes: new Map([["npc1", m]]) });
    expect(wanderLog.length).toBe(0);
  });

  it("wanderStep result sets mesh.heading", () => {
    const n = makeNpc("npc1");
    const m = makeMesh({ heading: 0 });
    const { actions } = makeActions({ npcPositions: { npc1: { x: 0, y: 0, z: 0, u: 5, v: 5 } }, wanderResult: 1.23 });
    mountNpcMoveTick({ actions }).tick(0.016, { ...BASE, npcDefs: [n], npcMeshes: new Map([["npc1", m]]) });
    expect(m.heading).toBeCloseTo(1.23);
  });
});

describe("npc_move_tick — ring glow", () => {
  it("close hero → ring opacity springs toward > 0", () => {
    const n = makeNpc("npc1");
    const m = makeMesh({ hasRing: true });
    const { actions } = makeActions({ npcPositions: { npc1: { x: 0, y: 0, z: 0, u: 1, v: 1 } } }); // dist ~1.4 < 2.5
    mountNpcMoveTick({ actions }).tick(0.016, { ...BASE, heroU: 0, heroV: 0, npcDefs: [n], npcMeshes: new Map([["npc1", m]]) });
    expect(m.ring.material.opacity).toBeGreaterThan(0);
  });

  it("far hero → ring opacity springs toward 0", () => {
    const n = makeNpc("npc1");
    const m = makeMesh({ hasRing: true });
    m.ring.material.opacity = 0.5;
    const { actions } = makeActions({ npcPositions: { npc1: { x: 0, y: 0, z: 0, u: 10, v: 10 } } }); // dist ~14 > 2.5
    mountNpcMoveTick({ actions }).tick(0.016, { ...BASE, heroU: 0, heroV: 0, npcDefs: [n], npcMeshes: new Map([["npc1", m]]) });
    expect(m.ring.material.opacity).toBeLessThan(0.5);
  });
});

describe("npc_move_tick — mesh update", () => {
  it("group.rotation.y set to mesh.heading each tick", () => {
    const n = makeNpc("npc1", { fleeT: 0 });
    const m = makeMesh({ heading: 1.5 });
    const { actions } = makeActions({ npcPositions: { npc1: { x: 0, y: 0, z: 0, u: 5, v: 5 } }, wanderResult: 1.5 });
    mountNpcMoveTick({ actions }).tick(0.016, { ...BASE, npcDefs: [n], npcMeshes: new Map([["npc1", m]]) });
    expect(m.group.rotation.y).toBeCloseTo(1.5);
  });
});

describe("npc_move_tick — fuzz", () => {
  it("never throws for 20 random states", () => {
    for (let i = 0; i < 20; i++) {
      const n = makeNpc("npc1", { fleeT: Math.random(), fleeAng: Math.random() * Math.PI * 2 });
      const m = makeMesh({ hasRing: Math.random() > 0.5 });
      if (m.ring) m.ring.material.opacity = Math.random();
      const { actions } = makeActions({ npcPositions: { npc1: { x: 0, y: 0, z: 0, u: Math.random() * 10, v: Math.random() * 10 } } });
      expect(() => mountNpcMoveTick({ actions }).tick(0.016, {
        nowMs: Math.random() * 60000, heroU: Math.random() * 5, heroV: Math.random() * 5,
        npcDefs: [n], npcMeshes: new Map([["npc1", m]]),
        dialogOpen: Math.random() > 0.5, lastHeroShotT: Math.random() * 60,
      })).not.toThrow();
    }
  });
});
