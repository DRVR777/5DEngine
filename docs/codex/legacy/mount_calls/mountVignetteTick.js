// Legacy clone of mountVignetteTick call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 1632..1632
// (context lines 1628..1636)

const _fpsTick = mountFpsTick({ get: { fpsFrames: () => _fpsFrames, fpsWindowT: () => _fpsWindowT, fpsDisplay: () => _fpsDisplay }, set: { fpsFrames: v => { _fpsFrames = v; }, fpsWindowT: v => { _fpsWindowT = v; }, fpsDisplay: v => { _fpsDisplay = v; } }, actions: { onNewFps: fps => { if (typeof Engine !== "undefined") { Engine.debug.fpsHistory.push(fps); if (Engine.debug.fpsHistory.length > 60) Engine.debug.fpsHistory.shift(); } } } });
const _crosshairTick = mountCrosshairTick();
const _combatHudTick = mountCombatHudTick();
const _clockHudTick  = mountClockHudTick({ actions: { getDayNightHour: () => (typeof DayNight !== "undefined") ? DayNight.getHour() : null } });
const _vignetteTick  = mountVignetteTick({ get: { vignetteAmt: () => _vignetteAmt }, set: { vignetteAmt: v => { _vignetteAmt = v; } } });
const _statBarsTick  = mountStatBarsTick({ get: { hpGhost: () => _hpGhost }, set: { hpGhost: v => { _hpGhost = v; } } });
const _bossBarTick   = mountBossBarTick();
const _comboHudTick    = mountComboHudTick();
const _vehicleDashTick = mountVehicleDashTick();
