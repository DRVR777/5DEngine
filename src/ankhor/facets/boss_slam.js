/** boss_slam — radius=5, dmg=50 (falloff 1-d/5), ff dmg=30, ff radius=3, cd 5.0/2.8, engDist=4 */
export default {
  priority: 36,
  tick(_t, data, dt, _r) {
    if (data.type !== "boss") return;
    const dist = data.dist || 99;
    if (dist >= 4) return;
    const cd = data.enraged ? 2.8 : 5.0;
    const now = Date.now() / 1000;
    if (data.slamT && now - data.slamT <= cd) return;
    data.slamT = now;
    data.slamDmg = Math.round(50 * (1 - Math.min(dist, 5) / 5));
    data.slamFired = true;
  }
};
