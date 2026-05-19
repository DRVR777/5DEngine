export async function mountEcsBootstrap({
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
}) {
  try {
    // Hero prefab: load atom, register the $facets.prefab sub-object
    const heroAtom = await Core.loadData("data/prefabs/hero.json");
    Core.registerPrefab("hero", heroAtom.$facets.prefab);

    // Enemy types: load index, then each stat atom → convert to component spec
    const enemyIndex = await Core.loadData("data/enemies/enemy_types.json");
    await Promise.all(enemyIndex.$facets.types.map(async (typeId) => {
      const atom = await Core.loadData(`data/enemies/types/${typeId}.json`);
      const f = atom.$facets;
      Core.registerPrefab(`enemy_${typeId}`, {
        components: {
          Transform: { u: 0, v: 0, y: 0, heading: 0 },
          Velocity:  { u: 0, v: 0, y: 0 },
          Health:    { hp: f.hp, maxHp: f.maxHp, armor: 0 },
          EnemyAI:   Object.assign(
            { type: atom.$id, state: "wander", alertT: -99, lastAttackT: -99,
              damage: f.damage, attackRange: f.attackRange,
              sightRange: f.sightRange, moveSpeed: f.moveSpeed,
              wanderSpeed: f.wanderSpeed },
            f.ability ? { ability: f.ability } : {}
          ),
          Faction:   { id: "enemy" },
          Mesh:      { type: "capsule", radius: f.bodyRadius, height: f.bodyHeight, color: f.color },
        }
      });
    }));

    // Load damage multipliers and wire combat system
    const dmAtom = await Core.loadData("data/enemies/damage_multipliers.json");
    const _ecsCombatCtx = { damageMultipliers: dmAtom.$facets, elapsedS: 0 };
    Core.addSystem((dt, core) => {
      _ecsCombatCtx.elapsedS += dt;
      combatSystem(dt, core, _ecsCombatCtx);
    }, 10, "combat");

    // Wire wave system — mirrors WaveManager but uses Core entities
    const _ecsWave = createWaveSystem();
    Core.addSystem(_ecsWave, 5, "wave");
    Core.on("game:modeSelected", ({ mode }) => {
      if (mode === "solo" || mode === "wave_defense") _ecsWave.start(Core);
    });
    Core.addSystem((dt, core) => pickupSystem(dt, core), 20, "pickup");

    if (!window.Engine) window.Engine = {};
    // Wire shop system — priority 25 (after pickup at 20)
    const shopAtom = await Core.loadData("data/shop/shop_items.json");
    const _ecsShop = createShopSystem(shopAtom.$facets, { HERO_MAX_ARMOR: 75 });
    Core.addSystem(_ecsShop, 25, "shop");

    // Wire perk system — priority 30 (after shop at 25)
    const perkIndex = await Core.loadData("data/perks/perks.json");
    const perkCatalog = {};
    await Promise.all(perkIndex.$facets.types.map(async (perkId) => {
      const atom = await Core.loadData(`data/perks/types/${perkId}.json`);
      perkCatalog[perkId] = atom.$facets;
    }));
    const _ecsPerk = createPerkSystem(perkCatalog, { HERO_MAX_ARMOR: 75 });
    Core.addSystem(_ecsPerk, 30, "perk");

    // Wire weapon system — priority 8 (before combat at 10)
    const _weaponDefs = {};
    for (const w of (CFG?.weapons || [])) { _weaponDefs[w.id] = w; }
    const _ecsWeapon = createWeaponSystem(_weaponDefs);
    Core.addSystem(_ecsWeapon, 8, "weapon");
    window.Engine.weaponSystem = _ecsWeapon;

    // Wire score system — priority 40 (after regen at 35)
    const _ecsScore = createScoreSystem();
    Core.addSystem(_ecsScore, 40, "score");
    window.Engine.scoreSystem = _ecsScore;

    // Wire AI movement system — priority 12 (after weapon:8, before status:15)
    const _ecsAIMovement = createAIMovementSystem();
    Core.addSystem(_ecsAIMovement, 12, "ai_movement");
    window.Engine.aiMovementSystem = _ecsAIMovement;

    // Wire enrage system — priority 13 (after ai_movement:12, before status_effects:15)
    const _ecsEnrage = createEnrageSystem();
    Core.addSystem(_ecsEnrage, 13, "enrage");
    window.Engine.enrageSystem = _ecsEnrage;

    // Wire boss slam system — priority 14 (after enrage:13, before status:15)
    const _ecsBossSlam = createBossSlamSystem();
    Core.addSystem(_ecsBossSlam, 14, "boss_slam");
    window.Engine.bossSlamSystem = _ecsBossSlam;

    // Wire fast charge system — priority 11 (before ai_movement:12; sets _charging flag)
    const _ecsFastCharge = createFastChargeSystem();
    Core.addSystem(_ecsFastCharge, 11, "fast_charge");
    window.Engine.fastChargeSystem = _ecsFastCharge;

    // Wire robot EMP system — priority 15 (after ai_movement:12; emits hero:emped)
    const _ecsRobotEmp = createRobotEmpSystem();
    Core.addSystem(_ecsRobotEmp, 15, "robot_emp");
    window.Engine.robotEmpSystem = _ecsRobotEmp;

    // Wire heavy throw system — priority 13 (after ai_movement:12; emits grenade:throw)
    const _ecsHeavyThrow = createHeavyThrowSystem();
    Core.addSystem(_ecsHeavyThrow, 13, "heavy_throw");
    window.Engine.heavyThrowSystem = _ecsHeavyThrow;

    // Wire boss rock system — priority 14 (after enrage:13; emits grenade:throw)
    const _ecsBossRock = createBossRockSystem();
    Core.addSystem(_ecsBossRock, 14, "boss_rock");
    window.Engine.bossRockSystem = _ecsBossRock;

    // Wire poisoner spit system — priority 13 (after ai_movement:12)
    const _ecsPoisonerSpit = createPoisonerSpitSystem();
    Core.addSystem(_ecsPoisonerSpit, 13, "poisoner_spit");
    window.Engine.poisonerSpitSystem = _ecsPoisonerSpit;

    // Wire incendiary bomb system — priority 13 (after ai_movement:12)
    const _ecsIncendiaryBomb = createIncendiaryBombSystem();
    Core.addSystem(_ecsIncendiaryBomb, 13, "incendiary_bomb");
    window.Engine.incendiaryBombSystem = _ecsIncendiaryBomb;

    // Wire sniper shoot system — priority 13 (after ai_movement:12)
    const _ecsSniperShoot = createSniperShootSystem();
    Core.addSystem(_ecsSniperShoot, 13, "sniper_shoot");
    window.Engine.sniperShootSystem = _ecsSniperShoot;

    // Wire melee attack system — priority 14 (after ai_movement:12)
    const _ecsMeleeAttack = createMeleeAttackSystem();
    Core.addSystem(_ecsMeleeAttack, 14, "melee_attack");
    window.Engine.meleeAttackSystem = _ecsMeleeAttack;

    // Wire morale panic system — priority 15 (after all AI:12-14)
    const _ecsMoralePanic = createMoralePanicSystem();
    Core.addSystem(_ecsMoralePanic, 15, "morale_panic");
    window.Engine.moralePanicSystem = _ecsMoralePanic;

    // Wire stagger movement system — priority 13 (overrides ai_movement for staggered entities)
    const _ecsStaggerMovement = createStaggerMovementSystem();
    Core.addSystem(_ecsStaggerMovement, 13, "stagger_movement");
    window.Engine.staggerMovementSystem = _ecsStaggerMovement;

    // Wire gunshot alert system — priority 13 (approaches shot position while not chasing)
    const _ecsGunshotAlert = createGunshotAlertSystem();
    Core.addSystem(_ecsGunshotAlert, 13, "gunshot_alert");
    window.Engine.gunshotAlertSystem = _ecsGunshotAlert;

    // Wire robot shoot system — priority 13 (plasma bolt ranged attack every 1.5s)
    const _ecsRobotShoot = createRobotShootSystem();
    Core.addSystem(_ecsRobotShoot, 13, "robot_shoot");
    window.Engine.robotShootSystem = _ecsRobotShoot;

    // Wire poisoner dart system — priority 13 (direct venom dart 3.5–10m, 3.0–4.5s CD)
    const _ecsPoisonerDart = createPoisonerDartSystem();
    Core.addSystem(_ecsPoisonerDart, 13, "poisoner_dart");
    window.Engine.poisonerDartSystem = _ecsPoisonerDart;

    // Wire enemy bullet system — priority 11 (moves projectiles, checks hero hit)
    const _ecsEnemyBullet = createEnemyBulletSystem();
    _ecsEnemyBullet.wireListeners(Core);
    Core.addSystem(_ecsEnemyBullet, 11, "enemy_bullet");
    window.Engine.enemyBulletSystem = _ecsEnemyBullet;

    // Wire enemy regen system — priority 8 (4 HP/s out-of-combat regen after 8s)
    const _ecsEnemyRegen = createEnemyRegenSystem();
    Core.addSystem(_ecsEnemyRegen, 8, "enemy_regen");
    window.Engine.enemyRegenSystem = _ecsEnemyRegen;

    // Wire enemy separation system — priority 13 (pairwise overlap push at 1.2m)
    const _ecsEnemySep = createEnemySeparationSystem();
    Core.addSystem(_ecsEnemySep, 13, "enemy_separation");
    window.Engine.enemySeparationSystem = _ecsEnemySep;

    // Wire combo system — priority 6 (kill streak tracking with 3.5s decay)
    const _ecsCombo = createComboSystem();
    _ecsCombo.wireListeners(Core);
    Core.addSystem(_ecsCombo, 6, "combo");
    window.Engine.comboSystem = _ecsCombo;

    // Wire arena clamp system — priority 16 (last safety net; clamps enemies to 27.5m)
    const _ecsArenaClamp = createArenaClampSystem();
    Core.addSystem(_ecsArenaClamp, 16, "arena_clamp");
    window.Engine.arenaClampSystem = _ecsArenaClamp;

    // Wire enemy blind system — priority 12 (same as ai_movement; flash blind before canSee eval)
    const _ecsEnemyBlind = createEnemyBlindSystem();
    _ecsEnemyBlind.wireListeners(Core);
    Core.addSystem(_ecsEnemyBlind, 12, "enemy_blind");
    window.Engine.enemyBlindSystem = _ecsEnemyBlind;

    // Wire smoke zone system — priority 10 (before ai_movement; isSmoked query used in canSee)
    const _ecsSmokeZone = createSmokeZoneSystem();
    _ecsSmokeZone.wireListeners(Core);
    Core.addSystem(_ecsSmokeZone, 10, "smoke_zone");
    window.Engine.smokeZoneSystem = _ecsSmokeZone;

    // Wire mine system — priority 14 (after ai_movement; checks enemy positions)
    const _ecsMine = createMineSystem();
    _ecsMine.wireListeners(Core);
    Core.addSystem(_ecsMine, 14, "mine");
    window.Engine.mineSystem = _ecsMine;

    // Wire turret system — priority 14 (after ai_movement; autonomous fire control)
    const _ecsTurret = createTurretSystem();
    _ecsTurret.wireListeners(Core);
    Core.addSystem(_ecsTurret, 14, "turret");
    window.Engine.turretSystem = _ecsTurret;

    // Wire fire patch system — priority 11 (after bullets; before ai_movement)
    const _ecsFirePatch = createFirePatchSystem();
    _ecsFirePatch.wireListeners(Core);
    Core.addSystem(_ecsFirePatch, 11, "fire_patch");
    window.Engine.firePatchSystem = _ecsFirePatch;

    // Wire poison puddle system — priority 11 (same tier as fire patch)
    const _ecsPoisonPuddle = createPoisonPuddleSystem();
    _ecsPoisonPuddle.wireListeners(Core);
    Core.addSystem(_ecsPoisonPuddle, 11, "poison_puddle");
    window.Engine.poisonPuddleSystem = _ecsPoisonPuddle;

    // Wire coin drop system — priority 6 (after inventory:5, before combat)
    const _ecsCoinDrop = createCoinDropSystem();
    _ecsCoinDrop.wireListeners(Core);
    Core.addSystem(_ecsCoinDrop, 6, "coin_drop");
    window.Engine.coinDropSystem = _ecsCoinDrop;

    // Wire speed orb system — priority 6 (same tier as coin drops)
    const _ecsSpeedOrb = createSpeedOrbSystem();
    _ecsSpeedOrb.wireListeners(Core);
    Core.addSystem(_ecsSpeedOrb, 6, "speed_orb");
    window.Engine.speedOrbSystem = _ecsSpeedOrb;

    // Wire armor shard system — priority 6 (pickup tier; magnet + collect)
    const _ecsArmorShard = createArmorShardSystem();
    _ecsArmorShard.wireListeners(Core);
    Core.addSystem(_ecsArmorShard, 6, "armor_shard");
    window.Engine.armorShardSystem = _ecsArmorShard;

    // Wire health pickup system — priority 6 (pickup tier; 1.2m collect)
    const _ecsHealthPickup = createHealthPickupSystem();
    _ecsHealthPickup.wireListeners(Core);
    Core.addSystem(_ecsHealthPickup, 6, "health_pickup");
    window.Engine.healthPickupSystem = _ecsHealthPickup;

    // Wire ammo pickup system — priority 6 (pickup tier; 1.2m collect 3.0m magnet)
    const _ecsAmmoPickup = createAmmoPickupSystem();
    _ecsAmmoPickup.wireListeners(Core);
    Core.addSystem(_ecsAmmoPickup, 6, "ammo_pickup");
    window.Engine.ammoPickupSystem = _ecsAmmoPickup;

    // Wire weapon pickup system — priority 6 (pickup tier; 1.2m collect, no magnet)
    const _ecsWeaponPickup = createWeaponPickupSystem();
    _ecsWeaponPickup.wireListeners(Core);
    Core.addSystem(_ecsWeaponPickup, 6, "weapon_pickup");
    window.Engine.weaponPickupSystem = _ecsWeaponPickup;

    // Wire grenade crate system — priority 6 (static resupply; 1.3m collect 30s respawn)
    const _ecsGrenadeCrate = createGrenadeCrateSystem();
    _ecsGrenadeCrate.wireListeners(Core);
    Core.addSystem(_ecsGrenadeCrate, 6, "grenade_crate");
    window.Engine.grenadeCrateSystem = _ecsGrenadeCrate;

    // Wire armor vest system — priority 6 (static resupply; 1.3m collect 60s respawn)
    const _ecsArmorVest = createArmorVestSystem();
    _ecsArmorVest.wireListeners(Core);
    Core.addSystem(_ecsArmorVest, 6, "armor_vest");
    window.Engine.armorVestSystem = _ecsArmorVest;

    // Wire inventory system — priority 5 (before everything so ammo is ready)
    const _ecsInventory = createInventorySystem();
    Core.addSystem(_ecsInventory, 5, "inventory");
    window.Engine.inventorySystem = _ecsInventory;
    window.Engine.invAdd    = invAdd;
    window.Engine.invRemove = invRemove;
    window.Engine.invCount  = invCount;
    window.Engine.invHas    = invHas;

    // Wire knockback system — priority 16 (after status:15, before stamina:18)
    const _ecsKnockback = createKnockbackSystem();
    Core.addSystem(_ecsKnockback, 16, "knockback");
    window.Engine.knockbackSystem = _ecsKnockback;

    // Wire stamina system — priority 18 (after weapon:8, ai:12, status:15, before regen:35)
    const _ecsStamina = createStaminaSystem();
    Core.addSystem(_ecsStamina, 18, "stamina");
    window.Engine.staminaSystem = _ecsStamina;

    // Wire player movement system — priority 7 (before weapon:8, combat:10)
    const _ecsPlayerMove = createPlayerMovementSystem();
    Core.addSystem(_ecsPlayerMove, 7, "player_movement");
    window.Engine.playerMovementSystem = _ecsPlayerMove;

    // Wire bullet system — priority 9 (after weapon:8, before combat:10)
    const _ecsBullet = createBulletSystem();
    Core.addSystem(_ecsBullet, 9, "bullet");
    window.Engine.bulletSystem = _ecsBullet;
    window.Engine.spawnBullet  = spawnBullet;

    // Wire loot drop system — priority 11 (after bullet:9/combat:10, before ai:12)
    const _ecsLootDrop = createLootDropSystem(DROP_TABLE);
    Core.addSystem(_ecsLootDrop, 11, "loot_drop");
    window.Engine.lootDropSystem = _ecsLootDrop;

    // Wire grenade system — priority 22 (after stamina:18, before regen:35)
    const _ecsGrenade = createGrenadeSystem();
    Core.addSystem(_ecsGrenade, 22, "grenade");
    window.Engine.grenadeSystem = _ecsGrenade;

    // Wire regen system — priority 35 (after perk at 30)
    Core.addSystem(regenSystem, 35, "regen");

    // Wire status effect system — priority 15 (between combat at 10 and pickup at 20)
    const _ecsStatusFX = createStatusEffectSystem();
    Core.addSystem(_ecsStatusFX, 15, "status_effects");

    // Wire agent dispatch — priority 99 (runs last, after all game logic)
    const _ecsAgentDispatch = createAgentDispatch({
      getSocket: () => (typeof io !== "undefined" ? io({ reconnectionAttempts: 3, timeout: 3000 }) : null),
    });
    Core.addSystem(_ecsAgentDispatch, 99, "agent_dispatch");

    window.Engine.waveSystem     = _ecsWave;
    window.Engine.spawnPickup    = spawnPickup;
    window.Engine.shopSystem     = _ecsShop;
    window.Engine.perkSystem     = _ecsPerk;
    window.Engine.agentDispatch  = _ecsAgentDispatch;

    console.info("[ECS] Core ready —", Core.snapshot());
  } catch (e) {
    console.warn("[ECS] Core boot failed (non-fatal):", e.message);
  }
}
