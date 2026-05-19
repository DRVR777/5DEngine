import { it, expect, describe } from "vitest";
import { mountFreecamTick } from "../../src/systems/freecam_tick.js";

function makeFreecam({ yaw = 0, pitch = 0 } = {}) {
  const pos = { x: 0, y: 0, z: 0 };
  const get = { yaw: () => yaw, pitch: () => pitch };
  const actions = {
    move:  (dx, dy, dz) => { pos.x += dx; pos.y += dy; pos.z += dz; },
    moveY: (dy)         => { pos.y += dy; },
  };
  const { tick } = mountFreecamTick({ get, actions });
  return { pos, tick };
}

const SPD = 10, SPD_FAST = 25;
const BASE = { buildMode: true, speed: SPD, speedFast: SPD_FAST, keys: {} };

describe("freecam_tick — buildMode guard", () => {
  it("buildMode=false → no movement", () => {
    const { pos, tick } = makeFreecam();
    tick(0.016, { ...BASE, buildMode: false, keys: { KeyW: true } });
    expect(pos.x).toBe(0);
    expect(pos.y).toBe(0);
    expect(pos.z).toBe(0);
  });
});

describe("freecam_tick — forward/backward (yaw=0 → fwd is +Z)", () => {
  it("KeyW → positive Z movement at yaw=0, pitch=0", () => {
    const { pos, tick } = makeFreecam({ yaw: 0, pitch: 0 });
    tick(0.016, { ...BASE, keys: { KeyW: true } });
    expect(pos.z).toBeCloseTo(SPD * 0.016);
    expect(pos.x).toBeCloseTo(0);
    expect(pos.y).toBeCloseTo(0);
  });

  it("KeyS → negative Z movement at yaw=0, pitch=0", () => {
    const { pos, tick } = makeFreecam({ yaw: 0, pitch: 0 });
    tick(0.016, { ...BASE, keys: { KeyS: true } });
    expect(pos.z).toBeCloseTo(-SPD * 0.016);
  });

  it("KeyW with pitch → moves along Y axis (looking up/down)", () => {
    const pitch = Math.PI / 4; // 45° up
    const { pos, tick } = makeFreecam({ yaw: 0, pitch });
    tick(0.016, { ...BASE, keys: { KeyW: true } });
    expect(pos.y).toBeGreaterThan(0); // sin(45°) > 0
    expect(pos.z).toBeGreaterThan(0); // cos(45°) * cos(45°) > 0
  });
});

describe("freecam_tick — strafe (yaw=0 → right is -X)", () => {
  it("KeyD → positive X at yaw=0", () => {
    const { pos, tick } = makeFreecam({ yaw: 0 });
    tick(0.016, { ...BASE, keys: { KeyD: true } });
    expect(pos.x).toBeCloseTo(SPD * 0.016);
    expect(pos.y).toBeCloseTo(0);
  });

  it("KeyA → negative X at yaw=0", () => {
    const { pos, tick } = makeFreecam({ yaw: 0 });
    tick(0.016, { ...BASE, keys: { KeyA: true } });
    expect(pos.x).toBeCloseTo(-SPD * 0.016);
  });

  it("strafe keys do not move Y", () => {
    const { pos, tick } = makeFreecam({ pitch: 0.5 }); // some pitch
    tick(0.016, { ...BASE, keys: { KeyD: true } });
    expect(pos.y).toBeCloseTo(0);
  });
});

describe("freecam_tick — vertical (Space/C)", () => {
  it("Space → positive Y", () => {
    const { pos, tick } = makeFreecam();
    tick(0.016, { ...BASE, keys: { Space: true } });
    expect(pos.y).toBeCloseTo(SPD * 0.016);
  });

  it("KeyC → negative Y", () => {
    const { pos, tick } = makeFreecam();
    tick(0.016, { ...BASE, keys: { KeyC: true } });
    expect(pos.y).toBeCloseTo(-SPD * 0.016);
  });
});

describe("freecam_tick — sprint multiplier", () => {
  it("ShiftLeft → uses speedFast instead of speed", () => {
    const { pos, tick } = makeFreecam({ yaw: 0, pitch: 0 });
    tick(0.016, { ...BASE, keys: { KeyW: true, ShiftLeft: true } });
    expect(pos.z).toBeCloseTo(SPD_FAST * 0.016);
  });

  it("no ShiftLeft → uses normal speed", () => {
    const { pos, tick } = makeFreecam({ yaw: 0, pitch: 0 });
    tick(0.016, { ...BASE, keys: { KeyW: true } });
    expect(pos.z).toBeCloseTo(SPD * 0.016);
  });
});

describe("freecam_tick — fuzz", () => {
  it("never throws for 25 random inputs", () => {
    const allKeys = ["KeyW", "KeyS", "KeyA", "KeyD", "Space", "KeyC", "ShiftLeft"];
    for (let i = 0; i < 25; i++) {
      const { tick } = makeFreecam({ yaw: (Math.random() - 0.5) * Math.PI * 2, pitch: (Math.random() - 0.5) * Math.PI });
      const keys = {};
      for (const k of allKeys) if (Math.random() > 0.6) keys[k] = true;
      expect(() => tick(Math.random() * 0.05, { buildMode: Math.random() > 0.3, speed: 10, speedFast: 25, keys })).not.toThrow();
    }
  });
});
