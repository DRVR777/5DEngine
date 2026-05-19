import { it, expect, describe } from "vitest";
import { mountLegacyPickupTick } from "../../src/systems/legacy_pickup_tick.js";

function makeMesh(u = 0) {
  return { position: { y: 1.0 }, rotation: { y: 0 }, u };
}

function makePickup(id, { u = 5, collected = false } = {}) {
  const mesh = makeMesh(u);
  return { id, u, collected, _mesh: mesh };
}

function makeState({ collectResult = null } = {}) {
  const collected = [], meshMap = new Map();
  return {
    actions: {
      collectPickup: () => collectResult,
      getMesh: id => meshMap.get(id) || null,
      onCollected: id => collected.push(id),
    },
    registerMesh: (id, mesh) => meshMap.set(id, mesh),
    collected,
  };
}

const BASE = { nowMs: 1000 };

describe("legacy_pickup_tick — collection", () => {
  it("collectPickup returns id → onCollected called", () => {
    const { actions, collected } = makeState({ collectResult: "pk_1" });
    const pickups = [makePickup("pk_1")];
    mountLegacyPickupTick({ actions }).tick(0.016, { ...BASE, pickups });
    expect(collected).toContain("pk_1");
  });

  it("collectPickup returns null → onCollected not called", () => {
    const { actions, collected } = makeState({ collectResult: null });
    const pickups = [makePickup("pk_1")];
    mountLegacyPickupTick({ actions }).tick(0.016, { ...BASE, pickups });
    expect(collected.length).toBe(0);
  });
});

describe("legacy_pickup_tick — animation", () => {
  it("uncollected pickup → rotation.y increases", () => {
    const { actions, registerMesh } = makeState();
    const pk = makePickup("pk_1", { u: 0 });
    registerMesh("pk_1", pk._mesh);
    mountLegacyPickupTick({ actions }).tick(0.1, { ...BASE, pickups: [pk] });
    expect(pk._mesh.rotation.y).toBeGreaterThan(0);
  });

  it("uncollected pickup → position.y bobs (u=0, nowMs=0 → sin=0 → 1.0)", () => {
    const { actions, registerMesh } = makeState();
    const pk = makePickup("pk_1", { u: 0 });
    registerMesh("pk_1", pk._mesh);
    mountLegacyPickupTick({ actions }).tick(0.016, { nowMs: 0, pickups: [pk] });
    expect(pk._mesh.position.y).toBeCloseTo(1.0);
  });

  it("collected pickup → not animated", () => {
    const { actions, registerMesh } = makeState();
    const pk = makePickup("pk_1", { u: 0, collected: true });
    registerMesh("pk_1", pk._mesh);
    mountLegacyPickupTick({ actions }).tick(0.1, { ...BASE, pickups: [pk] });
    expect(pk._mesh.rotation.y).toBe(0);
  });

  it("pickup with no mesh → does not throw", () => {
    const { actions } = makeState();
    const pk = makePickup("pk_1");
    expect(() =>
      mountLegacyPickupTick({ actions }).tick(0.016, { ...BASE, pickups: [pk] })
    ).not.toThrow();
  });
});

describe("legacy_pickup_tick — fuzz", () => {
  it("never throws for 20 random states", () => {
    for (let i = 0; i < 20; i++) {
      const pickups = Array.from({ length: Math.floor(Math.random() * 5) }, (_, j) =>
        makePickup(`pk_${j}`, { u: (Math.random()-0.5)*10, collected: Math.random() < 0.3 })
      );
      const state = makeState({ collectResult: Math.random() < 0.3 ? pickups[0]?.id || null : null });
      pickups.forEach(pk => state.registerMesh(pk.id, pk._mesh));
      expect(() =>
        mountLegacyPickupTick({ actions: state.actions }).tick(0.016, {
          nowMs: Math.random() * 60000, pickups,
        })
      ).not.toThrow();
    }
  });
});
