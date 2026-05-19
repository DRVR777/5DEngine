export function mountHeartbeat({ get, set, actions }) {
  function tick(dt) {
    const heroHp    = get.heroHp();
    const maxHp     = get.HERO_MAX_HP();
    const heroDead  = get.heroDead();
    const threshold = maxHp * 0.3;
    if (heroHp < threshold && !heroDead) {
      const next = get.heartbeatT() - dt;
      set.heartbeatT(next);
      if (next <= 0) {
        const hbFrac = heroHp / threshold;
        set.heartbeatT(0.38 + hbFrac * 0.82);
        actions.playSfx("tone:42:95:sine", 0.30 + (1 - hbFrac) * 0.18);
      }
    } else {
      set.heartbeatT(0);
    }
  }
  return { tick };
}
