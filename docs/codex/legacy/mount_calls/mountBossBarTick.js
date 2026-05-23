// Legacy clone of mountBossBarTick call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 1634..1634
// (context lines 1630..1638)

const _combatHudTick = mountCombatHudTick();
const _clockHudTick  = mountClockHudTick({ actions: { getDayNightHour: () => (typeof DayNight !== "undefined") ? DayNight.getHour() : null } });
const _vignetteTick  = mountVignetteTick({ get: { vignetteAmt: () => _vignetteAmt }, set: { vignetteAmt: v => { _vignetteAmt = v; } } });
const _statBarsTick  = mountStatBarsTick({ get: { hpGhost: () => _hpGhost }, set: { hpGhost: v => { _hpGhost = v; } } });
const _bossBarTick   = mountBossBarTick();
const _comboHudTick    = mountComboHudTick();
const _vehicleDashTick = mountVehicleDashTick();
let _combatAmbT = 0;
const _combatAmbientTick = mountCombatAmbientTick({ get: { ambT: () => _combatAmbT }, set: { ambT: v => { _combatAmbT = v; } }, actions: { isAmbientReady: () => Sfx.isAmbientReady(), setAmbient: (k, f, t, v, fade) => _setAmbient(k, f, t, v, fade) } });
