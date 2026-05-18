// Tests for src/systems/hero_lifecycle.js
import { it, expect, describe } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dir, "../../src/systems/hero_lifecycle.js"), "utf8");

it("exports mountHeroLifecycle", () => {
  expect(src).toMatch(/export\s+function\s+mountHeroLifecycle/);
});

it("guards document access", () => {
  expect(src).toContain('typeof document === "undefined"');
});

describe("dependencies", () => {
  it("accepts get", () => { expect(src).toContain("get,"); });
  it("accepts set", () => { expect(src).toContain("set,"); });
  it("accepts actions", () => { expect(src).toContain("actions,"); });
});

describe("heroShowDeathScreen", () => {
  it("sets heroDead true via set.heroDead", () => {
    expect(src).toContain("set.heroDead(true)");
  });

  it("clears grenadePressT and heroKbT via set", () => {
    expect(src).toContain("set.grenadePressT(0)");
    expect(src).toContain("set.heroKbT(0)");
  });

  it("calls document.exitPointerLock", () => {
    expect(src).toContain("document.exitPointerLock");
  });

  it("populates death stats with kills, wave, coins, accuracy", () => {
    expect(src).toContain("get.enemyKills()");
    expect(src).toContain("get.score()");
    expect(src).toContain("get.damageDealt()");
    expect(src).toContain("get.shotsFired()");
    expect(src).toContain("get.shotsHit()");
  });

  it("calls actions.waveNum for current wave", () => {
    expect(src).toContain("actions.waveNum()");
  });

  it("calls actions.checkHighScore", () => {
    expect(src).toContain("actions.checkHighScore(");
  });

  it("calls actions.highScoreGet for previous record", () => {
    expect(src).toContain("actions.highScoreGet()");
  });

  it("sets _deathCountdownT to RESPAWN_DELAY", () => {
    expect(src).toContain("_deathCountdownT = RESPAWN_DELAY");
  });

  it("shows the deathOverlay", () => {
    expect(src).toContain('"deathOverlay"');
    expect(src).toContain('overlay.style.display = "flex"');
  });
});

describe("heroRespawn", () => {
  it("sets heroDead false", () => {
    expect(src).toContain("set.heroDead(false)");
  });

  it("hides the deathOverlay", () => {
    expect(src).toContain('overlay.style.display = "none"');
  });

  it("calls actions.getSpawnPoint and actions.worldSetPlayer", () => {
    expect(src).toContain("actions.getSpawnPoint()");
    expect(src).toContain("actions.worldSetPlayer(");
  });

  it("restores hp using HERO_MAX_HP + perkMaxHpBonus", () => {
    expect(src).toContain("get.HERO_MAX_HP() + get.perkMaxHpBonus()");
    expect(src).toContain("set.heroHp(");
  });

  it("resets armor, stamina, velocityY", () => {
    expect(src).toContain("set.heroArmor(0)");
    expect(src).toContain("set.velocityY(0)");
    expect(src).toContain("set.stamina(get.STAMINA_MAX())");
  });

  it("zeroes combat stats", () => {
    expect(src).toContain("set.shotsFired(0)");
    expect(src).toContain("set.shotsHit(0)");
    expect(src).toContain("set.damageDealt(0)");
    expect(src).toContain("set.comboCount(0)");
    expect(src).toContain("set.comboAnnouncedMul(0)");
  });

  it("zeroes status timers", () => {
    expect(src).toContain("set.heroFireT(0)");
    expect(src).toContain("set.heroEmpT(0)");
    expect(src).toContain("set.heroBlindT(0)");
    expect(src).toContain("set.heroKbU(0)");
    expect(src).toContain("set.heroKbV(0)");
    expect(src).toContain("set.slideT(0)");
    expect(src).toContain("set.speedBoostT(0)");
    expect(src).toContain("set.bulletTimeLeft(0)");
    expect(src).toContain("set.killMarkerUntil(0)");
  });

  it("plays respawn tone via actions.playSfx", () => {
    expect(src).toContain('actions.playSfx("tone:440:120:sine"');
  });

  it("fires heroRespawnedEvent and requestPointerLock", () => {
    expect(src).toContain("actions.heroRespawnedEvent(");
    expect(src).toContain("actions.requestPointerLock()");
  });
});

describe("tickDeath", () => {
  it("decrements _deathCountdownT by dt", () => {
    expect(src).toContain("_deathCountdownT -= dt");
  });

  it("updates the deathCountdown DOM element", () => {
    expect(src).toContain('"deathCountdown"');
    expect(src).toContain("Math.max(0, Math.ceil(_deathCountdownT))");
  });

  it("calls heroRespawn when countdown expires", () => {
    expect(src).toContain("_deathCountdownT <= 0");
    expect(src).toContain("heroRespawn()");
  });
});

it("returns heroShowDeathScreen, heroRespawn, tickDeath", () => {
  expect(src).toContain("heroShowDeathScreen, heroRespawn, tickDeath");
});
