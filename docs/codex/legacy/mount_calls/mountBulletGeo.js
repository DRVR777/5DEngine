// Legacy clone of mountBulletGeo call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 794..794
// (context lines 790..798)

let flashbangCount = 2;
const smokeZones = [];
let _mineCount = 2;
// ═══ EXTRACTED → src/render/bullet_geo.js (iter 561)
const { bulletGeo, bulletMat } = mountBulletGeo({ THREE });

const damageFlashEl = document.getElementById("damageFlash");
let damageFlashUntil = 0;
let _vignetteAmt = 0; // spring [0..1]: driven by hit impulses + low-HP pulse
