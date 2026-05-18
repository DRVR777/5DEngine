// Tests for src/systems/game_reset.js
import { it, expect, describe } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dir, "../../src/systems/game_reset.js"), "utf8");

it("exports mountGameReset", () => {
  expect(src).toMatch(/export\s+function\s+mountGameReset/);
});

describe("dependencies", () => {
  it("accepts scene", () => { expect(src).toContain("scene,"); });
  it("accepts world", () => { expect(src).toContain("world,"); });
  it("accepts Inv", () => { expect(src).toContain("Inv,"); });
  it("accepts CFG", () => { expect(src).toContain("CFG,"); });
  it("accepts enemies", () => { expect(src).toContain("enemies,"); });
  it("accepts enemyMeshes", () => { expect(src).toContain("enemyMeshes,"); });
  it("accepts bullets3D", () => { expect(src).toContain("bullets3D,"); });
  it("accepts enemyBullets", () => { expect(src).toContain("enemyBullets,"); });
  it("accepts grenades3D", () => { expect(src).toContain("grenades3D,"); });
  it("accepts smokeZones", () => { expect(src).toContain("smokeZones,"); });
  it("accepts firePatches", () => { expect(src).toContain("firePatches,"); });
  it("accepts poisonPuddles", () => { expect(src).toContain("poisonPuddles,"); });
  it("accepts wallScorches", () => { expect(src).toContain("wallScorches,"); });
  it("accepts armorShards", () => { expect(src).toContain("armorShards,"); });
  it("accepts speedOrbs", () => { expect(src).toContain("speedOrbs,"); });
  it("accepts weaponPickups", () => { expect(src).toContain("weaponPickups,"); });
  it("accepts heroInv", () => { expect(src).toContain("heroInv,"); });
  it("accepts weaponAmmo", () => { expect(src).toContain("weaponAmmo,"); });
  it("accepts actions", () => { expect(src).toContain("actions,"); });
});

describe("enemy cleanup", () => {
  it("iterates enemies backwards and splices en_spawned_ entries", () => {
    expect(src).toContain('re.id.startsWith("en_spawned_")');
    expect(src).toContain("enemies.splice(i, 1)");
  });

  it("removes enemy mesh group from scene", () => {
    expect(src).toContain("scene.remove(rm.group)");
    expect(src).toContain("scene.remove(rm.laserLine)");
    expect(src).toContain("enemyMeshes.delete(re.id)");
  });

  it("removes from world.players", () => {
    expect(src).toContain("world.players.delete(re.id)");
  });
});

describe("hazard cleanup", () => {
  it("clears firePatches, poisonPuddles, armorShards from scene", () => {
    expect(src).toContain("firePatches.length = 0");
    expect(src).toContain("poisonPuddles.length = 0");
    expect(src).toContain("armorShards.length = 0");
  });

  it("hides wallScorches (visible = false)", () => {
    expect(src).toContain("ws.visible = false");
    expect(src).toContain("wallScorches.length = 0");
  });

  it("calls actions.gadgetClearAll for turrets and mines", () => {
    expect(src).toContain("actions.gadgetClearAll()");
  });
});

describe("projectile cleanup", () => {
  it("clears bullets3D, enemyBullets, grenades3D", () => {
    expect(src).toContain("bullets3D.length = 0");
    expect(src).toContain("enemyBullets.length = 0");
    expect(src).toContain("grenades3D.length = 0");
  });

  it("removes grenade warn rings from scene", () => {
    expect(src).toContain("rg._warnRing");
  });
});

describe("pickup cleanup", () => {
  it("clears smokeZones, speedOrbs, weaponPickups", () => {
    expect(src).toContain("smokeZones.length = 0");
    expect(src).toContain("speedOrbs.length = 0");
    expect(src).toContain("weaponPickups.length = 0");
  });
});

describe("inventory reset", () => {
  it("fills heroInv.slots with null", () => {
    expect(src).toContain("heroInv.slots.fill(null)");
  });

  it("restores starting weapons and ammo via Inv.addItem", () => {
    expect(src).toContain('Inv.addItem(heroInv, "gun_" + w.id');
    expect(src).toContain('Inv.addItem(heroInv, "medkit"');
  });

  it("clears and repopulates weaponAmmo map", () => {
    expect(src).toContain("weaponAmmo.clear()");
    expect(src).toContain("weaponAmmo.set(w.id");
  });
});

describe("actions called", () => {
  it("calls resetGrenades, resetWeapon, heroRespawn, waveRestart", () => {
    expect(src).toContain("actions.resetGrenades()");
    expect(src).toContain("actions.resetWeapon()");
    expect(src).toContain("actions.heroRespawn()");
    expect(src).toContain("actions.waveRestart()");
  });

  it("calls resetStats, resetLevel, resetPerks", () => {
    expect(src).toContain("actions.resetStats()");
    expect(src).toContain("actions.resetLevel()");
    expect(src).toContain("actions.resetPerks()");
  });

  it("calls hidePerkPicker, refreshPerkHud, clearHeroLevelHud", () => {
    expect(src).toContain("actions.hidePerkPicker()");
    expect(src).toContain("actions.refreshPerkHud()");
    expect(src).toContain("actions.clearHeroLevelHud()");
  });
});

it("returns resetGameState", () => {
  expect(src).toContain("return { resetGameState }");
});
