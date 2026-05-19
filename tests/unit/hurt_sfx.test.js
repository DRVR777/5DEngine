import { describe, it, expect } from "vitest";
import { computeHurtSfx } from "../../src/combat/hurt_sfx.js";

describe("computeHurtSfx — per-type tone strings", () => {
  const cases = [
    ["grunt",      "tone:110:45:sawtooth"],
    ["fast",       "tone:190:28:sawtooth"],
    ["heavy",      "tone:55:85:sawtooth"],
    ["poisoner",   "tone:140:50:sawtooth"],
    ["incendiary", "tone:120:48:sawtooth"],
    ["robot",      "tone:400:32:square"],
    ["boss",       "tone:42:110:sawtooth"],
    ["sniper",     "tone:160:38:sawtooth"],
  ];

  for (const [type, expected] of cases) {
    it(`${type} → ${expected}`, () => {
      expect(computeHurtSfx({ enemyType: type, headshot: false }).tone).toBe(expected);
    });
  }

  it("unknown type → default tone:110:45:sawtooth", () => {
    expect(computeHurtSfx({ enemyType: "alien", headshot: false }).tone).toBe("tone:110:45:sawtooth");
  });
});

describe("computeHurtSfx — volume", () => {
  it("headshot=false → vol 0.18", () => {
    expect(computeHurtSfx({ enemyType: "grunt", headshot: false }).vol).toBe(0.18);
  });

  it("headshot=true → vol 0.32", () => {
    expect(computeHurtSfx({ enemyType: "grunt", headshot: true }).vol).toBe(0.32);
  });

  it("vol unchanged by enemy type — boss headshot still 0.32", () => {
    expect(computeHurtSfx({ enemyType: "boss", headshot: true }).vol).toBe(0.32);
  });
});

describe("computeHurtSfx — robot uses square wave", () => {
  it("robot → square waveform", () => {
    expect(computeHurtSfx({ enemyType: "robot", headshot: false }).tone).toContain(":square");
  });

  it("all non-robot types → sawtooth waveform", () => {
    for (const type of ["grunt", "fast", "heavy", "poisoner", "incendiary", "boss", "sniper"]) {
      expect(computeHurtSfx({ enemyType: type, headshot: false }).tone).toContain(":sawtooth");
    }
  });
});
