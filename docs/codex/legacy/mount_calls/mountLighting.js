// Legacy clone of mountLighting call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 862..862
// (context lines 858..866)

  mountVfxInit({ THREE, scene, camera, Vfx, warnRingGeo: _vfxWarnGeo, warnRingMat: _vfxWarnMat });
// ─────────────────────────────────────────────────────────────────────────────

// ═══ EXTRACTED → src/render/lighting.js (iter 553)
const { ambLight: _ambLight, sun } = mountLighting({ THREE, scene, Engine, renderer });

// ═══ EXTRACTED → src/systems/wave_events.js (iter 684)
if (typeof WaveManager !== "undefined") {
  mountWaveEvents({
