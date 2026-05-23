// Legacy clone of mountSaveWiring call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 2232..2232
// (context lines 2228..2236)

// EXTRACT-PLAN iter 532: save_system.js → src/systems/save_system.js
// Covers: localStorage save/load, _loadGameState, _saveGameState
// ═══ EXTRACTED → src/systems/save_wiring.js (iter 683) ════════════════════════
// Pseudocode: GameProgress.init(collect, apply) + auto-save 30s + Ctrl+S keydown.
const { save: _saveGame, load: _loadGame } = mountSaveWiring({ GameProgress, get: { score: () => score, enemyKills: () => enemyKills, heroHp: () => heroHp, heroMaxHp: () => HERO_MAX_HP, currentWeaponId: () => currentWeaponId, computerOpen: () => computerOpen, heroPos: () => world.getPlayer ? (world.getPlayer("hero") || { u: 0, v: 0, y: 0 }) : { u: 0, v: 0, y: 0 }, inventory: () => (typeof _inventory !== "undefined") ? _inventory : [], spawnPoints: () => _spawnPoints, quests: () => _quest.getQuests() }, set: { score: v => { score = v; }, enemyKills: v => { enemyKills = v; }, heroHp: v => { heroHp = v; } }, actions: { addSpawnPoint: _addSpawnPoint, renderQuests: () => _quest.renderQuests(), showToast }, registerKeydown: fn => document.addEventListener("keydown", fn) });
window._saveGame = _saveGame;
window._loadGame = _loadGame;

// ═══ EXTRACTED → src/systems/starter_quests.js (iter 581)
