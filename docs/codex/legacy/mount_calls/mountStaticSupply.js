// Legacy clone of mountStaticSupply call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 1054..1054
// (context lines 1050..1058)

  ammoPickups, weaponPickups, healthPickups, armorShards, coinDrops,
} = mountDropSpawner({ THREE, scene, CFG, get: { weapon: () => getWeapon() } });

// ═══ EXTRACTED → src/systems/static_supply.js (iter 550)
const { grenadeCrates, armorPickups } = mountStaticSupply({ THREE, scene });

// ═══ EXTRACTED → src/systems/speed_orb_spawner.js (iter 551)
// _speedBoostT / _speedTrailT remain here — mutated by lifecycle + tick
let _speedBoostT = 0;
