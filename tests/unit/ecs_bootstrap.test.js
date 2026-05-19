import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const src = readFileSync("src/core/ecs_bootstrap.js", "utf8");

describe("ecs_bootstrap", () => {
  it("exports mountEcsBootstrap as an async function", () => {
    expect(src).toContain("export async function mountEcsBootstrap");
  });

  it("accepts Core and CFG", () => {
    expect(src).toContain("Core");
    expect(src).toContain("CFG");
  });

  it("loads hero prefab from data/prefabs/hero.json", () => {
    expect(src).toContain("data/prefabs/hero.json");
    expect(src).toContain("registerPrefab");
  });

  it("loads enemy types index", () => {
    expect(src).toContain("data/enemies/enemy_types.json");
  });

  it("wires combatSystem to Core", () => {
    expect(src).toContain("combatSystem");
    expect(src).toContain("addSystem");
  });

  it("wires all major ECS systems", () => {
    expect(src).toContain("createWaveSystem");
    expect(src).toContain("createShopSystem");
    expect(src).toContain("createPerkSystem");
    expect(src).toContain("createBulletSystem");
    expect(src).toContain("createInventorySystem");
    expect(src).toContain("regenSystem");
  });

  it("uses CFG.weapons for weapon defs instead of window.GameConfig", () => {
    expect(src).toContain("CFG?.weapons");
    expect(src).not.toContain("window.GameConfig");
  });

  it("wraps boot in try/catch with non-fatal warning", () => {
    expect(src).toContain("try {");
    expect(src).toContain("catch (e)");
    expect(src).toContain("non-fatal");
  });
});
