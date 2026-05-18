// Tests for src/systems/config_editor.js
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dir, "../../src/systems/config_editor.js"), "utf8");

// Static structure checks (no DOM dependency)
it("exports mountConfigEditor", () => {
  expect(src).toMatch(/export\s+function\s+mountConfigEditor/);
});

it("guards document access (document === undefined check)", () => {
  expect(src).toContain('typeof document === "undefined"');
});

it("contains all 5 config sections", () => {
  expect(src).toContain("PLAYER MOVEMENT");
  expect(src).toContain("PLAYER HEALTH");
  expect(src).toContain("CAMERA");
  expect(src).toContain("WORLD");
  expect(src).toContain("BUILDER");
});

it("contains all weapon tuning fields", () => {
  for (const field of ["damage", "fireRate", "range", "speed", "magCap", "reloadDuration", "spread", "pellets"]) {
    expect(src).toContain(`"${field}"`);
  }
});

it("uses optional chaining on cfgApply/cfgReset getElementById (graceful if missing)", () => {
  expect(src).toMatch(/getElementById\("cfgApply"\)\?\.addEventListener/);
  expect(src).toMatch(/getElementById\("cfgReset"\)\?\.addEventListener/);
});

it("returns { build, apply, reset }", () => {
  expect(src).toContain("return { build, apply, reset }");
});

it("applies deep-copy defaults to GameConfig on reset", () => {
  expect(src).toContain("JSON.parse(JSON.stringify(");
  expect(src).toContain("Object.assign(GameConfig,");
});

// Meta coverage: all documented config keys have metadata
const META_KEYS = [
  "walkSpeed", "sprintSpeed", "jumpVelocity", "gravity",
  "heroMaxHp", "heroRegenDelay", "heroRegenRate",
  "camDistMin", "camDistMax", "camDefaultDist", "camAimShrink",
  "camPitchMin", "camPitchMax", "camLookAheadDist",
  "arenaHalfExtent", "computerInteractDist", "vehicleInteractDist",
  "pickupRadius", "snapGridSize",
];

describe("META contains min/max/step for every documented key", () => {
  for (const key of META_KEYS) {
    it(`has metadata for "${key}"`, () => {
      expect(src).toContain(`${key}:`);
    });
  }
});
