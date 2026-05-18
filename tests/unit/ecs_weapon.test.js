import { describe, it, expect, beforeEach } from "vitest";
import { createWeaponSystem, makeWeaponComponent } from "../../src/systems/ecs_weapon.js";
import Core from "../../src/core/core.js";

const DEFS = {
  pistol:  { id: "pistol",  ammoItem: "pistol_9mm",  fireRate: 5,   damage: 20, magCap: 12, reloadDuration: 1200, pellets: 1, spread: 0, range: 30 },
  rifle:   { id: "rifle",   ammoItem: "rifle_556",   fireRate: 12,  damage: 25, magCap: 30, reloadDuration: 2000, pellets: 1, spread: 0.015 },
  shotgun: { id: "shotgun", ammoItem: "shotgun_12g", fireRate: 1.2, damage: 14, magCap: 8,  reloadDuration: 2800, pellets: 9, spread: 0.14 },
};

function makeShooter(weaponId = "pistol", magAmmo = 12, ammo = 60) {
  const id = Core.createEntity();
  Core.addComponent(id, "Weapon",    makeWeaponComponent(DEFS[weaponId]));
  Core.addComponent(id, "Inventory", { items: { [DEFS[weaponId].ammoItem]: ammo } });
  Core.addComponent(id, "PerkState", { _perkReloadMul: 1.0, _perkDmgMul: 1.0 });
  Core.getComponent(id, "Weapon").magAmmo = magAmmo;
  return id;
}

describe("makeWeaponComponent", () => {
  it("creates a weapon component with full mag", () => {
    const comp = makeWeaponComponent(DEFS.pistol);
    expect(comp.weaponId).toBe("pistol");
    expect(comp.magAmmo).toBe(12);
    expect(comp.reloading).toBe(false);
    expect(comp.cooldownLeft).toBe(0);
  });
});

describe("createWeaponSystem — fire", () => {
  beforeEach(() => { Core._reset(); });

  it("emits weapon:fired on fire event when ammo available", () => {
    const sys = createWeaponSystem(DEFS);
    const id = makeShooter();
    sys(0, Core);

    const fired = [];
    Core.on("weapon:fired", e => fired.push(e));
    Core.emit("weapon:fire", { entityId: id });
    expect(fired.length).toBe(1);
    expect(fired[0].weaponId).toBe("pistol");
    expect(fired[0].damage).toBe(20);
  });

  it("decrements magAmmo on fire", () => {
    const sys = createWeaponSystem(DEFS);
    const id = makeShooter("pistol", 12);
    sys(0, Core);

    Core.emit("weapon:fire", { entityId: id });
    expect(Core.getComponent(id, "Weapon").magAmmo).toBe(11);
  });

  it("sets cooldownLeft = 1/fireRate after firing", () => {
    const sys = createWeaponSystem(DEFS);
    const id = makeShooter();
    sys(0, Core);

    Core.emit("weapon:fire", { entityId: id });
    const cd = Core.getComponent(id, "Weapon").cooldownLeft;
    expect(cd).toBeCloseTo(1 / 5, 3); // pistol fireRate=5
  });

  it("does NOT fire during cooldown", () => {
    const sys = createWeaponSystem(DEFS);
    const id = makeShooter();
    sys(0, Core);

    Core.emit("weapon:fire", { entityId: id });
    const fired = [];
    Core.on("weapon:fired", e => fired.push(e));
    Core.emit("weapon:fire", { entityId: id }); // too soon
    expect(fired.length).toBe(0);
  });

  it("emits weapon:empty when mag is empty and triggers auto-reload", () => {
    const sys = createWeaponSystem(DEFS);
    const id = makeShooter("pistol", 0, 60); // empty mag, has ammo
    sys(0, Core);

    const emptyEvt = [];
    const reloadEvt = [];
    Core.on("weapon:empty",        e => emptyEvt.push(e));
    Core.on("weapon:reload_start", e => reloadEvt.push(e));
    Core.emit("weapon:fire", { entityId: id });
    expect(emptyEvt.length).toBe(1);
    expect(reloadEvt.length).toBe(1);
  });

  it("shotgun fires with pellets=9 and spread in event", () => {
    const sys = createWeaponSystem(DEFS);
    const id = makeShooter("shotgun", 8, 32);
    sys(0, Core);

    const fired = [];
    Core.on("weapon:fired", e => fired.push(e));
    Core.emit("weapon:fire", { entityId: id });
    expect(fired[0].pellets).toBe(9);
    expect(fired[0].spread).toBe(0.14);
  });
});

