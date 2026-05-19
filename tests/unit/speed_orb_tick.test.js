import { it, expect, describe } from "vitest";
import { mountSpeedOrbTick } from "../../src/systems/speed_orb_tick.js";

function makeMesh(u = 0, v = 0) {
  return {
    rotation: { y: 0 },
    position: { x: u, y: 0.7, z: v },
    material: { emissiveIntensity: 0.7 },
  };
}

function makeOrb(id, { u = 5, v = 5 } = {}) {
  return { id, u, v, collected: false, mesh: makeMesh(u, v) };
}

function makeState() {
  let boostT = 0;
  const sfx = [], toasts = [], particles = [], removed = [];
  return {
    set: { speedBoostT: v => { boostT = v; } },
    actions: {
      removeMesh: mesh => removed.push(mesh),
      spawnParticles: (u, y, v, n, col, spd, size) => particles.push({ u, y, v, n, col }),
      playSfx: (str, vol) => sfx.push({ str, vol }),
      showToast: (msg, type, dur) => toasts.push({ msg, type, dur }),
    },
    getBoostT: () => boostT,
    sfx, toasts, particles, removed,
  };
}

const BASE = { heroU: 0, heroV: 0, nowMs: 1000, heroDead: false };

describe("speed_orb_tick — collection", () => {
  it("orb within 1.2m + alive → marked collected, gone after next tick", () => {
    const pickups = [makeOrb("o1", { u: 0.5, v: 0 })];
    const { set, actions } = makeState();
    const sys = mountSpeedOrbTick({ set, actions });
    sys.tick(0.016, { ...BASE, pickups });
    expect(pickups[0].collected).toBe(true);
    sys.tick(0.016, { ...BASE, pickups });
    expect(pickups.length).toBe(0);
  });

  it("collection → speedBoostT set to 4.0", () => {
    const pickups = [makeOrb("o1", { u: 0.5, v: 0 })];
    const { set, actions, getBoostT } = makeState();
    mountSpeedOrbTick({ set, actions }).tick(0.016, { ...BASE, pickups });
    expect(getBoostT()).toBe(4.0);
  });

  it("collection → spawnParticles called with yellow", () => {
    const pickups = [makeOrb("o1", { u: 0.5, v: 0 })];
    const { set, actions, particles } = makeState();
    mountSpeedOrbTick({ set, actions }).tick(0.016, { ...BASE, pickups });
    expect(particles.length).toBe(1);
    expect(particles[0].col).toBe("yellow");
  });

  it("collection → two sfx calls", () => {
    const pickups = [makeOrb("o1", { u: 0.5, v: 0 })];
    const { set, actions, sfx } = makeState();
    mountSpeedOrbTick({ set, actions }).tick(0.016, { ...BASE, pickups });
    expect(sfx.length).toBe(2);
    expect(sfx[0].str).toContain("1400");
    expect(sfx[1].str).toContain("1800");
  });

  it("collection → showToast with SPEED BOOST", () => {
    const pickups = [makeOrb("o1", { u: 0.5, v: 0 })];
    const { set, actions, toasts } = makeState();
    mountSpeedOrbTick({ set, actions }).tick(0.016, { ...BASE, pickups });
    expect(toasts[0].msg).toContain("SPEED BOOST");
    expect(toasts[0].type).toBe("warning");
  });

  it("orb.collected=true → spliced without pickup effects", () => {
    const orb = makeOrb("o1", { u: 0.5, v: 0 });
    orb.collected = true;
    const pickups = [orb];
    const { set, actions, sfx } = makeState();
    mountSpeedOrbTick({ set, actions }).tick(0.016, { ...BASE, pickups });
    expect(pickups.length).toBe(0);
    expect(sfx.length).toBe(0);
  });

  it("orb within range but heroDead → not collected", () => {
    const pickups = [makeOrb("o1", { u: 0.5, v: 0 })];
    const { set, actions, sfx } = makeState();
    mountSpeedOrbTick({ set, actions }).tick(0.016, { ...BASE, heroDead: true, pickups });
    expect(pickups.length).toBe(1);
    expect(sfx.length).toBe(0);
  });

  it("orb beyond range → not collected", () => {
    const pickups = [makeOrb("o1", { u: 5, v: 5 })];
    const { set, actions } = makeState();
    mountSpeedOrbTick({ set, actions }).tick(0.016, { ...BASE, pickups });
    expect(pickups.length).toBe(1);
  });
});

describe("speed_orb_tick — animation", () => {
  it("distant orb → rotation.y increases", () => {
    const orb = makeOrb("o1", { u: 5, v: 5 });
    const { set, actions } = makeState();
    mountSpeedOrbTick({ set, actions }).tick(0.016, { ...BASE, pickups: [orb] });
    expect(orb.mesh.rotation.y).toBeGreaterThan(0);
  });

  it("distant orb → position.y bobs (u=0 so sin offset=0)", () => {
    const orb = makeOrb("o1", { u: 5, v: 5 });
    const { set, actions } = makeState();
    mountSpeedOrbTick({ set, actions }).tick(0.016, { heroU: 0, heroV: 0, nowMs: 0, heroDead: false, pickups: [orb] });
    const expected = 0.7 + 0.18 * Math.sin(0 / 280 + orb.u);
    expect(orb.mesh.position.y).toBeCloseTo(expected);
  });

  it("distant orb → emissiveIntensity updated", () => {
    const orb = makeOrb("o1", { u: 5, v: 5 });
    const { set, actions } = makeState();
    mountSpeedOrbTick({ set, actions }).tick(0.016, { ...BASE, nowMs: 0, pickups: [orb] });
    expect(orb.mesh.material.emissiveIntensity).toBeCloseTo(0.7 + 0.3 * Math.sin(0));
  });
});

describe("speed_orb_tick — fuzz", () => {
  it("never throws for 20 random states", () => {
    for (let i = 0; i < 20; i++) {
      const pickups = Array.from({ length: Math.floor(Math.random() * 5) }, (_, j) => {
        const orb = makeOrb(`o${j}`, { u: (Math.random() - 0.5) * 10, v: (Math.random() - 0.5) * 10 });
        orb.collected = Math.random() < 0.3;
        return orb;
      });
      const { set, actions } = makeState();
      expect(() =>
        mountSpeedOrbTick({ set, actions }).tick(0.016, {
          heroU: Math.random() * 5, heroV: Math.random() * 5,
          nowMs: Math.random() * 60000, heroDead: Math.random() < 0.2, pickups,
        })
      ).not.toThrow();
    }
  });
});
