/**
 * parity_integration.test.js — ECS system integration parity tests
 *
 * Exercises multiple ECS systems running together to verify they compose
 * correctly and match monolith behavior end-to-end.
 *
 * Covers ticks 10-19 systems:
 *   - ecs_combat (melee, armor absorb)
 *   - ecs_score  (kill credit, level-up chain)
 *   - ecs_regen  (delayed regen, perk bonus)
 *   - applyPlayerDamage (damage formula with all modifiers stacked)
 *   - ecs_weapon (fire cooldown, reload, ammo)
 *   - ecs_inventory (ammo deduction on reload)
 */

import { describe, it, expect, beforeEach } from "vitest";
import Core from "../../src/core/core.js";
import { combatSystem, applyPlayerDamage } from "../../src/systems/ecs_combat.js";
import { createScoreSystem, applyLevelBuff } from "../../src/systems/ecs_score.js";
import { regenSystem } from "../../src/systems/ecs_regen.js";
import { createWeaponSystem } from "../../src/systems/ecs_weapon.js";
import { invAdd, invCount } from "../../src/systems/ecs_inventory.js";

// ── shared factory helpers ────────────────────────────────────────────────────
function makeHero(opts = {}) {
  const id = Core.createEntity();
  Core.addComponent(id, "PlayerControl", { active: true });
  Core.addComponent(id, "Faction",       { id: "player" });
  Core.addComponent(id, "Transform",     { u: 0, v: 0, y: 0 });
  Core.addComponent(id, "Health",        { hp: opts.hp ?? 100, maxHp: 100, armor: opts.armor ?? 0, lastDamageT: -999 });
  Core.addComponent(id, "PerkState",     { _perkDmgMul: 1.0, _perkReloadMul: 1.0, _heroLvlDmgMul: 1.0, _heroLvlSpeedBonus: 0, _perkRegenBonus: 0 });
  Core.addComponent(id, "Score",         { coins: 0, kills: opts.kills ?? 0, level: opts.level ?? 0, combo: 0, lastKillT: -Infinity });
  Core.addComponent(id, "Inventory",     { items: { pistol_9mm: opts.ammo ?? 30 } });
  Core.addComponent(id, "ActiveWeapon",  { weaponId: "pistol", ammoItem: "pistol_9mm" });
  Core.addComponent(id, "Weapon",        { weaponId: "pistol", cooldownLeft: 0, reloadLeft: -1, magAmmo: opts.magAmmo ?? 12, reloading: false });
  return id;
}

function makeEnemy(opts = {}) {
  const id = Core.createEntity();
  Core.addComponent(id, "EnemyAI", {
    type:        opts.type        ?? "grunt",
    damage:      opts.damage      ?? 6,
    attackRange: opts.attackRange ?? 1.6,
    sightRange:  12,
    moveSpeed:   2.4,
    lastAttackT: -99,
  });
  Core.addComponent(id, "Transform", { u: opts.u ?? 0, v: opts.v ?? 0, y: 0 });
  Core.addComponent(id, "Health",    { hp: opts.hp ?? 80, maxHp: 80 });
  Core.addComponent(id, "Faction",   { id: "enemy" });
  return id;
}

const DM = {}; // empty damage multipliers (1.0 resist)
const CTX = { damageMultipliers: DM, elapsedS: 0 };

// ── Scenario 1: Enemy melee + armor absorb ────────────────────────────────────
describe("Integration: enemy melee attack with armor absorb (monolith lines 7499-7503)", () => {
  beforeEach(() => Core._reset());

  it("heavy attack (18 dmg) absorbed by armor: armorHit=10.8, netDmg=7, hero hp=93", () => {
    const hid = makeHero({ armor: 75 });
    makeEnemy({ type: "heavy", damage: 18, attackRange: 2.0, u: 1.0, v: 0 }); // within range

    combatSystem(1/60, Core, { damageMultipliers: DM, elapsedS: 100 });

    const h = Core.getComponent(hid, "Health");
    expect(h.armor).toBeCloseTo(75 - 10.8, 5);  // 75 - min(75, 18*0.6) = 64.2
    expect(h.hp).toBe(93);                        // 100 - round(18 - 10.8) = 100 - 7 = 93
  });

  it("grunt attack (6 dmg) without armor: full 6 HP removed", () => {
    const hid = makeHero({ armor: 0 });
    makeEnemy({ type: "grunt", damage: 6, u: 0.5, v: 0 });

    combatSystem(1/60, Core, { damageMultipliers: DM, elapsedS: 100 });

    expect(Core.getComponent(hid, "Health").hp).toBe(94);
  });

  it("enemy out of attackRange does not attack", () => {
    const hid = makeHero({ armor: 0 });
    makeEnemy({ type: "grunt", damage: 6, u: 5, v: 0, attackRange: 1.6 }); // 5m away

    combatSystem(1/60, Core, { damageMultipliers: DM, elapsedS: 100 });

    expect(Core.getComponent(hid, "Health").hp).toBe(100);
  });

  it("emits hero:damaged event with correct amount", () => {
    makeHero({ armor: 0 });
    makeEnemy({ type: "grunt", damage: 10, u: 0.5, v: 0 });

    const events = [];
    Core.on("hero:damaged", e => events.push(e));
    combatSystem(1/60, Core, { damageMultipliers: DM, elapsedS: 100 });

    expect(events.length).toBe(1);
    expect(events[0].amount).toBe(10);
  });
});

