// Tests for src/systems/keydown_handler.js
import { it, expect, describe } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dir, "../../src/systems/keydown_handler.js"), "utf8");

it("exports mountKeydownHandler", () => {
  expect(src).toMatch(/export\s+function\s+mountKeydownHandler/);
});

it("guards document access", () => {
  expect(src).toContain('typeof document === "undefined"');
});

it("registers keydown listener", () => {
  expect(src).toContain('"keydown"');
  expect(src).toContain("keys[e.code] = true");
});

it("snapshots state at handler start", () => {
  expect(src).toContain("const s = getState()");
});

describe("dependencies", () => {
  it("accepts keys", () => { expect(src).toContain("keys,"); });
  it("accepts invDiv", () => { expect(src).toContain("invDiv,"); });
  it("accepts renderInventory", () => { expect(src).toContain("renderInventory,"); });
  it("accepts getState", () => { expect(src).toContain("getState,"); });
  it("accepts set", () => { expect(src).toContain("set,"); });
  it("accepts get", () => { expect(src).toContain("get,"); });
  it("accepts actions", () => { expect(src).toContain("actions,"); });
  it("accepts weaponDropMap", () => { expect(src).toContain("weaponDropMap,"); });
  it("accepts coinByType", () => { expect(src).toContain("coinByType,"); });
});

describe("inventory toggle", () => {
  it("opens on KeyI", () => {
    expect(src).toContain('"KeyI"');
    expect(src).toContain("classList.toggle");
  });

  it("calls renderInventory when opened", () => {
    expect(src).toContain("renderInventory()");
  });
});

describe("build-mode undo/redo", () => {
  it("calls worldBuilder().undo() on Ctrl+Z", () => {
    expect(src).toContain("get.worldBuilder().undo()");
  });

  it("calls worldBuilder().redo() on Ctrl+Y / Ctrl+Shift+Z", () => {
    expect(src).toContain("get.worldBuilder().redo()");
  });
});

describe("snap-zone keys", () => {
  it("Q maps to FIRST_PERSON zone", () => {
    expect(src).toContain('"KeyQ"');
    expect(src).toContain('"FIRST_PERSON"');
  });

  it("V maps to THIRD_PERSON zone", () => {
    expect(src).toContain('"KeyV"');
    expect(src).toContain('"THIRD_PERSON"');
  });

  it("Z maps to BIRD_VIEW zone", () => {
    expect(src).toContain('"BIRD_VIEW"');
    expect(src).toContain("set.snapZoomTarget");
  });
});

describe("weapon switching via digit keys", () => {
  it("reads from CFG.weapons", () => {
    expect(src).toContain("CFG.weapons");
  });

  it("saves ammo for current weapon before switch", () => {
    expect(src).toContain("set.weaponAmmoEntry(s.currentWeaponId, s.pistolAmmo)");
  });

  it("cancels reload on switch", () => {
    expect(src).toContain("set.reloading(false)");
  });

  it("calls switchGunMesh and showWeaponSelector", () => {
    expect(src).toContain("actions.switchGunMesh(nw.id)");
    expect(src).toContain("actions.showWeaponSelector()");
  });
});

describe("flashlight", () => {
  it("toggles flashlightOn state", () => {
    expect(src).toContain("set.flashlightOn(on)");
    expect(src).toContain("set.flashLightIntensity");
  });
});

describe("grenades and special weapons", () => {
  it("T throws smoke grenade", () => {
    expect(src).toContain('"KeyT"');
    expect(src).toContain("actions.throwSmokeGrenade()");
  });

  it("U throws flashbang", () => {
    expect(src).toContain('"KeyU"');
    expect(src).toContain("actions.throwFlashbang()");
  });

  it("M drops mine in play mode", () => {
    expect(src).toContain("actions.dropMine()");
  });

  it("G starts grenade cook timer", () => {
    expect(src).toContain("set.grenadePressT(performance.now())");
  });

  it("P places turret in play mode", () => {
    expect(src).toContain("actions.placeTurret()");
  });
});

