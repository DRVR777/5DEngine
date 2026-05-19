import { describe, it, expect, vi } from "vitest";
import { mountEnemyAiScaffoldTick } from "../../src/systems/enemy_ai_scaffold_tick.js";

function makeEnemy(o = {}) {
  return { id: "e1", type: "grunt", hp: 100, maxHp: 100, moveSpeed: 3,
    sightRange: 12, attackRange: 1.8, wanderSpeed: 1.0, heading: 0, u: 0, v: 0, ...o };
}
function makePos(o = {}) { return { u: 0, v: 0, x: 0, y: 0, z: 0, ...o }; }
function makeEm() { return { group: { rotation: { z: 0 } } }; }
function makeCtx(o = {}) {
  return { heroU: 5, heroV: 0, nowMs: 10000, crouching: false,
    smokeZones: [], heroShotAlertT: 0, heroShotAlertU: 0, heroShotAlertV: 0,
    em: makeEm(), ...o };
}
function makeSpy() { return { tick: vi.fn() }; }
function makeActions(o = {}) {
  return { playSfx: vi.fn(), showToast: vi.fn(), spawnParticles: vi.fn(), ...o };
}

function makeSys(opts = {}) {
  let alertBroadcastT = opts.alertBroadcastT ?? 0;
  const pos = opts.pos ?? makePos();
  const posAfterKb = opts.posAfterKb ?? pos;
  let call = 0;
  const getEnemyPos = opts.getEnemyPos ?? vi.fn(() => (call++ === 0 ? pos : (opts.posSecond ?? pos)));
  const setEnemyPos = opts.setEnemyPos ?? vi.fn();
  const resolveMove = opts.resolveMove ?? vi.fn();
  const hasLOS = opts.hasLOS ?? vi.fn(() => true);
  const makeBt = opts.makeBt ?? vi.fn(o => ({ _o: o }));
  const runBt = opts.runBt ?? null;
  const pathfind = opts.pathfind ?? null;
  const actions = opts.actions ?? makeActions();
  const sub = opts.sub ?? makeSpy();
  const sys = mountEnemyAiScaffoldTick({
    getEnemyPos, setEnemyPos, resolveMove,
    hasLOS, makeBt, runBt, pathfind,
    getAlertBroadcastT: () => alertBroadcastT,
    setAlertBroadcastT: t => { alertBroadcastT = t; },
    robotPlasmaTick: sub, empTick: sub, heavyGrenadeTick: sub,
    bossRockTick: sub, poisonerSpitTick: sub, incendiaryTick: sub,
    bossSlamTick: sub, poisonerRangedSpitTick: sub,
    fastChargeTick: sub, sniperTick: sub, strafeMeleeTick: sub,
    getHeroDead: opts.getHeroDead ?? (() => false),
    getGodMode:  opts.getGodMode  ?? (() => false),
    getDodgeT:   opts.getDodgeT   ?? (() => 0),
    getHeroHp:   opts.getHeroHp   ?? (() => 100),
    getHeroArmor:opts.getHeroArmor ?? (() => 0),
    actions,
  });
  return { sys, getEnemyPos, setEnemyPos, resolveMove, hasLOS, makeBt, actions, sub,
    getAlertT: () => alertBroadcastT, setAlertT: t => { alertBroadcastT = t; } };
}

