/** bullet_world_hit — barrel hit: dist²<0.18 at y<0.95, crate hit: dist²<0.25 at y<0.95, max range */
export default {
  priority: 40,
  tick(_t, data, _dt, _r) {
    const bullets = data.bullets; if (!bullets || !bullets.length) return;
    const barrels = data.barrels || [];
    const crates = data.crates || [];
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      if (b.traveled >= b.range) { bullets.splice(i, 1); continue; }
      let hit = false;
      for (const bar of barrels) {
        if (bar.exploded) continue;
        if ((bar.u - b.posU)**2 + (bar.v - b.posV)**2 < 0.18 && b.posY < 0.95) { bar.hp -= b.damage; if (bar.hp <= 0) bar.exploded = true; hit = true; break; }
      }
      if (hit) { bullets.splice(i, 1); continue; }
      for (const cr of crates) {
        if (cr.broken) continue;
        if ((cr.u - b.posU)**2 + (cr.v - b.posV)**2 < 0.25 && b.posY < 0.95) { cr.hp -= b.damage; if (cr.hp <= 0) cr.broken = true; hit = true; break; }
      }
      if (hit) bullets.splice(i, 1);
    }
  }
};
