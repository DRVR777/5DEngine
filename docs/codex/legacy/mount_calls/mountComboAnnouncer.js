// Legacy clone of mountComboAnnouncer call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 359..364
// (context lines 355..368)

let _comboCount = 0;
let _comboLastT = 0;
let _comboAnnouncedMul = 0;
// ═══ EXTRACTED → src/systems/combo_announcer.js (iter 592)
const _comboAnnouncer = mountComboAnnouncer({
  DECAY: _COMBO_DECAY,
  get: { comboCount: () => _comboCount, comboLastT: () => _comboLastT, comboAnnouncedMul: () => _comboAnnouncedMul },
  set: { comboCount: v => { _comboCount = v; }, comboAnnouncedMul: v => { _comboAnnouncedMul = v; } },
  actions: { showToast, playSfx: (...a) => playSfx(...a) },
});
// ════════════════════════════════════════════════════════════════════════════
// PERK SYSTEM STATE — multipliers applied on top of base stats each wave.
// All are reset on new game via _perkSys.clearTimerAndReset().
// ════════════════════════════════════════════════════════════════════════════
