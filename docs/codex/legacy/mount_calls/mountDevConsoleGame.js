// Legacy clone of mountDevConsoleGame call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 580..591
// (context lines 576..595)

window.Engine = window.Engine || {};
window.Engine.debug = window.Engine.debug || { godMode: false, noclip: false };

// ---- Dev console (` key) — game command handler ----
mountDevConsoleGame({
  toggleGodMode:   () => { window.Engine.debug.godMode  = !window.Engine.debug.godMode; },
  isGodMode:       () => window.Engine.debug.godMode,
  toggleNoclip:    () => { window.Engine.debug.noclip   = !window.Engine.debug.noclip; },
  isNoclip:        () => window.Engine.debug.noclip,
  heal:            () => { heroHp = HERO_MAX_HP + _perkMaxHpBonus; heroArmor = HERO_MAX_ARMOR; },
  refillAmmo:      () => { for (const w of (CFG.weapons || [])) { weaponAmmo.set(w.id, w.magCap); } pistolAmmo = getWeapon().magCap; },
  spawnEnemy:      (type) => { if (typeof window._spawnEnemyAtHero === "function") window._spawnEnemyAtHero(type); },
  teleport:        (tu, tv) => { const hp = world.players.get("hero"); world.setPlayer("hero", hp.x, hp.y, hp.z, tu, tv); },
  setWave:         (wn) => { if (typeof WaveManager !== "undefined") { WaveManager.wave = wn - 1; WaveManager.phase = "spawn"; } },
  resetGameState:  () => resetGameState(),
});

// ═══ EXTRACTED → src/systems/entity_hooks.js (iter 587)
mountEntityHooks({
  ARMOR_ABSORB,
