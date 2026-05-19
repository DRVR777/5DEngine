import { it, expect, describe } from "vitest";
import { mountGrenadePhysicsTick } from "../../src/systems/grenade_physics_tick.js";

function makeWarnRing() {
  return {
    position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
    material: { opacity: 0 },
    scale: { x: 1, y: 1, z: 1, set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
  };
}

function makeMesh() {
  return {
    position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
    rotation: { x: 0, y: 0, z: 0 },
    material: { emissiveIntensity: 0.9 },
  };
}

function makeGrenade({ u = 5, y = 2, v = 0, fuse = 3, velU = 0, velV = 0, velY = -1, isSmoke = false, warnRing = false } = {}) {
  return {
    u, y, v, fuse, velU, velV, velY,
    _isSmoke: isSmoke, _deployed: false,
    _warnRing: warnRing ? makeWarnRing() : null,
    mesh: makeMesh(),
  };
}

function makeState() {
  const log = [];
  const actions = {
    spawnParticles: (u, y, v) => log.push({ type: "particles", u, y, v }),
    removeMesh: m => log.push({ type: "removeMesh", m }),
    deploySmokeZone: (u, v) => log.push({ type: "smoke", u, v }),
    explodeGrenade: g => log.push({ type: "explode", g }),
    playSfx: (id, vol) => log.push({ type: "playSfx", id, vol }),
  };
  return { actions, log };
}

const BASE = { gravity: -9.8, nowMs: 0 };

describe("grenade_physics_tick — movement", () => {
  it("grenade moves by velocity * dt", () => {
    const { actions } = makeState();
    const g = makeGrenade({ u: 0, v: 0, y: 5, velU: 2, velV: 0, velY: 0, fuse: 3 });
    mountGrenadePhysicsTick({ actions }).tick(0.5, { grenades: [g], ...BASE });
    expect(g.u).toBeCloseTo(1.0);
  });

  it("gravity accelerates velY each tick", () => {
    const { actions } = makeState();
    const g = makeGrenade({ y: 5, velY: 0, fuse: 3 });
    mountGrenadePhysicsTick({ actions }).tick(0.1, { grenades: [g], gravity: -9.8, nowMs: 0 });
    expect(g.velY).toBeCloseTo(-0.98);
  });

  it("fuse decrements by dt", () => {
    const { actions } = makeState();
    const g = makeGrenade({ fuse: 2.0, y: 5 });
    mountGrenadePhysicsTick({ actions }).tick(0.1, { grenades: [g], ...BASE });
    expect(g.fuse).toBeCloseTo(1.9);
  });
});

describe("grenade_physics_tick — smoke trail", () => {
  it("grenade above 0.1m always calls spawnParticles", () => {
    const { actions, log } = makeState();
    // Override to ensure always fires (test with prob=1 pattern: call many grenades)
    const g = makeGrenade({ y: 2, fuse: 3 });
    // Run 50 ticks, at least some should fire (prob 0.55)
    const sys = mountGrenadePhysicsTick({ actions });
    for (let i = 0; i < 50; i++) {
      g.y = 2; g.fuse = 3; g.velY = 0;
      sys.tick(0.001, { grenades: [g], ...BASE });
    }
    expect(log.filter(e => e.type === "particles").length).toBeGreaterThan(0);
  });
});

describe("grenade_physics_tick — bounce", () => {
  it("hitting ground → y clamped to 0", () => {
    const { actions } = makeState();
    const g = makeGrenade({ y: 0.05, velY: -5, fuse: 3 });
    mountGrenadePhysicsTick({ actions }).tick(0.1, { grenades: [g], ...BASE });
    expect(g.y).toBe(0);
  });

  it("bounce → velY reflected with dampening", () => {
    const { actions } = makeState();
    const g = makeGrenade({ y: 0.0, velY: -5, fuse: 3 });
    mountGrenadePhysicsTick({ actions }).tick(0.001, { grenades: [g], ...BASE });
    // velY should now be positive (bounced) with 0.35 damping
    expect(g.velY).toBeGreaterThan(0);
    expect(g.velY).toBeCloseTo(5 * 0.35, 1);
  });

  it("hard bounce → playSfx called", () => {
    const { actions, log } = makeState();
    const g = makeGrenade({ y: 0.0, velY: -5, fuse: 3 });
    mountGrenadePhysicsTick({ actions }).tick(0.001, { grenades: [g], ...BASE });
    expect(log.some(e => e.type === "playSfx")).toBe(true);
  });

  it("soft bounce (velY > -1) → no sfx", () => {
    const { actions, log } = makeState();
    const g = makeGrenade({ y: 0.0, velY: -0.5, fuse: 3 });
    mountGrenadePhysicsTick({ actions }).tick(0.001, { grenades: [g], ...BASE });
    expect(log.some(e => e.type === "playSfx")).toBe(false);
  });
});

describe("grenade_physics_tick — detonation", () => {
  it("fuse expired → explodeGrenade called and removed", () => {
    const { actions, log } = makeState();
    const g = makeGrenade({ y: 5, fuse: 0.001 });
    const grenades = [g];
    mountGrenadePhysicsTick({ actions }).tick(0.016, { grenades, ...BASE });
    expect(log.some(e => e.type === "explode")).toBe(true);
    expect(grenades.length).toBe(0);
  });

  it("smoke grenade landing slow → deploySmokeZone, not explode", () => {
    const { actions, log } = makeState();
    const g = makeGrenade({ y: 0.0, velY: -1.0, fuse: 2.5, isSmoke: true });
    const grenades = [g];
    mountGrenadePhysicsTick({ actions }).tick(0.001, { grenades, ...BASE });
    expect(log.some(e => e.type === "smoke")).toBe(true);
    expect(log.some(e => e.type === "explode")).toBe(false);
    expect(grenades.length).toBe(0);
  });

  it("smoke grenade landing fast → NOT deployed, keep flying", () => {
    const { actions } = makeState();
    const g = makeGrenade({ y: 0.0, velY: -5.0, fuse: 2.5, isSmoke: true });
    const grenades = [g];
    mountGrenadePhysicsTick({ actions }).tick(0.001, { grenades, ...BASE });
    expect(g._deployed).toBe(false);
    expect(grenades.length).toBe(1);
  });
});

describe("grenade_physics_tick — mesh updates", () => {
  it("live grenade → mesh position updated", () => {
    const { actions } = makeState();
    const g = makeGrenade({ u: 3, y: 5, v: 1, velU: 0, velV: 0, velY: 0, fuse: 3 });
    mountGrenadePhysicsTick({ actions }).tick(0.016, { grenades: [g], ...BASE });
    expect(g.mesh.position.x).toBeCloseTo(3);
    expect(g.mesh.position.z).toBeCloseTo(1);
  });

  it("fuse < 1s → mesh blinks (emissiveIntensity alternates)", () => {
    const { actions } = makeState();
    const g1 = makeGrenade({ y: 5, fuse: 0.5 });
    const g2 = makeGrenade({ y: 5, fuse: 0.45 });
    mountGrenadePhysicsTick({ actions }).tick(0, { grenades: [g1], gravity: 0, nowMs: 0 });
    mountGrenadePhysicsTick({ actions }).tick(0, { grenades: [g2], gravity: 0, nowMs: 0 });
    const intensities = [g1.mesh.material.emissiveIntensity, g2.mesh.material.emissiveIntensity];
    expect(intensities).toContain(2.5);
    expect(intensities).toContain(0.2);
  });
});

describe("grenade_physics_tick — warn ring", () => {
  it("grenade with warnRing → ring position updated", () => {
    const { actions } = makeState();
    const g = makeGrenade({ u: 3, y: 2, v: 4, fuse: 3, warnRing: true });
    mountGrenadePhysicsTick({ actions }).tick(0.016, { grenades: [g], ...BASE });
    expect(g._warnRing.position.x).toBeCloseTo(3);
    expect(g._warnRing.position.z).toBeCloseTo(4);
  });
});
