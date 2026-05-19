import { it, expect, describe } from "vitest";
import { mountWeaponHudTick } from "../../src/systems/weapon_hud_tick.js";

function makeState() {
  let lowAmmoWarnedAt = -1, lastMagBarAmmo = -1, lastMagBarReloading = false;
  return {
    get: {
      lowAmmoWarnedAt:     () => lowAmmoWarnedAt,
      lastMagBarAmmo:      () => lastMagBarAmmo,
      lastMagBarReloading: () => lastMagBarReloading,
    },
    set: {
      lowAmmoWarnedAt:     v => { lowAmmoWarnedAt = v; },
      lastMagBarAmmo:      v => { lastMagBarAmmo = v; },
      lastMagBarReloading: v => { lastMagBarReloading = v; },
    },
  };
}

function makeActions(wp = {}, reserve = 30, sfxLog = []) {
  return {
    getWeapon:  () => ({ name: "Pistol", id: "pistol", magCap: 12, ammoItem: "pistol_9mm", ...wp }),
    getReserve: () => reserve,
    playSfx:    (str, vol) => sfxLog.push({ str, vol }),
  };
}

function makeEl(withChild = false) {
  const el = { style: { color: "" }, textContent: "", innerHTML: "" };
  if (withChild) el.childNodes = [{ textContent: "" }];
  return el;
}

const NULL_ELS = { wpName: null, wpAmmo: null, wpReserve: null, wpMagBar: null, wpGrenades: null };
const DEFAULT_GRENADES = { frag: 3, smoke: 2, flash: 1, mines: 0 };

function makeTick(wpOverride = {}, reserve = 30) {
  const state = makeState();
  const sfxLog = [];
  const { tick } = mountWeaponHudTick({ ...state, actions: makeActions(wpOverride, reserve, sfxLog) });
  return { tick, sfxLog, ...state };
}

// Helper: els with a live wpName anchor so the early-return guard passes
function withAnchor(extras = {}) { return { ...NULL_ELS, wpName: makeEl(), ...extras }; }

describe("weapon_hud_tick — null safety", () => {
  it("does not throw when wpName and wpAmmo are both null", () => {
    const { tick } = makeTick();
    expect(() => tick(0, 8, false, DEFAULT_GRENADES, NULL_ELS)).not.toThrow();
  });
});

describe("weapon_hud_tick — weapon name", () => {
  it("sets wpName to weapon name in UPPER CASE", () => {
    const { tick } = makeTick({ name: "shotgun" });
    const name = makeEl();
    tick(0, 8, false, DEFAULT_GRENADES, { ...NULL_ELS, wpName: name });
    expect(name.textContent).toBe("SHOTGUN");
  });

  it("falls back to weapon id when name is absent", () => {
    const { tick } = makeTick({ name: undefined, id: "ak47" });
    const name = makeEl();
    tick(0, 8, false, DEFAULT_GRENADES, { ...NULL_ELS, wpName: name });
    expect(name.textContent).toBe("AK47");
  });

  it("falls back to 'WEAPON' when name and id absent", () => {
    const { tick } = makeTick({ name: undefined, id: undefined });
    const name = makeEl();
    tick(0, 8, false, DEFAULT_GRENADES, { ...NULL_ELS, wpName: name });
    expect(name.textContent).toBe("WEAPON");
  });
});

describe("weapon_hud_tick — ammo display", () => {
  it("sets wpAmmo childNodes[0].textContent to pistolAmmo", () => {
    const { tick } = makeTick();
    const ammo = makeEl(true);
    tick(0, 7, false, DEFAULT_GRENADES, { ...NULL_ELS, wpAmmo: ammo });
    expect(ammo.childNodes[0].textContent).toBe(7);
  });

  it("sets wpReserve text to ' / N'", () => {
    const { tick } = makeTick({}, 45);
    const res = makeEl();
    tick(0, 8, false, DEFAULT_GRENADES, withAnchor({ wpReserve: res }));
    expect(res.textContent).toBe(" / 45");
  });
});

describe("weapon_hud_tick — low ammo warning", () => {
  it("low ammo color is red (one of two flash values) at ≤25% mag", () => {
    const { tick } = makeTick({ magCap: 12 }); // thresh = 3
    const ammo = makeEl(true);
    // sin(0/110) = 0, not > 0, so we get #ff8888
    tick(0, 2, false, DEFAULT_GRENADES, { ...NULL_ELS, wpAmmo: ammo });
    expect(["#ff2222", "#ff8888"]).toContain(ammo.style.color);
  });

  it("normal ammo color is --holo-warn", () => {
    const { tick } = makeTick({ magCap: 12 }); // thresh = 3
    const ammo = makeEl(true);
    tick(0, 8, false, DEFAULT_GRENADES, { ...NULL_ELS, wpAmmo: ammo });
    expect(ammo.style.color).toBe("var(--holo-warn)");
  });

  it("no low ammo warning when reloading", () => {
    const { tick } = makeTick({ magCap: 12 });
    const ammo = makeEl(true);
    tick(0, 2, true, DEFAULT_GRENADES, { ...NULL_ELS, wpAmmo: ammo });
    expect(ammo.style.color).toBe("var(--holo-warn)");
  });

  it("playSfx called when new low ammo threshold crossed", () => {
    const { tick, sfxLog } = makeTick({ magCap: 12 });
    const ammo = makeEl(true);
    tick(0, 2, false, DEFAULT_GRENADES, { ...NULL_ELS, wpAmmo: ammo });
    expect(sfxLog.length).toBe(2);
    expect(sfxLog[0].str).toBe("tone:440:60:square");
  });

  it("playSfx NOT called again for same ammo count", () => {
    const state = makeState();
    const sfxLog = [];
    const { tick } = mountWeaponHudTick({ ...state, actions: makeActions({ magCap: 12 }, 30, sfxLog) });
    const ammo = makeEl(true);
    tick(0, 2, false, DEFAULT_GRENADES, { ...NULL_ELS, wpAmmo: ammo });
    tick(0, 2, false, DEFAULT_GRENADES, { ...NULL_ELS, wpAmmo: ammo });
    expect(sfxLog.length).toBe(2); // only first call
  });

  it("lowAmmoWarnedAt resets to -1 when not low ammo", () => {
    const state = makeState();
    const sfxLog = [];
    const { tick } = mountWeaponHudTick({ ...state, actions: makeActions({ magCap: 12 }, 30, sfxLog) });
    state.set.lowAmmoWarnedAt(2); // simulate a previous warning
    const ammo = makeEl(true);
    tick(0, 8, false, DEFAULT_GRENADES, { ...NULL_ELS, wpAmmo: ammo });
    expect(state.get.lowAmmoWarnedAt()).toBe(-1);
  });
});

