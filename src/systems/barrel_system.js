// Explosive barrel system — extracted from index.html iter 540.
// mountBarrelSystem(deps) → { makeBarrel, explodeBarrel, barrels }
export function mountBarrelSystem({
  THREE,
  scene,
  enemies,
  world,
  coinByType,
  weaponDropMap,
  get,
  set,
  actions,
}) {
  function makeBarrel(u, v) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.85, 10),
      new THREE.MeshStandardMaterial({ color: 0xcc2200, metalness: 0.6, roughness: 0.5 })
    );
    body.position.y = 0.425; body.castShadow = true; g.add(body);
    const stripe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.285, 0.285, 0.12, 10),
      new THREE.MeshStandardMaterial({ color: 0xffcc00, emissive: 0x552200, emissiveIntensity: 0.6 })
    );
    stripe.position.y = 0.52; g.add(stripe);
    g.position.set(u, 0, v);
    scene.add(g);
    return { u, v, hp: 40, maxHp: 40, mesh: g, exploded: false };
  }

  function explodeBarrel(u, v) {
    actions.spawnParticles(u, 0.5, v, 80, "orange", 18, 2.2);
    actions.spawnParticles(u, 0.8, v, 40, "red",    12, 2.8);
    actions.spawnParticles(u, 1.2, v, 30, "yellow", 10, 1.4);
    actions.triggerMuzzleFlash(u, 1.0, v);
    actions.playSfx("tone:80:400:sawtooth", 0.9);
    actions.playSfx("tone:160:200:sawtooth", 0.6);
    const RADIUS = 5, MAX_DMG = 60;
    const nowMs = performance.now();
    for (const en of enemies) {
      if (en.dead) continue;
      const ep = world.players.get(en.id);
      if (!ep) continue;
      const d = Math.hypot(ep.u - u, ep.v - v);
      if (d < RADIUS) {
        en.hp = Math.max(0, en.hp - Math.round(MAX_DMG * (1 - d / RADIUS)));
        en._hpBarShowT = nowMs / 1000;
        if (en.hp <= 0 && !en.dead) {
          en.dead = true; en.respawnT = nowMs / 1000;
          set.enemyKills(get.enemyKills() + 1);
          set.comboCount(get.comboCount() + 1);
          set.comboLastT(nowMs / 1000);
          actions.spawnDecal(ep.u, ep.v, en.type === "robot" ? "oil" : "blood");
          if (en.type === "incendiary") actions.spawnFirePatch(ep.u, ep.v);
          if (en.type === "poisoner")   actions.spawnPoisonPuddle(ep.u, ep.v);
          actions.addKillFeedEntry(`★ BARREL KILL #${get.enemyKills()} — ${en.type}`, "#ff6600");
          actions.trackKillAndPanic(ep.u, ep.v);
          const _brlCoinMul = Math.min(8, get.comboCount());
          actions.spawnCoinDrop(ep.u, ep.v, (coinByType[en.type] || 1) * _brlCoinMul);
          actions.spawnAmmoPickup(ep.u, ep.v, en.dropQty || 12, en.dropAmmo);
          if ((en.dropHealth || 0) > 0) actions.spawnHealthPickup(ep.u, ep.v, en.dropHealth);
          if (weaponDropMap[en.type]) actions.spawnWeaponPickup(ep.u + 0.5, ep.v + 0.5, weaponDropMap[en.type]);
        }
      }
    }
    const h = world.players.get("hero");
    const hd = Math.hypot(h.u - u, h.v - v);
    actions.applyScreenShake(Math.max(0, 0.8 * (1 - hd / (RADIUS * 1.5))));
    if (hd < RADIUS && !get.heroDead() && get.dodgeT() <= 0 &&
        !(typeof Engine !== "undefined" && Engine.debug.godMode)) {
      const sd = Math.round(MAX_DMG * (1 - hd / RADIUS));
      if (sd > 0) {
        set.heroHp(Math.max(0, get.heroHp() - sd));
        set.heroLastDamageT(nowMs / 1000);
        actions.flashDamage();
        if (get.heroHp() <= 0 && !get.heroDead()) actions.heroShowDeathScreen();
      }
      if (hd > 0.1) {
        const _hkbStr = 14 * (1 - hd / RADIUS);
        set.heroKbU(((h.u - u) / hd) * _hkbStr);
        set.heroKbV(((h.v - v) / hd) * _hkbStr);
        set.heroKbT(0.28);
      }
    }
    for (const bar of barrels) {
      if (!bar.exploded && Math.hypot(bar.u - u, bar.v - v) < RADIUS * 0.8) {
        bar.exploded = true; bar.mesh.visible = false;
        setTimeout(() => explodeBarrel(bar.u, bar.v), 80);
      }
    }
  }

  const barrels = [
    {u:10,v:10},{u:-10,v:10},{u:10,v:-10},{u:-10,v:-10},
    {u:18,v:0},{u:-18,v:0},{u:0,v:18},{u:0,v:-18}
  ].map(p => makeBarrel(p.u, p.v));

  return { makeBarrel, explodeBarrel, barrels };
}
