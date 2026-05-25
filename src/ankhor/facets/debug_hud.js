/** debug_hud — HP_BAR_LEN=16, hp thresholds: >0.5 green, >0.25 yellow, else red */
export default {
  priority: 95,
  tick(_t, data, _dt, _r) {
    const maxHp = (data.heroMaxHp || 100) + (data.perkMaxHpBonus || 0) || 1;
    const hpFrac = Math.max(0, Math.min(1, (data.heroHp || 0) / maxHp));
    data.hpBarFilled = Math.round(16 * hpFrac);
    data.hpColor = hpFrac > 0.5 ? "#5dff5d" : hpFrac > 0.25 ? "#ffd166" : "#ff5d5d";
  }
};
