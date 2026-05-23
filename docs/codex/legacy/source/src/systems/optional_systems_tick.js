// Optional global systems — each guarded by a null-check via actions.
// All world state comes in via `enemies` param or actions callbacks.
export function mountOptionalSystemsTick({ actions }) {
  function tick(dt, { enemies, performanceNow }) {
    const tz = actions.getTriggerZones();
    if (tz) {
      const heroPos = actions.getHeroPos();
      const ents = [{ id: "hero", u: heroPos.u, v: heroPos.v, y: heroPos.y || 0 }];
      for (const en of enemies) {
        if (en.dead) continue;
        const ep = actions.getEnemyPos(en.id);
        if (ep) ents.push({ id: en.id, u: ep.u, v: ep.v, y: 0 });
      }
      tz.tick(ents, dt);
    }

    const heroPos = actions.getHeroPos();
    const sz = actions.getSoundZones();
    if (sz) sz.tick(heroPos.u, heroPos.v);

    const cu = actions.getCutscene();
    if (cu) cu.tick(dt, actions.getCamera());

    const ach = actions.getAchievements();
    if (ach) ach.tick(dt);

    const dn = actions.getDayNight();
    if (dn) dn.tick(dt);

    const se = actions.getStatusEffects();
    if (se) se.tick(dt);

    const wm = actions.getWaveManager();
    if (wm) {
      wm.tick(dt);
      actions.waveHudTick(dt, wm.getState(), performanceNow);
    }
  }

  return { tick };
}
