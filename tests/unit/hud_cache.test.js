// Tests for src/ui/hud_cache.js
import { it, expect, describe } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dir, "../../src/ui/hud_cache.js"), "utf8");

it("exports mountHudElements", () => {
  expect(src).toMatch(/export\s+function\s+mountHudElements/);
});

it("guards document access", () => {
  expect(src).toContain('typeof document === "undefined"');
});

it("returns stub when document unavailable", () => {
  expect(src).toContain("dom: {}");
  expect(src).toContain("hud: null");
  expect(src).toContain("mini: null");
  expect(src).toContain("dmgDirSvg: null");
  expect(src).toContain("dmgDirG: null");
});

describe("HUD element cache", () => {
  it("includes fpsCounter", () => { expect(src).toContain('"fpsCounter"'); });
  it("includes ammoHud", () => { expect(src).toContain('"ammoHud"'); });
  it("includes reloadCircle", () => { expect(src).toContain('"reloadCircle"'); });
  it("includes scopeOverlay", () => { expect(src).toContain('"scopeOverlay"'); });
  it("includes crosshair", () => { expect(src).toContain('"crosshair"'); });
  it("includes dmgDirIndicator", () => { expect(src).toContain('"dmgDirIndicator"'); });
  it("includes health bar elements", () => {
    expect(src).toContain('"hbFill"');
    expect(src).toContain('"hbVal"');
    expect(src).toContain('"hbGhost"');
  });
  it("includes wave HUD elements", () => {
    expect(src).toContain('"waveHud"');
    expect(src).toContain('"waveLabel"');
    expect(src).toContain('"waveBanner"');
  });
  it("includes weapon HUD elements", () => {
    expect(src).toContain('"wpName"');
    expect(src).toContain('"wpAmmo"');
    expect(src).toContain('"wpMagBar"');
  });
  it("includes grenade elements", () => {
    expect(src).toContain('"grenadeWarn"');
    expect(src).toContain('"grenCookTimer"');
  });
  it("includes boss HP bar", () => {
    expect(src).toContain('"bossHpBar"');
    expect(src).toContain('"bossHpFill"');
  });
  it("includes status effects HUD", () => {
    expect(src).toContain('"statusEffectsHud"');
    expect(src).toContain('"statusTint"');
  });
});

describe("minimap", () => {
  it("gets minimap canvas context", () => {
    expect(src).toContain('"minimap"');
    expect(src).toContain('getContext("2d")');
  });

  it("reads MINI_HALF from CFG", () => {
    expect(src).toContain("miniMapHalfExtent");
    expect(src).toContain("MINI_HALF");
  });
});

describe("damage direction SVG", () => {
  it("creates SVG element", () => {
    expect(src).toContain("createElementNS");
    expect(src).toContain('"svg"');
  });

  it("creates polygon with correct points", () => {
    expect(src).toContain('"polygon"');
    expect(src).toContain("0,-42 -10,-26 10,-26");
  });

  it("appends SVG to dmgDirIndicator", () => {
    expect(src).toContain("dmgDirIndicator");
    expect(src).toContain("appendChild(dmgDirSvg)");
  });

  it("returns dmgDirG for tick() transform updates", () => {
    expect(src).toContain("dmgDirG");
    expect(src).toContain("return { dom");
  });
});
