// Legacy clone of mountCrateSystem call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 1343..1360
// (context lines 1339..1364)

  document.getElementById("invWeight").textContent = Inv.totalWeight(heroInv).toFixed(1);
}

// ── Crate system — iter 541 ──────────────────────────────────────────────────
const { makeCrate: _makeCrate, breakCrate: _breakCrate, crates } = mountCrateSystem({
  THREE, scene,
  get: {
    score:  () => score,
    weapon: () => getWeapon(),
  },
  set: {
    score: (v) => { score = v; },
  },
  actions: {
    playSfx,
    showToast,
    spawnParticles:   _spawnParticles,
    spawnAmmoPickup:  _spawnAmmoPickup,
    spawnHealthPickup: _spawnHealthPickup,
    spawnDamageNumber: _spawnDamageNumber,
  },
});

mountKeydownHandler({
  keys,
  invDiv,
