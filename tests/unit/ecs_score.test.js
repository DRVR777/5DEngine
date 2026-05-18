import { describe, it, expect, beforeEach } from "vitest";
import { createScoreSystem, applyLevelBuff, COIN_BY_TYPE, LEVEL_THRESHOLDS } from "../../src/systems/ecs_score.js";
import Core from "../../src/core/core.js";

function makeHero(kills = 0, coins = 0, level = 0) {
  const id = Core.createEntity();
  Core.addComponent(id, "PlayerControl", { active: true });
  Core.addComponent(id, "Faction",       { id: "player" });
  Core.addComponent(id, "Health",        { hp: 100, maxHp: 100 });
  Core.addComponent(id, "PerkState",     { _perkDmgMul: 1.0, _perkReloadMul: 1.0, _heroLvlDmgMul: 1.0, _heroLvlSpeedBonus: 0 });
  Core.addComponent(id, "Score",         { coins, kills, level, combo: 0, lastKillT: -Infinity });
  return id;
}

describe("COIN_BY_TYPE constants — monolith line 1308 parity", () => {
  it("grunt = 1 coin", () => { expect(COIN_BY_TYPE.grunt).toBe(1); });
  it("fast = 1 coin",  () => { expect(COIN_BY_TYPE.fast).toBe(1); });
  it("poisoner = 2",   () => { expect(COIN_BY_TYPE.poisoner).toBe(2); });
  it("incendiary = 2", () => { expect(COIN_BY_TYPE.incendiary).toBe(2); });
  it("heavy = 4",      () => { expect(COIN_BY_TYPE.heavy).toBe(4); });
  it("robot = 8",      () => { expect(COIN_BY_TYPE.robot).toBe(8); });
  it("boss = 30",      () => { expect(COIN_BY_TYPE.boss).toBe(30); });
  it("sniper = 3",     () => { expect(COIN_BY_TYPE.sniper).toBe(3); });
});

describe("LEVEL_THRESHOLDS constants — monolith line 1220 parity", () => {
  it("thresholds = [10, 20, 30, 40, 50]", () => {
    expect(LEVEL_THRESHOLDS).toEqual([10, 20, 30, 40, 50]);
  });
});

describe("applyLevelBuff", () => {
  beforeEach(() => { Core._reset(); });

  it("level 1 — multiplies _heroLvlDmgMul by 1.10", () => {
    const id = makeHero();
    applyLevelBuff(1, id, Core);
    expect(Core.getComponent(id, "PerkState")._heroLvlDmgMul).toBeCloseTo(1.10);
  });

  it("level 2 — adds 1.0 to _heroLvlSpeedBonus", () => {
    const id = makeHero();
    applyLevelBuff(2, id, Core);
    expect(Core.getComponent(id, "PerkState")._heroLvlSpeedBonus).toBe(1.0);
  });

  it("level 4 — heals 20 HP and raises maxHp by 20", () => {
    const id = makeHero();
    Core.getComponent(id, "Health").hp = 80;
    applyLevelBuff(4, id, Core);
    expect(Core.getComponent(id, "Health").maxHp).toBe(120);
    expect(Core.getComponent(id, "Health").hp).toBe(100); // 80 + 20 = 100, capped at new max 120
  });

  it("level 4 heal does not exceed new maxHp", () => {
    const id = makeHero();
    Core.getComponent(id, "Health").hp = 115;
    Core.getComponent(id, "Health").maxHp = 100;
    applyLevelBuff(4, id, Core);
    expect(Core.getComponent(id, "Health").hp).toBe(120); // capped at 100+20=120
  });
});

