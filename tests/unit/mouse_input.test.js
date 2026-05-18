// Tests for src/systems/mouse_input.js
import { it, expect, describe } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dir, "../../src/systems/mouse_input.js"), "utf8");

it("exports mountMouseInput", () => {
  expect(src).toMatch(/export\s+function\s+mountMouseInput/);
});

it("guards document access", () => {
  expect(src).toContain('typeof document === "undefined"');
});

describe("dependencies", () => {
  it("accepts getState", () => { expect(src).toContain("getState"); });
  it("accepts getRenderer", () => { expect(src).toContain("getRenderer"); });
  it("accepts getWorldBuilder", () => { expect(src).toContain("getWorldBuilder"); });
  it("accepts setCamYaw and setCamPitch", () => {
    expect(src).toContain("setCamYaw");
    expect(src).toContain("setCamPitch");
  });
  it("accepts setFreeCamYaw and setFreeCamPitch", () => {
    expect(src).toContain("setFreeCamYaw");
    expect(src).toContain("setFreeCamPitch");
  });
  it("accepts setAiming", () => { expect(src).toContain("setAiming"); });
  it("accepts setPointerLocked", () => { expect(src).toContain("setPointerLocked"); });
  it("accepts setCurrentWeaponId", () => { expect(src).toContain("setCurrentWeaponId"); });
  it("accepts setPistolAmmo", () => { expect(src).toContain("setPistolAmmo"); });
  it("accepts setReloading", () => { expect(src).toContain("setReloading"); });
  it("accepts switchGunMesh", () => { expect(src).toContain("switchGunMesh"); });
  it("accepts showWeaponSelector", () => { expect(src).toContain("showWeaponSelector"); });
  it("accepts playSfx", () => { expect(src).toContain("playSfx"); });
});

describe("wheel handler", () => {
  it("registers wheel listener on renderer.domElement", () => {
    expect(src).toContain('"wheel"');
    expect(src).toContain("passive: false");
  });

  it("updates camDist in build mode", () => {
    expect(src).toContain("CAM_DIST_MIN");
    expect(src).toContain("CAM_DIST_MAX");
    expect(src).toContain("setCamDist");
  });

  it("switches weapon in play mode", () => {
    expect(src).toContain("setCurrentWeaponId");
    expect(src).toContain("setPistolAmmo");
  });

  it("cancels reload on weapon switch", () => {
    expect(src).toContain("setReloading(false)");
  });

  it("calls switchGunMesh and showWeaponSelector", () => {
    expect(src).toContain("switchGunMesh(nw.id)");
    expect(src).toContain("showWeaponSelector()");
  });

  it("emits WEAPON_SWITCH event", () => {
    expect(src).toContain("WEAPON_SWITCH");
  });
});

describe("right-click aiming", () => {
  it("sets aiming true on mousedown button 2", () => {
    expect(src).toContain("setAiming(true)");
  });

  it("clears aiming on mouseup button 2", () => {
    expect(src).toContain("setAiming(false)");
  });

  it("prevents context menu", () => {
    expect(src).toContain('"contextmenu"');
    expect(src).toContain("preventDefault");
  });
});

describe("pointer lock", () => {
  it("listens for click to request pointer lock", () => {
    expect(src).toContain("requestPointerLock");
  });

  it("listens for pointerlockchange to sync state", () => {
    expect(src).toContain('"pointerlockchange"');
    expect(src).toContain("setPointerLocked");
  });

  it("checks shop/settings/npcDialog before requesting lock", () => {
    expect(src).toContain("getShop()");
    expect(src).toContain("getSettings()");
    expect(src).toContain("getNpcDialog()");
  });
});

describe("mousemove handler", () => {
  it("handles build mode world builder drag", () => {
    expect(src).toContain("isAxisDragging");
    expect(src).toContain("isDragging");
  });

  it("handles mouse-mode screen cursor movement", () => {
    expect(src).toContain("getActiveMouseScreen");
    expect(src).toContain("getMouseModeCursor");
    expect(src).toContain("resolutionW");
  });

  it("updates camYaw and camPitch in play mode", () => {
    expect(src).toContain("setCamYaw");
    expect(src).toContain("setCamPitch");
    expect(src).toContain("0.003");
  });

  it("applies sniper sensitivity reduction", () => {
    expect(src).toContain("getSniperSens");
    expect(src).toContain('"sniper"');
  });

  it("updates freeCamYaw and freeCamPitch in build mode", () => {
    expect(src).toContain("setFreeCamYaw");
    expect(src).toContain("setFreeCamPitch");
  });

  it("uses drag fallback when not pointer locked", () => {
    expect(src).toContain("dragging");
    expect(src).toContain("lastMouseX");
    expect(src).toContain("lastMouseY");
  });
});