describe("mountEnemyAiScaffoldTick", () => {
  it("does not throw with minimal deps", () => {
    const { sys } = makeSys();
    expect(() => sys.tick(0.016, makeEnemy(), makeCtx())).not.toThrow();
  });

  // Magic numbers: sightRangeDef=12, attackRangeDef=1.8, attackCD=1.0, loseRangeMul=2.5
  it("initializes BT on first tick with correct opts", () => {
    const makeBt = vi.fn(o => ({ _o: o }));
    const { sys } = makeSys({ makeBt });
    const en = makeEnemy({ sightRange: 8, attackRange: 2.0 });
    sys.tick(0.016, en, makeCtx());
    expect(makeBt).toHaveBeenCalledOnce();
    const opts = makeBt.mock.calls[0][0];
    expect(opts.sightRange).toBe(8);
    expect(opts.attackRange).toBe(2.0);
    expect(opts.attackCD).toBe(1.0);
    expect(opts.loseRange).toBeCloseTo(8 * 2.5, 4);
  });

  it("does not re-init BT if already present", () => {
    const makeBt = vi.fn(o => ({ _o: o }));
    const { sys } = makeSys({ makeBt });
    const en = makeEnemy({ _bt: { existing: true } });
    sys.tick(0.016, en, makeCtx());
    expect(makeBt).not.toHaveBeenCalled();
  });

  it("applies knockback when en._kbT > 0", () => {
    const setEnemyPos = vi.fn();
    const { sys } = makeSys({ setEnemyPos });
    const en = makeEnemy({ _kbT: 0.5, _kbU: 2, _kbV: 0 });
    sys.tick(0.016, en, makeCtx());
    expect(setEnemyPos).toHaveBeenCalled();
    const firstCall = setEnemyPos.mock.calls[0];
    expect(firstCall[0]).toBe("e1");
    expect(firstCall[4]).toBeCloseTo(0 + 2 * 0.016, 4); // u + kbU*dt (args: id,x,y,z,u,v)
  });

  // Magic number: crouchSightMul=0.6 — hero at dist=10 is invisible when crouch reduces sight to 7.2
  it("canSee is false when crouching reduces effective sight below hero dist", () => {
    const playSfx = vi.fn();
    const actions = makeActions({ playSfx });
    const { sys } = makeSys({ pos: makePos({ u: 0, v: 0 }), actions });
    // dist to hero (heroU=10) = 10, sightRange=12, crouching true → effSight=12*0.6=7.2 < 10
    const en = makeEnemy({ _wasChasing: false });
    sys.tick(0.016, en, makeCtx({ heroU: 10, heroV: 0, crouching: true }));
    expect(playSfx).not.toHaveBeenCalled(); // alert bark needs canSee
  });

  it("canSee is false when smokeZone covers enemy", () => {
    const playSfx = vi.fn();
    const actions = makeActions({ playSfx });
    const { sys } = makeSys({ pos: makePos({ u: 0, v: 0 }), actions });
    const en = makeEnemy({ _wasChasing: false });
    const smokeZones = [{ u: 0, v: 0, radius: 5 }]; // smoke covers enemy at (0,0)
    sys.tick(0.016, en, makeCtx({ heroU: 3, heroV: 0, smokeZones }));
    expect(playSfx).not.toHaveBeenCalled();
  });

  // Magic numbers: alertBarkDist=6, alertBarkDur=1.6
  it("alert bark fires when canSee && dist < 6 && !_wasChasing", () => {
    const playSfx = vi.fn();
    const actions = makeActions({ playSfx });
    const { sys } = makeSys({ pos: makePos({ u: 0, v: 0 }), actions });
    const en = makeEnemy({ _wasChasing: false });
    // dist = 4 (inside 6), sightRange=12, LOS=true
    sys.tick(0.016, en, makeCtx({ heroU: 4, heroV: 0 }));
    expect(playSfx).toHaveBeenCalledWith(expect.stringContaining("sawtooth"), 0.22);
    expect(en._alertT).toBe(1.6);
    expect(en._wasChasing).toBe(true);
  });

  it("alert bark does NOT fire when dist >= 6", () => {
    const playSfx = vi.fn();
    const actions = makeActions({ playSfx });
    const { sys } = makeSys({ pos: makePos({ u: 0, v: 0 }), actions });
    const en = makeEnemy({ _wasChasing: false });
    sys.tick(0.016, en, makeCtx({ heroU: 6, heroV: 0 }));
    expect(playSfx).not.toHaveBeenCalled();
  });

  it("alert bark uses robot freq 280, heavy freq 90, default 160", () => {
    const playSfx = vi.fn();
    const actions = makeActions({ playSfx });
    for (const [type, freq] of [["robot", 280], ["heavy", 90], ["grunt", 160]]) {
      playSfx.mockClear();
      const { sys } = makeSys({ pos: makePos(), actions });
      const en = makeEnemy({ type, _wasChasing: false });
      sys.tick(0.016, en, makeCtx({ heroU: 2, heroV: 0 }));
      expect(playSfx.mock.calls[0][0]).toContain(`tone:${freq}`);
    }
  });

  it("setAlertBroadcastT called with nowMs/1000 on bark", () => {
    const { sys, getAlertT } = makeSys({ pos: makePos() });
    const en = makeEnemy({ _wasChasing: false });
    sys.tick(0.016, en, makeCtx({ heroU: 2, heroV: 0, nowMs: 7000 }));
    expect(getAlertT()).toBeCloseTo(7, 3);
  });

  // Magic number: broadcastWindow=1.5
  it("en._alertT set to 1.0 from broadcast within 1.5s", () => {
    const { sys } = makeSys({ pos: makePos(), alertBroadcastT: 9.5 }); // 0.5s ago
    const en = makeEnemy({ _wasChasing: false });
    // heroU=20 → dist=20 > sightRange=12 → canSee false → won't bark, but broadcast window open
    sys.tick(0.016, en, makeCtx({ heroU: 20, heroV: 0, nowMs: 10000 }));
    expect(en._alertT).toBe(1.0);
  });

  it("broadcast does NOT trigger outside 1.5s window", () => {
    const { sys } = makeSys({ pos: makePos(), alertBroadcastT: 8.4 }); // 1.6s ago
    const en = makeEnemy({ _wasChasing: false });
    sys.tick(0.016, en, makeCtx({ heroU: 20, heroV: 0, nowMs: 10000 }));
    expect(en._alertT).toBeUndefined();
  });

  // Magic numbers: enrageThreshold=0.25, enrageSpeedMul=1.35, boss enrage toast
  it("enrage fires for boss at < 25% HP", () => {
    const spawnParticles = vi.fn();
    const playSfx = vi.fn();
    const showToast = vi.fn();
    const actions = makeActions({ spawnParticles, playSfx, showToast });
    const { sys } = makeSys({ pos: makePos(), actions });
    const en = makeEnemy({ type: "boss", hp: 20, maxHp: 100 }); // 20% HP
    sys.tick(0.016, en, makeCtx());
    expect(spawnParticles).toHaveBeenCalledWith(0, 1.0, 0, 40, "red", 9, 1.2);
    expect(playSfx).toHaveBeenCalledWith("tone:60:350:sawtooth", 0.75);
    expect(showToast).toHaveBeenCalledWith("★ BOSS ENRAGED!", "danger", 2500);
    expect(en._enraged).toBe(true);
  });

  it("enrage NOT fired for grunt (not enrageable)", () => {
    const showToast = vi.fn();
    const actions = makeActions({ showToast });
    const { sys } = makeSys({ pos: makePos(), actions });
    const en = makeEnemy({ type: "grunt", hp: 20, maxHp: 100 });
    sys.tick(0.016, en, makeCtx());
    expect(showToast).not.toHaveBeenCalled();
  });

  it("enrage not fired twice (sets en._enraged=true)", () => {
    const showToast = vi.fn();
    const actions = makeActions({ showToast });
    const { sys } = makeSys({ pos: makePos(), actions });
    const en = makeEnemy({ type: "boss", hp: 20, maxHp: 100, _enraged: true });
    sys.tick(0.016, en, makeCtx());
    expect(showToast).not.toHaveBeenCalled();
  });

  // Magic number: panicSpeedMul=1.3
  it("panic flee calls resolveMove and returns before BT when en._panicT > 0", () => {
    const resolveMove = vi.fn();
    const runBt = vi.fn();
    const { sys } = makeSys({ resolveMove, runBt, pos: makePos({ u: 0, v: 0 }) });
    const en = makeEnemy({ _panicT: 1.0, moveSpeed: 3 });
    sys.tick(0.016, en, makeCtx({ heroU: 5, heroV: 0 }));
    expect(resolveMove).toHaveBeenCalled();
    expect(runBt).not.toHaveBeenCalled();
  });

  // Magic numbers: heardShotRadius=9, heardConvergeThresh=1.2
  it("heard-shot: registers within 9m when heroShotAlertT > 0 and no LOS", () => {
    const { sys } = makeSys({ pos: makePos({ u: 5, v: 0 }), hasLOS: vi.fn(() => false) });
    const en = makeEnemy({ sightRange: 4 }); // dist=5 > sightRange → canSee false
    // heroShotAlert at (3, 0), dist from enemy (5,0) to alert (3,0) = 2 < 9
    sys.tick(0.016, en, makeCtx({ heroU: 5, heroV: 0, heroShotAlertT: 9.0, heroShotAlertU: 3, heroShotAlertV: 0 }));
    expect(en._heardShot).toBeGreaterThan(0); // set to 9.0 then decremented by dt in same tick
    expect(en._alertU).toBe(3);
  });

  it("heard-shot NOT registered beyond 9m", () => {
    const { sys } = makeSys({ pos: makePos({ u: 0, v: 0 }), hasLOS: vi.fn(() => false) });
    const en = makeEnemy({ sightRange: 4 });
    // heroShotAlert at (10, 0), dist from enemy (0,0) = 10 > 9
    sys.tick(0.016, en, makeCtx({ heroU: 20, heroV: 0, heroShotAlertT: 9.0, heroShotAlertU: 10, heroShotAlertV: 0 }));
    expect(en._heardShot).toBeUndefined();
  });

  it("heard-shot converge calls resolveMove and returns before BT", () => {
    const resolveMove = vi.fn();
    const runBt = vi.fn();
    // en at (0,0), alertU=5, alertV=0 → dist to alert=5 > 1.2, canSee=false
    const { sys } = makeSys({ pos: makePos({ u: 0, v: 0 }), resolveMove, runBt, hasLOS: vi.fn(() => false) });
    const en = makeEnemy({ _heardShot: 5.0, _alertU: 5, _alertV: 0, sightRange: 2 });
    sys.tick(0.016, en, makeCtx({ heroU: 20, heroV: 0 }));
    expect(resolveMove).toHaveBeenCalled();
    expect(runBt).not.toHaveBeenCalled();
  });

  // Magic number: staggerRotRate=Math.PI*4, staggerSpeed=0.35
  it("grenade stagger updates en._staggerAngle by PI*4 per second", () => {
    const { sys } = makeSys();
    const en = makeEnemy({ _staggerT: 1.0, _staggerAngle: 0, moveSpeed: 3 });
    sys.tick(0.5, en, makeCtx());
    expect(en._staggerAngle).toBeCloseTo(0 + 0.5 * (Math.PI * 4), 4);
  });

  it("grenade stagger sets em.group.rotation.z and skips BT", () => {
    const em = makeEm();
    const runBt = vi.fn();
    const { sys } = makeSys({ runBt });
    const en = makeEnemy({ _staggerT: 0.5, moveSpeed: 3 });
    sys.tick(0.016, en, makeCtx({ em }));
    expect(em.group.rotation.z).not.toBe(0);
    expect(runBt).not.toHaveBeenCalled();
  });

  // Magic number: arenaHalfSize=27.5
  it("arena clamp corrects position beyond 27.5", () => {
    const pos = makePos({ u: 30, v: 0 });
    const setEnemyPos = vi.fn();
    // First call for ep, second call for arena clamp
    const getEnemyPos = vi.fn().mockReturnValue(pos);
    const { sys } = makeSys({ getEnemyPos, setEnemyPos });
    const en = makeEnemy();
    sys.tick(0.016, en, makeCtx());
    // args: (id, x, y, z, u, v) → u is index 4
    const clampCalls = setEnemyPos.mock.calls.filter(c => Math.abs(c[4]) <= 27.5);
    expect(clampCalls.length).toBeGreaterThan(0);
    expect(clampCalls[clampCalls.length - 1][4]).toBeCloseTo(27.5, 4);
  });

  it("BT.run dispatches to sub-ticks via onChase when runBt fires onChase", () => {
    const sub = makeSpy();
    const runBt = vi.fn((bt, ctx) => ctx.onChase(ctx));
    const { sys } = makeSys({ sub, runBt });
    const en = makeEnemy({ _bt: {} });
    sys.tick(0.016, en, makeCtx());
    expect(sub.tick).toHaveBeenCalled();
  });

  it("BT.run dispatches strafeMeleeTick via onAttack when runBt fires onAttack", () => {
    const sub = makeSpy();
    const runBt = vi.fn((bt, ctx) => ctx.onAttack({ ...ctx, now: ctx.now ?? 10 }));
    const { sys } = makeSys({ sub, runBt });
    const en = makeEnemy({ _bt: {} });
    sys.tick(0.016, en, makeCtx());
    expect(sub.tick).toHaveBeenCalled();
  });

  it("fallback movement fires when runBt is null and enemy is in sight/attack range gap", () => {
    const resolveMove = vi.fn();
    // dist to hero = 5, sightRange=12, attackRange=1.8 → 1.8 < 5 < 12 → moves
    const { sys } = makeSys({ resolveMove, pos: makePos({ u: 0, v: 0 }), runBt: null });
    const en = makeEnemy({ _bt: null, sightRange: 12, attackRange: 1.8, moveSpeed: 3 });
    sys.tick(0.016, en, makeCtx({ heroU: 5, heroV: 0 }));
    expect(resolveMove).toHaveBeenCalled();
  });

  // Magic number: slowSpeedMul=0.55 for non-enrageable at < 25% HP
  it("enrage speed mul is 1.35 for boss; 0.55 for grunt (via panic resolveMove args)", () => {
    for (const [type, expectedMul] of [["boss", 1.35], ["grunt", 0.55]]) {
      const resolveMove = vi.fn();
      const { sys } = makeSys({ resolveMove, pos: makePos() });
      const en = makeEnemy({ type, hp: 20, maxHp: 100, _panicT: 0.5, moveSpeed: 1 });
      sys.tick(1.0, en, makeCtx({ heroU: 0, heroV: 0 })); // dt=1 for easy math
      const args = resolveMove.mock.calls[0];
      // panic speed: sin(ang)*moveSpeed*1.3*enSpeedMul*dt
      // With moveSpeed=1, dt=1: sin(ang)*1.3*enSpeedMul
      const totalMag = Math.hypot(args[1], args[2]);
      expect(totalMag).toBeCloseTo(1.3 * expectedMul, 3);
    }
  });
});
