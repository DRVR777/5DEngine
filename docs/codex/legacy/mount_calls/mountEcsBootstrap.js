// Legacy clone of mountEcsBootstrap call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 2413..2433
// (context lines 2409..2437)

});

// ═══ EXTRACTED → src/core/ecs_bootstrap.js (iter 583)
// ═══ TICK 3 — ECS Core boot (additive, parallel runtime) ═══════════════════
mountEcsBootstrap({
  Core, CFG,
  combatSystem, createWaveSystem, pickupSystem, spawnPickup,
  createShopSystem, createPerkSystem, createAgentDispatch, createStatusEffectSystem,
  regenSystem, createWeaponSystem, createScoreSystem, createAIMovementSystem,
  createInventorySystem, invAdd, invRemove, invCount, invHas,
  createStaminaSystem, createGrenadeSystem, createBulletSystem, spawnBullet,
  createLootDropSystem, DROP_TABLE,
  createKnockbackSystem, createPlayerMovementSystem, createEnrageSystem,
  createBossSlamSystem, createFastChargeSystem, createRobotEmpSystem,
  createHeavyThrowSystem, createBossRockSystem, createPoisonerSpitSystem,
  createIncendiaryBombSystem, createSniperShootSystem, createMeleeAttackSystem,
  createMoralePanicSystem, createStaggerMovementSystem, createGunshotAlertSystem,
  createRobotShootSystem, createPoisonerDartSystem, createEnemyBulletSystem,
  createEnemyRegenSystem, createEnemySeparationSystem, createComboSystem,
  createArenaClampSystem, createEnemyBlindSystem, createSmokeZoneSystem,
  createMineSystem, createTurretSystem, createFirePatchSystem, createPoisonPuddleSystem,
  createCoinDropSystem, createSpeedOrbSystem, createArmorShardSystem,
  createHealthPickupSystem, createAmmoPickupSystem, createWeaponPickupSystem,
  createGrenadeCrateSystem, createArmorVestSystem,
});

// Pseudocode: working-build overlay verifies/pulls git after loading succeeds.
mountLoadCheckOverlay({
  actions: {
