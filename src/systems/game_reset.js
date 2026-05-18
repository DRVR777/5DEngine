// Full game reset — clears all active entities and resets session state
// mountGameReset(deps) → { resetGameState }

export function mountGameReset({
  scene, world, Inv, CFG,
  enemies, enemyMeshes,
  bullets3D, enemyBullets, grenades3D,
  smokeZones, firePatches, poisonPuddles, wallScorches, armorShards,
  speedOrbs, weaponPickups,
  heroInv, weaponAmmo,
  actions,
}) {
  function resetGameState() {
    for (let i = enemies.length - 1; i >= 0; i--) {
      const re = enemies[i];
      if (re.id && re.id.startsWith("en_spawned_")) {
        const rm = enemyMeshes.get(re.id);
        if (rm) { scene.remove(rm.group); if (rm.laserLine) scene.remove(rm.laserLine); enemyMeshes.delete(re.id); }
        if (world.players) world.players.delete(re.id);
        enemies.splice(i, 1);
      }
    }
    for (const fp of firePatches) scene.remove(fp.mesh); firePatches.length = 0;
    for (const pp of poisonPuddles) scene.remove(pp.mesh); poisonPuddles.length = 0;
    for (const ws of wallScorches) ws.visible = false; wallScorches.length = 0;
    for (const as of armorShards) scene.remove(as.mesh); armorShards.length = 0;
    actions.gadgetClearAll();
    for (const rb of bullets3D) scene.remove(rb.mesh); bullets3D.length = 0;
    for (const eb of enemyBullets) scene.remove(eb.mesh); enemyBullets.length = 0;
    for (const rg of grenades3D) { scene.remove(rg.mesh); if (rg._warnRing) scene.remove(rg._warnRing); } grenades3D.length = 0;
    for (const sz of smokeZones) scene.remove(sz.mesh); smokeZones.length = 0;
    for (const so of speedOrbs) scene.remove(so.mesh); speedOrbs.length = 0;
    for (const wp of weaponPickups) scene.remove(wp.mesh); weaponPickups.length = 0;
    actions.resetGrenades();
    heroInv.slots.fill(null);
    for (const w of (CFG.weapons || [])) {
      Inv.addItem(heroInv, "gun_" + w.id, 1);
      Inv.addItem(heroInv, w.ammoItem || "pistol_9mm", w.magCap * 4);
    }
    Inv.addItem(heroInv, "medkit", 2);
    weaponAmmo.clear();
    for (const w of (CFG.weapons || [])) weaponAmmo.set(w.id, w.magCap || 12);
    actions.resetWeapon();
    actions.heroRespawn();
    actions.waveRestart();
    actions.resetStats();
    actions.resetLevel();
    actions.resetPerks();
    actions.hidePerkPicker();
    actions.refreshPerkHud();
    actions.clearHeroLevelHud();
  }

  return { resetGameState };
}
