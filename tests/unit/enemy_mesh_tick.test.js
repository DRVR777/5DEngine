import { it, expect, describe, vi } from "vitest";
import { mountEnemyMeshTick } from "../../src/systems/enemy_mesh_tick.js";

function makeGroup() {
  const pos = { x: 0, y: 0, z: 0 };
  const rot = { x: 0, y: 0 };
  const scl = { s: 1 };
  return {
    position: { set: (u, y, v) => { pos.x = u; pos.y = y; pos.z = v; } },
    rotation: { get x() { return rot.x; }, set x(v) { rot.x = v; }, get y() { return rot.y; }, set y(v) { rot.y = v; } },
    scale: { setScalar: s => { scl.s = s; } },
    get visible() { return this._visible; }, set visible(v) { this._visible = v; },
    _visible: false,
    _pos: pos, _rot: rot, _scl: scl,
  };
}

function makeHpFg() {
  const mat = { color: { setHex: function(h) { this._h = h; }, _h: 0 } };
  return {
    scale: { x: 1 },
    position: { x: 0 },
    material: mat,
  };
}

function makeEnemy(overrides = {}) {
  return {
    id: "en_1", type: "basic", hp: 100, maxHp: 100,
    heading: 0, moveSpeed: 2.5, dead: false,
    hp: 80, maxHp: 100,
    respawnT: 0, _hitFlashT: 0, _hitFlashWas: false,
    _alertT: 0, _bleedT: null, _flinchX: null,
    _meshChildren: [], _walkBobPhase: 0, _wasChasing: false, _heardShot: 0,
    ...overrides,
  };
}

function makeMesh() {
  return {
    group: makeGroup(),
    hpFg: makeHpFg(),
    hpPivot: null,
    _alertBubble: null,
    _typeGem: null,
  };
}

function makeActions({ camYaw = 0, posMap = {}, particles = [], dirty = [] } = {}) {
  return {
    getCamYaw: () => camYaw,
    getPos: id => posMap[id] || { u: 0, v: 0 },
    spawnParticles: (...a) => particles.push(a),
    spawnClearPos: (r1, r2) => ({ u: 5, v: 5 }),
    setPos: vi.fn(),
    markHudDirty: () => dirty.push(1),
  };
}

describe("enemy_mesh_tick — tickAlive: walk bob", () => {
  it("moving enemy → group.position.y > 0 (bob)", () => {
    const en = makeEnemy({ _wasChasing: true, _walkBobPhase: Math.PI / 2 });
    const em = makeMesh();
    const sys = mountEnemyMeshTick({ actions: makeActions({ posMap: { en_1: { u: 3, v: 4 } } }) });
    sys.tickAlive(en, em, 0.016, 1000);
    // sin(PI/2)=1 → y = amp (0.035 for basic type)
    expect(em.group._pos.y).toBeGreaterThan(0);
  });

  it("still enemy → group.position.y = 0", () => {
    const en = makeEnemy({ _wasChasing: false, _heardShot: 0 });
    const em = makeMesh();
    const sys = mountEnemyMeshTick({ actions: makeActions({ posMap: { en_1: { u: 1, v: 2 } } }) });
    sys.tickAlive(en, em, 0.016, 0);
    expect(em.group._pos.y).toBe(0);
  });

  it("boss type → larger bob amplitude", () => {
    const en1 = makeEnemy({ type: "boss", _wasChasing: true, _walkBobPhase: Math.PI / 2, moveSpeed: 1 });
    const en2 = makeEnemy({ type: "basic", _wasChasing: true, _walkBobPhase: Math.PI / 2, moveSpeed: 1 });
    const em1 = makeMesh(), em2 = makeMesh();
    const actions = makeActions({ posMap: { en_1: { u: 0, v: 0 } } });
    const sys = mountEnemyMeshTick({ actions });
    sys.tickAlive(en1, em1, 0.016, 0);
    sys.tickAlive(en2, em2, 0.016, 0);
    expect(em1.group._pos.y).toBeGreaterThan(em2.group._pos.y);
  });
});

describe("enemy_mesh_tick — tickAlive: flinch spring", () => {
  it("flinchX > 0 → springs toward 0", () => {
    const en = makeEnemy({ _flinchX: 0.5 });
    const em = makeMesh();
    const sys = mountEnemyMeshTick({ actions: makeActions({ posMap: { en_1: { u: 0, v: 0 } } }) });
    sys.tickAlive(en, em, 0.016, 0);
    expect(en._flinchX).toBeLessThan(0.5);
    expect(en._flinchX).toBeGreaterThanOrEqual(0);
  });
});

