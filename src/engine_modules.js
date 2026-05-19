// Central re-export barrel for all engine subsystems.
// index.html imports everything from here — add one line per new extracted module.
// Goal: index.html eventually becomes ~3 lines: import, init, start.

// ── UI ──────────────────────────────────────────────────────────────────────
export { mountHudTemplate }    from "./ui/hud_template.js";
export { mountHudElements }    from "./ui/hud_cache.js";
export { mountWeaponSelector } from "./ui/weapon_selector.js";
export { mountComputerUI }     from "./ui/computer_ui_events.js";
export { default as Notifications } from "./ui/hud_notifications.js";
export { default as Minimap }  from "./ui/minimap.js";

// ── Entities ─────────────────────────────────────────────────────────────────
export { createHeroAnimSystem } from "./entities/hero_animation.js";

// ── Systems ──────────────────────────────────────────────────────────────────
export { mountConfigEditor }    from "./systems/config_editor.js";
export { mountSceneHierarchy }  from "./systems/scene_hierarchy.js";
export { mountDuelMode }        from "./systems/duel_mode.js";
export { mountNpcDialog, DEFAULT_NPC_DIALOGS } from "./systems/npc_dialog.js";
export { mountQuestPanel }      from "./systems/quest_panel.js";
export { mountSettingsPanel }   from "./systems/settings_panel.js";
export { buildComputerApps, addDynamicIcons } from "./systems/computer_apps.js";
export { mountMouseInput }      from "./systems/mouse_input.js";
export { mountKeydownHandler, mountKeyupHandler } from "./systems/keydown_handler.js";
export { mountGadgetSystem }    from "./systems/gadget_system.js";
export { mountSpawnSystem }     from "./systems/spawn_system.js";
export { mountPerkSystem }      from "./systems/perk_system.js";
export { mountHeroLifecycle }   from "./systems/hero_lifecycle.js";
export { mountGameReset }       from "./systems/game_reset.js";
export { mountDevConsoleGame }  from "./systems/dev_console_game.js";
export { mountKillTracking, COIN_BY_TYPE } from "./systems/kill_tracking.js";
export { mountLevelSystem }     from "./systems/level_system.js";
export { mountBarrelSystem }    from "./systems/barrel_system.js";
export { mountCrateSystem }     from "./systems/crate_system.js";
export { mountHazardZones }     from "./systems/hazard_zones.js";
export { mountDropSpawner, WEAPON_DROP_MAP } from "./systems/drop_spawner.js";
export { GameProgress }         from "./systems/save_load.js";

// ── Combat ───────────────────────────────────────────────────────────────────
export { mountShootSystem }    from "./combat/shoot_system.js";
export { createWeaponVisuals } from "./combat/weapon_visuals.js";

// ── Render ───────────────────────────────────────────────────────────────────
export { mountDecalSystem }       from "./render/decals.js";
export { mountEnemyMeshFactory }  from "./render/enemy_mesh.js";
export { mountVehicleMeshFactory } from "./render/vehicle_mesh.js";
export { mountVehicleMeshes }     from "./render/vehicle_meshes.js";
export { mountFlashlight }        from "./render/flashlight.js";
export { mountBulletGeo }         from "./render/bullet_geo.js";
export { mountEnvironment }       from "./render/environment.js";
export { mountHeroMesh }          from "./render/hero_mesh.js";
export { mountLighting }          from "./render/lighting.js";
export { mountNpcMeshFactory }    from "./render/npc_mesh.js";
export { mountPickupMeshes }      from "./render/pickup_mesh.js";
export { mountComputerMesh }      from "./render/computer_mesh.js";
export { mountSkybox }            from "./render/skybox.js";

// ── Static supplies ───────────────────────────────────────────────────────────
export { mountStaticSupply }      from "./systems/static_supply.js";
export { mountSpeedOrbSpawner }   from "./systems/speed_orb_spawner.js";
export { default as Vfx, warnRingGeo, warnRingMat } from "./render/vfx.js";

// ── Social ───────────────────────────────────────────────────────────────────
export { createLanSession } from "./social/lan_session.js";

// ── Economy ──────────────────────────────────────────────────────────────────
export { mountShopPanel } from "./economy/shop_panel.js";

// ── Core ─────────────────────────────────────────────────────────────────────
export { Core } from "./core/core.js";

// ── Config ────────────────────────────────────────────────────────────────────
export { ENEMY_TYPES, WEAPON_DMG_MULTIPLIERS } from "./config/enemy_types.js";
export { makeHeroStats, HERO_MAX_ARMOR, ARMOR_ABSORB, DODGE_DURATION, DODGE_SPEED, DODGE_COOLDOWN,
         STAMINA_MAX, STAMINA_DRAIN, STAMINA_REGEN, STAMINA_LOCKOUT } from "./config/hero_stats.js";

