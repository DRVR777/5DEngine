const SEP_DIST = 1.2;
const SEP_PUSH = 0.6;

export function mountEnemySepTick({ actions }) {
  function tick(dt, { enemies }) {
    for (let ei = 0; ei < enemies.length; ei++) {
      const ea = enemies[ei]; if (ea.dead) continue;
      const pa = actions.getPos(ea.id); if (!pa) continue;
      for (let ej = ei + 1; ej < enemies.length; ej++) {
        const eb = enemies[ej]; if (eb.dead) continue;
        const pb = actions.getPos(eb.id); if (!pb) continue;
        const dU = pa.u - pb.u, dV = pa.v - pb.v;
        if (Math.abs(dU) > SEP_DIST && Math.abs(dV) > SEP_DIST) continue;
        const d = Math.hypot(dU, dV);
        if (d < SEP_DIST && d > 0.001) {
          const push = (SEP_DIST - d) * SEP_PUSH * dt / d;
          actions.setPos(ea.id, pa.x, 0, 0, pa.u + dU * push, pa.v + dV * push);
          actions.setPos(eb.id, pb.x, 0, 0, pb.u - dU * push, pb.v - dV * push);
        }
      }
    }
  }
  return { tick };
}
