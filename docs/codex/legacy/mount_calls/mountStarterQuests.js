// Legacy clone of mountStarterQuests call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 2237..2241
// (context lines 2233..2245)

window._saveGame = _saveGame;
window._loadGame = _loadGame;

// ═══ EXTRACTED → src/systems/starter_quests.js (iter 581)
mountStarterQuests({
  addQuest: (...a) => _quest.addQuest(...a),
  showToast,
  loadGame: () => _loadGame(),
});

// J key closes quest panel too if focus is in-game
document.addEventListener("keydown", (e) => {
  if (e.code === "KeyJ" && !computerOpen) _quest.renderQuests();
