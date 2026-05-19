import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

const killSrc    = readFileSync("src/systems/bullet_enemy_kill_tick.js", "utf8");
const physicsSrc = readFileSync("src/systems/bullet_physics_tick.js", "utf8");
const keydownSrc = readFileSync("src/systems/keydown_handler.js", "utf8");
const waveSrc    = readFileSync("src/systems/wave_manager.js", "utf8");

describe("enemy lifecycle contract", () => {
  it("bullet kill path treats hp <= 0 as dead and clamps hp", () => {
    // kill side-effects live in bullet_enemy_kill_tick.js (extracted iter 679)
    expect(killSrc).toContain("en.hp = 0;");
    expect(killSrc).toContain("en.dead = true;");
    // physics tick gates the killTick call on hp <= 0
    expect(physicsSrc).toContain("if (en.hp <= 0)");
  });

  it("melee kill path treats hp <= 0 as dead and clamps hp", () => {
    expect(keydownSrc).toContain("if (en.hp <= 0 && !en.dead)");
    expect(keydownSrc).toContain("en.hp = 0; en.dead = true;");
  });

  it("wave waiting ignores spawned enemies with zero hp even if dead flag was missed", () => {
    expect(waveSrc).toContain("!e.dead && (e.hp ?? 1) > 0 && e.id.startsWith(\"en_spawned_\")");
  });
});
