import { describe, it, expect, beforeEach } from "vitest";
import { applyPlayerDamage, combatSystem } from "../../src/systems/ecs_combat.js";
import Core from "../../src/core/core.js";

// Mirrors data/enemies/damage_multipliers.json $facets
const DM = {
  heavy:  { pistol: 0.5, shotgun: 0.7, rifle: 1.0, smg: 0.6, sniper: 1.5 },
  boss:   { pistol: 0.4, shotgun: 0.6, rifle: 0.8, smg: 0.5, sniper: 2.0 },
  robot:  { pistol: 0.5, shotgun: 0.8, rifle: 1.0, smg: 0.7, sniper: 1.8 },
  sniper: { pistol: 1.0, shotgun: 1.5, rifle: 1.2, smg: 1.0, sniper: 0.8 },
  fast:   { pistol: 1.0, shotgun: 1.3, rifle: 1.0, smg: 1.0, sniper: 1.0 },
};

// ── applyPlayerDamage ─────────────────────────────────────────────────────────

describe("applyPlayerDamage", () => {
  it("no modifiers — applies weapon resistance only", () => {
    // heavy vs pistol: 100 * 0.5 = 50
    expect(applyPlayerDamage(100, "pistol", "heavy", DM)).toBe(50);
  });

  it("missing enemy type defaults to 1.0 resist", () => {
    // grunt has no entry in DM → 1.0
    expect(applyPlayerDamage(20, "pistol", "grunt", DM)).toBe(20);
  });

  it("missing weapon type defaults to 1.0 resist", () => {
    // heavy has no "rocket" entry → wResist = 1.0, result = 20 * 1.0 = 20
    expect(applyPlayerDamage(20, "rocket", "heavy", DM)).toBe(20);
  });

  it("headshot multiplier 1.85x", () => {
    // grunt vs pistol: 20 * 1.85 * 1.0 = 37
    expect(applyPlayerDamage(20, "pistol", "grunt", DM, { headshot: true })).toBe(37);
  });

  it("backstab multiplier 1.5x", () => {
    expect(applyPlayerDamage(20, "pistol", "grunt", DM, { backstab: true })).toBe(30);
  });

  it("frontal block 0.5x (boss/heavy)", () => {
    // boss vs sniper: 100 * 0.5 (frontalBlock) * 2.0 (sniper vs boss) = 100
    expect(applyPlayerDamage(100, "sniper", "boss", DM, { frontalBlock: true })).toBe(100);
  });

  it("crit multiplier 2.5x", () => {
    expect(applyPlayerDamage(20, "pistol", "grunt", DM, { crit: true })).toBe(50);
  });

  it("perkDmgMul stacks multiplicatively", () => {
    // 20 * 1.0 * 1.0 * 1.15 = 23
    expect(applyPlayerDamage(20, "pistol", "grunt", DM, { perkDmgMul: 1.15 })).toBe(23);
  });

  it("sniper vs robot — 1.8x resist (sniper is strong against robots)", () => {
    expect(applyPlayerDamage(50, "sniper", "robot", DM)).toBe(90); // 50 * 1.8 = 90
  });

  it("boss vs sniper — 2.0x (sniper demolishes boss)", () => {
    expect(applyPlayerDamage(50, "sniper", "boss", DM)).toBe(100);
  });

  it("result is always a non-negative integer", () => {
    const dmg = applyPlayerDamage(0, "pistol", "grunt", DM);
    expect(dmg).toBe(0);
    expect(Number.isInteger(dmg)).toBe(true);
  });

  it("falloffMul scales damage down at range", () => {
    // 100 at 50% range falloff = 50
    expect(applyPlayerDamage(100, "pistol", "grunt", DM, { falloffMul: 0.5 })).toBe(50);
  });
});

// ── combatSystem ──────────────────────────────────────────────────────────────

