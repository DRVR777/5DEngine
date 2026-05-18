// Tests for src/ui/hud_template.js — static structure checks on the template HTML
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dir = path.dirname(fileURLToPath(import.meta.url));
let src;
beforeAll(() => {
  src = readFileSync(path.join(__dir, "../../src/ui/hud_template.js"), "utf8");
});

// Helper: count occurrences of a string in src
const countOccurrences = (str, sub) => {
  let count = 0, pos = 0;
  while ((pos = str.indexOf(sub, pos)) !== -1) { count++; pos++; }
  return count;
};

// --- module shape ---
it("exports mountHudTemplate function", () => {
  expect(src).toMatch(/export\s+function\s+mountHudTemplate/);
});

it("is idempotent guard on fpsCounter presence", () => {
  // The guard checks for fpsCounter before inserting
  expect(src).toMatch(/getElementById\s*\(\s*["']fpsCounter["']\s*\)/);
  expect(src).toMatch(/return/); // early-return guard present
});

// --- required element IDs ---
const REQUIRED_IDS = [
  "fpsCounter", "clockHud", "ammoHud", "reloadCircle",
  "dmgDirIndicator", "grenadeWarn", "grenadeRing", "grenCookTimer",
  "waveClearBanner", "waveClearTitle", "waveClearSub",
  "perkPicker", "perkWaveNum", "perkTimer", "perkCards",
  "bossHpBar", "bossName", "bossHpFill", "bossHpVal",
  "comboHud", "comboMulText", "comboFill",
  "scopeOverlay",
  "waveBanner", "waveBannerLabel", "waveBannerSub",
  "weaponPanel", "wpName", "wpAmmo", "wpReserve", "wpMagBar", "wpGrenades",
  "healthBar", "hbLabel", "hbTrack", "hbGhost", "hbFill", "hbVal",
  "armorBar", "arFill", "arVal",
  "perkHud", "staminaBar", "stFill",
  "statusEffectsHud", "weaponSelector",
  "killFeed", "vehicleDash", "vdSpeed", "vdGear",
  "npcDialog", "npcDialogName", "npcDialogText", "npcDialogChoices",
  "toastContainer", "dmgNumLayer",
  "questPanel", "questList",
  "waveHud", "waveLabel", "waveDetail", "heroLevelHud", "waveChallengeHud", "difficultyBadge",
  "rainCanvas",
  "charEditor", "charModelName", "charStateMachine", "charBlendTime", "charBlendVal",
  "charTimeScale", "charTSVal", "charClipList", "charScale",
  "hotbar", "creativeInv", "ciPrimitives", "ciAssets",
  "texturePanel", "texSwatches", "texDropZone",
  "minimap", "crosshair", "killMarker", "damageFlash", "statusTint",
  "keybindPanel", "devConsole", "devConsoleLogs", "devConsoleInput",
  "deathOverlay", "deathStats", "deathCountdown",
  "victoryOverlay", "victoryStats", "victoryPlayAgain",
  "difficultyScreen",
  "computerOverlay", "appHome", "appWindow", "appTitle", "appBody",
  "inventory", "invGrid", "invWeight",
  "shopOverlay", "shopCoinDisplay", "shopClose", "shopGrid",
  "settingsOverlay", "settingsClose", "sniperSensSlider", "sniperSensVal",
  "adminLockRow", "adminPwInput", "adminUnlockBtn", "adminLockMsg", "adminContent", "adminWeaponGrid",
  "builderUI", "bUndo", "bUndoCount", "bRedo", "bRedoCount",
  "bInspector", "bSelMeta",
  "bPosX", "bPosY", "bPosZ", "bRotX", "bRotY", "bRotZ", "bSclX", "bSclY", "bSclZ",
  "bColorRow", "bColor", "bColorKind", "bIntensityRow", "bIntensity", "bIntensityVal",
  "bClone", "bDelete", "bScript", "bScriptApply", "bScriptClear", "bScriptError",
  "bSceneList", "bSceneLoad", "bSceneDel", "bSceneName", "bSceneSave",
  "bExport", "bImport", "bImportFile",
  "sceneHierarchy", "shCount", "shSearch", "shTree",
  "cfgEditor", "cfgSections", "cfgApply", "cfgReset", "cfgMsg",
  "envPanel", "skyboxBtns", "terrainSeed",
  "fogNear", "fogNearV", "fogFar", "fogFarV", "fogDens", "fogDensV",
  "bloomStr", "bloomStrV", "bloomRad", "bloomRadV", "bloomThr", "bloomThrV",
  "ambInt", "ambIntV", "sunInt", "sunIntV", "sunAz", "sunAzV",
  "computerClose", "help",
];

describe("template contains all required element IDs", () => {
  for (const id of REQUIRED_IDS) {
    it(`id="${id}" is present`, () => {
      expect(src).toContain(`id="${id}"`);
    });
  }
});

// --- structural counts ---
it("hotbar has exactly 9 slots (data-slot=0 through 8)", () => {
  expect(countOccurrences(src, "data-slot=")).toBe(9);
});

it("difficultyScreen has exactly 4 diffBtn buttons", () => {
  expect(countOccurrences(src, 'class="diffBtn"')).toBe(4);
});

it("loadingScreen is NOT in the template (stays in HTML)", () => {
  expect(src).not.toContain('id="loadingScreen"');
});

it("hud div is NOT in the template (stays in HTML)", () => {
  // The template must not add a second #hud — that belongs to load_guard.js
  expect(src).not.toMatch(/id="hud"[^>]*>loading/);
});

// --- broken oninput guards ---
it("fog near oninput uses window wrapper, not bare scene.fog", () => {
  expect(src).not.toMatch(/oninput="scene\.fog/);
});

it("hero scale oninput uses window wrapper, not bare heroGroup", () => {
  expect(src).not.toMatch(/oninput="heroGroup\.scale/);
});

it("fog near slider calls window._setFogNear", () => {
  expect(src).toContain("window._setFogNear");
});

it("fog far slider calls window._setFogFar", () => {
  expect(src).toContain("window._setFogFar");
});

it("hero scale slider calls window._setHeroScale", () => {
  expect(src).toContain("window._setHeroScale");
});

// --- uses insertAdjacentHTML not innerHTML (safer for existing DOM) ---
it("uses insertAdjacentHTML to inject template", () => {
  expect(src).toContain("insertAdjacentHTML");
});
