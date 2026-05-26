/** armor_vest — COLLECT_DIST=1.3, GAIN_AMT=25, RESPAWN_DUR=60 from legacy */
const COLLECT_DIST = 1.3;
const GAIN_AMT = 25;
const RESPAWN_DUR = 60;

export default {
  priority: 72,
  tick(_t, data, dt, _r) {
    const pickups = data.pickups; if (!pickups || !pickups.length) return;
    const hu = data.heroU || 0, hv = data.heroV || 0;
    for (let i = pickups.length - 1; i >= 0; i--) {
      const v = pickups[i];
      if (Math.hypot(hu - v.u, hv - v.v) < COLLECT_DIST) {
        pickups.splice(i, 1);
        data.armorGained = (data.armorGained || 0) + GAIN_AMT;
      }
    }
  }
};