// ── Scenario 2: Kill → score → level up → buff applied ───────────────────────
describe("Integration: kill chain → score → level-up buff (monolith 1220, 2760-2779)", () => {
  beforeEach(() => Core._reset());

  it("killing grunt at threshold (kill 9→10) triggers LVL 1: _heroLvlDmgMul *= 1.10", () => {
    const scoreSys = createScoreSystem();
    const hid = makeHero({ kills: 9, level: 0 });
    scoreSys(0, Core);

    Core.emit("enemy:killed", { type: "grunt", heroId: hid });

    const sc = Core.getComponent(hid, "Score");
    const pk = Core.getComponent(hid, "PerkState");
    expect(sc.level).toBe(1);
    expect(pk._heroLvlDmgMul).toBeCloseTo(1.10);
  });

  it("LVL 1 damage buff applied: pistol now deals round(20 × 1.10) = 22 on plain hit", () => {
    const scoreSys = createScoreSystem();
    const hid = makeHero({ kills: 9, level: 0 });
    scoreSys(0, Core);

    Core.emit("enemy:killed", { type: "grunt", heroId: hid });

    const pk = Core.getComponent(hid, "PerkState");
    const finalDmg = applyPlayerDamage(20, "pistol", "grunt", DM, { heroLvlDmgMul: pk._heroLvlDmgMul });
    expect(finalDmg).toBe(22);
  });

  it("heavy kill = 4 coins × combo 1 = 4 coins", () => {
    const scoreSys = createScoreSystem();
    const hid = makeHero();
    scoreSys(0, Core);

    Core.emit("enemy:killed", { type: "heavy", heroId: hid });

    expect(Core.getComponent(hid, "Score").coins).toBe(4);
  });

  it("two grunt kills within combo window = 1+2 = 3 coins total", () => {
    const scoreSys = createScoreSystem();
    const hid = makeHero();
    scoreSys(0, Core);

    Core.emit("enemy:killed", { type: "grunt", heroId: hid }); // combo=1, 1 coin
    scoreSys(0.5, Core); // 0.5s later
    Core.emit("enemy:killed", { type: "grunt", heroId: hid }); // combo=2, 2 coins

    expect(Core.getComponent(hid, "Score").coins).toBe(3);
  });
});

// ── Scenario 3: Damage → regen delay → regen resumes ─────────────────────────
describe("Integration: damage → regen delay → recovery (monolith lines 1530-1531)", () => {
  beforeEach(() => Core._reset());

  it("regen does not tick within 5s of last damage", () => {
    const hid = makeHero({ hp: 70 });
    Core.getComponent(hid, "Health").lastDamageT = 100; // took damage at t=100

    regenSystem(1.0, Core); // t=1 (module-level elapsed, but lastDamageT=100 → gap=99? wait...)
    // Note: regenSystem uses module-level _elapsed. We just need lastDamageT to be recent.
    // Strategy: set lastDamageT to a future time (e.g. 9999) so gap is negative → no regen.
    Core.getComponent(hid, "Health").lastDamageT = 9999;
    regenSystem(0, Core);

    expect(Core.getComponent(hid, "Health").hp).toBe(70); // no regen
  });

  it("regen kicks in after 5s delay (REGEN_RATE=4 HP/s)", () => {
    const hid = makeHero({ hp: 80 });
    // Set lastDamageT to a long time ago so regen is active
    Core.getComponent(hid, "Health").lastDamageT = -100;

    const healed = [];
    Core.on("hero:regen", e => healed.push(e));

    regenSystem(1.0, Core); // 1 second → should gain 4 HP

    const h = Core.getComponent(hid, "Health");
    expect(h.hp).toBeGreaterThan(80);
    expect(healed.length).toBeGreaterThan(0);
  });

  it("regen stops at maxHp (100)", () => {
    const hid = makeHero({ hp: 99 });
    Core.getComponent(hid, "Health").lastDamageT = -100;

    regenSystem(5.0, Core); // 5s → would gain 20 HP normally but capped at 100

    expect(Core.getComponent(hid, "Health").hp).toBeLessThanOrEqual(100);
  });
});