describe("createWeaponSystem — reload", () => {
  beforeEach(() => { Core._reset(); });

  it("starts reload on weapon:reload event", () => {
    const sys = createWeaponSystem(DEFS);
    const id = makeShooter("pistol", 6, 60); // half mag
    sys(0, Core);

    const events = [];
    Core.on("weapon:reload_start", e => events.push(e));
    Core.emit("weapon:reload", { entityId: id });
    expect(events.length).toBe(1);
    expect(Core.getComponent(id, "Weapon").reloading).toBe(true);
  });

  it("completes reload after reloadDuration seconds and refills mag", () => {
    const sys = createWeaponSystem(DEFS);
    const id = makeShooter("pistol", 6, 60); // 6 rounds in mag, 60 in reserve
    sys(0, Core);
    Core.emit("weapon:reload", { entityId: id });

    const done = [];
    Core.on("weapon:reload_done", e => done.push(e));
    sys(1.5, Core); // pistol reload = 1.2s, so 1.5s should complete it
    expect(done.length).toBe(1);
    expect(Core.getComponent(id, "Weapon").magAmmo).toBe(12);
    expect(Core.getComponent(id, "Inventory").items["pistol_9mm"]).toBe(54); // 60 - 6
  });

  it("does not reload if mag is already full", () => {
    const sys = createWeaponSystem(DEFS);
    const id = makeShooter("pistol", 12, 60); // full mag
    sys(0, Core);

    const events = [];
    Core.on("weapon:reload_start", e => events.push(e));
    Core.emit("weapon:reload", { entityId: id });
    expect(events.length).toBe(0);
  });

  it("does not reload if no ammo in reserve", () => {
    const sys = createWeaponSystem(DEFS);
    const id = makeShooter("pistol", 0, 0); // no reserve
    sys(0, Core);

    const events = [];
    Core.on("weapon:reload_start", e => events.push(e));
    Core.emit("weapon:reload", { entityId: id });
    expect(events.length).toBe(0);
  });

  it("perk reload mul shortens reload time", () => {
    const sys = createWeaponSystem(DEFS);
    const id = makeShooter("pistol", 6, 60);
    Core.getComponent(id, "PerkState")._perkReloadMul = 0.85;
    sys(0, Core);
    Core.emit("weapon:reload", { entityId: id });

    const weapon = Core.getComponent(id, "Weapon");
    // Reduced duration: 1.2s * 0.85 = 1.02s
    expect(weapon.reloadLeft).toBeCloseTo(1.02, 2);
  });

  it("blocks firing while reloading", () => {
    const sys = createWeaponSystem(DEFS);
    const id = makeShooter("pistol", 6, 60);
    sys(0, Core);
    Core.emit("weapon:reload", { entityId: id });

    const fired = [];
    Core.on("weapon:fired", e => fired.push(e));
    Core.emit("weapon:fire", { entityId: id });
    expect(fired.length).toBe(0);
  });
});

describe("createWeaponSystem — weapon switch", () => {
  beforeEach(() => { Core._reset(); });

  it("switches to new weapon on weapon:switch event", () => {
    const sys = createWeaponSystem(DEFS);
    const id = makeShooter("pistol");
    Core.addComponent(id, "Inventory", { items: { rifle_556: 60, pistol_9mm: 60 } });
    sys(0, Core);

    Core.emit("weapon:switch", { entityId: id, weaponId: "rifle" });
    expect(Core.getComponent(id, "Weapon").weaponId).toBe("rifle");
  });

  it("emits weapon:switched event", () => {
    const sys = createWeaponSystem(DEFS);
    const id = makeShooter("pistol");
    sys(0, Core);

    const events = [];
    Core.on("weapon:switched", e => events.push(e));
    Core.emit("weapon:switch", { entityId: id, weaponId: "shotgun" });
    expect(events.length).toBe(1);
    expect(events[0].weaponId).toBe("shotgun");
  });

  it("cancels reload on weapon switch", () => {
    const sys = createWeaponSystem(DEFS);
    const id = makeShooter("pistol", 6, 60);
    sys(0, Core);
    Core.emit("weapon:reload", { entityId: id });
    Core.emit("weapon:switch", { entityId: id, weaponId: "rifle" });
    expect(Core.getComponent(id, "Weapon").reloading).toBe(false);
  });

  it("cooldown resets on switch", () => {
    const sys = createWeaponSystem(DEFS);
    const id = makeShooter("pistol", 12, 60);
    sys(0, Core);
    Core.emit("weapon:fire", { entityId: id }); // sets cooldown
    Core.emit("weapon:switch", { entityId: id, weaponId: "rifle" });
    expect(Core.getComponent(id, "Weapon").cooldownLeft).toBe(0);
  });

  it("sys.defs exposes weapon definitions", () => {
    const sys = createWeaponSystem(DEFS);
    expect(sys.defs["pistol"]).toBeDefined();
    expect(sys.defs["pistol"].damage).toBe(20);
  });
});
