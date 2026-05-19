// Extracted from index.html — bullet physics substep loop (iter 681).
// Five substeps per frame prevent tunneling past narrow enemies.
// Hit radius: 0.6m. Pierce tone: 2200Hz. SUBSTEPS: 5.
export function mountBulletPhysicsTick({
  bullets3D,
  enemies,
  getPlayerPos,
  computeBulletDamage,
  hitFeedbackTick,
  killTick,
  worldHitTick,
  get,
  set,
  actions,
}) {
  const SUBSTEPS = 5;

  function tick(dt, { nowMs }) {
    set.pistolCooldown(Math.max(0, get.pistolCooldown() - dt));
    const subDt = dt / SUBSTEPS;

    for (let s = 0; s < SUBSTEPS && bullets3D.length > 0; s++) {
      for (let i = bullets3D.length - 1; i >= 0; i--) {
        const b = bullets3D[i];
        b.posU += b.dirU * b.speed * subDt;
        b.posV += b.dirV * b.speed * subDt;
        if (b.dirY) b.posY += b.dirY * b.speed * subDt;
        b.traveled += b.speed * subDt;

        let hitEnemy = false;
        for (const en of enemies) {
          if (en.dead) continue;
          const ep = getPlayerPos(en.id);
          if (!ep) continue;
          if (Math.hypot(ep.u - b.posU, ep.v - b.posV) < 0.6) {
            const { dmg, headshot, backstab, frontalBlock, isCrit } = computeBulletDamage({
              bullet: b, enemy: en,
              dmgMul: get.dmgMul(), lvlDmgMul: get.lvlDmgMul(), perkDmgMul: get.perkDmgMul(),
            });
            en.hp = Math.max(0, en.hp - dmg);
            hitFeedbackTick.tick(en, ep, b, { nowMs, dmg, headshot, backstab, frontalBlock, isCrit });
            if (en.hp <= 0) killTick.tick(en, ep, { nowMs, headshot });

            if (b.weaponId === "sniper" && !b._pierced) {
              b._pierced = true;
              actions.spawnDamageNumber(ep.u, b.posY + 1.4, ep.v, "PIERCE!", "#00eeff");
              actions.playSfx("tone:2200:30:sine", 0.18);
            } else {
              hitEnemy = true; break;
            }
          }
        }

        if (hitEnemy) { actions.removeMesh(b.mesh); bullets3D.splice(i, 1); continue; }
        const worldHit = worldHitTick.tick(b);
        if (worldHit.remove) { actions.removeMesh(b.mesh); bullets3D.splice(i, 1); continue; }
        b.mesh.position.set(b.posU, b.posY, b.posV);
      }
    }
  }

  return { tick };
}
