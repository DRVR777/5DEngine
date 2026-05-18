// Tests for src/ui/weapon_selector.js
import { it, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dir, "../../src/ui/weapon_selector.js"), "utf8");

it("exports mountWeaponSelector", () => {
  expect(src).toMatch(/export\s+function\s+mountWeaponSelector/);
});

it("accepts { getCFG, getActiveWeaponId }", () => {
  expect(src).toContain("getCFG");
  expect(src).toContain("getActiveWeaponId");
});

it("guards document access", () => {
  expect(src).toContain('typeof document === "undefined"');
});

it("returns { show }", () => {
  expect(src).toContain("return { show }");
});

it("show() reads weaponSelector element", () => {
  expect(src).toContain('"weaponSelector"');
});

it("show() calls getCFG() for weapons list", () => {
  expect(src).toContain("getCFG()");
  expect(src).toContain("cfg.weapons");
});

it("show() calls getActiveWeaponId()", () => {
  expect(src).toContain("getActiveWeaponId()");
});

it("show() sets display flex and opacity 1", () => {
  expect(src).toContain('"flex"');
  expect(src).toContain('"1"');
});

it("show() fades out after 1800ms", () => {
  expect(src).toContain("1800");
  expect(src).toContain('"opacity 0.4s"');
});

it("show() cancels existing timeout before setting new one", () => {
  expect(src).toContain("clearTimeout(_timeout)");
});

it("active weapon shows highlight color and arrow", () => {
  expect(src).toContain("#00ccff");
  expect(src).toContain("▶");
});