describe("createScoreSystem", () => {
  beforeEach(() => { Core._reset(); });

  it("increments kills and coins on enemy:killed event", () => {
    const sys = createScoreSystem();
    const id = makeHero();
    sys(0, Core);

    Core.emit("enemy:killed", { type: "grunt", heroId: id });
    const sc = Core.getComponent(id, "Score");
    expect(sc.kills).toBe(1);
    expect(sc.coins).toBe(1); // grunt=1, combo=1 → mul=1 → 1 coin
  });

  it("combo multiplier: second kill within combo window = 2×", () => {
    const sys = createScoreSystem();
    const id = makeHero();
    sys(0, Core);

    Core.emit("enemy:killed", { type: "grunt", heroId: id }); // combo=1, mul=1
    sys(0.5, Core); // 0.5s later — within 4s window
    Core.emit("enemy:killed", { type: "grunt", heroId: id }); // combo=2, mul=2
    expect(Core.getComponent(id, "Score").coins).toBe(1 + 2); // 1 + 2
  });

  it("heavy kill = 4 coins × combo multiplier", () => {
    const sys = createScoreSystem();
    const id = makeHero();
    sys(0, Core);

    Core.emit("enemy:killed", { type: "heavy", heroId: id });
    expect(Core.getComponent(id, "Score").coins).toBe(4);
  });

  it("boss kill = 30 coins", () => {
    const sys = createScoreSystem();
    const id = makeHero();
    sys(0, Core);

    Core.emit("enemy:killed", { type: "boss", heroId: id });
    expect(Core.getComponent(id, "Score").coins).toBe(30);
  });

  it("emits score:kill event with payload", () => {
    const sys = createScoreSystem();
    const id = makeHero();
    sys(0, Core);

    const events = [];
    Core.on("score:kill", e => events.push(e));
    Core.emit("enemy:killed", { type: "sniper", heroId: id });
    expect(events.length).toBe(1);
    expect(events[0].enemyType).toBe("sniper");
    expect(events[0].coinValue).toBe(3);
  });

  it("emits score:levelup when kills reach threshold", () => {
    const sys = createScoreSystem();
    const id = makeHero(9, 0, 0); // 9 kills, threshold=10
    sys(0, Core);

    const lvlEvents = [];
    Core.on("score:levelup", e => lvlEvents.push(e));
    Core.emit("enemy:killed", { type: "grunt", heroId: id }); // kills=10 → LVL 1
    expect(lvlEvents.length).toBe(1);
    expect(lvlEvents[0].level).toBe(1);
  });

  it("applies level buff on levelup — LVL 1 gives +10% dmg", () => {
    const sys = createScoreSystem();
    const id = makeHero(9, 0, 0);
    sys(0, Core);

    Core.emit("enemy:killed", { type: "grunt", heroId: id });
    expect(Core.getComponent(id, "PerkState")._heroLvlDmgMul).toBeCloseTo(1.10);
    expect(Core.getComponent(id, "Score").level).toBe(1);
  });

  it("does not level past LVL 5", () => {
    const sys = createScoreSystem();
    const id = makeHero(49, 0, 4); // at threshold for LVL 5
    sys(0, Core);

    Core.emit("enemy:killed", { type: "grunt", heroId: id }); // LVL 5
    Core.emit("enemy:killed", { type: "grunt", heroId: id }); // should not go to LVL 6
    expect(Core.getComponent(id, "Score").level).toBe(5);
  });

  it("combo resets after COMBO_WINDOW (4s)", () => {
    const sys = createScoreSystem();
    const id = makeHero();
    sys(0, Core);

    Core.emit("enemy:killed", { type: "grunt", heroId: id }); // combo=1
    sys(5.0, Core); // 5 seconds later — past window
    expect(Core.getComponent(id, "Score").combo).toBe(0);
  });

  it("score:add_coins adds to hero coins", () => {
    const sys = createScoreSystem();
    const id = makeHero(0, 5, 0);
    sys(0, Core);

    Core.emit("score:add_coins", { heroId: id, amount: 10 });
    expect(Core.getComponent(id, "Score").coins).toBe(15);
  });

  it("emits score:combo when combo > 1", () => {
    const sys = createScoreSystem();
    const id = makeHero();
    sys(0, Core);

    const combos = [];
    Core.on("score:combo", e => combos.push(e));
    Core.emit("enemy:killed", { type: "grunt", heroId: id }); // combo=1, no event
    sys(0.1, Core);
    Core.emit("enemy:killed", { type: "grunt", heroId: id }); // combo=2, fires
    expect(combos.length).toBe(1);
    expect(combos[0].combo).toBe(2);
  });

  it("sys.thresholds matches monolith LEVEL_THRESHOLDS", () => {
    const sys = createScoreSystem();
    expect(sys.thresholds).toEqual([10, 20, 30, 40, 50]);
  });
});
