# MULTI_CYCLE_EXTRACTION_PLAN.md

This plan continues after iter 698. The old big-block extraction phase is done.
The next objective is grouped wiring compression: keep every system exactly as
it is, but stop making `index.html` hand-mount every subsystem one by one.

This is still extraction, not final engine architecture.

## Current Baseline

Measured after iter 698:

```txt
index.html total lines:        2498
index.html code lines:         1830
index.html blank lines:        204
index.html comment-only lines: 464
```

Verification baseline:

```txt
npm test:            PASS
npm run browser-check: PASS
```

## Simulation Rule

Every cycle is a complete mini-loop:

1. Read the exact current `index.html` region. Line numbers drift.
2. Identify state read, state mutated, DOM/window globals, callbacks, timers,
   and magic numbers.
3. Create one grouped wiring module.
4. Move only the mount/wiring code, not subsystem behavior.
5. Preserve all constants, timings, strings, formulas, expression order, and
   public handles.
6. Add focused unit tests around the wiring contract.
7. Run focused tests.
8. Run `npm test`.
9. Run `npm run count:index`.
10. Run `npm run browser-check` for boot/runtime-affecting changes.
11. Update `docs/STATE.md` and `docs/JOURNAL.md`.
12. Commit exactly one cycle.
13. Continue to the next cycle unless blocked.

No heavy visual Playwright campaign is part of these cycles unless explicitly
requested. The lightweight no-render browser check remains mandatory for
boot/runtime wiring.

## Stop Conditions

Stop normal extraction and write `docs/HANDOFF_EXTRACTION.md` when:

- `index.html` is mostly imports, declarations, grouped factory calls, tick
  order, and final bootstrap.
- A proposed module only moves one line out while adding more dependency bag
  surface than it removes.
- Remaining reduction requires a real `bootGame()`, Engine service container,
  system registry, or manifest-driven lifecycle.
- A cycle fails browser-check three times after targeted fixes.

## Cycle Queue

### Cycle 699 - Input Wiring Factory

Target:

- `mountKeydownHandler`
- `mountKeyupHandler`
- `mountMouseInput`
- `mountCanvasPrimaryAction`
- mouse held `mousedown` / `mouseup` listeners if safe

Module:

```txt
src/wiring/input_wiring.js
```

Goal:

Create one `mountInputWiring(...)` call that returns any handles needed by
`index.html`, while preserving input behavior and avoiding TDZ reads for
`_tryShoot` / `_tryDroneShoot`.

Important preservation points:

- pointer lock state writes
- build mode hotbar and screen interaction callbacks
- grenade press/release behavior
- reload state writes
- `mouseModeCursor` mutation
- canvas primary action ordering:
  build pick first, screen click second, gameplay shoot last
- deferred shoot callbacks

Expected savings:

```txt
30-80 code lines
```

### Cycle 700 - Lightweight HUD Wiring Factory

Target:

- `mountHeartbeat`
- `mountFpsTick`
- `mountCrosshairTick`
- `mountCombatHudTick`
- `mountClockHudTick`
- `mountVignetteTick`
- `mountStatBarsTick`
- `mountBossBarTick`
- `mountComboHudTick`
- `mountVehicleDashTick`

Module:

```txt
src/wiring/hud_tick_wiring.js
```

Goal:

Return named tick objects in a single object while preserving the names used by
the main tick loop.

Important preservation points:

- FPS history cap remains 60.
- `_hpGhost` getter/setter behavior remains unchanged.
- DayNight optional lookup remains guarded.
- No HUD DOM selector changes.

Expected savings:

```txt
20-50 code lines
```

### Cycle 701 - Visual Motion Wiring Factory

Target:

- `mountCombatAmbientTick`
- `mountSkyDayNightTick`
- `mountFpGunPosTick`
- `mountWalkAnimTick`
- `mountHeroFaceTick`
- `mountCamShakeTick`

Module:

```txt
src/wiring/visual_motion_wiring.js
```

Important preservation points:

- ambient readiness and fade callback
- sky/fog/sun color setters
- first-person gun position/rotation setters
- walk-cycle bridge callback
- thigh/shin/arm rotation expressions
- camera shake mutates camera position exactly as before

Expected savings:

```txt
30-70 code lines
```

### Cycle 702 - Hero Movement Tick Wiring Factory

Target:

- `mountHeroKnockbackTick`
- `mountDodgeTick`
- `mountScopeFovTick`
- `mountFreecamTick`
- `mountHeroMoveTick`
- `mountJumpGravityTick`
- `mountCamPitchSprings`
- `mountFootstepSound`
- `mountMotionSprings`
- `mountSniperSway`
- `mountStaminaTick`

Module:

```txt
src/wiring/hero_motion_tick_wiring.js
```

Important preservation points:

- dodge bash damage formula `Math.round(25 * _heroLvlDmgMul)`
- dodge bash radius `0.9`
- knockback multipliers `5`, `0.18`
- damage number text `BASH!`
- particle counts/colors/speeds/sizes
- fall damage formula `Math.min(90, Math.max(0, (-impact - 15) * 5))`
- stamina constants imported from hero stats remain unchanged
- scope sway variables remain mutable in `index.html`

Expected savings:

```txt
80-160 code lines
```

Risk:

Medium. This cluster contains gameplay-feel constants. Tests must pin the
constants that are moved into callbacks.

### Cycle 703 - Enemy Special Tick Wiring Factory

Target:

