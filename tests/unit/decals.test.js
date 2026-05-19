import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";
import { mountDecalSystem } from "../../src/render/decals.js";

const src = readFileSync("src/render/decals.js", "utf8");

describe("decals", () => {
  it("exports mountDecalSystem", () => {
    expect(src).toContain("export function mountDecalSystem");
  });

  it("returns spawnDecal and spawnWallScorch", () => {
    expect(src).toContain("spawnDecal");
    expect(src).toContain("spawnWallScorch");
  });

  it("uses internal decal pool for reuse", () => {
    expect(src).toContain("_decalPool");
    expect(src).toContain("_decalPool.pop()");
    expect(src).toContain("_decalPool.push(mesh)");
  });

  it("pools blood and oil material variants", () => {
    expect(src).toContain("blood");
    expect(src).toContain("0x5a0000");
    expect(src).toContain("oil");
    expect(src).toContain("0x1a1a2a");
  });

  it("auto-returns decal to pool after 45s", () => {
    expect(src).toContain("45000");
    expect(src).toContain("mesh.visible = false");
  });

  it("scorch ring-buffer at SCORCH_MAX=50", () => {
    expect(src).toContain("_SCORCH_MAX = 50");
    expect(src).toContain("_wallScorches.shift()");
  });

  it("scorch uses DoubleSide so it shows from both wall faces", () => {
    expect(src).toContain("THREE.DoubleSide");
  });

  it("scorch rotates to face wall normal via atan2", () => {
    expect(src).toContain("Math.atan2(nU, nV)");
  });

  it("scorch offsets slightly off wall to avoid z-fighting", () => {
    expect(src).toContain("nU * 0.025");
    expect(src).toContain("nV * 0.025");
  });
});

// ── Real smoke test — imports and calls the module ──────────────────────────
// Regression: mountDecalSystem previously did not return wallScorches, so
// index.html passed undefined to mountGameReset → resetGameState() threw
// "wallScorches is not iterable" on every game reset.

const makeMesh = () => ({
  position: { set() {} },
  rotation: { x: 0, y: 0, z: 0, set() {} },
  scale: { setScalar() {} },
  visible: true,
  material: { opacity: 0.65, clone() { return this; } },
});

const THREE_STUB = {
  MeshBasicMaterial: class { constructor() { return { opacity: 0, clone() { return this; } }; } },
  CircleGeometry:    class { constructor() {} },
  PlaneGeometry:     class { constructor() {} },
  Mesh:              class { constructor() { return makeMesh(); } },
  DoubleSide: 2,
};
const SCENE_STUB = { add() {}, remove() {} };

it("mountDecalSystem returns wallScorches as a live Array (regression fix)", () => {
  const result = mountDecalSystem({ THREE: THREE_STUB, scene: SCENE_STUB });
  expect(typeof result.spawnDecal).toBe("function");
  expect(typeof result.spawnWallScorch).toBe("function");
  expect(Array.isArray(result.wallScorches)).toBe(true);
});

it("spawnWallScorch pushes into wallScorches array", () => {
  const result = mountDecalSystem({ THREE: THREE_STUB, scene: SCENE_STUB });
  expect(result.wallScorches.length).toBe(0);
  result.spawnWallScorch(1, 0.5, 2, 0, 1);
  expect(result.wallScorches.length).toBe(1);
});
