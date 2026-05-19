import { it, expect, describe } from "vitest";
import { mountAmmoReloadTick } from "../../src/systems/ammo_reload_tick.js";

function makeEl() {
  return { style: { display: "none" }, textContent: "", _color: "" };
}

function makeActions({ wep = { ammoItem: "pistol_9mm" }, magCap = 12, invAmmo = 10, circleEl = null, ammoEl = null, reloadDur = 1200 } = {}) {
  let _inv = invAmmo;
  return {
    getReloadDur:   () => reloadDur,
    getReloadCircle: () => circleEl,
    getAmmoHud:     () => ammoEl,
    getWeapon:      () => wep,
    getMagCap:      () => magCap,
    countInvAmmo:   () => _inv,
    removeInvAmmo:  (item, n) => { _inv = Math.max(0, _inv - n); },
    setAmmo:        (n) => { /* external setAmmo called */ },
    _getInv: () => _inv,
  };
}

function makeSet(initial = {}) {
  let reloading = initial.reloading ?? false;
  let pistolAmmo = initial.pistolAmmo ?? 0;
  let cooldown = initial.cooldown ?? 0;
  return {
    reloading:     (v) => { reloading = v; },
    pistolAmmo:    (v) => { pistolAmmo = v; },
    pistolCooldown:(v) => { cooldown = v; },
    getPistolAmmo: () => pistolAmmo,
    _state: () => ({ reloading, pistolAmmo, cooldown }),
  };
}

describe("ammo_reload_tick — reload circle visibility", () => {
  it("reloading + not done → circle visible", () => {
    const circle = makeEl();
    const actions = makeActions({ circleEl: circle, reloadDur: 1000 });
    const set = makeSet({ reloading: true, pistolAmmo: 0 });
    const sys = mountAmmoReloadTick({ set, actions });
    sys.tick(0.016, { nowMs: 500, reloading: true, reloadStart: 0, pistolAmmo: 0 });
    expect(circle.style.display).toBe("block");
  });

  it("reloading + done → circle hidden", () => {
    const circle = makeEl();
    const actions = makeActions({ circleEl: circle, reloadDur: 1000, invAmmo: 5 });
    const set = makeSet({ reloading: true, pistolAmmo: 6 });
    const sys = mountAmmoReloadTick({ set, actions });
    sys.tick(0.016, { nowMs: 1100, reloading: true, reloadStart: 0, pistolAmmo: 6 });
    expect(circle.style.display).toBe("none");
  });

  it("not reloading → circle hidden", () => {
    const circle = makeEl();
    const actions = makeActions({ circleEl: circle });
    const set = makeSet();
    const sys = mountAmmoReloadTick({ set, actions });
    sys.tick(0.016, { nowMs: 0, reloading: false, reloadStart: 0, pistolAmmo: 12 });
    expect(circle.style.display).toBe("none");
  });

  it("no circle element → no error", () => {
    const actions = makeActions({ circleEl: null });
    const set = makeSet({ reloading: true });
    const sys = mountAmmoReloadTick({ set, actions });
    expect(() => sys.tick(0.016, { nowMs: 500, reloading: true, reloadStart: 0, pistolAmmo: 0 })).not.toThrow();
  });
});

