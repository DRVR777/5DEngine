import { it, expect, describe, vi } from "vitest";
import { mountFootstepSound } from "../../src/systems/footstep_sound.js";

function makeFootstep({ footstepT = 0 } = {}) {
  const s = { footstepT };
  const sfxLog = [];
  const get = { footstepT: () => s.footstepT };
  const set = { footstepT: v => { s.footstepT = v; } };
  const actions = { playSfx: (t, v) => sfxLog.push({ t, v }) };
  const { tick } = mountFootstepSound({ get, set, actions });
  return { s, sfxLog, tick };
}

const ACTIVE = { isMoving: true, heroDead: false, pointerLocked: true, canSprint: false, crouching: false };

describe("footstep_sound no-op conditions", () => {
  it("resets footstepT to 0 when not moving", () => {
    const { s, sfxLog, tick } = makeFootstep({ footstepT: 0.2 });
    tick(0.1, { ...ACTIVE, isMoving: false });
    expect(s.footstepT).toBe(0);
    expect(sfxLog).toHaveLength(0);
  });

  it("resets footstepT to 0 when heroDead", () => {
    const { s, sfxLog, tick } = makeFootstep({ footstepT: 0.2 });
    tick(0.1, { ...ACTIVE, heroDead: true });
    expect(s.footstepT).toBe(0);
    expect(sfxLog).toHaveLength(0);
  });

  it("resets footstepT to 0 when pointer not locked", () => {
    const { s, sfxLog, tick } = makeFootstep({ footstepT: 0.2 });
    tick(0.1, { ...ACTIVE, pointerLocked: false });
    expect(s.footstepT).toBe(0);
    expect(sfxLog).toHaveLength(0);
  });
});

describe("footstep_sound timer decrement", () => {
  it("decrements footstepT while active and above 0", () => {
    const { s, sfxLog, tick } = makeFootstep({ footstepT: 0.5 });
    tick(0.1, ACTIVE);
    expect(s.footstepT).toBeCloseTo(0.4);
    expect(sfxLog).toHaveLength(0);
  });

  it("fires sfx and resets timer when footstepT crosses 0 (walk interval)", () => {
    const { s, sfxLog, tick } = makeFootstep({ footstepT: 0.05 });
    tick(0.1, ACTIVE); // 0.05 - 0.1 = -0.05 → fires
    expect(sfxLog).toHaveLength(1);
    expect(sfxLog[0].t).toMatch(/^tone:\d+:30:triangle$/);
    expect(sfxLog[0].v).toBe(0.08);
    expect(s.footstepT).toBeGreaterThan(0);
  });
});

describe("footstep_sound intervals", () => {
  it("uses sprint interval (0.26) when canSprint", () => {
    const { s, tick } = makeFootstep({ footstepT: 0.05 });
    tick(0.1, { ...ACTIVE, canSprint: true });
    expect(s.footstepT).toBeCloseTo(0.26);
  });

  it("uses walk interval (0.38) when not sprinting and not crouching", () => {
    const { s, tick } = makeFootstep({ footstepT: 0.05 });
    tick(0.1, { ...ACTIVE, canSprint: false, crouching: false });
    expect(s.footstepT).toBeCloseTo(0.38);
  });

  it("uses crouch interval (0.55) when crouching and not sprinting", () => {
    const { s, tick } = makeFootstep({ footstepT: 0.05 });
    tick(0.1, { ...ACTIVE, canSprint: false, crouching: true });
    expect(s.footstepT).toBeCloseTo(0.55);
  });

  it("sprint takes priority over crouch", () => {
    const { s, tick } = makeFootstep({ footstepT: 0.05 });
    tick(0.1, { ...ACTIVE, canSprint: true, crouching: true });
    expect(s.footstepT).toBeCloseTo(0.26);
  });
});

describe("footstep_sound sfx frequency", () => {
  it("sfx frequency is in range [80, 120] (rounded)", () => {
    for (let i = 0; i < 20; i++) {
      const { sfxLog, tick } = makeFootstep({ footstepT: 0.05 });
      tick(0.1, ACTIVE);
      const match = sfxLog[0].t.match(/^tone:(\d+):/);
      const freq = parseInt(match[1], 10);
      expect(freq).toBeGreaterThanOrEqual(80);
      expect(freq).toBeLessThanOrEqual(120);
    }
  });
});
