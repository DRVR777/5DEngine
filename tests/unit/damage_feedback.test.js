import { it, expect, describe } from "vitest";
import { mountDamageFeedback } from "../../src/systems/damage_feedback.js";

function makeState({ heroHp = 100, nearDeathFired = false, bulletTimeLeft = 0,
                     hitPunchPitch = 0, camShakeAmt = 0 } = {}) {
  const s = { waveChallengeNoDmg: true, vignetteAmt: 0, nearDeathFired,
              bulletTimeLeft, hitPunchPitch, camShakeAmt, heroHp };
  const sfxLog = [], toastLog = [];
  const get = {
    heroHp:         () => s.heroHp,
    nearDeathFired: () => s.nearDeathFired,
    bulletTimeLeft: () => s.bulletTimeLeft,
    hitPunchPitch:  () => s.hitPunchPitch,
    camShakeAmt:    () => s.camShakeAmt,
  };
  const set = {
    waveChallengeNoDmg: (v) => { s.waveChallengeNoDmg = v; },
    vignetteAmt:        (v) => { s.vignetteAmt = v; },
    nearDeathFired:     (v) => { s.nearDeathFired = v; },
    bulletTimeLeft:     (v) => { s.bulletTimeLeft = v; },
    hitPunchPitch:      (v) => { s.hitPunchPitch = v; },
    camShakeAmt:        (v) => { s.camShakeAmt = v; },
  };
  const actions = {
    playSfx:   (t, v) => sfxLog.push(t),
    showToast: (msg, type) => toastLog.push(msg),
  };
  const sys = mountDamageFeedback({ get, set, actions });
  return { s, sfxLog, toastLog, ...sys };
}

describe("flashDamage", () => {
  it("sets vignetteAmt to 1.0 and waveChallengeNoDmg to false", () => {
    const { s, flashDamage } = makeState();
    flashDamage();
    expect(s.vignetteAmt).toBe(1.0);
    expect(s.waveChallengeNoDmg).toBe(false);
  });

  it("plays the pain-grunt sfx", () => {
    const { sfxLog, flashDamage } = makeState();
    flashDamage();
    expect(sfxLog).toContain("tone:90:35:sawtooth");
  });

  it("increases hitPunchPitch by at least 0.05", () => {
    const { s, flashDamage } = makeState({ hitPunchPitch: 0 });
    flashDamage();
    expect(s.hitPunchPitch).toBeGreaterThanOrEqual(0.05);
    expect(s.hitPunchPitch).toBeLessThanOrEqual(0.12);
  });

  it("does NOT fire near-death reflex when heroHp > 10", () => {
    const { s, sfxLog, toastLog, flashDamage } = makeState({ heroHp: 50 });
    flashDamage();
    expect(s.nearDeathFired).toBe(false);
    expect(s.bulletTimeLeft).toBe(0);
    expect(toastLog).toHaveLength(0);
  });

  it("fires near-death reflex (bulletTime + toast + sfx) when heroHp <= 10", () => {
    const { s, sfxLog, toastLog, flashDamage } = makeState({ heroHp: 8 });
    flashDamage();
    expect(s.nearDeathFired).toBe(true);
    expect(s.bulletTimeLeft).toBeGreaterThanOrEqual(0.45);
    expect(toastLog).toContain("CRITICAL!");
    expect(sfxLog).toContain("tone:60:200:sine");
    expect(sfxLog).toContain("tone:80:180:sine");
  });

  it("does NOT re-fire near-death reflex if already triggered", () => {
    const { s, toastLog, flashDamage } = makeState({ heroHp: 5, nearDeathFired: true });
    flashDamage();
    expect(toastLog).toHaveLength(0);
    expect(s.bulletTimeLeft).toBe(0);
  });

  it("does not fire near-death reflex when heroHp === 0 (already dead)", () => {
    const { s, toastLog, flashDamage } = makeState({ heroHp: 0 });
    flashDamage();
    expect(toastLog).toHaveLength(0);
    expect(s.nearDeathFired).toBe(false);
  });

  it("bulletTimeLeft takes the max of existing value and 0.45", () => {
    const { s, flashDamage } = makeState({ heroHp: 3, bulletTimeLeft: 1.2 });
    flashDamage();
    expect(s.bulletTimeLeft).toBe(1.2); // existing 1.2 > 0.45 → kept
  });
});

describe("applyScreenShake", () => {
  it("adds intensity to camShakeAmt", () => {
    const { s, applyScreenShake } = makeState({ camShakeAmt: 0 });
    applyScreenShake(0.3);
    expect(s.camShakeAmt).toBeCloseTo(0.3);
  });

  it("clamps camShakeAmt to 1.0", () => {
    const { s, applyScreenShake } = makeState({ camShakeAmt: 0.9 });
    applyScreenShake(0.5);
    expect(s.camShakeAmt).toBe(1);
  });

  it("accumulates multiple shakes up to 1.0", () => {
    const { s, applyScreenShake } = makeState({ camShakeAmt: 0 });
    applyScreenShake(0.4);
    applyScreenShake(0.4);
    expect(s.camShakeAmt).toBeCloseTo(0.8);
    applyScreenShake(0.4);
    expect(s.camShakeAmt).toBe(1);
  });
});
