// Kill tracking — lifesteal on kill, multi-kill panic/rout broadcast
// mountKillTracking(deps) → { trackKillAndPanic, resetPanic }
// COIN_BY_TYPE exported as named const for use by other modules

export const COIN_BY_TYPE = {
  grunt: 1, fast: 1, poisoner: 2, incendiary: 2,
  heavy: 4, robot: 8, boss: 30, sniper: 3,
};

export function mountKillTracking({ enemies, world, get, set, actions }) {
  let _recentKillPos = [];
  let _panicBroadcastT = -99;

  function trackKillAndPanic(killU, killV) {
    const t = performance.now() / 1000;
    if (get.perkLifesteal() && !get.heroDead()) {
      set.heroHp(Math.min(get.HERO_MAX_HP() + get.perkMaxHpBonus(), get.heroHp() + 3));
      actions.spawnDamageNumber(killU, 2.0, killV, "+3 HP", "#cc44cc");
    }
    _recentKillPos.push({ u: killU, v: killV, t });
    _recentKillPos = _recentKillPos.filter(k => t - k.t < 4.0);
    if (_recentKillPos.length >= 3 && t - _panicBroadcastT > 4.0) {
      _panicBroadcastT = t;
      let panicked = 0;
      for (const en2 of enemies) {
        if (en2.dead || en2._panicT > 0) continue;
        const ep2 = world.players.get(en2.id);
        if (!ep2) continue;
        for (const k of _recentKillPos) {
          if (Math.hypot(ep2.u - k.u, ep2.v - k.v) < 10) { en2._panicT = 3.0; panicked++; break; }
        }
      }
      if (panicked > 0) {
        actions.addKillFeedEntry(`⚠ ${panicked} ENEM${panicked > 1 ? "IES" : "Y"} ROUTING!`, "#ffff00");
        actions.showToast("Enemies routing!", "success", 1800);
        actions.playSfx("tone:500:120:triangle", 0.3);
      }
    }
  }

  function resetPanic() {
    _recentKillPos = [];
    _panicBroadcastT = -99;
  }

  return { trackKillAndPanic, resetPanic };
}
