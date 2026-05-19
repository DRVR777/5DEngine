import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const src = readFileSync("src/engine_modules.js", "utf8");

describe("engine_modules", () => {
  it("re-exports all mount* systems", () => {
    expect(src).toContain("mountShootSystem");
    expect(src).toContain("mountDecalSystem");
    expect(src).toContain("mountBarrelSystem");
    expect(src).toContain("mountCrateSystem");
    expect(src).toContain("mountHudTemplate");
    expect(src).toContain("mountLevelSystem");
    expect(src).toContain("mountGadgetSystem");
    expect(src).toContain("mountSpawnSystem");
    expect(src).toContain("mountHeroLifecycle");
    expect(src).toContain("mountGameReset");
    expect(src).toContain("mountKillTracking");
    expect(src).toContain("mountEnvironment");
  });

  it("re-exports all create* ECS systems", () => {
    expect(src).toContain("createWaveSystem");
    expect(src).toContain("createBulletSystem");
    expect(src).toContain("createInventorySystem");
    expect(src).toContain("createAIMovementSystem");
    expect(src).toContain("createEnemyBulletSystem");
    expect(src).toContain("createFirePatchSystem");
    expect(src).toContain("createPoisonPuddleSystem");
    expect(src).toContain("createCoinDropSystem");
  });

  it("re-exports COIN_BY_TYPE for alias at import site", () => {
    expect(src).toContain("COIN_BY_TYPE");
  });

  it("re-exports default exports as named (Rain, Sfx, Vfx, Minimap, HighScore)", () => {
    expect(src).toContain("default as Rain");
    expect(src).toContain("default as Sfx");
    expect(src).toContain("default as Vfx");
    expect(src).toContain("default as Minimap");
    expect(src).toContain("default as HighScore");
    expect(src).toContain("default as Notifications");
  });

  it("re-exports Vfx named helpers (warnRingGeo, warnRingMat)", () => {
    expect(src).toContain("warnRingGeo");
    expect(src).toContain("warnRingMat");
  });

  it("re-exports multi-name inventory helpers", () => {
    expect(src).toContain("invAdd");
    expect(src).toContain("invRemove");
    expect(src).toContain("invCount");
    expect(src).toContain("invHas");
  });

  it("re-exports Core", () => {
    expect(src).toContain("Core");
  });

  it("re-exports GameProgress", () => {
    expect(src).toContain("GameProgress");
  });
});
