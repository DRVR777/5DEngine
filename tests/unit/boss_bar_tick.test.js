import { it, expect, describe } from "vitest";
import { mountBossBarTick } from "../../src/systems/boss_bar_tick.js";

function makeEl(withParent = false) {
  const el = { style: { width: "", background: "", display: "", boxShadow: "" }, textContent: "" };
  if (withParent) el.parentElement = { style: { boxShadow: "" } };
  return el;
}

const { tick } = mountBossBarTick();
const NULL_ELS = { bossBar: null, bossHpFill: null, bossHpVal: null, bossName: null };

function makeLiveBoss({ hp = 100, maxHp = 100, dead = false } = {}) {
  return { hp, maxHp, dead };
}

describe("boss_bar_tick — null safety", () => {
  it("does not throw when bossBar is null", () => {
    expect(() => tick(1000, makeLiveBoss(), NULL_ELS)).not.toThrow();
  });

  it("does not throw when liveBoss is null", () => {
    const bar = makeEl();
    expect(() => tick(1000, null, { ...NULL_ELS, bossBar: bar })).not.toThrow();
  });
});

describe("boss_bar_tick — visibility", () => {
  it("shows bar when liveBoss is alive", () => {
    const bar = makeEl();
    tick(1000, makeLiveBoss(), { ...NULL_ELS, bossBar: bar });
    expect(bar.style.display).toBe("block");
  });

  it("hides bar when liveBoss is null", () => {
    const bar = makeEl();
    tick(1000, null, { ...NULL_ELS, bossBar: bar });
    expect(bar.style.display).toBe("none");
  });

  it("hides bar when liveBoss.dead is true", () => {
    const bar = makeEl();
    tick(1000, makeLiveBoss({ dead: true }), { ...NULL_ELS, bossBar: bar });
    expect(bar.style.display).toBe("none");
  });
});

describe("boss_bar_tick — HP fill bar", () => {
  it("sets fill width as percentage of maxHp", () => {
    const bar = makeEl(), fill = makeEl(true);
    tick(1000, makeLiveBoss({ hp: 60, maxHp: 100 }), { ...NULL_ELS, bossBar: bar, bossHpFill: fill });
    expect(fill.style.width).toBe("60.0%");
  });

  it("uses high gradient above 50%", () => {
    const bar = makeEl(), fill = makeEl(true);
    tick(1000, makeLiveBoss({ hp: 80, maxHp: 100 }), { ...NULL_ELS, bossBar: bar, bossHpFill: fill });
    expect(fill.style.background).toContain("#cc0000");
    expect(fill.style.background).toContain("#ff4400");
  });

  it("uses mid gradient between 25-50%", () => {
    const bar = makeEl(), fill = makeEl(true);
    tick(1000, makeLiveBoss({ hp: 35, maxHp: 100 }), { ...NULL_ELS, bossBar: bar, bossHpFill: fill });
    expect(fill.style.background).toContain("#aa0000");
  });

  it("uses low gradient below 25%", () => {
    const bar = makeEl(), fill = makeEl(true);
    tick(1000, makeLiveBoss({ hp: 20, maxHp: 100 }), { ...NULL_ELS, bossBar: bar, bossHpFill: fill });
    expect(fill.style.background).toContain("#660000");
  });

  it("pulses shadow when HP < 30%", () => {
    const bar = makeEl(), fill = makeEl(true);
    tick(1000, makeLiveBoss({ hp: 20, maxHp: 100 }), { ...NULL_ELS, bossBar: bar, bossHpFill: fill });
    expect(fill.parentElement.style.boxShadow).toMatch(/rgba\(255,0,0/);
  });

  it("uses steady shadow when HP >= 30%", () => {
    const bar = makeEl(), fill = makeEl(true);
    tick(1000, makeLiveBoss({ hp: 50, maxHp: 100 }), { ...NULL_ELS, bossBar: bar, bossHpFill: fill });
    expect(fill.parentElement.style.boxShadow).toBe("0 0 12px rgba(255,40,0,0.3)");
  });
});

describe("boss_bar_tick — text labels", () => {
  it("sets bossHpVal to 'ceil(hp) / maxHp'", () => {
    const bar = makeEl(), val = makeEl();
    tick(1000, makeLiveBoss({ hp: 73.4, maxHp: 200 }), { ...NULL_ELS, bossBar: bar, bossHpVal: val });
    expect(val.textContent).toBe("74 / 200");
  });

  it("sets bossName to boss label", () => {
    const bar = makeEl(), name = makeEl();
    tick(1000, makeLiveBoss(), { ...NULL_ELS, bossBar: bar, bossName: name });
    expect(name.textContent).toContain("BOSS");
  });
});
