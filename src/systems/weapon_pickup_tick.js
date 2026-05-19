const COLLECT_DIST  = 1.2;
const SPIN_SPEED    = 1.8;
const BOB_BASE      = 0.35;
const BOB_AMP       = 0.1;
const BOB_PERIOD    = 350;
const PILLAR_BASE   = 0.25;
const PILLAR_AMP    = 0.15;
const PILLAR_PERIOD = 400;

export function mountWeaponPickupTick({ get, set, actions }) {
  function tick(dt, { pickups, heroU, heroV, nowMs }) {
    for (const wp of pickups) {
      if (wp.collected) continue;
      wp.mesh.rotation.y += dt * SPIN_SPEED;
      wp.mesh.position.y = BOB_BASE + Math.sin(nowMs / BOB_PERIOD + wp.u) * BOB_AMP;
      if (wp.pillar) {
        wp.pillar.material.opacity =
          PILLAR_BASE + PILLAR_AMP * Math.sin(nowMs / PILLAR_PERIOD + wp.u);
      }
      const d = Math.hypot(heroU - wp.u, heroV - wp.v);
      if (d < COLLECT_DIST) {
        wp.collected = true;
        actions.removeMesh(wp.mesh);
        const wDef = actions.findWeaponDef(wp.weaponId);
        if (wDef) {
          actions.setWeaponAmmo(wDef.id, wDef.magCap);
          actions.addReserveAmmo(wDef.ammoItem, wDef.magCap * 2);
        }
        actions.playSfx("tone:900:80:sine", 0.5);
        actions.playSfx("tone:1200:60:sine", 0.3);
        actions.spawnParticles(wp.u, 0.5, wp.v, 14, "white", 5, 0.4);
        const curReserve = wDef ? actions.countReserveAmmo(get.currentWeaponAmmoItem()) : 0;
        const autoEquip = get.currentMag() <= 0 && curReserve <= 0 && !!wDef && wp.weaponId !== get.currentWeaponId();
        if (autoEquip) {
          actions.setWeaponAmmo(get.currentWeaponId(), 0);
          set.currentWeaponId(wDef.id);
          set.currentMag(wDef.magCap);
          actions.clearReload();
          actions.switchGunMesh(wDef.id);
          set.weaponSwitchT(0.3);
          actions.playSfx("click", 0.5);
          actions.showWeaponSelector();
        }
        const label = wDef ? (wDef.name || wp.weaponId).toUpperCase() : wp.weaponId.toUpperCase();
        actions.showToast(`Looted ${label}${autoEquip ? " — AUTO-EQUIPPED!" : " — mag filled!"}`, "success", 2400);
        actions.addKillFeed(`★ WEAPON LOOTED — ${wp.weaponId.toUpperCase()}`, "#aaddff");
      }
    }
  }
  return { tick };
}
