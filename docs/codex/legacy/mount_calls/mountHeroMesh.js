// Legacy clone of mountHeroMesh call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 954..954
// (context lines 950..958)

// ═══ EXTRACTED → src/render/environment.js (iter 548)
const { skyUniforms, ground, sky, grid } = mountEnvironment({ THREE, scene, buildings });

// ═══ EXTRACTED → src/render/hero_mesh.js (iter 549)
const { heroGroup, torso, thighL, shinL, thighR, shinR, armL, armR, walkState, shadowBlob: _shadowBlob } = mountHeroMesh({ THREE, scene });

// ---- Weapon mesh registry ----
const { gunMount: _gunMount, fpGunGroup: _fpGunGroup, switchGunMesh: _switchGunMesh, registerGunMesh: _wvRegisterGunMesh } = createWeaponVisuals({
  THREE, armR, camera,