describe("ammo_reload_tick — reload completion", () => {
  it("on completion → reloading set to false", () => {
    const circle = makeEl();
    const actions = makeActions({ circleEl: circle, reloadDur: 1000, invAmmo: 8 });
    const set = makeSet({ reloading: true, pistolAmmo: 4 });
    const sys = mountAmmoReloadTick({ set, actions });
    sys.tick(0.016, { nowMs: 1100, reloading: true, reloadStart: 0, pistolAmmo: 4 });
    expect(set._state().reloading).toBe(false);
  });

  it("on completion → pistolAmmo refilled from reserve", () => {
    const circle = makeEl();
    // mag=4, cap=12, need=8; reserve=6 → take=6 → newAmmo=10
    const actions = makeActions({ circleEl: circle, reloadDur: 1000, invAmmo: 6, magCap: 12 });
    const set = makeSet({ pistolAmmo: 4 });
    const sys = mountAmmoReloadTick({ set, actions });
    sys.tick(0.016, { nowMs: 1100, reloading: true, reloadStart: 0, pistolAmmo: 4 });
    expect(set._state().pistolAmmo).toBe(10); // 4 + 6
  });

  it("on completion → pistolCooldown reset to 0", () => {
    const circle = makeEl();
    const actions = makeActions({ circleEl: circle, reloadDur: 1000, invAmmo: 5 });
    const set = makeSet({ cooldown: 0.5, pistolAmmo: 6 });
    const sys = mountAmmoReloadTick({ set, actions });
    sys.tick(0.016, { nowMs: 1100, reloading: true, reloadStart: 0, pistolAmmo: 6 });
    expect(set._state().cooldown).toBe(0);
  });

  it("reserve = 0 → ammo unchanged", () => {
    const circle = makeEl();
    const actions = makeActions({ circleEl: circle, reloadDur: 1000, invAmmo: 0 });
    const set = makeSet({ pistolAmmo: 3 });
    const sys = mountAmmoReloadTick({ set, actions });
    sys.tick(0.016, { nowMs: 1100, reloading: true, reloadStart: 0, pistolAmmo: 3 });
    // take = min(9, 0) = 0, so pistolAmmo stays 3
    expect(set._state().pistolAmmo).toBe(3);
  });

  it("already at cap → reserve not consumed", () => {
    const circle = makeEl();
    const actions = makeActions({ circleEl: circle, reloadDur: 1000, invAmmo: 10, magCap: 12 });
    const set = makeSet({ pistolAmmo: 12 });
    const sys = mountAmmoReloadTick({ set, actions });
    sys.tick(0.016, { nowMs: 1100, reloading: true, reloadStart: 0, pistolAmmo: 12 });
    expect(actions._getInv()).toBe(10); // reserve unchanged
  });
});

describe("ammo_reload_tick — ammo HUD", () => {
  it("shows mag / reserve text", () => {
    const ammoEl = makeEl();
    const actions = makeActions({ ammoEl, invAmmo: 6 });
    const set = makeSet({ pistolAmmo: 8 });
    const sys = mountAmmoReloadTick({ set, actions });
    sys.tick(0.016, { nowMs: 0, reloading: false, reloadStart: 0, pistolAmmo: 8 });
    expect(ammoEl.textContent).toBe("8 / 6");
  });

  it("empty mag → red color", () => {
    const ammoEl = makeEl();
    const actions = makeActions({ ammoEl, invAmmo: 5 });
    const set = makeSet({ pistolAmmo: 0 });
    const sys = mountAmmoReloadTick({ set, actions });
    sys.tick(0.016, { nowMs: 0, reloading: false, reloadStart: 0, pistolAmmo: 0 });
    expect(ammoEl.style.color).toBe("#ff5d5d");
  });

  it("non-empty mag → gold color", () => {
    const ammoEl = makeEl();
    const actions = makeActions({ ammoEl, invAmmo: 3 });
    const set = makeSet({ pistolAmmo: 5 });
    const sys = mountAmmoReloadTick({ set, actions });
    sys.tick(0.016, { nowMs: 0, reloading: false, reloadStart: 0, pistolAmmo: 5 });
    expect(ammoEl.style.color).toBe("#ffd166");
  });

  it("no ammo element → no error", () => {
    const actions = makeActions({ ammoEl: null });
    const set = makeSet();
    const sys = mountAmmoReloadTick({ set, actions });
    expect(() => sys.tick(0.016, { nowMs: 0, reloading: false, reloadStart: 0, pistolAmmo: 12 })).not.toThrow();
  });
});
