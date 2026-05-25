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

  // spin: rotation. Writes to position.heading (single-axis legacy) AND/OR
  // directly to mesh.threeObj.rotation for per-axis spin (used by health,
  // armor-shard, and other multi-axis pickups).
  // Data: { speed?, x?, y?, z? }  — speed is legacy y-axis; x/y/z are radians/sec.
  spin: {
    priority: 21,
    tick(thing, data, dt, registry) {
      if (!data) return;
      const pos = registry.facetData(thing.id, "position");
      if (pos) pos.heading = (pos.heading || 0) + (data.speed || data.y || 0) * dt;
      const mesh = registry.facetData(thing.id, "mesh");
      if (mesh?.threeObj && (data.x != null || data.y != null || data.z != null)) {
        if (data.x) mesh.threeObj.rotation.x += data.x * dt;
        if (data.y) mesh.threeObj.rotation.y += data.y * dt;
        if (data.z) mesh.threeObj.rotation.z += data.z * dt;
      }
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

  // opacity-pulse: oscillate material.opacity on a named child of the mesh group.
  // Data: { base, amplitude, period_ms, child_name? }  — if child_name set,
  // pulse only that named child; otherwise pulse all transparent children.
  // Used by weapon-pickup's vertical beacon pillar.
  "opacity-pulse": {
    priority: 23,
    tick(thing, data, _dt, registry) {
      if (!data) return;
      const mesh = registry.facetData(thing.id, "mesh");
      if (!mesh?.threeObj) return;
      const t = (typeof performance !== "undefined" ? performance.now() : Date.now()) / (data.period_ms || 400);
      const opacity = (data.base || 0.25) + (data.amplitude || 0.15) * Math.sin(t);
      mesh.threeObj.traverse?.((o) => {
        if (!o.material) return;
        if (data.child_name && o.name !== data.child_name) return;
        if (o.material.transparent) o.material.opacity = opacity;
      });
    }
  },

  // ─── 40–59: interactions / server observers ────────────────────────────────

  // magnet: pull the Thing's position toward (heroU, heroV) when within range.
  // Mirrors src/systems/coin_drop_tick.js magnet logic (lines 23–29). Caller
  // injects heroU/heroV each frame via registry.updateFacet.
  // Data: { range, speed, heroU?, heroV? }
  magnet: {
    priority: 35,
    tick(thing, data, dt, registry) {
      if (!data) return;
      const hu = data.heroU, hv = data.heroV;
      if (hu == null || hv == null) return;
      const pos = registry.facetData(thing.id, "position");
      if (!pos) return;
      const x = pos.x ?? pos.u ?? 0, z = pos.z ?? pos.v ?? 0;
      const du = hu - x, dv = hv - z;
      const d = Math.hypot(du, dv);
      const range = data.range || 3.0;
      if (d > 0 && d < range) {
        const pull = (data.speed || 9) * (1 - d / range);
        pos.x = x + (du / d) * pull * dt;
        pos.z = z + (dv / d) * pull * dt;
      }
    }
  },

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
  // ─── CONFIG FACETS (legacy data extracted to substrate) ──────────────────
  "skybox": {
    priority: 5,
    init(_thing, data) {
      if (data.presets) return;
      data.presets = {
        day:    { bg: 0x87ceeb, fog: 0x87ceeb, fogNear: 40, fogFar: 140, ambColor: 0xffffff, ambInt: 0.9, sunColor: 0xffffff, sunInt: 1.1 },
        sunset: { bg: 0xff7744, fog: 0xee6633, fogNear: 20, fogFar: 90,  ambColor: 0xff9966, ambInt: 0.8, sunColor: 0xff8800, sunInt: 1.4 },
        night:  { bg: 0x060a1a, fog: 0x060a1a, fogNear: 15, fogFar: 60,  ambColor: 0x223366, ambInt: 0.3, sunColor: 0x3366aa, sunInt: 0.4 },
        holo:   { bg: 0x010810, fog: 0x010810, fogNear: 30, fogFar: 100, ambColor: 0x00ccff, ambInt: 0.4, sunColor: 0x00ffaa, sunInt: 0.6 },
        space:  { bg: 0x000008, fog: 0x000008, fogNear: 60, fogFar: 300, ambColor: 0x8866ff, ambInt: 0.2, sunColor: 0xffffff, sunInt: 2.0 },
      };
      data.current = "day";
    },
  },
  "day-night": {
    priority: 8,
    init(_t, data) { data.hour = 8.0; data.speed = 1.0; data.paused = false; },
    tick(_t, data, dt) { if (!data.paused) data.hour = ((data.hour + (data.speed/60)*dt) % 24 + 24) % 24; },
  },
  "lighting":  { priority: 6,  init(_t,d){ d.ambInt=0.9; d.sunInt=1.1; d.shadowMapSize=2048; d.shadowCamHalf=40; d.sunPos={x:20,y:30,z:10}; } },
  "weather":   { priority: 9,  init(_t,d){ d.current="clear"; d.presets={clear:{vis:1.0,sky:{r:.53,g:.81,b:.92},wind:1.0},light_rain:{vis:.85,sky:{r:.45,g:.55,b:.62},wind:2.5},heavy_rain:{vis:.55,sky:{r:.30,g:.35,b:.42},wind:5.0},storm:{vis:.30,sky:{r:.18,g:.20,b:.25},wind:9.0,lightning:true},snow:{vis:.65,sky:{r:.85,g:.87,b:.90},wind:3.0},fog:{vis:.25,sky:{r:.78,g:.80,b:.82},wind:0.5}}; } },
  "fog_of_war": { priority: 50, init(_t,d){ d.FOW_RADIUS=25; d.FOW_FADE_START=18; d.FOW_OPACITY=0.85; } },
  "rain":       { priority: 12, init(_t,d){ d.rainDrops=true; d.rainIntensity=1; } },
  "world_layout": { priority: 10, init(_t,d){ d.ARENA_HALF=28; d.ARENA_THICK=1.6; d.ARENA_HEIGHT=2.2; } },
};

export function installDefaultHandlers(registry) {
  for (const [name, handler] of Object.entries(facetHandlers)) {
    if (name === "emissivePulse") continue; // alias placeholder, see "emissive-pulse"
    registry.registerFacetHandler(name, handler);
  }
  return registry;
}
