/** enemy_kill — hp=0, dead=true, headshot bonus 0.22s, killMarker 300ms, streaks 3/5/10, boss+vignette */
export default {
  priority: 38,
  tick(_t, data, _dt, _r) {
    if (!data.killed) return;
    data.hp = 0; data.dead = true;
    if (data.headshot) data.bulletTimeBonus = 0.22;
    data.killMarkerUntil = Date.now() + 300;
    if (data.type === "boss") { data.vignetteAmt = (data.vignetteAmt || 0) + 0.9; data.bossDefeated = true; }
    data.enemyKills = (data.enemyKills || 0) + 1;
    data.killStreak = data.killStreak || 1;
    const bonus = { 3: 3, 5: 5, 10: 10 };
    if (bonus[data.killStreak]) data.streakCoins = bonus[data.killStreak];
  }
};