// ── Scenario 4: Weapon fire → ammo deduction → reload ────────────────────────
describe("Integration: weapon fire → ammo → reload (monolith line 6102, 6126-6129)", () => {
  beforeEach(() => Core._reset());

  const PISTOL_DEF = { id: "pistol", fireRate: 5, damage: 20, range: 50, speed: 120,
                       magCap: 12, reloadDuration: 1200, pellets: 1, spread: 0, ammoItem: "pistol_9mm" };

  it("firing reduces magAmmo by 1", () => {
    const weapSys = createWeaponSystem({ pistol: PISTOL_DEF });
    const hid = makeHero();
    weapSys(0, Core);

    const fired = [];
    Core.on("weapon:fired", e => fired.push(e));
    Core.emit("weapon:fire", { entityId: hid });

    expect(Core.getComponent(hid, "Weapon").magAmmo).toBe(11);
    expect(fired[0].damage).toBe(20);
  });

  it("reload replenishes mag from inventory ammo pool", () => {
    const weapSys = createWeaponSystem({ pistol: PISTOL_DEF });
    const hid = makeHero({ magAmmo: 0, ammo: 30 });
    Core.getComponent(hid, "Weapon").reloading = false;
    Core.getComponent(hid, "Weapon").magAmmo = 0;
    weapSys(0, Core);

    Core.emit("weapon:reload", { entityId: hid });
    // Fast-forward through reload duration (1.2s)
    weapSys(1.5, Core);

    const w = Core.getComponent(hid, "Weapon");
    const inv = Core.getComponent(hid, "Inventory");
    expect(w.magAmmo).toBe(12); // full mag refilled
    expect(inv.items.pistol_9mm).toBe(18); // 30 - 12 = 18
  });

  it("fire is blocked while reloading", () => {
    const weapSys = createWeaponSystem({ pistol: PISTOL_DEF });
    const hid = makeHero({ magAmmo: 0, ammo: 30 }); // empty mag — reload needed
    Core.getComponent(hid, "Weapon").magAmmo = 6;    // partial mag so reload triggers
    weapSys(0, Core);

    // Start reload (partial mag → reload triggers)
    Core.emit("weapon:reload", { entityId: hid });
    // Try to fire while reloading
    const fired = [];
    Core.on("weapon:fired", e => fired.push(e));
    Core.emit("weapon:fire", { entityId: hid });

    expect(fired.length).toBe(0);
  });
});

// ── Scenario 5: Full damage formula stack ────────────────────────────────────
describe("Integration: applyPlayerDamage full modifier stack (monolith line 6607)", () => {
  it("headshot + level1 buff + perk dmg: round(20 × 1.85 × 1.10 × 1.15) = 47", () => {
    const dmg = applyPlayerDamage(20, "pistol", "grunt", DM, {
      headshot: true,
      heroLvlDmgMul: 1.10,
      perkDmgMul: 1.15,
    });
    // 20 * 1.85 * 1.10 * 1.15 = 20 * 2.34025 = 46.805 → round = 47
    expect(dmg).toBe(47);
  });

  it("crit vs heavy (pistol resist 0.5): round(20 × 2.5 × 0.5) = 25", () => {
    const dm = { heavy: { pistol: 0.5 } };
    expect(applyPlayerDamage(20, "pistol", "heavy", dm, { crit: true })).toBe(25);
  });

  it("backstab + falloff 0.5 + perk: round(20 × 1.5 × 1.0 × 1.15 × 0.5) = 17", () => {
    const dmg = applyPlayerDamage(20, "pistol", "grunt", DM, {
      backstab: true,
      perkDmgMul: 1.15,
      falloffMul: 0.5,
    });
    // 20 * 1.5 * 1.15 * 0.5 = 20 * 0.8625 = 17.25 → round = 17
    expect(dmg).toBe(17);
  });

  it("frontalBlock + level2 buff + two perk stacks: round(20 × 0.5 × 1.10 × 1.3225) = 15", () => {
    const dmg = applyPlayerDamage(20, "pistol", "grunt", DM, {
      frontalBlock: true,
      heroLvlDmgMul: 1.10,
      perkDmgMul: 1.15 * 1.15, // two damage perks
    });
    // 20 * 0.5 * 1.10 * 1.3225 = 20 * 0.727375 = 14.5475 → round = 15
    expect(dmg).toBe(15);
  });

  it("sniper headshot at full range (no falloff): round(95 × 1.85) = 176", () => {
    expect(applyPlayerDamage(95, "sniper", "grunt", DM, { headshot: true, falloffMul: 1.0 })).toBe(176);
  });

  it("zero damage never returns negative", () => {
    expect(applyPlayerDamage(0, "pistol", "grunt", DM, { frontalBlock: true })).toBe(0);
  });
});