describe("combatSystem — enemy melee", () => {
  beforeEach(() => { Core._reset(); });

  function spawnHero(hp = 100, armor = 0) {
    const id = Core.createEntity();
    Core.addComponent(id, "PlayerControl", { walkSpeed: 5 });
    Core.addComponent(id, "Health", { hp, maxHp: hp, armor, maxArmor: 75 });
    Core.addComponent(id, "Transform", { u: 0, v: 0, y: 0 });
    Core.addComponent(id, "Faction", { id: "player" });
    return id;
  }

  function spawnEnemy(type, damage, attackRange, lastAttackT = -99) {
    const id = Core.createEntity();
    Core.addComponent(id, "EnemyAI", { type, damage, attackRange, lastAttackT, state: "attack" });
    Core.addComponent(id, "Transform", { u: 0, v: 0, y: 0 }); // same position = in range
    Core.addComponent(id, "Health", { hp: 80, maxHp: 80, armor: 0 });
    Core.addComponent(id, "Faction", { id: "enemy" });
    return id;
  }

  it("does nothing if no damageMultipliers in ctx", () => {
    spawnHero(100);
    spawnEnemy("grunt", 10, 2.0);
    combatSystem(1 / 60, Core, {});
    const heroId = Core.query("PlayerControl", "Health")[0];
    expect(Core.getComponent(heroId, "Health").hp).toBe(100);
  });

  it("enemy attacks hero within attackRange", () => {
    const heroId = spawnHero(100);
    spawnEnemy("grunt", 6, 2.0);
    combatSystem(1 / 60, Core, { damageMultipliers: DM, elapsedS: 99 });
    expect(Core.getComponent(heroId, "Health").hp).toBe(94);
  });

  it("enemy does not attack if outside attackRange", () => {
    const heroId = spawnHero(100);
    const eid = spawnEnemy("grunt", 6, 2.0);
    Core.getComponent(eid, "Transform").u = 5; // 5m away, attackRange=2.0
    combatSystem(1 / 60, Core, { damageMultipliers: DM, elapsedS: 99 });
    expect(Core.getComponent(heroId, "Health").hp).toBe(100);
  });

  it("respects attack cooldown — no double attack in same second", () => {
    const heroId = spawnHero(100);
    spawnEnemy("grunt", 6, 2.0, -99);
    const ctx = { damageMultipliers: DM, elapsedS: 99 };
    combatSystem(1 / 60, Core, ctx); // first attack lands
    combatSystem(1 / 60, Core, ctx); // cooldown not elapsed — no second attack
    expect(Core.getComponent(heroId, "Health").hp).toBe(94);
  });

  it("attack allowed after cooldown elapses", () => {
    const heroId = spawnHero(100);
    spawnEnemy("grunt", 6, 2.0, -99);
    combatSystem(1 / 60, Core, { damageMultipliers: DM, elapsedS: 99 });
    combatSystem(1 / 60, Core, { damageMultipliers: DM, elapsedS: 100.1 }); // 1.1s later
    expect(Core.getComponent(heroId, "Health").hp).toBe(88);
  });

  it("armor absorbs 60% of damage", () => {
    const heroId = spawnHero(100, 40); // 40 armor
    spawnEnemy("grunt", 10, 2.0);
    combatSystem(1 / 60, Core, { damageMultipliers: DM, elapsedS: 99 });
    const health = Core.getComponent(heroId, "Health");
    // armorHit = min(40, 10 * 0.6) = 6 → armor=34, dmg=4 → hp=96
    expect(health.armor).toBe(34);
    expect(health.hp).toBe(96);
  });

  it("emits hero:damaged event with correct amount", () => {
    spawnHero(100);
    spawnEnemy("grunt", 6, 2.0);
    const events = [];
    Core.on("hero:damaged", (e) => events.push(e));
    combatSystem(1 / 60, Core, { damageMultipliers: DM, elapsedS: 99 });
    expect(events.length).toBe(1);
    expect(events[0].amount).toBe(6);
  });

  it("emits hero:died when HP hits 0", () => {
    spawnHero(5); // low HP
    spawnEnemy("grunt", 10, 2.0);
    const died = [];
    Core.on("hero:died", (e) => died.push(e));
    combatSystem(1 / 60, Core, { damageMultipliers: DM, elapsedS: 99 });
    expect(died.length).toBe(1);
  });

  it("dead enemy does not attack", () => {
    const heroId = spawnHero(100);
    const eid = spawnEnemy("grunt", 6, 2.0);
    Core.getComponent(eid, "Health").hp = 0; // already dead
    combatSystem(1 / 60, Core, { damageMultipliers: DM, elapsedS: 99 });
    expect(Core.getComponent(heroId, "Health").hp).toBe(100);
  });

  it("friendly faction entity does not attack hero", () => {
    const heroId = spawnHero(100);
    const eid = spawnEnemy("grunt", 6, 2.0);
    Core.getComponent(eid, "Faction").id = "player"; // change to friendly
    combatSystem(1 / 60, Core, { damageMultipliers: DM, elapsedS: 99 });
    expect(Core.getComponent(heroId, "Health").hp).toBe(100);
  });
});