// ── World ─────────────────────────────────────────────────────────────────────
export { default as Rain }     from "./world/rain.js";
export { mountWorldLayout }    from "./world/world_layout.js";

// ── Audio ─────────────────────────────────────────────────────────────────────
export { default as Sfx } from "./audio/sfx.js";

// ── Progression ───────────────────────────────────────────────────────────────
export { default as HighScore } from "./progression/high_score.js";

// ── ECS systems ──────────────────────────────────────────────────────────────
export { combatSystem }             from "./systems/ecs_combat.js";
export { createWaveSystem }         from "./systems/ecs_wave.js";
export { pickupSystem, spawnPickup } from "./systems/ecs_pickup.js";
export { createShopSystem }         from "./systems/ecs_shop.js";
export { createPerkSystem }         from "./systems/ecs_perk.js";
export { createAgentDispatch }      from "./systems/ecs_agent_dispatch.js";
export { createStatusEffectSystem } from "./systems/ecs_status_effects.js";
export { regenSystem }              from "./systems/ecs_regen.js";
export { createWeaponSystem }       from "./systems/ecs_weapon.js";
export { createScoreSystem }        from "./systems/ecs_score.js";
export { createAIMovementSystem }   from "./systems/ecs_ai_movement.js";
export { createInventorySystem, invAdd, invRemove, invCount, invHas } from "./systems/ecs_inventory.js";
export { createStaminaSystem }      from "./systems/ecs_stamina.js";
export { createGrenadeSystem }      from "./systems/ecs_grenade.js";
export { createBulletSystem, spawnBullet } from "./systems/ecs_bullet.js";
export { createLootDropSystem, DROP_TABLE } from "./systems/ecs_loot_drop.js";
export { createKnockbackSystem }    from "./systems/ecs_knockback.js";
export { createPlayerMovementSystem } from "./systems/ecs_player_movement.js";
export { createEnrageSystem }       from "./systems/ecs_enrage.js";
export { createBossSlamSystem }     from "./systems/ecs_boss_slam.js";
export { createFastChargeSystem }   from "./systems/ecs_fast_charge.js";
export { createRobotEmpSystem }     from "./systems/ecs_robot_emp.js";
export { createHeavyThrowSystem }   from "./systems/ecs_heavy_throw.js";
export { createBossRockSystem }     from "./systems/ecs_boss_rock.js";
export { createPoisonerSpitSystem } from "./systems/ecs_poisoner_spit.js";
export { createIncendiaryBombSystem } from "./systems/ecs_incendiary_bomb.js";
export { createSniperShootSystem }  from "./systems/ecs_sniper_shoot.js";
export { createMeleeAttackSystem }  from "./systems/ecs_melee_attack.js";
export { createMoralePanicSystem }  from "./systems/ecs_morale_panic.js";
export { createStaggerMovementSystem } from "./systems/ecs_stagger_movement.js";
export { createGunshotAlertSystem } from "./systems/ecs_gunshot_alert.js";
export { createRobotShootSystem }   from "./systems/ecs_robot_shoot.js";
export { createPoisonerDartSystem } from "./systems/ecs_poisoner_dart.js";
export { createEnemyBulletSystem }  from "./systems/ecs_enemy_bullet.js";
export { createEnemyRegenSystem }   from "./systems/ecs_enemy_regen.js";
export { createEnemySeparationSystem } from "./systems/ecs_enemy_separation.js";
export { createComboSystem }        from "./systems/ecs_combo.js";
export { createArenaClampSystem }   from "./systems/ecs_arena_clamp.js";
export { createEnemyBlindSystem }   from "./systems/ecs_enemy_blind.js";
export { createSmokeZoneSystem }    from "./systems/ecs_smoke_zone.js";
export { createMineSystem }         from "./systems/ecs_mine.js";
export { createTurretSystem }       from "./systems/ecs_turret.js";
export { createFirePatchSystem }    from "./systems/ecs_fire_patch.js";
export { createPoisonPuddleSystem } from "./systems/ecs_poison_puddle.js";
export { createCoinDropSystem }     from "./systems/ecs_coin_drop.js";
export { createSpeedOrbSystem }     from "./systems/ecs_speed_orb.js";
export { createArmorShardSystem }   from "./systems/ecs_armor_shard.js";
export { createHealthPickupSystem } from "./systems/ecs_health_pickup.js";
export { createAmmoPickupSystem }   from "./systems/ecs_ammo_pickup.js";
export { createWeaponPickupSystem } from "./systems/ecs_weapon_pickup.js";
export { createGrenadeCrateSystem } from "./systems/ecs_grenade_crate.js";
export { createArmorVestSystem }    from "./systems/ecs_armor_vest.js";
