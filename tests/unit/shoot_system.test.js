import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const src = readFileSync("src/combat/shoot_system.js", "utf8");

describe("shoot_system", () => {
  it("exports mountShootSystem", () => {
    expect(src).toContain("export function mountShootSystem");
  });

  it("returns tryShoot, tryDroneShoot, getAimAngle", () => {
    expect(src).toContain("tryShoot");
    expect(src).toContain("tryDroneShoot");
    expect(src).toContain("getAimAngle");
  });

  it("respects shopOpen guard", () => {
    expect(src).toContain("get.shopOpen()");
  });

  it("handles reload cancel when ammo remains", () => {
    expect(src).toContain("get.reloading()");
    expect(src).toContain("set.reloading(false)");
    expect(src).toContain("set.reloadMsg");
  });

  it("triggers auto-reload from reserve inventory", () => {
    expect(src).toContain("Inv.countItem(get.heroInv()");
    expect(src).toContain("set.reloadStart");
    expect(src).toContain("get.reloadDur()");
  });

  it("auto-switches to weapon with ammo when fully dry", () => {
    expect(src).toContain("get.weapons()");
    expect(src).toContain("actions.switchGunMesh");
    expect(src).toContain("actions.showWeaponSelector");
  });

  it("decrements pistolAmmo and syncs weaponAmmo map", () => {
    expect(src).toContain("set.pistolAmmo(newAmmo)");
    expect(src).toContain("set.weaponAmmoEntry(get.currentWeaponId(), newAmmo)");
  });

  it("uses get.moveSpread for spread calculation", () => {
    expect(src).toContain("get.moveSpread()");
  });

  it("spawns bullets with weapon properties", () => {
    expect(src).toContain("bullets3D.push");
    expect(src).toContain("wep.speed");
    expect(src).toContain("wep.damage");
    expect(src).toContain("weaponId: curId");
  });

  it("increments shotsFired via setter", () => {
    expect(src).toContain("set.shotsFired(get.shotsFired() + 1)");
  });

  it("sets gunshot alert state", () => {
    expect(src).toContain("set.heroShotAlertU");
    expect(src).toContain("set.heroShotAlertV");
    expect(src).toContain("set.heroShotAlertT(3.0)");
  });

  it("applies recoil and kick via setters", () => {
    expect(src).toContain("set.addRecoilPitch");
    expect(src).toContain("set.gunKickZ");
  });

  it("drone fires burst of 2 bullets with cyan material", () => {
    expect(src).toContain("0x00eeff");
    expect(src).toContain("for (let i = 0; i < 2; i++)");
    expect(src).toContain("speed: 38");
    expect(src).toContain("damage: 20");
  });

  it("drone respects cooldown via getter/setter", () => {
    expect(src).toContain("get.droneCooldown()");
    expect(src).toContain("set.droneCooldown(0.22)");
  });

  it("drone uses activeVehicleId getter", () => {
    expect(src).toContain("get.activeVehicleId()");
  });

  it("getAimAngle falls back to camYaw when horizontal is tiny", () => {
    expect(src).toContain("get.camYaw()");
    expect(src).toContain("h > 0.001");
  });

  it("excludes heroGroup and camera children from aim raycast", () => {
    expect(src).toContain("heroGroup");
    expect(src).toContain("_p === camera");
  });
});
