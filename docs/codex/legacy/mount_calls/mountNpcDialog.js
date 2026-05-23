// Legacy clone of mountNpcDialog call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 693..693
// (context lines 689..697)

// ═══════════════════════════════════════════════════════════════════════════════
window.showToast = Notifications.showToast;  // keep global API

// ---- NPC Dialog system ----
const _npcDialog = mountNpcDialog(DEFAULT_NPC_DIALOGS);
// ---- Quest / Objective system ----
const _quest = mountQuestPanel({ showToast });
window.addQuest = (...a) => _quest.addQuest(...a);
window.completeQuestStep = (...a) => _quest.completeQuestStep(...a);
