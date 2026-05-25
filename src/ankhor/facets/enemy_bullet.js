/** enemy_bullet — hit 0.6m/0.9h, miss 1.5m/1.2h, missCd 0.5s, shake min(0.35,dmg/55) */
export default {
  priority: 37,
  tick(_t, data, dt, _r) {
    const bullets = data.bullets; if (!bullets || !bullets.length) return;
    const hu = data.heroU || 0, hv = data.heroV || 0, hy = data.heroY || 0;
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.posU = (b.posU || 0) + (b.dirU || 0) * (b.speed || 10) * dt;
      b.posV = (b.posV || 0) + (b.dirV || 0) * (b.speed || 10) * dt;
      b.traveled = (b.traveled || 0) + (b.speed || 10) * dt;
      const du = hu - b.posU, dv = hv - b.posV, dh = (hy + 1.0) - (b.posY || 0);
      if (du * du + dv * dv < 0.36 && Math.abs(dh) < 0.9) {
        let dmg = b.damage || 10;
        data.heroHp = Math.max(0, (data.heroHp || 100) - dmg);
        data.shakeAmt = Math.min(0.35, dmg / 55);
        bullets.splice(i, 1); data.hit = true;
      } else if (du * du + dv * dv < 2.25 && Math.abs(dh) < 1.2) {
        data.missCooldown = 0.5;
      }
    }
    data.missCooldown = Math.max(0, (data.missCooldown || 0) - dt);
  }
};
