// Tests for src/combat/weapon_visuals.js
import { it, expect, describe } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dir, "../../src/combat/weapon_visuals.js"), "utf8");

it("exports createWeaponVisuals", () => {
  expect(src).toMatch(/export\s+function\s+createWeaponVisuals/);
});

it("accepts { THREE, armR, camera, weapons, getActiveWeaponId }", () => {
  expect(src).toContain("getActiveWeaponId");
  expect(src).toContain("armR");
  expect(src).toContain("camera");
  expect(src).toContain("weapons");
});

it("returns { gunMount, fpGunGroup, switchGunMesh, registerGunMesh }", () => {
  expect(src).toContain("return { gunMount, fpGunGroup, switchGunMesh, registerGunMesh }");
});

it("adds gunMount to armR", () => {
  expect(src).toContain("armR.add(gunMount)");
});

it("adds fpGunGroup to camera", () => {
  expect(src).toContain("camera.add(fpGunGroup)");
});

it("fpGunGroup starts invisible", () => {
  expect(src).toContain("fpGunGroup.visible = false");
});

it("positions gunMount at (0, -0.7, 0.2)", () => {
  expect(src).toContain("0, -0.7, 0.2");
});

it("positions fpGunGroup at (0.22, -0.24, -0.45)", () => {
  expect(src).toContain("0.22, -0.24, -0.45");
});

it("has placeholder specs for all 5 weapon types", () => {
  for (const id of ["pistol", "rifle", "shotgun", "smg", "sniper"]) {
    expect(src).toContain(`${id}:`);
  }
});

it("sets placeholder pistol fallback when no pistol in weapons list", () => {
  expect(src).toContain('!_gunMeshes.has("pistol")');
});

it("uses getActiveWeaponId() to set initial visibility", () => {
  expect(src).toContain("const activeId = getActiveWeaponId()");
  expect(src).toContain("w.id === activeId");
});

it("uses getActiveWeaponId() in registerGunMesh (not stale value)", () => {
  expect(src).toContain("getActiveWeaponId()");
  // registerGunMesh calls getActiveWeaponId() each time it runs
  const registerIdx = src.indexOf("function registerGunMesh");
  const getterInRegister = src.indexOf("getActiveWeaponId()", registerIdx);
  expect(getterInRegister).toBeGreaterThan(registerIdx);
});

it("switchGunMesh toggles 3P mesh visibility and FP mesh visibility", () => {
  expect(src).toContain("_gunMeshes.forEach");
  expect(src).toContain("_fpGunMeshes.forEach");
});

it("registerGunMesh removes old mesh before adding new one", () => {
  expect(src).toContain("gunMount.remove(old)");
  expect(src).toContain("gunMount.add(threeGroup)");
});

it("FP meshes use depthTest: false for always-on-top rendering", () => {
  expect(src).toContain("depthTest: false");
});

it("FP meshes use renderOrder: 100", () => {
  expect(src).toContain("renderOrder = 100");
});

describe("weapon spec coverage", () => {
  it("has 3P specs for all 5 weapons", () => {
    expect(src).toContain("_3pSpecs");
    expect(src).toContain("pistol:");
    expect(src).toContain("rifle:");
    expect(src).toContain("shotgun:");
    expect(src).toContain("smg:");
    expect(src).toContain("sniper:");
  });

  it("has FP specs for all 5 weapons", () => {
    expect(src).toContain("_fpSpecs");
  });
});
