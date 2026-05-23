# game.html — Complete Inventory of Functionality

Status as of iter 741 (2026-05-23). The substrate (`index.html`) currently
reproduces a fraction of game.html. This doc lists EVERY subsystem so the
migration roadmap reflects reality, not just what's been shipped.

Legend:
  - ✅ DONE         — fully absorbed by a substrate kind/facet
  - ⚠ PARTIAL      — kind+tuning+spawn exist, behavior incomplete or inert
  - ❌ MISSING      — not in substrate at all yet
  - 🔧 PRIMITIVE    — needs a new substrate primitive before kinds can fit

Each game.html system is a `mount*` function call (~135 total).

---

## 1. Hero — movement, camera, lifecycle

| game.html system | substrate equiv | status |
|---|---|---|
| mountHeroMoveTick | hero-input-move facet (iter 740) | ✅ |
| mountCameraPosTick | boot.js updateCamera() (iter 740) | ✅ |
| mountKeydownHandler / mountKeyupHandler / mountMouseInput / mountCanvasPrimaryAction | input kind + input-state facet (iter 740) | ✅ |
| mountCamPitchSprings | pitch-spring facet | ❌ |
| mountCamShakeTick | camera-shake facet on hero or scene | ❌ |
| mountCamDistTick | camera zoom (scroll wheel) | ❌ |
| mountCameraZoneTick | camera-zone Thinga (cinematic regions) | ❌ |
| mountFreecamTick | freecam input-mode | ❌ |
| mountMotionSprings | gun-bob + strafe-roll facet | ❌ |
| mountSniperSway | scope-sway facet | ❌ |
| mountScopeFovTick | scope-fov facet | ❌ |
| mountWalkAnimTick | walk-anim facet on hero | ❌ |
| mountHeroFaceTick | hero rotation slave to yaw | ⚠ (heading set by move) |
| mountDodgeTick | dodge facet (dash) | ❌ |
| mountJumpGravityTick | jump+gravity facet | ❌ |
| mountCrouchSpeedTick | crouch facet | ❌ |
| mountStaminaTick | stamina facet | ❌ |
| mountHeroLifecycle | hero-respawn facet (iter 742) — teleport+heal only, no UI yet | ⚠ |
| mountHeroRegenTick | hp-regen facet (regen_delay + rate already in hero-tuning) | ❌ |
| mountHeroKnockbackTick | knockback-spring facet | ❌ |
| mountHeroMesh | hero mesh-spec (iter 724) | ✅ |
| mountFootstepSound | footstep-sfx facet | ❌ |

## 2. Combat — weapons, bullets, hit detection

| game.html system | substrate equiv | status |
|---|---|---|
| mountShootSystem | hero-shoot facet (iter 741) | ✅ (hero side) |
| mountBulletPhysicsTick | position.velocity (iter 720) | ✅ |
| mountBulletWorldHitTick | bullet collides with barrels/crates/walls — no walls yet | ⚠ |
| mountBulletEnemyKillTick | enemy-death-cleanup facet (iter 742) | ✅ |
| mountBulletEnemyHitFeedbackTick | hit-flash + damage numbers | ❌ |
| mountEnemyBulletTick | enemy-shoot facet (sniper, robot, poisoner-ranged) | ❌ |
| mountWeaponAmmo | ammo-state facet on hero + per-weapon | ❌ |
| mountWeaponSelector | weapon-picker UI Thinga | ❌ |
| mountWeaponHudTick | shots-fired counter inside hud-overlay (iter 743); real ammo pending | ⚠ |
| mountFpGunPosTick | fp-gun-position facet (gun in front of cam) | ❌ |
| mountAmmoReloadTick | reload-state facet | ❌ |
| mountBulletGeo | already in bullet tunings (iter 720) | ✅ |
| mountGadgetSystem | gadget Things (mines, turrets, etc.) | ❌ |
| mountDecalSystem | wall-decal facet (bullet scorches) | ❌ |
| mountGrenadePhysicsTick / mountGrenadeArcTick / mountGrenadeWarnTick | grenade kind + grenade-physics facet + warn-overlay | ❌ |

## 3. Enemy AI — per-variant behaviors

