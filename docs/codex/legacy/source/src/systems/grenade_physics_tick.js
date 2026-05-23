const SMOKE_SPAWN_PROB   = 0.55;
const BOUNCE_DAMP_Y      = 0.35;
const BOUNCE_DAMP_UV     = 0.6;
const BOUNCE_SFX_THRESH  = 1.0;
const BOUNCE_SFX_MAX_VOL = 0.22;
const BOUNCE_SFX_VOL_DIV = 28;
const BLINK_THRESH       = 1.0;
const BLINK_ON_INTENSITY = 2.5;
const BLINK_OFF_INTENSITY = 0.2;
const STEADY_INTENSITY   = 0.9;
const RING_BASE_OPACITY  = 0.35;
const RING_URG_OPACITY   = 0.4;
const RING_PULSE_OPACITY = 0.15;
const RING_SCALE_BASE    = 0.9;
const RING_SCALE_PULSE   = 0.15;
const SMOKE_SLOW_THRESH  = 3.5;

export function mountGrenadePhysicsTick({ actions }) {
  function tick(dt, { grenades, gravity, nowMs }) {
    for (let i = grenades.length - 1; i >= 0; i--) {
      const g = grenades[i];
      g.fuse -= dt;
      g.velY += gravity * dt;
      g.u += g.velU * dt; g.y += g.velY * dt; g.v += g.velV * dt;

      if (g.y > 0.1) actions.spawnParticles(g.u, g.y, g.v);

      if (g.y <= 0) {
        g.y = 0;
        if (g._isSmoke && !g._deployed && Math.abs(g.velY) < SMOKE_SLOW_THRESH) {
          g._deployed = true;
          if (g._warnRing) { actions.removeMesh(g._warnRing); g._warnRing = null; }
          actions.deploySmokeZone(g.u, g.v);
          actions.removeMesh(g.mesh);
          grenades.splice(i, 1);
          continue;
        }
        if (g.fuse <= 0) {
          if (g._warnRing) { actions.removeMesh(g._warnRing); g._warnRing = null; }
          actions.explodeGrenade(g);
          grenades.splice(i, 1);
          continue;
        }
        if (g.velY < -BOUNCE_SFX_THRESH) {
          actions.playSfx("tone:2400:22:triangle", Math.min(BOUNCE_SFX_MAX_VOL, Math.abs(g.velY) / BOUNCE_SFX_VOL_DIV));
        }
        g.velY = Math.abs(g.velY) * BOUNCE_DAMP_Y;
        g.velU *= BOUNCE_DAMP_UV; g.velV *= BOUNCE_DAMP_UV;
      }

      if (g.fuse <= 0) {
        if (g._warnRing) { actions.removeMesh(g._warnRing); g._warnRing = null; }
        actions.explodeGrenade(g);
        grenades.splice(i, 1);
        continue;
      }

      g.mesh.position.set(g.u, g.y, g.v);
      g.mesh.rotation.x += dt * 8; g.mesh.rotation.z += dt * 5;
      g.mesh.material.emissiveIntensity = g.fuse < BLINK_THRESH
        ? (Math.floor(g.fuse * 10) % 2 === 0 ? BLINK_ON_INTENSITY : BLINK_OFF_INTENSITY)
        : STEADY_INTENSITY;

      if (g._warnRing) {
        g._warnRing.position.set(g.u, 0.05, g.v);
        const urg = Math.max(0, 1 - g.fuse / 2.0);
        const pulse = 0.5 + 0.5 * Math.sin(nowMs / (g.fuse < 1 ? 60 : 140));
        g._warnRing.material.opacity = RING_BASE_OPACITY + urg * RING_URG_OPACITY + pulse * RING_PULSE_OPACITY;
        const sc = RING_SCALE_BASE + pulse * RING_SCALE_PULSE;
        g._warnRing.scale.set(sc, sc, sc);
      }
    }
  }
  return { tick };
}
