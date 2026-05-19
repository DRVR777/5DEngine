// Shoot system — hero firing + drone firing, extracted from index.html iter 538.
// mountShootSystem(deps) → { tryShoot, tryDroneShoot, getAimAngle }
export function mountShootSystem({
  THREE,
  scene,
  camera,
  world,
  bullets3D,
  heroGroup,
  Inv,
  get,
  set,
  actions,
}) {
  const _droneBulletMat = new THREE.MeshBasicMaterial({ color: 0x00eeff });

  function getAimAngle() {
    const d = new THREE.Vector3();
    camera.getWorldDirection(d);
    const h = Math.sqrt(d.x * d.x + d.z * d.z);
    return h > 0.001 ? Math.atan2(d.x, d.z) : get.camYaw();
  }

  function tryShoot() {
    if (get.shopOpen()) return;
    if (get.reloading()) {
      if (get.pistolAmmo() > 0) {
        set.reloading(false);
        set.reloadMsg("");
        set.reloadMsgUntil(0);
      } else {
        return;
      }
    }
    const wep = get.weapon();
    if (get.pistolCooldown() > 0) return;
    if (get.pistolAmmo() <= 0) {
      const _arInv = Inv.countItem(get.heroInv(), wep.ammoItem || "pistol_9mm");
      if (_arInv > 0) {
        set.reloading(true);
        set.reloadStart(performance.now());
        actions.playSfx("tone:200:120:square", 0.5);
        actions.playSfx("click", 0.5);
        set.reloadMsg("reloading…");
        set.reloadMsgUntil(performance.now() + get.reloadDur());
      } else {
        const _weps = get.weapons() || [];
        const _curId = get.currentWeaponId();
        const _curIdx = _weps.findIndex(w => w.id === _curId);
        for (let _si = 1; _si < _weps.length; _si++) {
          const _ni = ((_curIdx + _si) % _weps.length);
          const _nw = _weps[_ni];
          const _stored = get.weaponAmmoEntry(_nw.id);
          const _nMag = _stored != null ? _stored : _nw.magCap;
          const _nRes = Inv.countItem(get.heroInv(), _nw.ammoItem || "pistol_9mm");
          if (_nMag > 0 || _nRes > 0) {
            set.weaponAmmoEntry(_curId, 0);
            set.currentWeaponId(_nw.id);
            set.pistolAmmo(_nMag);
            if (get.reloading()) { set.reloading(false); set.reloadMsg(""); set.reloadMsgUntil(0); }
            actions.switchGunMesh(_nw.id);
            actions.playSfx("click", 0.5);
            actions.showToast(`Auto-switch → ${_nw.name || _nw.id}`, "warn", 1200);
            actions.showWeaponSelector();
            break;
          }
        }
      }
      return;
    }
    const newAmmo = get.pistolAmmo() - 1;
    set.pistolCooldown(1 / wep.fireRate);
    set.pistolAmmo(newAmmo);
    set.weaponAmmoEntry(get.currentWeaponId(), newAmmo);
    const _wSfx = {
      pistol:  () => { actions.playSfx("tone:1400:45:square", 0.22); },
      rifle:   () => { actions.playSfx("tone:280:55:sawtooth", 0.35); actions.playSfx("tone:900:35:square", 0.18); },
      shotgun: () => { actions.playSfx("tone:120:90:sawtooth", 0.55); actions.playSfx("tone:200:60:sawtooth", 0.35); actions.playSfx("tone:80:70:square", 0.4); },
      smg:     () => { actions.playSfx("tone:1100:35:square", 0.18); },
      sniper:  () => { actions.playSfx("tone:180:120:sawtooth", 0.7); actions.playSfx("tone:2400:30:sine", 0.3); },
    };
    (_wSfx[get.currentWeaponId()] || _wSfx.pistol)();
    const hp = world.players.get("hero");
    if (typeof ParticleSystem !== "undefined") ParticleSystem.emit("muzzle", { x: hp.u, y: hp.y + 1.6, z: hp.v });
    const _aimDir = new THREE.Vector3();
    camera.getWorldDirection(_aimDir);
    const _gunPos   = new THREE.Vector3(hp.u, hp.y + 1.5, hp.v);
    const _wepRange = wep.range || 80;
    // Collect only Mesh objects, excluding hero body and FP gun (camera children) and
    // in-flight bullets, so the raycast doesn't hit them.
    const _bulletSet = new Set(bullets3D.map(b => b.mesh));
    const _aimTargets = [];
    scene.traverse(obj => {
      if (!obj.isMesh) return;
      let _p = obj.parent;
      while (_p) {
        if (_p === heroGroup || _p === camera) return;
        _p = _p.parent;
      }
      if (!_bulletSet.has(obj)) _aimTargets.push(obj);
    });
    const _aimRay = new THREE.Raycaster(camera.position.clone(), _aimDir, 0.1, _wepRange);
    _aimRay.camera = camera;
    const _aimHits = _aimRay.intersectObjects(_aimTargets, false);
    const _aimPt = _aimHits.length > 0
      ? _aimHits[0].point.clone()
      : camera.position.clone().addScaledVector(_aimDir, _wepRange);
    const _baseDir   = _aimPt.clone().sub(_gunPos).normalize();
    const baseAngle  = Math.atan2(_baseDir.x, _baseDir.z);
    const _basePitch = Math.asin(Math.max(-1, Math.min(1, _baseDir.y)));
    const pellets = wep.pellets || 1;
    const spread  = (wep.spread || 0) + get.moveSpread() * 0.12;
    const bulletGeo = get.bulletGeo();
    const bulletMat = get.bulletMat();
    for (let p = 0; p < pellets; p++) {
      const ang = baseAngle + (Math.random() - 0.5) * spread * 2;
      const hcos = Math.cos(_basePitch);
      const dirU = Math.sin(ang) * hcos;
      const dirY = Math.sin(_basePitch);
      const dirV = Math.cos(ang) * hcos;
      const mesh = new THREE.Mesh(bulletGeo, bulletMat);
      const _bDir = new THREE.Vector3(dirU, dirY, dirV).normalize();
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), _bDir);
      const bulletY = hp.y + 1.5;
      mesh.position.set(hp.u, bulletY, hp.v);
      scene.add(mesh);
      const curId = get.currentWeaponId();
      bullets3D.push({ mesh, posU: hp.u, posV: hp.v, posY: bulletY, dirU, dirY, dirV,
        speed: wep.speed, traveled: 0, range: wep.range, damage: wep.damage,
        falloff: wep.falloff || 0, weaponId: curId });
      set.shotsFired(get.shotsFired() + 1);
      set.lastHeroShotT(performance.now() / 1000);
    }
    set.heroShotAlertU(hp.u);
    set.heroShotAlertV(hp.v);
    set.heroShotAlertT(3.0);
    const mfx = hp.u + Math.sin(baseAngle) * 0.5;
    const mfy = hp.y + 1.5;
    const mfz = hp.v + Math.cos(baseAngle) * 0.5;
    actions.spawnParticles(mfx, mfy, mfz, pellets > 1 ? 6 : 3, "yellow", 5, 0.08);
    actions.triggerMuzzleFlash(mfx, mfy, mfz);
    actions.ejectCasing(hp.u, hp.y + 1.4, hp.v, get.camYaw());
    set.addRecoilPitch(pellets > 1 ? 0.035 : 0.015);
    set.gunKickZ(pellets > 1 ? -0.14 : -0.08);
  }

  function tryDroneShoot() {
    if (get.droneCooldown() > 0) return;
    set.droneCooldown(0.22);
    const dp = world.players.get(get.activeVehicleId());
    if (!dp) return;
    const baseAngle = getAimAngle();
    const hcos = Math.cos(get.camPitch());
    for (let i = 0; i < 2; i++) {
      const ang = baseAngle + (i === 0 ? -0.04 : 0.04);
      const dirU = Math.sin(ang) * hcos, dirY = Math.sin(get.camPitch()), dirV = Math.cos(ang) * hcos;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 5), _droneBulletMat);
      m.position.set(dp.u, dp.y + 0.1, dp.v);
      scene.add(m);
      bullets3D.push({ mesh: m, posU: dp.u, posV: dp.v, posY: dp.y + 0.1,
        dirU, dirY, dirV, speed: 38, traveled: 0, range: 55, damage: 20 });
    }
    actions.spawnParticles(dp.u, dp.y + 0.1, dp.v, 4, "cyan", 6, 0.1);
    actions.playSfx("tone:900:40:square", 0.18);
  }

  return { tryShoot, tryDroneShoot, getAimAngle };
}
