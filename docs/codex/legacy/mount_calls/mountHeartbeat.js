// Legacy clone of mountHeartbeat call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 1621..1625
// (context lines 1617..1629)

let _bulletTimeLeft = 0;  // seconds remaining of bullet-time slow (sniper incoming / headshot kill / wave clear)
let _nearDeathFired = false; // near-death bullet-time has fired this life (resets above 15 HP)
let _heartbeatT = 0;
// ═══ EXTRACTED → src/systems/heartbeat.js (iter 590)
const _heartbeat = mountHeartbeat({
  get: { heroHp: () => heroHp, HERO_MAX_HP: () => HERO_MAX_HP, heroDead: () => _heroDead, heartbeatT: () => _heartbeatT },
  set: { heartbeatT: v => { _heartbeatT = v; } },
  actions: { playSfx },
});
let _hpGhost = 100;       // lagging HP ghost bar — catches up slowly after damage
let _fpsFrames = 0, _fpsDisplay = 0, _fpsWindowT = performance.now();
const _fpsTick = mountFpsTick({ get: { fpsFrames: () => _fpsFrames, fpsWindowT: () => _fpsWindowT, fpsDisplay: () => _fpsDisplay }, set: { fpsFrames: v => { _fpsFrames = v; }, fpsWindowT: v => { _fpsWindowT = v; }, fpsDisplay: v => { _fpsDisplay = v; } }, actions: { onNewFps: fps => { if (typeof Engine !== "undefined") { Engine.debug.fpsHistory.push(fps); if (Engine.debug.fpsHistory.length > 60) Engine.debug.fpsHistory.shift(); } } } });
const _crosshairTick = mountCrosshairTick();
