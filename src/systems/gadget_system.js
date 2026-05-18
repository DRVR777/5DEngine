// Turret, mine, and grenade gadget systems
// mountGadgetSystem(deps) → { deploySmokeZone, placeTurret, tickTurrets,
//   dropMine, tickMines, throwSmokeGrenade, throwFlashbang, throwGrenade, explodeGrenade }

export function mountGadgetSystem({
  THREE,
  scene,
  world,
  enemies,
  bullets3D,
  grenades3D,
  smokeZones,
  HERO_MAX_ARMOR,
  ARMOR_ABSORB,
  coinByType,
  weaponDropMap,
  get,
  set,
  actions,
}) {
  // Grenade geometries/materials
  const _grenadesGeo  = new THREE.SphereGeometry(0.15, 8, 6);
  const _grenadesMat  = new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0xcc3300, emissiveIntensity: 0.9 });
  const _smokeGrenGeo = new THREE.SphereGeometry(0.14, 8, 6);
  const _smokeGrenMat = new THREE.MeshStandardMaterial({ color: 0x667755, emissive: 0x223311, emissiveIntensity: 0.5 });
  const _flashGrenGeo = new THREE.SphereGeometry(0.13, 8, 6);
  const _flashGrenMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffcc, emissiveIntensity: 1.2 });

  // Deployable turret system — P key places turret for 20 coins (max 2 at a time)
  const _turrets = [];
  const _TURRET_COST      = 20;
  const _TURRET_HP        = 60;
  const _TURRET_AMMO      = 40;
  const _TURRET_RANGE     = 10;
  const _TURRET_FIRE_RATE = 1.8; // shots/second
  const _turretBodyMat   = new THREE.MeshStandardMaterial({ color: 0x334455, metalness: 0.8, roughness: 0.35 });
  const _turretBarrelMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.2 });

  function _makeTurretGroup(u, v) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.6, 0.42), _turretBodyMat);
    body.position.y = 0.3; g.add(body);
    const head = new THREE.Group(); head.position.y = 0.75; g.add(head);
    head.add(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.28, 0.36), _turretBodyMat));
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8), _turretBarrelMat);
    barrel.rotation.x = Math.PI / 2; barrel.position.z = 0.38; barrel.position.y = 0;
    head.add(barrel);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), new THREE.MeshBasicMaterial({ color: 0x00ff44 }));
    led.position.set(0, 0.18, 0.2); head.add(led);
    g.position.set(u, 0, v); scene.add(g);
    return { group: g, head, led };
  }

  function placeTurret() {
    const s = { heroDead: get.heroDead(), buildMode: get.buildMode(), inCar: get.inCar(), shopIsOpen: get.shopIsOpen(), score: get.score() };
    if (s.heroDead || s.buildMode || s.inCar || s.shopIsOpen) return;
    const active = _turrets.filter(t => !t.dead).length;
    if (active >= 2) { actions.showToast("Max 2 turrets already deployed!", "danger", 1400); return; }
    if (s.score < _TURRET_COST) { actions.showToast(`Need ${_TURRET_COST} coins to deploy turret!`, "danger", 1400); return; }
    set.score(s.score - _TURRET_COST);
    const hm = world.players.get("hero");
    const { group, head, led } = _makeTurretGroup(hm.u, hm.v);
    _turrets.push({ u: hm.u, v: hm.v, group, head, led, hp: _TURRET_HP, maxHp: _TURRET_HP, ammo: _TURRET_AMMO, fireT: 0, dead: false, heading: 0 });
    actions.showToast(`Turret deployed! (-${_TURRET_COST} coins) ${2 - active - 1} slot${2 - active - 1 !== 1 ? "s" : ""} left`, "success", 2200);
    actions.addKillFeedEntry("⚙ TURRET DEPLOYED", "#4499ff");
    actions.playSfx("tone:400:80:square", 0.4); actions.playSfx("tone:600:40:square", 0.3);
  }

  function tickTurrets(dt) {
    const bulletGeo = get.bulletGeo();
    const bulletMat = get.bulletMat();
    for (let _ti = _turrets.length - 1; _ti >= 0; _ti--) {
      const t = _turrets[_ti];
      if (t.dead) { _turrets.splice(_ti, 1); continue; }
      let nearEp = null, nearDist = _TURRET_RANGE, nearEn = null;
      for (const en of enemies) {
        if (en.dead) continue;
        const ep = world.players.get(en.id);
        if (!ep) continue;
        const d = Math.hypot(ep.u - t.u, ep.v - t.v);
        if (d < nearDist) { nearDist = d; nearEp = ep; nearEn = en; }
      }
      if (nearEp) {
        const dx = nearEp.u - t.u, dz = nearEp.v - t.v;
        t.heading = Math.atan2(dx, dz);
        t.fireT -= dt;
        if (t.fireT <= 0 && t.ammo > 0) {
          t.fireT = 1 / _TURRET_FIRE_RATE;
          t.ammo--;
          const dirU = Math.sin(t.heading), dirV = Math.cos(t.heading);
          const bMesh = new THREE.Mesh(bulletGeo, bulletMat);
          bMesh.position.set(t.u + dirU * 0.5, 0.85, t.v + dirV * 0.5);
          scene.add(bMesh);
          bullets3D.push({ mesh: bMesh, posU: t.u + dirU * 0.5, posV: t.v + dirV * 0.5, posY: 0.85, dirU, dirY: 0, dirV, speed: 90, traveled: 0, range: _TURRET_RANGE * 1.4, damage: 20, falloff: 0, weaponId: "turret" });
          actions.playSfx("tone:700:18:square", 0.12);
          actions.spawnParticles(t.u + dirU * 0.55, 0.85, t.v + dirV * 0.55, 2, "yellow", 6, 0.08);
        }
        const _adjDist = nearDist - (nearEn ? (nearEn.attackRange || 1.6) : 1.6);
        if (_adjDist < 0) {
          t.hp -= (nearEn ? (nearEn.damage || 6) : 6) * dt * 0.8;
          if (t.hp <= 0) {
            t.dead = true;
            actions.spawnParticles(t.u, 0.5, t.v, 20, "orange", 8, 0.6);
            actions.spawnParticles(t.u, 1.0, t.v, 10, "white", 5, 0.4);
            scene.remove(t.group);
            actions.playSfx("tone:80:200:sawtooth", 0.6); actions.playSfx("tone:180:120:square", 0.4);
            actions.showToast("Turret destroyed!", "danger", 1800);
            actions.addKillFeedEntry("⚙ TURRET DESTROYED", "#ff4444");
            continue;
          }
        }
      } else {
        t.heading += dt * 0.9;
        if (t.ammo <= 0) {
          t.dead = true; scene.remove(t.group);
          actions.showToast("Turret out of ammo — removed", "danger", 1400);
          actions.addKillFeedEntry("⚙ TURRET AMMO EMPTY", "#888888");
          continue;
        }
      }
      t.head.rotation.y = t.heading;
      const ledColor = t.hp < _TURRET_HP * 0.4 ? 0xff4444 : t.ammo < 10 ? 0xff8800 : 0x00ff44;
      if (t.led && t.led.material) t.led.material.color.setHex(ledColor);
    }
  }

  // Trap mine system — M key drops proximity mine (1.2m trigger, 90 dmg, 3m radius)
  const _mines = [];
  const _mineGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.08, 12);
  const _mineMat = new THREE.MeshStandardMaterial({ color: 0x333344, roughness: 0.8 });

  function dropMine() {
    if (get.mineCount() <= 0) { actions.showToast("No mines!", "danger", 800); return; }
    if (get.buildMode() || get.computerOpen() || get.heroDead()) return;
    set.mineCount(get.mineCount() - 1);
    const hp = world.players.get("hero");
    const disc = new THREE.Mesh(_mineGeo, _mineMat.clone());
    disc.position.set(hp.u, 0.04, hp.v);
    const ledGeo = new THREE.SphereGeometry(0.04, 6, 4);
    const ledMat = new THREE.MeshBasicMaterial({ color: 0xff2200 });
    const led = new THREE.Mesh(ledGeo, ledMat);
    led.position.set(0, 0.06, 0);
    disc.add(led);
    scene.add(disc);
    _mines.push({ mesh: disc, led, u: hp.u, v: hp.v, armed: false, armT: 1.2 });
    actions.playSfx("tone:1200:40:square", 0.22);
  }

  function tickMines(dt) {
    const _heroNow = world.players.get("hero");
    for (let _mi = _mines.length - 1; _mi >= 0; _mi--) {
      const mn = _mines[_mi];
      if (!mn.armed) { mn.armT -= dt; if (mn.armT <= 0) mn.armed = true; }
      if (mn.armed) {
        mn.led.material.color.setHex((Math.floor(performance.now() / 200) % 2 === 0) ? 0xff2200 : 0x220000);
        for (const en of enemies) {
          if (en.dead) continue;
          const ep = world.players.get(en.id);
          if (!ep) continue;
          if (Math.hypot(ep.u - mn.u, ep.v - mn.v) < 1.2) {
            scene.remove(mn.mesh);
            _mines.splice(_mi, 1);
            actions.playSfx("tone:80:300:sawtooth", 0.9); actions.playSfx("tone:220:200:sawtooth", 0.7);
            actions.spawnParticles(mn.u, 0.3, mn.v, 60, "orange", 10, 1.0);
            actions.spawnParticles(mn.u, 0.8, mn.v, 30, "white",  8,  0.7);
            actions.applyScreenShake(Math.hypot(_heroNow.u - mn.u, _heroNow.v - mn.v) < 4 ? 0.5 : 0.2);
            const _mBlast = 3.0;
            let enemyKills = get.enemyKills();
            let comboCount = get.comboCount();
            let comboLastT = get.comboLastT();
            for (const en2 of enemies) {
              if (en2.dead) continue;
              const ep2 = world.players.get(en2.id);
              if (!ep2) continue;
              const _md = Math.hypot(ep2.u - mn.u, ep2.v - mn.v);
              if (_md < _mBlast) {
                const _mDmg = Math.round(90 * (1 - _md / _mBlast));
                en2.hp = Math.max(0, en2.hp - _mDmg);
                en2._hitFlashT = 0.08;
                actions.spawnDamageNumber(ep2.u, 1.0, ep2.v, `${_mDmg}`, "#ffaa00");
                if (en2.hp <= 0) {
                  en2.dead = true; en2.respawnT = performance.now() / 1000;
                  enemyKills++; comboCount++; comboLastT = performance.now() / 1000;
                  actions.addKillFeedEntry(`⊠ MINE KILL #${enemyKills} — ${en2.type}`, "#ffaa00");
                  actions.trackKillAndPanic(ep2.u, ep2.v);
                  actions.spawnCoinDrop(ep2.u, ep2.v, (coinByType[en2.type] || 1) * Math.min(8, comboCount));
                  actions.spawnAmmoPickup(ep2.u, ep2.v, en2.dropQty || 12, en2.dropAmmo);
                  if (en2.type === "incendiary") actions.spawnFirePatch(ep2.u, ep2.v);
                  if (weaponDropMap[en2.type]) actions.spawnWeaponPickup(ep2.u + 0.5, ep2.v + 0.5, weaponDropMap[en2.type]);
                  if (en2._elite) {
                    set.score(get.score() + 15);
                    set.heroArmor(Math.min(HERO_MAX_ARMOR, get.heroArmor() + 20));
                  }
                  const heroLevel = get.heroLevel();
                  const levelThresholds = get.levelThresholds();
                  if (heroLevel < 5 && enemyKills >= levelThresholds[heroLevel]) actions.applyLevelUpBuff(heroLevel + 1);
                }
              }
            }
            set.enemyKills(enemyKills);
            set.comboCount(comboCount);
            set.comboLastT(comboLastT);
            break;
          }
        }
      }
    }
  }

  function throwSmokeGrenade() {
    if (get.smokeGrenadeCount() <= 0) { actions.showToast("No smoke grenades!", "danger", 800); return; }
    if (get.buildMode() || get.computerOpen()) return;
    set.smokeGrenadeCount(get.smokeGrenadeCount() - 1);
    const hp = world.players.get("hero");
    const fx = Math.sin(get.camYaw()), fz = Math.cos(get.camYaw());
    const mesh = new THREE.Mesh(_smokeGrenGeo, _smokeGrenMat.clone());
    mesh.position.set(hp.u + fx * 0.5, hp.y + 1.2, hp.v + fz * 0.5);
    scene.add(mesh);
    grenades3D.push({ mesh, fuse: 8.0, u: hp.u + fx * 0.5, y: hp.y + 1.2, v: hp.v + fz * 0.5,
      velU: fx * 10, velY: 5, velV: fz * 10, _isSmoke: true });
    actions.playSfx("tone:500:40:square", 0.22);
  }

  function throwFlashbang() {
    if (get.flashbangCount() <= 0) { actions.showToast("No flashbangs!", "danger", 800); return; }
    if (get.buildMode() || get.computerOpen() || get.heroDead()) return;
    set.flashbangCount(get.flashbangCount() - 1);
    const hp = world.players.get("hero");
    const fx = Math.sin(get.camYaw()), fz = Math.cos(get.camYaw());
    const mesh = new THREE.Mesh(_flashGrenGeo, _flashGrenMat.clone());
    mesh.position.set(hp.u + fx * 0.5, hp.y + 1.2, hp.v + fz * 0.5);
    scene.add(mesh);
    grenades3D.push({ mesh, fuse: 1.8, u: hp.u + fx * 0.5, y: hp.y + 1.2, v: hp.v + fz * 0.5,
      velU: fx * 11, velY: 5.5, velV: fz * 11, _isFlash: true });
    actions.playSfx("tone:1800:30:sine", 0.18);
  }

  function throwGrenade(cookedFuse) {
    if (get.grenadeCount() <= 0) { actions.showToast("No grenades!", "danger", 800); return; }
    if (get.buildMode() || get.computerOpen()) return;
    set.grenadeCount(get.grenadeCount() - 1);
    const hp = world.players.get("hero");
    const fx = Math.sin(get.camYaw()), fz = Math.cos(get.camYaw());
    const mesh = new THREE.Mesh(_grenadesGeo, _grenadesMat.clone());
    mesh.position.set(hp.u + fx * 0.5, hp.y + 1.2, hp.v + fz * 0.5);
    scene.add(mesh);
    const fuse = (cookedFuse != null) ? Math.max(0.15, cookedFuse) : 2.5;
    grenades3D.push({ mesh, fuse, u: hp.u + fx * 0.5, y: hp.y + 1.2, v: hp.v + fz * 0.5,
      velU: fx * 13, velY: 6, velV: fz * 13 });
    actions.playSfx("tone:600:60:square", 0.3);
  }


  function deploySmokeZone(u, v) {
    smokeZones.push({ u, v, radius: 3.5, timeLeft: 6.0 });
    for (let _si = 0; _si < 18; _si++) actions.spawnParticles(u, 0.4, v, 2, "white", 2.8, 1.8);
    actions.playSfx("tone:280:300:sine", 0.35);
  }

  function explodeGrenade(g) {
    scene.remove(g.mesh);
    if (g._isAcidSpit) {
      actions.spawnPoisonPuddle(g.u, g.v);
      actions.spawnParticles(g.u, 0.3, g.v, 20, "green", 5, 0.6);
      actions.playSfx("tone:300:120:sine", 0.35);
      const _hAs = world.players.get("hero");
      const _hAsD = Math.hypot(_hAs.u - g.u, _hAs.v - g.v);
      const dodgeT = get.dodgeT();
      if (_hAsD < 1.5 && !get.heroDead() && dodgeT <= 0 && !(typeof Engine !== "undefined" && Engine.debug.godMode)) {
        let _asDmg = Math.round(8 * (1 - _hAsD / 1.5));
        if (_asDmg > 0) {
          let heroArmor = get.heroArmor();
          if (heroArmor > 0) { const _aa = Math.min(heroArmor, _asDmg * ARMOR_ABSORB); heroArmor = Math.max(0, heroArmor - _aa); _asDmg -= _aa; set.heroArmor(heroArmor); }
          set.heroHp(Math.max(0, get.heroHp() - _asDmg)); set.heroLastDamageT(performance.now() / 1000);
          actions.flashDamage(); if (get.heroHp() <= 0 && !get.heroDead()) actions.heroShowDeathScreen();
          if (typeof StatusEffects !== "undefined") StatusEffects.apply("hero", "poison");
        }
      }
      return;
    }
    if (g._isFireball) {
      actions.spawnFirePatch(g.u, g.v, 2.2, 6.0);
      actions.spawnParticles(g.u, 0.5, g.v, 40, "orange", 12, 0.9);
      actions.spawnParticles(g.u, 1.0, g.v, 20, "white", 8, 0.5);
      actions.playSfx("tone:200:180:sawtooth", 0.6); actions.playSfx("tone:400:100:sawtooth", 0.4);
      actions.applyScreenShake(0.3);
      const _hFb = world.players.get("hero");
      const _hFbD = Math.hypot(_hFb.u - g.u, _hFb.v - g.v);
      if (_hFbD < 2.5 && !get.heroDead() && get.dodgeT() <= 0 && !(typeof Engine !== "undefined" && Engine.debug.godMode)) {
        let _fbDmg = Math.round(18 * (1 - _hFbD / 2.5));
        if (_fbDmg > 0) {
          let heroArmor = get.heroArmor();
          if (heroArmor > 0) { const _fa = Math.min(heroArmor, _fbDmg * ARMOR_ABSORB); heroArmor = Math.max(0, heroArmor - _fa); _fbDmg -= _fa; set.heroArmor(heroArmor); }
          set.heroHp(Math.max(0, get.heroHp() - _fbDmg)); set.heroLastDamageT(performance.now() / 1000);
          actions.flashDamage(); if (get.heroHp() <= 0 && !get.heroDead()) actions.heroShowDeathScreen();
          actions.showToast(`FIRE BOMB! -${_fbDmg} HP`, "danger", 1000);
        }
      }
      return;
    }
    if (g._isFlash) {
      actions.spawnParticles(g.u, Math.max(g.y, 0.5), g.v, 40, "white", 20, 0.5);
      actions.playSfx("tone:4000:120:sine", 0.7); actions.playSfx("tone:2000:180:sine", 0.5);
      const FLASH_R = 6;
      for (const en of enemies) {
        if (en.dead) continue;
        const ep = world.players.get(en.id);
        const d = Math.hypot(ep.u - g.u, ep.v - g.v);
        if (d < FLASH_R) en._blindT = 2.5 * (1 - d / FLASH_R) + 0.5;
      }
      const hr = world.players.get("hero");
      const hd = Math.hypot(hr.u - g.u, hr.v - g.v);
      if (hd < FLASH_R) {
        set.heroBlindT(2.0 * (1 - hd / FLASH_R) + 0.3);
        actions.showToast("FLASHBANG!", "warning", 1200);
      }
      return;
    }
    if (g._isBossRock) {
      actions.spawnParticles(g.u, 0.2, g.v, 60, "orange", 12, 1.5);
      actions.spawnParticles(g.u, 0.5, g.v, 30, "white", 8, 1.2);
      actions.playSfx("tone:60:300:sawtooth", 0.8);
      const hr = world.players.get("hero");
      const hd = Math.hypot(hr.u - g.u, hr.v - g.v);
      if (hd < 3.5) {
        actions.applyScreenShake(0.5 * (1 - hd / 3.5));
        if (get.dodgeT() <= 0 && !get.heroDead() && !(typeof Engine !== "undefined" && Engine.debug.godMode)) {
          const impDmg = Math.round(45 * (1 - hd / 3.5));
          if (impDmg > 0) {
            let d = impDmg;
            let heroArmor = get.heroArmor();
            if (heroArmor > 0) { const a = Math.min(heroArmor, d * ARMOR_ABSORB); heroArmor -= a; d -= a; set.heroArmor(heroArmor); }
            set.heroHp(Math.max(0, get.heroHp() - d)); set.heroLastDamageT(performance.now() / 1000);
            actions.flashDamage(); if (get.heroHp() <= 0 && !get.heroDead()) actions.heroShowDeathScreen();
          }
        }
      }
      return;
    }
    // Standard grenade explosion
    actions.spawnParticles(g.u, Math.max(g.y, 0.5), g.v, 200, "orange", 28, 3.2);
    actions.spawnParticles(g.u, Math.max(g.y, 0.5), g.v, 80,  "white",  20, 4.5);
    actions.spawnParticles(g.u, Math.max(g.y, 0.5), g.v, 60,  "red",    22, 2.0);
    if (typeof ParticleSystem !== "undefined") ParticleSystem.emit("sparks", { x: g.u, y: g.y, z: g.v });
    actions.playSfx("tone:80:400:sawtooth", 1.0);
    actions.playSfx("tone:180:220:sawtooth", 0.7);
    const RADIUS = 14, MAX_DMG = 80;
    let enemyKills = get.enemyKills();
    let comboCount = get.comboCount();
    let comboLastT = get.comboLastT();
    for (const en of enemies) {
      if (en.dead) continue;
      const ep = world.players.get(en.id);
      const d = Math.hypot(ep.u - g.u, ep.v - g.v);
      if (d < RADIUS) {
        const dmg = Math.round(MAX_DMG * (1 - d / RADIUS));
        en.hp = Math.max(0, en.hp - dmg); en._hpBarShowT = performance.now() / 1000;
        const _bkbLen = d || 1;
        const _bkbStr = Math.max(0, 14 * (1 - d / RADIUS));
        en._kbU = ((ep.u - g.u) / _bkbLen) * _bkbStr;
        en._kbV = ((ep.v - g.v) / _bkbLen) * _bkbStr;
        en._kbT = 0.28;
        if (d < 5) en._staggerT = 1.5;
        if (en.hp <= 0 && !en.dead) {
          en.dead = true; en.respawnT = performance.now() / 1000; enemyKills++;
          comboCount++; comboLastT = performance.now() / 1000;
          actions.spawnDecal(ep.u, ep.v, en.type === "robot" ? "oil" : "blood");
          if (en.type === "incendiary") actions.spawnFirePatch(ep.u, ep.v);
          if (en.type === "poisoner") actions.spawnPoisonPuddle(ep.u, ep.v);
          actions.addKillFeedEntry(`★ GRENADE KILL #${enemyKills} — ${en.type}`, "#ff8800");
          actions.trackKillAndPanic(ep.u, ep.v);
          const _gCoinMul = Math.min(8, comboCount);
          actions.spawnCoinDrop(ep.u, ep.v, (coinByType[en.type] || 1) * _gCoinMul);
          actions.spawnAmmoPickup(ep.u, ep.v, en.dropQty || 12, en.dropAmmo);
          if ((en.dropHealth || 0) > 0) actions.spawnHealthPickup(ep.u, ep.v, en.dropHealth);
          if (weaponDropMap[en.type]) actions.spawnWeaponPickup(ep.u + 0.5, ep.v + 0.5, weaponDropMap[en.type]);
        }
      }
    }
    set.enemyKills(enemyKills);
    set.comboCount(comboCount);
    set.comboLastT(comboLastT);
    const h2 = world.players.get("hero");
    const hd = Math.hypot(h2.u - g.u, h2.v - g.v);
    if (hd < RADIUS) {
      actions.applyScreenShake(0.7 * Math.max(0, 1 - hd / RADIUS));
      if (!(typeof Engine !== "undefined" && Engine.debug.godMode)) {
        const sd = Math.round(40 * (1 - hd / RADIUS));
        if (sd > 0) {
          set.heroHp(Math.max(0, get.heroHp() - sd)); set.heroLastDamageT(performance.now() / 1000);
          actions.flashDamage(); if (get.heroHp() <= 0 && !get.heroDead()) actions.heroShowDeathScreen();
        }
      }
      if (get.dodgeT() <= 0 && hd > 0.1) {
        const _hkbStr = 16 * (1 - hd / RADIUS);
        set.heroKbU(((h2.u - g.u) / hd) * _hkbStr);
        set.heroKbV(((h2.v - g.v) / hd) * _hkbStr);
        set.heroKbT(0.35);
      }
    } else if (hd < RADIUS * 2) {
      actions.applyScreenShake(0.25 * Math.max(0, 1 - hd / (RADIUS * 2)));
    }
  }

  return {
    deploySmokeZone,
    placeTurret,
    tickTurrets,
    dropMine,
    tickMines,
    throwSmokeGrenade,
    throwFlashbang,
    throwGrenade,
    explodeGrenade,
  };
}
