/**
 * handlers.js — Default facet handlers for the 7D Engine registry.
 *
 * Each handler is an object: { priority, tick?, init?, cleanup? }.
 * The registry's tick(dt) walks handlers in priority order, invoking
 * handler.tick(thing, facetData, dt, registry) for every Thing carrying
 * that facet.
 *
 * Priority guide (lower = runs earlier per tick):
 *    0–19   physics / position integration
 *   20–39   passive autonomous motion (bob, spin), AI/behavior
 *   40–59   pickup / interaction
 *   50–59   server-side observers (process / request / db / agent-message)
 *   60–79   render / visual sync (mesh handler installed by boot.js)
 *   80–99   cleanup / TTL / despawn
 *
 * Mesh handler is NOT installed here — it lives in src/ankhor/install_mesh_handler.js
 * because it needs the live THREE+scene from boot.js.
 */

// ─── 0–19: physics / position ────────────────────────────────────────────────
export const facetHandlers = {
  position: {
    priority: 10,
    tick(_thing, data, dt) {
      if (!data?.velocity) return;
      data.x = (data.x || 0) + (data.velocity.x || 0) * dt;
      data.y = (data.y || 0) + (data.velocity.y || 0) * dt;
      data.z = (data.z || 0) + (data.velocity.z || 0) * dt;
    }
  },

  // ─── 20–39: passive motion / AI ─────────────────────────────────────────────

  // bob: sinusoidal vertical oscillation. Writes to position.y.
  // Used by all pickups (speed orb, coin, health, etc.) for the floating effect.
  // Data: { base, amplitude, period_ms, phase? }
  bob: {
    priority: 20,
    init(_thing, data) {
      if (data && data.phase == null) data.phase = Math.random() * Math.PI * 2;
    },
    tick(thing, data, _dt, registry) {
      if (!data) return;
      const pos = registry.facetData(thing.id, "position");
      if (!pos) return;
      const t = (typeof performance !== "undefined" ? performance.now() : Date.now()) / (data.period_ms || 280);
      pos.y = (data.base || 0.7) + Math.sin(t + (data.phase || 0)) * (data.amplitude || 0.18);
    }
  },

  // spin: rotation around y-axis. Writes to position.heading (mesh handler reads).
  // Data: { speed }  (radians/sec)
  spin: {
    priority: 21,
    tick(thing, data, dt, registry) {
      if (!data) return;
      const pos = registry.facetData(thing.id, "position");
      if (!pos) return;
      pos.heading = (pos.heading || 0) + (data.speed || 1) * dt;
    }
  },

  // emissive-pulse: oscillate material.emissiveIntensity on the mesh.
  // Data: { base, amplitude, period_ms }
  emissivePulse: {
    priority: 22,
  },

  "emissive-pulse": {
    priority: 22,
    tick(thing, data, _dt, registry) {
      if (!data) return;
      const mesh = registry.facetData(thing.id, "mesh");
      if (!mesh?.threeObj) return;
      const t = (typeof performance !== "undefined" ? performance.now() : Date.now()) / (data.period_ms || 120);
      const intensity = (data.base || 0.7) + (data.amplitude || 0.3) * Math.sin(t);
      mesh.threeObj.traverse?.((o) => {
        if (o.material && "emissiveIntensity" in o.material) o.material.emissiveIntensity = intensity;
      });
    }
  },

  // ─── 40–59: interactions / server observers ────────────────────────────────

  // pickup-radius: detect when hero is close enough to collect.
  // Data: { radius, heroU?, heroV?, on_pickup_action?, collected? }
  // Caller must inject heroU/heroV via registry.updateFacet each frame.
  // on_pickup_action is a string event name emitted (not invoked) to keep
  // facets pure-data; a higher-level system handles the consequences.
  "pickup-radius": {
    priority: 40,
    tick(thing, data, _dt, registry) {
      if (!data || data.collected) return;
      const pos = registry.facetData(thing.id, "position");
      if (!pos) return;
      const hu = data.heroU, hv = data.heroV;
      if (hu == null || hv == null) return;     // hero hasn't been wired in yet
      const du = hu - (pos.x ?? pos.u ?? 0);
      const dv = hv - (pos.z ?? pos.v ?? 0);
      if (du * du + dv * dv < (data.radius || 1.2) ** 2) {
        data.collected = true;
        data.collected_at = (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;
        registry.despawn(thing.id, `pickup:${data.on_pickup_action || "default"}`);
      }
    }
  },

  // ─── server domain (data containers; values injected by Python adapters) ───
  health:              { priority: 25 },
  destructible:        { priority: 30 },
  "process-observer":  { priority: 50 },
  "request-stream":    { priority: 51 },
  "db-connection":     { priority: 52 },
  "agent-message":     { priority: 53 },

  // ─── 60–79: render — mesh handler installed by boot.js (closes over THREE+scene) ───

  // ─── 80–99: cleanup / TTL ──────────────────────────────────────────────────
  ttl: {
    priority: 90,
    tick(thing, data, dt, registry) {
      if (!data) return;
      data.remaining = (data.remaining ?? 0) - dt;
      if (data.remaining <= 0) registry.despawn(thing.id, "ttl-expired");
    }
  }
};

export function installDefaultHandlers(registry) {
  for (const [name, handler] of Object.entries(facetHandlers)) {
    if (name === "emissivePulse") continue; // alias placeholder, see "emissive-pulse"
    registry.registerFacetHandler(name, handler);
  }
  return registry;
}