describe("enemy_mesh_tick — tickAlive: hit flash", () => {
  it("_hitFlashT > 0 → sets emissive to white", () => {
    const ch = { material: { emissive: { getHex: () => 0x000000, setHex: vi.fn() }, emissiveIntensity: 0 } };
    const en = makeEnemy({ _hitFlashT: 0.05, _meshChildren: [ch] });
    const em = makeMesh();
    const sys = mountEnemyMeshTick({ actions: makeActions({ posMap: { en_1: { u: 0, v: 0 } } }) });
    sys.tickAlive(en, em, 0.016, 0);
    expect(ch.material.emissive.setHex).toHaveBeenCalledWith(0xffffff);
    expect(ch.material.emissiveIntensity).toBe(2.0);
  });

  it("_hitFlashWas + _hitFlashT=0 → restores original emissive", () => {
    const ch = { material: { emissive: { setHex: vi.fn() }, emissiveIntensity: 0 }, _origEmissive: 0xaabbcc, _origEmissiveInt: 0.5 };
    const en = makeEnemy({ _hitFlashT: 0, _hitFlashWas: true, _meshChildren: [ch] });
    const em = makeMesh();
    const sys = mountEnemyMeshTick({ actions: makeActions({ posMap: { en_1: { u: 0, v: 0 } } }) });
    sys.tickAlive(en, em, 0.016, 0);
    expect(ch.material.emissive.setHex).toHaveBeenCalledWith(0xaabbcc);
    expect(en._hitFlashWas).toBe(false);
  });
});

describe("enemy_mesh_tick — tickAlive: HP bar", () => {
  it("50% HP → hpFg.scale.x = 0.5", () => {
    const en = makeEnemy({ hp: 50, maxHp: 100 });
    const em = makeMesh();
    const sys = mountEnemyMeshTick({ actions: makeActions({ posMap: { en_1: { u: 0, v: 0 } } }) });
    sys.tickAlive(en, em, 0.016, 0);
    expect(em.hpFg.scale.x).toBeCloseTo(0.5, 3);
  });

  it("full HP → color is green (0x00cc44)", () => {
    const en = makeEnemy({ hp: 100, maxHp: 100 });
    const em = makeMesh();
    const sys = mountEnemyMeshTick({ actions: makeActions({ posMap: { en_1: { u: 0, v: 0 } } }) });
    sys.tickAlive(en, em, 0.016, 0);
    expect(em.hpFg.material.color._h).toBe(0x00cc44);
  });

  it("30% HP → color is orange (0xff8800)", () => {
    const en = makeEnemy({ hp: 35, maxHp: 100 });
    const em = makeMesh();
    const sys = mountEnemyMeshTick({ actions: makeActions({ posMap: { en_1: { u: 0, v: 0 } } }) });
    sys.tickAlive(en, em, 0.016, 0);
    expect(em.hpFg.material.color._h).toBe(0xff8800);
  });

  it("20% HP → color is red (0xff2222)", () => {
    const en = makeEnemy({ hp: 20, maxHp: 100 });
    const em = makeMesh();
    const sys = mountEnemyMeshTick({ actions: makeActions({ posMap: { en_1: { u: 0, v: 0 } } }) });
    sys.tickAlive(en, em, 0.016, 0);
    expect(em.hpFg.material.color._h).toBe(0xff2222);
  });
});

describe("enemy_mesh_tick — tickAlive: blood trail", () => {
  it("hp < 30% + bleedT expired → calls spawnParticles", () => {
    const particles = [];
    const en = makeEnemy({ hp: 20, maxHp: 100, _bleedT: 0 });
    const em = makeMesh();
    const sys = mountEnemyMeshTick({ actions: makeActions({ posMap: { en_1: { u: 5, v: 3 } }, particles }) });
    sys.tickAlive(en, em, 0.016, 200); // nowMs=200 → nowSec=0.2; 0.2 - 0 > 0.12 → drip
    expect(particles.length).toBe(1);
  });

  it("hp >= 30% → no particles", () => {
    const particles = [];
    const en = makeEnemy({ hp: 50, maxHp: 100, _bleedT: null });
    const em = makeMesh();
    const sys = mountEnemyMeshTick({ actions: makeActions({ posMap: { en_1: { u: 0, v: 0 } }, particles }) });
    sys.tickAlive(en, em, 0.016, 0);
    expect(particles.length).toBe(0);
  });

  it("robot type → particle color is cyan", () => {
    const particles = [];
    const en = makeEnemy({ hp: 10, maxHp: 100, type: "robot", _bleedT: 0 });
    const em = makeMesh();
    const sys = mountEnemyMeshTick({ actions: makeActions({ posMap: { en_1: { u: 0, v: 0 } }, particles }) });
    sys.tickAlive(en, em, 0.016, 200);
    expect(particles[0][4]).toBe("cyan");
  });
});

