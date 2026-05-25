/** grenade_physics — all 14 constants + tick from legacy mountGrenadePhysicsTick */
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

export default {
  priority: 50,
  tick(_t, data, dt, _r) {
    const gs = data.grenades; if (!gs || !gs.length) return;
    const grav = data.gravity || -9.8;
    const nowMs = data.nowMs || Date.now();

    for (let i = gs.length - 1; i >= 0; i--) {
      const g = gs[i];
      g.fuse = (g.fuse || 3) - dt;
      g.velY = (g.velY || 0) + grav * dt;
      g.u = (g.u || 0) + (g.velU || 0) * dt;
      g.y = (g.y || 1) + g.velY * dt;
      g.v = (g.v || 0) + (g.velV || 0) * dt;

      // Particle trail intent
      if (g.y > 0.1) {
        data.particles = data.particles || [];
        data.particles.push({ u: g.u, y: g.y, v: g.v });
      }

      // Ground hit
      if (g.y <= 0) {
        g.y = 0;

        // Smoke grenade deploy
        if (g._isSmoke && !g._deployed && Math.abs(g.velY) < SMOKE_SLOW_THRESH) {
          g._deployed = true;
          data.smokeDeploy = { u: g.u, v: g.v };
          gs.splice(i, 1);
          continue;
        }

        // Explode on fuse zero at ground
        if (g.fuse <= 0) {
          data.explosions = data.explosions || [];
          data.explosions.push({ u: g.u, v: g.v, grenadeId: g.id });
          gs.splice(i, 1);
          continue;
        }

        // Bounce
        if (g.velY < -BOUNCE_SFX_THRESH) {
          data.bounceSfx = data.bounceSfx || [];
          data.bounceSfx.push({ vol: Math.min(BOUNCE_SFX_MAX_VOL, Math.abs(g.velY) / BOUNCE_SFX_VOL_DIV) });
        }
        g.velY = Math.abs(g.velY) * BOUNCE_DAMP_Y;
        g.velU *= BOUNCE_DAMP_UV;
        g.velV *= BOUNCE_DAMP_UV;
      }

      // Explode in air when fuse expires
      if (g.fuse <= 0) {
        data.explosions = data.explosions || [];
        data.explosions.push({ u: g.u, v: g.v, grenadeId: g.id });
        gs.splice(i, 1);
        continue;
      }

      // Emissive blink intent
      g.blinkIntensity = g.fuse < BLINK_THRESH
        ? (Math.floor(g.fuse * 10) % 2 === 0 ? BLINK_ON_INTENSITY : BLINK_OFF_INTENSITY)
        : STEADY_INTENSITY;

      // Warn ring intent
      const urg = Math.max(0, 1 - g.fuse / 2.0);
      const pulse = 0.5 + 0.5 * Math.sin(nowMs / (g.fuse < 1 ? 60 : 140));
      g.warnRingOpacity = RING_BASE_OPACITY + urg * RING_URG_OPACITY + pulse * RING_PULSE_OPACITY;
      g.warnRingScale = RING_SCALE_BASE + pulse * RING_SCALE_PULSE;
    }
  }
};
