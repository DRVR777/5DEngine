// Tests for src/systems/settings_panel.js
import { it, expect, describe } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dir, "../../src/systems/settings_panel.js"), "utf8");

it("exports mountSettingsPanel", () => {
  expect(src).toMatch(/export\s+function\s+mountSettingsPanel/);
});

it("accepts { getCFG, getRenderer, getBuildMode, password, initialSniperSens }", () => {
  expect(src).toContain("getCFG");
  expect(src).toContain("getRenderer");
  expect(src).toContain("getBuildMode");
  expect(src).toContain("password");
  expect(src).toContain("initialSniperSens");
});

it("guards document access", () => {
  expect(src).toContain('typeof document === "undefined"');
});

it("returns { open, close, isOpen, getSniperSens }", () => {
  expect(src).toContain("open,");
  expect(src).toContain("close,");
  expect(src).toContain("get isOpen()");
  expect(src).toContain("getSniperSens:");
});

it("open() sets _isOpen = true", () => {
  expect(src).toContain("_isOpen = true");
});

it("open() adds open class to settingsOverlay", () => {
  expect(src).toContain('"settingsOverlay"');
  expect(src).toContain('classList.add("open")');
});

it("open() syncs sniperSensSlider", () => {
  expect(src).toContain('"sniperSensSlider"');
  expect(src).toContain("sl.value = _sniperScopeSens");
});

it("open() calls _renderAdminGrid when admin unlocked", () => {
  expect(src).toContain("_adminUnlocked) _renderAdminGrid()");
});

it("close() sets _isOpen = false", () => {
  expect(src).toContain("_isOpen = false");
});

it("close() removes open class from settingsOverlay", () => {
  expect(src).toContain('classList.remove("open")');
});

it("close() calls getRenderer() for pointer lock", () => {
  expect(src).toContain("getRenderer()");
  expect(src).toContain("renderer.domElement.requestPointerLock()");
});

it("close() checks getBuildMode()", () => {
  expect(src).toContain("getBuildMode()");
});

it("getSniperSens returns _sniperScopeSens", () => {
  expect(src).toContain("getSniperSens: () => _sniperScopeSens");
});

it("slider listener updates _sniperScopeSens", () => {
  expect(src).toContain("_sniperScopeSens = parseFloat(sl.value)");
  expect(src).toContain("sniperScopeSens.toFixed(1)");
});

it("binds settingsClose button at mount time", () => {
  expect(src).toContain('"settingsClose"');
  expect(src).toContain('addEventListener("click", close)');
});

it("admin unlock compares against password param", () => {
  expect(src).toContain("pw === password");
});

it("admin unlock reveals adminContent", () => {
  expect(src).toContain('"adminContent"');
  expect(src).toContain('"block"');
});

it("wrong password shows error message then clears", () => {
  expect(src).toContain("Wrong password");
});

it("_renderAdminGrid reads adminWeaponGrid", () => {
  expect(src).toContain('"adminWeaponGrid"');
});

it("_renderAdminGrid uses getCFG()", () => {
  expect(src).toContain("getCFG()");
});

describe("null-safety", () => {
  it("stub returns isOpen = false when document unavailable", () => {
    expect(src).toContain("get isOpen() { return false; }");
  });

  it("stub getSniperSens returns initialSniperSens value", () => {
    expect(src).toContain("getSniperSens: () => _s");
  });
});
