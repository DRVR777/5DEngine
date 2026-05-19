import { it, expect, describe } from "vitest";
import { mountWeaponAmmo } from "../../src/systems/weapon_ammo.js";

const PISTOL = { id: "pistol", magCap: 12, damage: 20, fireRate: 5, ammoItem: "pistol_9mm",
                 range: 30, speed: 80, bulletRadius: 0.04, reloadDuration: 1200,
                 pellets: 1, spread: 0, automatic: false };
const RIFLE  = { id: "rifle",  magCap: 30, damage: 35, fireRate: 12, ammoItem: "rifle_556",
                 range: 60, speed: 120, bulletRadius: 0.03, reloadDuration: 2000,
                 pellets: 1, spread: 0.01, automatic: true };

function makeAmmo(weapons = [PISTOL, RIFLE], activeId = "pistol") {
  let _id = activeId;
  return {
    sys: mountWeaponAmmo({ getWeapons: () => weapons, getActiveWeaponId: () => _id }),
    setActiveId: (id) => { _id = id; },
  };
}

describe("getWeapon", () => {
  it("returns the matching weapon by active id", () => {
    const { sys, setActiveId } = makeAmmo();
    setActiveId("rifle");
    expect(sys.getWeapon().id).toBe("rifle");
    expect(sys.getWeapon().magCap).toBe(30);
  });

  it("falls back to pistol defaults when id not found", () => {
    const { sys, setActiveId } = makeAmmo();
    setActiveId("bazooka");
    expect(sys.getWeapon().id).toBe("pistol");
    expect(sys.getWeapon().magCap).toBe(12);
  });

  it("falls back to pistol defaults when weapons array is empty", () => {
    const sys = mountWeaponAmmo({ getWeapons: () => [], getActiveWeaponId: () => "rifle" });
    expect(sys.getWeapon().id).toBe("pistol");
  });

  it("falls back when getWeapons returns null", () => {
    const sys = mountWeaponAmmo({ getWeapons: () => null, getActiveWeaponId: () => "pistol" });
    expect(sys.getWeapon().id).toBe("pistol");
  });
});

describe("getAmmo / setAmmo", () => {
  it("returns full mag cap before any setAmmo call", () => {
    const { sys } = makeAmmo();
    expect(sys.getAmmo()).toBe(12); // pistol magCap
  });

  it("returns stored value after setAmmo", () => {
    const { sys } = makeAmmo();
    sys.setAmmo(7);
    expect(sys.getAmmo()).toBe(7);
  });

  it("tracks ammo independently per weapon", () => {
    const { sys, setActiveId } = makeAmmo();
    sys.setAmmo(5);           // pistol = 5
    setActiveId("rifle");
    expect(sys.getAmmo()).toBe(30); // rifle: never set → full mag
    sys.setAmmo(18);          // rifle = 18
    setActiveId("pistol");
    expect(sys.getAmmo()).toBe(5);  // pistol still 5
  });

  it("setAmmo persists into weaponAmmo Map", () => {
    const { sys } = makeAmmo();
    sys.setAmmo(3);
    expect(sys.weaponAmmo.get("pistol")).toBe(3);
  });
});

it("getAmmo reflects rifle magCap when switching to rifle with no prior setAmmo", () => {
  const { sys, setActiveId } = makeAmmo();
  setActiveId("rifle");
  expect(sys.getAmmo()).toBe(30);
});