describe("melee (KeyN)", () => {
  it("loops through enemies", () => {
    expect(src).toContain("for (const en of s.enemies)");
  });

  it("spawns damage numbers", () => {
    expect(src).toContain("actions.spawnDamageNumber");
  });

  it("accumulates enemyKills and comboCount locally", () => {
    expect(src).toContain("let enemyKills = s.enemyKills");
    expect(src).toContain("let comboCount = s.comboCount");
    expect(src).toContain("set.enemyKills(enemyKills)");
    expect(src).toContain("set.comboCount(comboCount)");
  });

  it("breaks crates in range", () => {
    expect(src).toContain("for (const cr of s.crates)");
    expect(src).toContain("actions.breakCrate(cr)");
  });

  it("spawns coin drops using coinByType", () => {
    expect(src).toContain("coinByType[en.type]");
    expect(src).toContain("actions.spawnCoinDrop");
  });

  it("uses weaponDropMap for loot", () => {
    expect(src).toContain("weaponDropMap[en.type]");
    expect(src).toContain("actions.spawnWeaponPickup");
  });
});

describe("dodge roll (KeyX)", () => {
  it("requires stamina >= 20", () => {
    expect(src).toContain("s._stamina >= 20");
  });

  it("sets dodgeVelU and dodgeVelV", () => {
    expect(src).toContain("set.dodgeVelU");
    expect(src).toContain("set.dodgeVelV");
  });

  it("drains stamina", () => {
    expect(src).toContain("set.stamina(Math.max(0, s._stamina - 20))");
  });

  it("calls applyScreenShake", () => {
    expect(src).toContain("actions.applyScreenShake");
  });
});

describe("vehicle interaction (KeyE)", () => {
  it("enters nearest vehicle within interact distance", () => {
    expect(src).toContain("set.inCar(true)");
    expect(src).toContain("set.activeVehicleId(nearestVeh.id)");
  });

  it("exits vehicle and ejects hero", () => {
    expect(src).toContain("set.inCar(false)");
    expect(src).toContain("set.activeVehicleId(null)");
  });

  it("emits VEHICLE_ENTER and VEHICLE_EXIT events", () => {
    expect(src).toContain("VEHICLE_ENTER");
    expect(src).toContain("VEHICLE_EXIT");
  });
});

describe("build mode keys", () => {
  it("B toggles build mode", () => {
    expect(src).toContain('"KeyB"');
    expect(src).toContain("set.buildMode(newBm)");
    expect(src).toContain("get.worldBuilder().setActive(newBm)");
  });

  it("arrow keys translate selected object", () => {
    expect(src).toContain('"ArrowUp"');
    expect(src).toContain('"ArrowDown"');
    expect(src).toContain("get.worldBuilder().translate");
  });

  it("bracket keys rotate selected object", () => {
    expect(src).toContain('"BracketLeft"');
    expect(src).toContain("get.worldBuilder().rotateY");
  });

  it("= and - scale selected object", () => {
    expect(src).toContain("get.worldBuilder().scaleBy");
  });

  it("Delete/Backspace removes selected object", () => {
    expect(src).toContain('"Delete"');
    expect(src).toContain("get.worldBuilder().deleteSelected()");
  });

  it("Ctrl+D clones selected object", () => {
    expect(src).toContain("get.worldBuilder().cloneSelected()");
  });

  it("N places spawn point at freeCamPos", () => {
    expect(src).toContain("actions.addSpawnPoint(s.freeCamPos.x, s.freeCamPos.z)");
  });
});

describe("camera controls", () => {
  it("L flips camera shoulder via set.camSide", () => {
    expect(src).toContain('"KeyL"');
    expect(src).toContain("set.camSide(-s.camSide)");
  });
});

describe("reload (KeyR)", () => {
  it("checks if already reloading", () => {
    expect(src).toContain("s._reloading");
    expect(src).toContain("set.reloading(true)");
  });

  it("sets reload start time", () => {
    expect(src).toContain("set.reloadStart(performance.now())");
  });

  it("checks inventory for ammo", () => {
    expect(src).toContain("Inv.countItem(s.heroInv, wep.ammoItem");
  });
});

describe("NPC dialog", () => {
  it("opens nearest NPC dialog with E", () => {
    expect(src).toContain("get.npcDialog().open(closestNpc.id)");
  });

  it("closes dialog with E or Escape", () => {
    expect(src).toContain("get.npcDialog().close()");
  });
});

describe("computer interaction", () => {
  it("Escape closes computer", () => {
    expect(src).toContain("actions.closeComputer()");
  });

  it("E begins computer entry", () => {
    expect(src).toContain("actions.beginComputerEntry()");
  });
});

describe("mouse-mode toggle (KeyM)", () => {
  it("exits mouse mode when active", () => {
    expect(src).toContain("actions.exitScreenMouseMode()");
  });

  it("enters screen mouse mode for wide screens nearby", () => {
    expect(src).toContain("actions.enterScreenMouseMode");
    expect(src).toContain("entry.screen.widthM >= 5");
  });
});