| game.html system | substrate equiv | status |
|---|---|---|
| mountEnemyAiScaffoldTick | chase-target facet (iter 737) | ✅ (chase) |
| (melee attack) | attack-target facet (iter 738) | ✅ |
| mountEnemyMeshTick | mesh facet (iter 712 generic) | ✅ |
| mountEnemyMeshFactory | mesh-spec (iter 721+722+723+725) | ✅ |
| mountEnemyFootstepTick | enemy-footstep-sfx facet | ❌ |
| mountEnemyRegenTick | enemy hp-regen | ❌ |
| mountEnemySepTick | enemy-separation facet (don't overlap) | ❌ |
| mountEnemyRobotEmpTick | robot ranged EMP attack | ❌ |
| mountEnemyRobotPlasmaTick | robot plasma bullet | ❌ |
| mountEnemyHeavyGrenadeTick | heavy throws grenades | ❌ |
| mountEnemyBossRockTick | boss rock throw | ❌ |
| mountEnemyBossSlamTick | boss ground slam (AOE) | ❌ |
| mountEnemyPoisonerSpitTick | poisoner ground AOE | ❌ |
| mountEnemyPoisonerRangedSpitTick | poisoner ranged | ❌ |
| mountEnemyIncendiaryTick | incendiary fire attack | ❌ |
| mountEnemyFastChargeTick | fast charge attack | ❌ |
| mountEnemySniperTick | sniper aim + shot | ❌ |
| mountEnemyStrafeMeleeTick | strafe-while-meleeing | ❌ |
| `wander` AI when no target | wander facet | ❌ |
| `flinch` on hit | flinch-spring facet | ❌ |
| `drop-on-death` | drop-on-death facet (iter 742) | ✅ |
| `alert-bubble` over enemy | alert-bubble facet | ❌ |
| `health-display` HP bar plane | health-display facet | ❌ |

## 4. HUD — overlays, screens, indicators

| game.html system | substrate equiv | status |
|---|---|---|
| mountHudTemplate / mountHudElements | hud kind + hud-overlay facet (iter 743) | ⚠ (shell — widgets pending) |
| mountCrosshairTick | painted inside hud-overlay (iter 743) | ⚠ |
| mountCombatHudTick | combat-state hud | ❌ |
| mountStatBarsTick | HP bar inside hud-overlay (iter 743); armor/stamina pending | ⚠ |
| mountBossBarTick | boss-bar facet | ❌ |
| mountComboHudTick | combo-counter hud | ❌ |
| mountComboAnnouncer | combo-announcer (sfx) | ❌ |
| mountWaveHudTick | wave-indicator hud | ❌ |
| mountWeaponHudTick | weapon-hud | ❌ |
| mountClockHudTick | day/night clock hud | ❌ |
| mountVignetteTick | vignette overlay | ❌ |
| mountStatusTintTick | screen-tint per status effect | ❌ |
| mountVehicleDashTick | vehicle-dashboard hud | ❌ |
| mountDamageFeedback / damage numbers | floating-text Thingas | ❌ |
| mountDebugHudTick | debug-hud | ❌ |
| mountFpsTick | fps-counter | ❌ |

## 5. Pickups — drops, items

| game.html system | substrate equiv | status |
|---|---|---|
| mountAmmoPickupTick | ammo-pickup → pickup-radius dispatch (iter 744) | ✅ (consumed; ammo system pending) |
| mountHealthPickupTick | health-pickup → pickup-radius dispatch (iter 744) | ✅ |
| mountArmorShardTick | armor-shard → pickup-radius dispatch (iter 744) | ✅ (no max-cap yet) |
| mountArmorVestTick | armor-vest kind | ❌ |
| mountSpeedOrbTick | speed-orb → pickup-radius dispatch (iter 744) | ⚠ (flag set; consumed by hero-input-move pending) |
| mountCoinDropTick | coin-drop → pickup-radius dispatch (iter 744) | ✅ |
| mountGrenadeCrateTick | grenade-crate kind (iter 718) | ⚠ |
| mountWeaponPickupTick | weapon-pickup kind (iter 711+735) | ⚠ |
| mountMediaPickups | media-pickup kind | ❌ |
| mountLegacyPickupTick | legacy bridge | ❌ |
| mountFirePatchTick | fire-patch hazard | ❌ |
| mountPoisonPuddleTick | poison-puddle hazard (status-zone iter 719) | ⚠ |
| mountSmokeZoneTick | smoke hazard-zone (iter 736) | ✅ |
| mountDropSpawner | drop-spawner facet (random loot tables) | ❌ |
| mountStaticSupply | static-supply spawner | ❌ |
| mountSpeedOrbSpawner | speed-orb spawner | ❌ |
| mountPickupMeshes | mesh-spec on pickup tunings | ✅ |

## 6. Vehicles

| game.html system | substrate equiv | status |
|---|---|---|
| mountVehiclePhysicsTick | vehicle-drive facet (input + physics) | ❌ |
| mountVehicleRenderTick | mesh tick (substrate generic) | ✅ |
| mountVehicleMeshFactory / mountVehicleMeshes | mesh-spec on vehicle-car (iter 727) | ✅ |
| enter/exit vehicle | enter-vehicle facet | ❌ |
| drone / mech / sidecar variants | variant tunings | ❌ |

## 7. NPCs / Dialog / Quests / Shop

| game.html system | substrate equiv | status |
|---|---|---|
| mountNpcMoveTick | npc-wander facet | ❌ |
| mountNpcDialog | npc-dialog UI Thinga | ❌ |
| mountNpcMeshFactory | mesh-spec on npc-default (iter 728) | ✅ |
| mountQuestPanel | quest UI Thinga | ❌ |
| mountStarterQuests | initial quest spawns | ❌ |
| mountShopPanel | shop UI Thinga | ❌ |
| mountSettingsPanel | settings UI Thinga | ❌ |
| mountConfigEditor | config-editor UI | ❌ |
| mountSceneHierarchy | scene-tree dev panel | ❌ |
| mountFirstLaunch | first-launch flow | ❌ |
| mountDifficultySelect | difficulty-picker UI | ❌ |
| mountSaveWiring | save/load state Thinga | ❌ |
| mountGameReset | game-reset action | ❌ |
| mountVictoryPlayAgain | victory state | ❌ |
| mountDevConsoleGame | dev-console UI | ❌ |

## 8. World / Environment / Scene

| game.html system | substrate equiv | status |
|---|---|---|
| mountScene | boot.js scene init | ✅ |
| mountEnvironment | world-params (iter 716) | ✅ partial |
| mountLighting | world_params.js lights | ✅ |
| mountSkybox | sky-shader Thinga (currently just bg color) | ❌ |
| mountSkyDayNightTick | day-night-cycle facet | ❌ |
| mountWorldLayout | world layout — buildings, terrain | ❌ |
| mountPlatformSystem | platform Thingas (jump pads / elevators) | ❌ |
| mountBarrelSystem | barrel kind (iter 706) | ⚠ (mesh only — explode missing) |
| mountCrateSystem | crate kind (iter 717) | ⚠ |
| mountHazardZones | hazard-zone kind (iter 719+736) | ✅ |
| mountVfxInit / mountDecalSystem / particles | particle Thingas (smoke iter 736) | ⚠ |
| mountFlashlight | flashlight facet on hero | ❌ |
| mountSpawnSystem | spawn-point Thingas | ❌ |
| mountLayerTransitionTick | **5D u/v transition** — phase shifts between layers | 🔧 (needs 5D-truth from iter 740+) |
| mountWaveEvents | wave-spawner Thinga | ❌ |
| Buildings / blockers / collision walls | building/wall Thingas + collision facet | 🔧 |
| GTAPhysics.resolveAABBMove | aabb-collision substrate primitive | 🔧 |

## 9. Status effects / Perks / Levels

| game.html system | substrate equiv | status |
|---|---|---|
| mountBurnTick | burn status-effect | ❌ |
| StatusEffects.apply (poison/fire/blind/EMP) | status-effect Thingas | ❌ |
| mountPerkSystem | perk Thingas + perk-picker UI | ❌ |
| mountKillTracking | kill-tracker facet on hero | ❌ |
| mountLevelSystem | hero-level facet | ❌ |
| mountWaveEvents | wave-spawner Thinga + wave-state | ❌ |

## 10. In-world Computer / Screens / Apps (the 7D bridge convergence)

| game.html system | substrate equiv | status |
|---|---|---|
| mountComputerMesh | computer Thinga | ⚠ (screen kind iter 729 is partial) |
| mountComputerUI | desktop UI as Thinga graph | ❌ |
| mountScreenInteraction | screen-click handler | ❌ |
| mountWorldScreens | world-screen Thingas | ⚠ |
| mountScreenMeshTick | screen-mesh updates | ❌ |
| mountDeviceBusTick | device-bus communication | ❌ |
| mountDeviceGraphWiring | device-graph wiring | ❌ |
| mountWorldBuilderControls / mountWorldBuilderHotbar / mountBuilderUiRefresh | build-mode Thinga + hotbar | ❌ |

**This whole section is the convergence point from SECOND_ABSTRACTION_PHASE.md
§5 — the in-world computer becomes a real terminal into the 7D operational
graph. When this lands, screens stop being props.**

## 11. Audio / SFX / Ambient

| game.html system | substrate equiv | status |
|---|---|---|
| mountFootstepSound / mountEnemyFootstepTick | footstep-sfx facets | ❌ |
| mountCombatAmbientTick | combat-ambient facet | ❌ |
| mountComboAnnouncer | combo-announcer | ❌ |
| Sfx module (playSfx) | sfx-bus primitive | 🔧 |
| Ambient (setAmbient) | ambient-bus primitive | 🔧 |

## 12. Multiplayer / Network

| game.html system | substrate equiv | status |
|---|---|---|
| mountAppMultiplayerWiring | LAN-session Thinga + WebSocket transport | ❌ |
| mountDuelMode | duel-mode game-mode | ❌ |
| mountMpBadge | multiplayer-badge HUD | ❌ |
| createLanSession | session-host facet | ❌ |
| EventBus | substrate has no event bus (mutate+reach only) | 🔧 (actor lift solves this) |

## 13. Engine bootstrap

| game.html system | substrate equiv | status |
|---|---|---|
| mountRenderer | boot.js renderer setup | ✅ |
| mountPostProcessing | postfx Thinga | ❌ |
| mountLoaders | asset-loader Thinga | ❌ |
| mountAssetBootstrap | async-asset-swap facet | ❌ |
| mountTestBridge | test-harness wiring | n/a |
| mountLoadCheckOverlay | loading-overlay UI | ❌ |
| mountRuntimeErrorReporter | error-reporter | ❌ |
| mountEngineRegistry | already have ThingRegistry | ✅ |
| mountEcsBootstrap | substrate's facet handlers cover it | ✅ |
| mountHeartbeat | substrate's frame loop covers it | ✅ |
| mountFpsTick | fps-counter | ❌ |
| mountEntityHooks | substrate's facet handlers cover it | ✅ |
| mountTriggerZoneInit | trigger-zone Thingas | ❌ |
| mountNavAndAchievements | nav + achievement Thingas | ❌ |
| mountParticleAndTerrain | particle/terrain Thingas | ❌ |
| mountOptionalSystemsTick | feature-flag wiring | ❌ |

---

## Summary count

  - DONE   ✅: ~15 systems
  - PARTIAL ⚠: ~15 systems
  - MISSING ❌: ~95 systems
  - PRIMITIVE 🔧 needed first: ~8 (collision, sfx-bus, event-bus, 5D u/v
    layer transition, ambient-bus, postfx, asset-loader, action-proposal)

**Total game.html surface area: ~135 mount* subsystems.**

## What this changes about the loop

The migration is sequenced now. The user pivot ("the game isnt actually
playable") means the *playability* slice is top priority, not the side
queue's pure-architecture items. Suggested order:

1. **Core combat loop close** (iters 741–745):
   - hero-shoot ✅ iter 741
   - bullet-kills-enemy (kinetic-hit despawns when hp ≤ 0)
   - drop-on-death (loot from enemy tunings)
   - hero hp-regen + death-screen + respawn
   - HUD (HP bar + ammo readout)

2. **Pickup activation** (iters 746–750):
   - Wire pickup-radius → consume health/ammo/armor pickup
   - Drop-spawner facet (random loot tables)

3. **Collision primitive** (iters 751–753):
   - aabb-collision substrate primitive
   - Apply to barrels/crates/walls so hero can't walk through

4. **Enemy ranged AI** (iters 754–758):
   - enemy-shoot facet (spawn enemy-bullet)
   - Variant-specific specials (boss slam, sniper aim, poisoner spit,
     robot EMP, incendiary fire, fast charge)

5. **Vehicle drive** (iters 759–761):
   - enter-vehicle facet
   - vehicle-drive facet

6. **NPC + dialog** (iters 762–764):
   - npc-wander facet
   - dialog UI Thinga

7. **HUD overhaul** (iters 765–770):
   - hud Thinga + DOM-render facets
   - crosshair, hp, ammo, wave, debug

8. **Wave system + perks + levels** (iters 771–775):
   - wave-spawner Thinga
   - perk-picker UI
   - hero-level facet

9. **In-world computer + 5D layer transition** (iters 776–785):
   - This is where the 5D-truth + 7D-truth convergence lands

10. **Multiplayer** (much later, after actor lift)

The actor lift will likely fire during the HUD or enemy-shoot phase
(third spawn-envelope handler). Current strike count: 2/3 (particle-
emitter iter 736 + hero-shoot iter 741).

— end —