describe("enemy_mesh_tick — tickDead", () => {
  it("elapsed < 0.6s → group is visible (collapsing)", () => {
    const en = makeEnemy({ dead: true, respawnT: 10 - 0.3, heading: 0 }); // elapsed = 0.3s
    const em = makeMesh();
    const sys = mountEnemyMeshTick({ actions: makeActions({ posMap: { en_1: { u: 2, v: 3 } } }) });
    sys.tickDead(en, em, 10000, 5);
    expect(em.group._visible).toBe(true);
  });

  it("elapsed > 0.6s + < respawnDelay → group hidden", () => {
    const en = makeEnemy({ dead: true, respawnT: 10 - 1.0, id: "en_1" }); // elapsed = 1.0s
    const em = makeMesh();
    const sys = mountEnemyMeshTick({ actions: makeActions({ posMap: { en_1: { u: 0, v: 0 } } }) });
    sys.tickDead(en, em, 10000, 5);
    expect(em.group._visible).toBe(false);
  });

  it("elapsed > respawnDelay + not spawned_ → revives enemy", () => {
    const en = makeEnemy({ dead: true, id: "en_1", respawnT: 10 - 6, hp: 0, maxHp: 100 }); // elapsed = 6s
    const em = makeMesh();
    const dirty = [];
    const sys = mountEnemyMeshTick({ actions: makeActions({ posMap: { en_1: { u: 0, v: 0 } }, dirty }) });
    sys.tickDead(en, em, 10000, 5);
    expect(en.dead).toBe(false);
    expect(en.hp).toBe(100);
    expect(dirty.length).toBe(1);
  });

  it("en_spawned_ prefix → does NOT respawn", () => {
    const en = makeEnemy({ dead: true, id: "en_spawned_abc", respawnT: 10 - 6 });
    const em = makeMesh();
    const sys = mountEnemyMeshTick({ actions: makeActions({ posMap: { en_spawned_abc: { u: 0, v: 0 } } }) });
    sys.tickDead(en, em, 10000, 5);
    expect(en.dead).toBe(true);
  });

  it("pos null → returns true (continue)", () => {
    const en = makeEnemy({ dead: true, respawnT: 10 - 0.3, id: "en_1" });
    const em = makeMesh();
    // Override getPos to explicitly return null for this enemy
    const actions = { getCamYaw: () => 0, getPos: () => null, spawnParticles: () => {}, spawnClearPos: () => ({ u:0, v:0 }), setPos: vi.fn(), markHudDirty: () => {} };
    const sys = mountEnemyMeshTick({ actions });
    const result = sys.tickDead(en, em, 10000, 5);
    expect(result).toBe(true);
  });
});

describe("enemy_mesh_tick — tickEntry", () => {
  it("alive enemy → tickAlive path, returns false", () => {
    const en = makeEnemy({ dead: false });
    const em = makeMesh();
    const sys = mountEnemyMeshTick({ actions: makeActions({ posMap: { en_1: { u: 0, v: 0 } } }) });
    const r = sys.tickEntry(en, em, 0.016, 0, 5);
    expect(r).toBe(false);
    expect(em.group._visible).toBe(true);
  });

  it("dead enemy → tickDead path", () => {
    const en = makeEnemy({ dead: true, respawnT: 10 - 1.0 });
    const em = makeMesh();
    const sys = mountEnemyMeshTick({ actions: makeActions({ posMap: { en_1: { u: 0, v: 0 } } }) });
    const r = sys.tickEntry(en, em, 0.016, 10000, 5);
    expect(em.group._visible).toBe(false);
    expect(r).toBe(false);
  });
});
