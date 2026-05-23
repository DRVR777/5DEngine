// Extracted from index.html bullet physics loop.
// Handles non-enemy bullet impacts: peers, barrels, crates, and building blockers.
// Behavior-preservation phase: keep hit radii, y thresholds, sounds, and damage formulas unchanged.
export function mountBulletWorldHitTick({
  getMp,
  barrels,
  crates,
  buildingBlockers,
  actions,
}) {
  function tick(b) {
    const mp = getMp ? getMp() : null;

    let hitPeer = false;
    if (mp && mp.enabled) {
      for (const [pid, peer] of mp.peers) {
        const lp = peer.lastPos;
        if (!lp) continue;
        const pdu = lp.u - b.posU, pdv = lp.v - b.posV;
        const pdy = (lp.y + 0.9) - b.posY;
        if (pdu*pdu + pdv*pdv < 0.36 && pdy*pdy < 0.81) {
          const headshot = b.posY > 1.6;
          const dmg      = headshot ? b.damage * 2 : b.damage;
          mp.hitPeer(pid, dmg, headshot);
          actions.spawnParticles(b.posU, b.posY, b.posV, 12, headshot ? "yellow" : "red", 6, 0.3);
          actions.spawnDamageNumber(b.posU, b.posY + 0.5, b.posV,
            `${headshot ? "HEADSHOT " : ""}-${dmg}`, headshot ? "#ffd700" : "#ff4444");
          actions.playSfx(headshot ? "tone:1800:40:sine" : "tone:900:30:square", 0.4);
          hitPeer = true; break;
        }
      }
    }
    if (hitPeer) return { remove: true, reason: "peer" };

    let hitBarrel = false;
    for (const bar of barrels) {
      if (bar.exploded) continue;
      const bdu = bar.u - b.posU, bdv = bar.v - b.posV;
      if (bdu*bdu + bdv*bdv < 0.18 && b.posY < 0.95) {
        bar.hp -= b.damage;
        actions.spawnParticles(b.posU, b.posY, b.posV, 5, "white", 7, 0.10);
        actions.spawnParticles(b.posU, b.posY, b.posV, 3, "yellow", 5, 0.14);
        actions.playSfx("tone:1650:28:square", 0.20);
        actions.spawnDamageNumber(b.posU, b.posY + 0.5, b.posV, `-${b.damage}`, "#ff6600");
        if (bar.hp <= 0) { bar.exploded = true; bar.mesh.visible = false; actions.explodeBarrel(bar.u, bar.v); }
        hitBarrel = true; break;
      }
    }
    if (hitBarrel) return { remove: true, reason: "barrel" };

    let hitCrate = false;
    for (const cr of crates) {
      if (cr.broken) continue;
      const cdu = cr.u - b.posU, cdv = cr.v - b.posV;
      if (cdu*cdu + cdv*cdv < 0.25 && b.posY < 0.95) {
        cr.hp -= b.damage;
        actions.spawnParticles(b.posU, b.posY, b.posV, 3, "orange", 3, 0.12);
        actions.spawnDamageNumber(b.posU, b.posY + 0.5, b.posV, `-${b.damage}`, "#cc8833");
        if (cr.hp <= 0) actions.breakCrate(cr);
        hitCrate = true; break;
      }
    }
    if (hitCrate) return { remove: true, reason: "crate" };

    let hitBlocker = null;
    for (const bl of buildingBlockers) {
      if (Math.abs(b.posU - bl.u) < bl.hitbox.w / 2 &&
          Math.abs(b.posV - bl.v) < bl.hitbox.d / 2 &&
          b.posY >= 0 && b.posY <= bl.hitbox.h) {
        hitBlocker = bl; break;
      }
    }
    if (hitBlocker) {
      actions.spawnParticles(b.posU, b.posY, b.posV, 4, "yellow", 4, 0.18);
      actions.playSfx("tone:180:28:square", 0.09);
      const fU = b.posU - hitBlocker.u, fV = b.posV - hitBlocker.v;
      const pnU = hitBlocker.hitbox.w / 2 - Math.abs(fU);
      const pnV = hitBlocker.hitbox.d / 2 - Math.abs(fV);
      const nU = pnU < pnV ? (fU > 0 ? 1 : -1) : 0;
      const nV = pnU < pnV ? 0 : (fV > 0 ? 1 : -1);
      actions.spawnWallScorch(b.posU, b.posY, b.posV, nU, nV);
      return { remove: true, reason: "blocker" };
    }

    if (b.traveled >= b.range) return { remove: true, reason: "range" };
    return { remove: false, reason: null };
  }

  return { tick };
}
