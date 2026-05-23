// Legacy clone of mountStatusTintTick call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 1320..1320
// (context lines 1316..1324)

const _throwFlashbang    = gadget.throwFlashbang;
const _throwGrenade      = gadget.throwGrenade;
const _explodeGrenade    = gadget.explodeGrenade;
let _heroBlindT          = 0; // seconds of white-out flash; written by gadget.explodeGrenade via set.heroBlindT
const _statusTintTick = mountStatusTintTick({ get: { heroBlindT: () => _heroBlindT, heroFireT: () => _heroFireT, heroEmpT: () => _heroEmpT }, set: { heroBlindT: v => { _heroBlindT = v; } }, actions: { getActiveEffects: id => (typeof StatusEffects !== "undefined") ? (StatusEffects.getActive(id) || []) : [] } });

// ---- input ----
const keys = Object.create(null);
const _5D_NO_RENDER = typeof location !== "undefined" && new URLSearchParams(location.search).has("_5dnorender");
