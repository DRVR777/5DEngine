// Tests for src/systems/gadget_system.js
import { it, expect, describe } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dir, "../../src/systems/gadget_system.js"), "utf8");

it("exports mountGadgetSystem", () => {
  expect(src).toMatch(/export\s+function\s+mountGadgetSystem/);
});

describe("dependencies", () => {
  it("accepts THREE", () => { expect(src).toContain("THREE,"); });
  it("accepts scene", () => { expect(src).toContain("scene,"); });
  it("accepts world", () => { expect(src).toContain("world,"); });
  it("accepts enemies", () => { expect(src).toContain("enemies,"); });
  it("accepts bullets3D", () => { expect(src).toContain("bullets3D,"); });
  it("accepts grenades3D", () => { expect(src).toContain("grenades3D,"); });
  it("accepts smokeZones", () => { expect(src).toContain("smokeZones,"); });
  it("accepts coinByType", () => { expect(src).toContain("coinByType,"); });
  it("accepts weaponDropMap", () => { expect(src).toContain("weaponDropMap,"); });
  it("accepts get", () => { expect(src).toContain("get,"); });
  it("accepts set", () => { expect(src).toContain("set,"); });
  it("accepts actions", () => { expect(src).toContain("actions,"); });
});

describe("smoke zone", () => {
  it("deploySmokeZone pushes to smokeZones", () => {
    expect(src).toContain("smokeZones.push(");
    expect(src).toContain("timeLeft: 6.0");
  });

  it("spawns white particles", () => {
    expect(src).toContain('"white", 2.8, 1.8');
  });
});

describe("turret system", () => {
  it("placeTurret checks heroDead, buildMode, inCar, shopIsOpen", () => {
    expect(src).toContain("get.heroDead()");
    expect(src).toContain("get.buildMode()");
    expect(src).toContain("get.inCar()");
    expect(src).toContain("get.shopIsOpen()");
  });

  it("placeTurret costs _TURRET_COST coins", () => {
    expect(src).toContain("_TURRET_COST");
    expect(src).toContain("set.score(");
  });

  it("tickTurrets reads bulletGeo and bulletMat lazily", () => {
    expect(src).toContain("get.bulletGeo()");
    expect(src).toContain("get.bulletMat()");
  });

  it("tickTurrets fires at nearest enemy in range", () => {
    expect(src).toContain("_TURRET_FIRE_RATE");
    expect(src).toContain("bullets3D.push(");
  });

  it("turret LED changes color by health/ammo", () => {
    expect(src).toContain("setHex(ledColor)");
    expect(src).toContain("0xff4444");
    expect(src).toContain("0xff8800");
    expect(src).toContain("0x00ff44");
  });
});

describe("mine system", () => {
  it("dropMine checks mineCount", () => {
    expect(src).toContain("get.mineCount()");
    expect(src).toContain("set.mineCount(");
  });

  it("mines arm after armT expires", () => {
    expect(src).toContain("mn.armT -= dt");
    expect(src).toContain("mn.armed = true");
  });

  it("mine detonates within 1.2m", () => {
    expect(src).toContain("< 1.2");
    expect(src).toContain("_mines.splice(_mi, 1)");
  });

  it("mine explosion deals 90 damage at center", () => {
    expect(src).toContain("90 * (1 - _md / _mBlast)");
  });

  it("mine kills accumulate enemyKills and comboCount locally", () => {
    expect(src).toContain("let enemyKills = get.enemyKills()");
    expect(src).toContain("let comboCount = get.comboCount()");
    expect(src).toContain("set.enemyKills(enemyKills)");
    expect(src).toContain("set.comboCount(comboCount)");
  });

  it("mine uses coinByType and weaponDropMap for loot", () => {
    expect(src).toContain("coinByType[en2.type]");
    expect(src).toContain("weaponDropMap[en2.type]");
  });
});

describe("grenade throws", () => {
  it("throwSmokeGrenade checks smokeGrenadeCount", () => {
    expect(src).toContain("get.smokeGrenadeCount()");
    expect(src).toContain("set.smokeGrenadeCount(");
    expect(src).toContain("_isSmoke: true");
  });

  it("throwFlashbang checks flashbangCount", () => {
    expect(src).toContain("get.flashbangCount()");
    expect(src).toContain("set.flashbangCount(");
    expect(src).toContain("_isFlash: true");
  });

  it("throwGrenade checks grenadeCount", () => {
    expect(src).toContain("get.grenadeCount()");
    expect(src).toContain("set.grenadeCount(");
  });

  it("throwGrenade uses cookedFuse clamped to 0.15", () => {
    expect(src).toContain("Math.max(0.15, cookedFuse)");
  });

  it("all throws push to grenades3D", () => {
    expect(src).toContain("grenades3D.push(");
  });

  it("all throws read camYaw via get", () => {
    expect(src).toContain("get.camYaw()");
  });
});

describe("explodeGrenade", () => {
  it("handles acid spit (_isAcidSpit)", () => {
    expect(src).toContain("g._isAcidSpit");
    expect(src).toContain("actions.spawnPoisonPuddle(");
    expect(src).toContain("StatusEffects.apply");
  });

  it("handles fireball (_isFireball)", () => {
    expect(src).toContain("g._isFireball");
    expect(src).toContain("actions.spawnFirePatch(");
  });

  it("handles flashbang (_isFlash)", () => {
    expect(src).toContain("g._isFlash");
    expect(src).toContain("set.heroBlindT(2.0");
    expect(src).toContain("en._blindT =");
  });

  it("handles boss rock (_isBossRock)", () => {
    expect(src).toContain("g._isBossRock");
    expect(src).toContain("actions.applyScreenShake(");
  });

  it("standard explosion has RADIUS 14 and MAX_DMG 80", () => {
    expect(src).toContain("RADIUS = 14");
    expect(src).toContain("MAX_DMG = 80");
  });

  it("explosion knockback sets heroKbU, heroKbV, heroKbT", () => {
    expect(src).toContain("set.heroKbU(");
    expect(src).toContain("set.heroKbV(");
    expect(src).toContain("set.heroKbT(0.35)");
  });

  it("explosion accumulates enemyKills/comboCount locally", () => {
    expect(src).toContain("let comboCount = get.comboCount()");
    expect(src).toContain("set.comboCount(comboCount)");
  });

  it("explosion respects godMode", () => {
    expect(src).toContain("Engine.debug.godMode");
  });

  it("calls actions.flashDamage and heroShowDeathScreen", () => {
    expect(src).toContain("actions.flashDamage()");
    expect(src).toContain("actions.heroShowDeathScreen()");
  });
});

describe("heroBlindT", () => {
  it("writes heroBlindT via set.heroBlindT on flashbang", () => {
    expect(src).toContain("set.heroBlindT(");
  });
});