- `mountEnemyRegenTick`
- `mountEnemySepTick`
- `mountEnemyRobotEmpTick`
- `mountEnemyHeavyGrenadeTick`
- `mountEnemyBossRockTick`
- `mountEnemyPoisonerSpitTick`
- `mountEnemyIncendiaryTick`
- `mountEnemyBossSlamTick`
- `mountEnemyPoisonerRangedSpitTick`
- `mountEnemyFastChargeTick`
- `mountEnemySniperTick`
- `mountEnemyRobotPlasmaTick`
- `mountEnemyStrafeMeleeTick`
- `mountEnemyAiScaffoldTick`
- `mountNpcMoveTick`

Module:

```txt
src/wiring/enemy_tick_wiring.js
```

Important preservation points:

- all special tick instances still exist before `mountEnemyAiScaffoldTick`
- `hasLOS` callback unchanged
- `BehaviorTree` and `AStar` optional lookups remain guarded
- sniper alert toast duration `800`
- sniper bullet-time value `0.38`
- hero death callbacks remain guarded against duplicate death screen
- fire/poison/status application stays optional

Expected savings:

```txt
120-220 code lines
```

Risk:

High. Run browser-check and at least focused campaign if later requested.

### Cycle 704 - Pickup Tick Wiring Factory

Target:

- `mountHeroRegenTick`
- `mountLayerTransitionTick`
- `mountAmmoPickupTick`
- `mountHealthPickupTick`
- `mountArmorShardTick`
- `mountSpeedOrbTick`
- `mountPoisonPuddleTick`
- `mountSmokeZoneTick`
- `mountGrenadeCrateTick`
- `mountArmorVestTick`
- `mountCoinDropTick`
- `mountWeaponPickupTick`
- `mountLegacyPickupTick`

Module:

```txt
src/wiring/pickup_tick_wiring.js
```

Important preservation points:

- legacy coin collection radius `1.2`
- coin toast duration `1500`
- `SCORE_CHANGED` event source `"coin"`
- fallback ammo item `"pistol_9mm"`
- all remove mesh callbacks still call `scene.remove`
- weapon pickup clears reload state exactly as before

Expected savings:

```txt
90-160 code lines
```

### Cycle 705 - Camera/Proximity/Debug Wiring Factory

Target:

- `mountOptionalSystemsTick`
- `mountCamDistTick`
- `mountCameraZoneTick`
- `mountCamVectors`
- `mountCameraPosTick`
- `mountProximityTick`
- `mountDeviceBusTick`
- `mountScreenMeshTick`
- `mountDebugHudTick`
- `mountEnemyMeshTick`
- `mountVehiclePhysicsTick`
- `mountAmmoReloadTick`
- `mountCrouchSpeedTick`
- `mountWaveHudTick`

Module:

```txt
src/wiring/runtime_tick_wiring.js
```

Important preservation points:

- optional globals remain guarded with `typeof`.
- camera spine fallbacks remain guarded.
- screen mesh raycaster still uses center `{ x: 0, y: 0 }`.
- debug HUD clears `_hudEnemyHpDirty`.
- reload duration and mag-cap callbacks stay dynamic.
- sprint trail particle constants stay unchanged.

Expected savings:

```txt
120-220 code lines
```

### Cycle 706 - Grenade/Projectile Wiring Factory

Target:

- `mountGrenadeArcTick`
- `mountGrenadePhysicsTick`
- `mountGrenadeWarnTick`
- `mountEnemyFootstepTick`
- `mountEnemyBulletTick`
- `mountBulletWorldHitTick`
- `mountBulletEnemyKillTick`
- `mountBulletEnemyHitFeedbackTick`
- `mountBulletPhysicsTick`
- `mountFirePatchTick`

Module:

```txt
src/wiring/combat_projectile_wiring.js
```

Important preservation points:

- grenade smoke trail random threshold `0.55`
- enemy bullet armor/dodge/god-mode behavior
- bullet world hit still gets live `_mp`
- enemy kill still emits `EventBus.EVENTS.ENEMY_KILLED`
- all level, combo, coin, armor, ammo, blood, fire, poison, and particle
  callbacks preserve formulas and strings

Expected savings:

```txt
120-240 code lines
```

Risk:

High. Browser-check mandatory. This is likely the last safe grouped extraction
before final architecture.

### Cycle 707 - Bootstrap/Core Wiring Factory

Target:

- renderer/postprocessing/lighting/environment/hero mesh setup
- config/editor/scene hierarchy setup
- reset/game lifecycle setup

Module:

```txt
src/wiring/bootstrap_wiring.js
```

Important preservation points:

- load order
- `composer` callback
- VFX init aliases
- lighting objects returned to `index.html`
- hero mesh parts returned by exact names

Expected savings:

```txt
80-160 code lines
```

Risk:

Medium-high because early boot order matters.

### Cycle 708 - Handoff Document

Target:

```txt
docs/HANDOFF_EXTRACTION.md
```

Contents:

- final line counts
- modules extracted since iter 690
- remaining `index.html` responsibilities
- why further extraction requires architecture
- proposed next architecture:
  - `src/main.js`
  - `bootGame()`
  - `Engine`
  - service container
  - system registry
  - manifest-driven lifecycle

### Cycle 709+ - Architecture Phase

Only after handoff:

- create `src/main.js`
- reduce `index.html` to static shell plus module script
- create `bootGame()`
- move import explosion out of HTML
- introduce manifest/system registry only after behavior is browser-clean

## Expected End State

After cycles 699-708:

```txt
index.html likely code lines: 900-1200
```

After architecture phase:

```txt
index.html likely code lines: 50-150
```

The first number comes from extraction. The second requires abstraction.

