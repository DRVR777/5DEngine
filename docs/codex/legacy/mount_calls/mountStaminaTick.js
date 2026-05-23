// Legacy clone of mountStaminaTick call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 1705..1705
// (context lines 1701..1709)

let _slideT = 0, _slideDU = 0, _slideDV = 0, _ctrlWasDown = false; // sprint slide state
let _stamina = 100;    // 0..100; depletes while sprinting, regens when idle
// ═══ EXTRACTED → src/config/hero_stats.js (iter 562) — STAMINA_MAX/DRAIN/REGEN/LOCKOUT imported at top
let _heroExtraStaminaMax = 0; // bonus from kill level 3
const _staminaTick = mountStaminaTick({ STAMINA_DRAIN, STAMINA_REGEN, STAMINA_MAX, STAMINA_LOCKOUT, get: { stamina: () => _stamina, heroEmpT: () => _heroEmpT, heroExtraStaminaMax: () => _heroExtraStaminaMax }, set: { stamina: v => { _stamina = v; }, heroEmpT: v => { _heroEmpT = v; } } });
// These resolve per-weapon dynamically at call sites
const RELOAD_DUR     = () => Math.round((getWeapon().reloadDuration || 1200) * _perkReloadMul);
const PISTOL_MAG_CAP = () => getWeapon().magCap || 12;

