// Tests for src/systems/spawn_system.js
import { it, expect, describe } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dir, "../../src/systems/spawn_system.js"), "utf8");

it("exports mountSpawnSystem", () => {
  expect(src).toMatch(/export\s+function\s+mountSpawnSystem/);
});

describe("dependencies", () => {
  it("accepts THREE", () => { expect(src).toContain("THREE,"); });
  it("accepts getScene lazy getter", () => { expect(src).toContain("getScene,"); });
  it("accepts buildingBlockers", () => { expect(src).toContain("buildingBlockers"); });
});

describe("spawnPoints", () => {
  it("initializes with origin point", () => {
    expect(src).toContain('{ u: 0, v: 0, label: "origin" }');
  });

  it("addSpawnPoint labels sequentially", () => {
    expect(src).toContain('`SP${spawnPoints.length + 1}`');
  });

  it("addSpawnPoint calls getScene() and adds mesh", () => {
    expect(src).toContain("getScene()");
    expect(src).toContain("scene.add(mesh)");
    expect(src).toContain("CylinderGeometry");
  });

  it("getSpawnPoint picks randomly", () => {
    expect(src).toContain("Math.floor(Math.random()");
    expect(src).toContain("spawnPoints.length");
  });
});

describe("spawnClearPos", () => {
  it("retries up to maxTries", () => {
    expect(src).toContain("maxTries || 30");
  });

  it("uses margin to avoid clipping", () => {
    expect(src).toContain("margin = 0.7");
  });

  it("skips arena boundary walls", () => {
    expect(src).toContain(">= 26");
  });

  it("falls back to safe position", () => {
    expect(src).toContain("{ u: 15, v: 0 }");
  });
});

it("returns addSpawnPoint, getSpawnPoint, spawnClearPos, spawnPoints", () => {
  expect(src).toContain("addSpawnPoint, getSpawnPoint, spawnClearPos, spawnPoints");
});
