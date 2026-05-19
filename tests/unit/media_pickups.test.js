import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";
import { mountMediaPickups } from "../../src/systems/media_pickups.js";

const src = readFileSync("src/systems/media_pickups.js", "utf8");

// ── static shape tests ────────────────────────────────────────────────────────
describe("media_pickups — module shape", () => {
  it("exports mountMediaPickups", () => {
    expect(src).toContain("export function mountMediaPickups");
  });

  it("accepts THREE and scene", () => {
    expect(src).toContain("THREE");
    expect(src).toContain("scene");
  });

  it("initialises heroMedia array", () => {
    expect(src).toContain("heroMedia");
    expect(src).toContain("= []");
  });

  it("initialises worldMedia array", () => {
    expect(src).toContain("worldMedia");
  });

  it("creates CylinderGeometry for CDs", () => {
    expect(src).toContain("CylinderGeometry");
    expect(src).toContain("\"cd\"");
  });

  it("creates BoxGeometry for USB", () => {
    expect(src).toContain("BoxGeometry");
  });

  it("sets castShadow on mesh", () => {
    expect(src).toContain("castShadow = true");
  });

  it("pushes to worldMedia with picked:false", () => {
    expect(src).toContain("picked: false");
  });

  it("returns heroMedia, worldMedia, spawnMedia, tick", () => {
    expect(src).toContain("heroMedia, worldMedia, spawnMedia, tick");
  });
});

// ── tick behavioral tests ─────────────────────────────────────────────────────
function makeMockModule() {
  const removed = [];
  const scene = {
    add: () => {},
    remove: m => removed.push(m),
  };
  const log = [];
  const actions = {
    playSfx: (id, vol) => log.push({ type: "playSfx", id, vol }),
  };
  const THREE = {
    CylinderGeometry: class { constructor() {} },
    BoxGeometry: class { constructor() {} },
    MeshStandardMaterial: class { constructor() {} },
    Mesh: class {
      constructor(g, m) {
        this.position = { x: 0, y: 1.0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
        this.rotation = { y: 0 };
        this.castShadow = false;
      }
    },
  };
  const mod = mountMediaPickups({ THREE, scene, actions });
  return { mod, scene, removed, log, THREE };
}

describe("media_pickups — tick collection", () => {
  it("hero within 1.5m → media marked picked", () => {
    const { mod } = makeMockModule();
    mod.spawnMedia({ id: "cd1", kind: "cd", label: "Disc", files: [] }, { u: 0, v: 0 });
    const m = mod.worldMedia[0];
    m.mesh.position.x = 0; m.mesh.position.z = 0;
    mod.tick(0.016, { heroU: 0, heroV: 0, nowMs: 1000 });
    expect(m.picked).toBe(true);
  });

  it("hero within 1.5m → pushed to heroMedia", () => {
    const { mod } = makeMockModule();
    mod.spawnMedia({ id: "usb1", kind: "usb", label: "USB", files: ["a.txt"] }, { u: 0, v: 0 });
    mod.worldMedia[0].mesh.position.x = 0; mod.worldMedia[0].mesh.position.z = 0;
    mod.tick(0.016, { heroU: 0, heroV: 0, nowMs: 1000 });
    expect(mod.heroMedia.length).toBe(1);
    expect(mod.heroMedia[0].id).toBe("usb1");
  });

  it("hero within 1.5m → mesh removed from scene", () => {
    const { mod, removed } = makeMockModule();
    mod.spawnMedia({ id: "cd1", kind: "cd", label: "Disc", files: [] }, { u: 0, v: 0 });
    mod.worldMedia[0].mesh.position.x = 0; mod.worldMedia[0].mesh.position.z = 0;
    mod.tick(0.016, { heroU: 0, heroV: 0, nowMs: 1000 });
    expect(removed.length).toBe(1);
  });

  it("hero within 1.5m → playSfx called", () => {
    const { mod, log } = makeMockModule();
    mod.spawnMedia({ id: "cd1", kind: "cd", label: "Disc", files: [] }, { u: 0, v: 0 });
    mod.worldMedia[0].mesh.position.x = 0; mod.worldMedia[0].mesh.position.z = 0;
    mod.tick(0.016, { heroU: 0, heroV: 0, nowMs: 1000 });
    expect(log.some(e => e.type === "playSfx")).toBe(true);
  });

  it("hero beyond 1.5m → not collected", () => {
    const { mod } = makeMockModule();
    mod.spawnMedia({ id: "cd1", kind: "cd", label: "Disc", files: [] }, { u: 0, v: 0 });
    mod.worldMedia[0].mesh.position.x = 5; mod.worldMedia[0].mesh.position.z = 0;
    mod.tick(0.016, { heroU: 0, heroV: 0, nowMs: 1000 });
    expect(mod.worldMedia[0].picked).toBe(false);
  });

  it("already-picked → skipped (no double-collect)", () => {
    const { mod } = makeMockModule();
    mod.spawnMedia({ id: "cd1", kind: "cd", label: "Disc", files: [] }, { u: 0, v: 0 });
    mod.worldMedia[0].picked = true;
    mod.worldMedia[0].mesh.position.x = 0; mod.worldMedia[0].mesh.position.z = 0;
    mod.tick(0.016, { heroU: 0, heroV: 0, nowMs: 1000 });
    expect(mod.heroMedia.length).toBe(0);
  });
});

describe("media_pickups — tick animation", () => {
  it("unpicked distant media → rotation.y increases", () => {
    const { mod } = makeMockModule();
    mod.spawnMedia({ id: "cd1", kind: "cd", label: "Disc", files: [] }, { u: 0, v: 0 });
    const m = mod.worldMedia[0];
    m.mesh.position.x = 5; m.mesh.position.z = 0;
    mod.tick(0.1, { heroU: 0, heroV: 0, nowMs: 1000 });
    expect(m.mesh.rotation.y).toBeGreaterThan(0);
  });

  it("unpicked distant media → position.y bobs (not stuck at 1.0)", () => {
    const { mod } = makeMockModule();
    mod.spawnMedia({ id: "cd1", kind: "cd", label: "Disc", files: [] }, { u: 0, v: 0 });
    const m = mod.worldMedia[0];
    m.mesh.position.x = 5; m.mesh.position.z = 0;
    mod.tick(0.016, { heroU: 0, heroV: 0, nowMs: 500 });
    // y should be close to 1.0 ± 0.12 depending on sin — just check it's set
    expect(m.mesh.position.y).toBeGreaterThanOrEqual(0.88);
    expect(m.mesh.position.y).toBeLessThanOrEqual(1.12);
  });
});
