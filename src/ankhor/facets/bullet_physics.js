/** bullet_physics — SUBSTEPS=5, hitRadius=0.6. Pure state tick from legacy. */
const SUBSTEPS = 5;
const HIT_RADIUS = 0.6;

export default {
  priority: 35,
  tick(_t, data, dt, _r) {
    const bullets = data.bullets;
    if (!bullets || !bullets.length) return;

    const subDt = dt / SUBSTEPS;
    for (let s = 0; s < SUBSTEPS && bullets.length > 0; s++) {
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.u = (b.u || 0) + (b.dx || 0) * (b.speed || 60) * subDt;
        b.v = (b.v || 0) + (b.dz || 0) * (b.speed || 60) * subDt;
        if (b.dy) b.y = (b.y || 0) + b.dy * (b.speed || 60) * subDt;
        b.traveled = (b.traveled || 0) + (b.speed || 60) * subDt;

        // Enemy hit check
        const enemies = data.enemies || [];
        let hitEnemy = false;
        for (const en of enemies) {
          if (en.dead || en.hp <= 0) continue;
          const d = Math.hypot(en.u - b.u, en.v - b.v);
          if (d < HIT_RADIUS) {
            en.hp = Math.max(0, en.hp - (b.dmg || 0));
            data.hits = data.hits || [];
            data.hits.push({ enemyId: en.id, dmg: b.dmg, headshot: false, u: b.u, v: b.v, y: b.y });
            if (en.hp <= 0) {
              data.kills = data.kills || [];
              data.kills.push({ enemyId: en.id, u: en.u, v: en.v });
            }
            if (b.weaponId === "sniper" && !b._pierced) {
              b._pierced = true;
              data.pierce = { u: en.u, y: (b.y || 0) + 1.4, v: en.v };
            } else {
              hitEnemy = true; break;
            }
          }
        }

        if (hitEnemy) { bullets.splice(i, 1); continue; }

        // World hit
        if (b.traveled > (b.range || 100) || b.ttl <= 0) {
          data.worldHits = data.worldHits || [];
          data.worldHits.push({ u: b.u, v: b.v, y: b.y });
          bullets.splice(i, 1);
          continue;
        }
      }
    }
  }
};
