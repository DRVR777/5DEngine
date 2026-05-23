// Legacy clone of mountKillTracking call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 456..474
// (context lines 452..478)

const _refreshPerkHud = _perkSys.refreshPerkHud;
const _applyPerk      = _perkSys.applyPerk;
const _activePerkLabels = _perkSys.activePerkLabels;
// Kill tracking + COIN_BY_TYPE imported from src/systems/kill_tracking.js
const _killTracking = mountKillTracking({
  enemies, world,
  get: {
    perkLifesteal:  () => _perkLifesteal,
    heroDead:       () => _heroDead,
    heroHp:         () => heroHp,
    HERO_MAX_HP:    () => HERO_MAX_HP,
    perkMaxHpBonus: () => _perkMaxHpBonus,
  },
  set: {
    heroHp: (v) => { heroHp = v; },
  },
  actions: {
    spawnDamageNumber: (u, y, v, text, color) => _spawnDamageNumber(u, y, v, text, color),
    addKillFeedEntry:  (text, color) => _addKillFeedEntry(text, color),
    showToast:         (msg, type, dur) => showToast(msg, type, dur),
    playSfx:           (t, v) => playSfx(t, v),
  },
});
const _trackKillAndPanic = _killTracking.trackKillAndPanic;
let hitMarkerUntil = 0;
let _killMarkerUntil = 0, _killMarkerHs = false;
let _dmgDirAngle = 0;  // world-space angle toward attacker (radians)