describe("weapon_hud_tick — mag bar", () => {
  it("mag bar innerHTML has correct number of div pips", () => {
    const { tick } = makeTick({ magCap: 12 });
    const magBar = makeEl();
    tick(0, 6, false, DEFAULT_GRENADES, withAnchor({ wpMagBar: magBar }));
    const matches = (magBar.innerHTML.match(/<div/g) || []).length;
    expect(matches).toBe(12);
  });

  it("mag bar caps at 30 pips even for large magCap", () => {
    const { tick } = makeTick({ magCap: 100 });
    const magBar = makeEl();
    tick(0, 50, false, DEFAULT_GRENADES, withAnchor({ wpMagBar: magBar }));
    const matches = (magBar.innerHTML.match(/<div/g) || []).length;
    expect(matches).toBe(30);
  });

  it("reloading pips use orange color", () => {
    const { tick } = makeTick({ magCap: 8 });
    const magBar = makeEl();
    tick(0, 4, true, DEFAULT_GRENADES, withAnchor({ wpMagBar: magBar }));
    expect(magBar.innerHTML).toContain("#ff8800");
    expect(magBar.innerHTML).not.toContain("#00ccff");
  });

  it("lit pips use cyan color when not reloading", () => {
    const { tick } = makeTick({ magCap: 8 });
    const magBar = makeEl();
    tick(0, 4, false, DEFAULT_GRENADES, withAnchor({ wpMagBar: magBar }));
    expect(magBar.innerHTML).toContain("#00ccff");
  });

  it("mag bar not updated when pistolAmmo and reloading unchanged", () => {
    const state = makeState();
    state.set.lastMagBarAmmo(6);
    state.set.lastMagBarReloading(false);
    const { tick } = mountWeaponHudTick({ ...state, actions: makeActions({ magCap: 12 }) });
    const magBar = makeEl();
    magBar.innerHTML = "UNCHANGED";
    tick(0, 6, false, DEFAULT_GRENADES, { ...NULL_ELS, wpMagBar: magBar });
    expect(magBar.innerHTML).toBe("UNCHANGED");
  });
});

describe("weapon_hud_tick — grenades", () => {
  it("grenade line contains frag count", () => {
    const { tick } = makeTick();
    const gren = makeEl();
    tick(0, 8, false, { frag: 5, smoke: 2, flash: 1, mines: 3 }, withAnchor({ wpGrenades: gren }));
    expect(gren.innerHTML).toContain("5 frag");
  });

  it("mine label is singular when mines === 1", () => {
    const { tick } = makeTick();
    const gren = makeEl();
    tick(0, 8, false, { frag: 0, smoke: 0, flash: 0, mines: 1 }, withAnchor({ wpGrenades: gren }));
    expect(gren.innerHTML).toContain("1 mine ");
    expect(gren.innerHTML).not.toContain("1 mines");
  });

  it("mine label is plural when mines !== 1", () => {
    const { tick } = makeTick();
    const gren = makeEl();
    tick(0, 8, false, { frag: 0, smoke: 0, flash: 0, mines: 3 }, withAnchor({ wpGrenades: gren }));
    expect(gren.innerHTML).toContain("3 mines");
  });
});

describe("weapon_hud_tick — fuzz", () => {
  it("never throws for 20 random states", () => {
    const state = makeState();
    const sfxLog = [];
    const { tick } = mountWeaponHudTick({ ...state, actions: makeActions({ magCap: 12 }, 30, sfxLog) });
    const ammo = makeEl(true), name = makeEl(), res = makeEl(), magBar = makeEl(), gren = makeEl();
    for (let i = 0; i < 20; i++) {
      const pa = Math.floor(Math.random() * 13);
      const reload = Math.random() > 0.5;
      const nowMs = Math.random() * 10000;
      expect(() => tick(nowMs, pa, reload, DEFAULT_GRENADES, {
        wpName: name, wpAmmo: ammo, wpReserve: res, wpMagBar: magBar, wpGrenades: gren
      })).not.toThrow();
    }
  });
});
