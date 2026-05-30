/** position5d facet — Full 5-dimensional position for the Ankhor substrate.
 *
 *  Why 5D? The engine convention is:
 *    render.x = u  (ground east)
 *    render.z = v  (ground north)
 *    render.y = y  (vertical / jump height)
 *    engine.x = deep-state channel A (layer routing, dimension index)
 *    engine.z = deep-state channel B (phase / world-slice id)
 *
 *  The `u, v` ground-plane coordinates are the AUTHORITATIVE position.
 *  Three.js reads them as (x, y=0+height, z). This separation means
 *  the physics engine and network sync operate on u,v and don't
 *  accidentally read render-space jitter.
 *
 *  REGISTERS: mutable runtime key-value slots that live alongside
 *  facet data. Registers are used for:
 *    - fast per-tick updates that don't need to be in the Thinga spec
 *    - network sync state (last sent u,v, dirty flag)
 *    - interpolation buffers for smooth remote-player movement
 *
 *  Register convention: keys prefixed with `_r_` are registers.
 *  They are NOT saved to disk. They ARE transmitted to peers at
 *  the world tick rate (default 30Hz via WorldWideComms).
 *
 *  Data schema:
 *  {
 *    u: 0,           // ground east (authoritative for physics)
 *    v: 0,           // ground north (authoritative for physics)
 *    y: 0,           // vertical height above ground
 *    heading: 0,     // yaw in radians (0 = north)
 *    layer: 0,       // dimensional layer index (0 = surface world)
 *    world_slice: "", // which world slice (for 7D federation)
 *    velocity: null, // { u, v, y } — optional, set by physics
 *
 *    // REGISTERS (runtime-only, not persisted)
 *    _r_dirty: false,        // true when position changed this frame
 *    _r_last_sent_u: 0,      // u at last network send
 *    _r_last_sent_v: 0,      // v at last network send
 *    _r_interp_target_u: null, // remote interpolation target
 *    _r_interp_target_v: null,
 *    _r_interp_alpha: 1.0,   // interpolation progress (1 = snapped)
 *    _r_network_lag_ms: 0,   // estimated round-trip lag to peer
 *  }
 *
 *  Written by RICH_HUMAN_20260324 for the Council — 2026-05-29
 *  Session: 2026-05-29_go-thru-5dengine-and-change-whatever-they-want-to_2098afea
 */

const INTERP_SPEED = 8.0;          // lerp rate for remote player smoothing
const NET_SEND_THRESHOLD_SQ = 0.0001; // (0.01 units)² — min movement before we mark dirty

export default {
  priority: 10,

  init(_thing, data) {
    // Ensure all fields exist with defaults
    if (data.u       === undefined) data.u = data.x || 0;
    if (data.v       === undefined) data.v = data.z || 0;
    if (data.y       === undefined) data.y = 0;
    if (data.heading === undefined) data.heading = 0;
    if (data.layer   === undefined) data.layer = 0;
    if (data.world_slice === undefined) data.world_slice = "";

    // Initialize registers
    data._r_dirty             = false;
    data._r_last_sent_u       = data.u;
    data._r_last_sent_v       = data.v;
    data._r_interp_target_u   = null;
    data._r_interp_target_v   = null;
    data._r_interp_alpha      = 1.0;
    data._r_network_lag_ms    = 0;
    data._r_is_remote          = false;  // true for networked remote players
  },

  tick(_thing, data, dt) {
    if (!data) return;

    // ── Physics integration (if velocity present) ──────────────────────────
    const vel = data.velocity;
    if (vel) {
      const prevU = data.u;
      const prevV = data.v;
      data.u = (data.u || 0) + (vel.u || 0) * dt;
      data.v = (data.v || 0) + (vel.v || 0) * dt;
      data.y = (data.y || 0) + (vel.y || 0) * dt;

      // Sync Three.js render coords from u,v,y
      data.x = data.u;
      data.z = data.v;

      // Mark dirty if moved significantly
      const du = data.u - prevU;
      const dv = data.v - prevV;
      if (du * du + dv * dv > NET_SEND_THRESHOLD_SQ) {
        data._r_dirty = true;
      }
    }

    // ── Remote player interpolation ────────────────────────────────────────
    // When a network update sets _r_interp_target_*, we smoothly lerp
    // toward it so remote players don't teleport on each packet.
    if (data._r_is_remote &&
        data._r_interp_target_u !== null &&
        data._r_interp_alpha < 1.0) {

      data._r_interp_alpha = Math.min(1.0, data._r_interp_alpha + dt * INTERP_SPEED);
      const a = data._r_interp_alpha;

      data.u = lerp(data.u, data._r_interp_target_u, a);
      data.v = lerp(data.v, data._r_interp_target_v, a);

      // Sync render coords
      data.x = data.u;
      data.z = data.v;

      if (data._r_interp_alpha >= 1.0) {
        data.u = data._r_interp_target_u;
        data.v = data._r_interp_target_v;
        data.x = data.u;
        data.z = data.v;
        data._r_interp_target_u = null;
        data._r_interp_target_v = null;
      }
    }
  },
};

/** Linearly interpolate a→b by t (0-1). */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

// ── Register protocol helpers ──────────────────────────────────────────────
// These are called by the WWC bridge when it sends/receives position packets.

/** Pack the position into a compact network frame.
 *  Returns { u, v, y, h, l } where h=heading, l=layer.
 *  The `_r_*` registers are NOT transmitted; only authoritative values. */
export function packPosition(data) {
  return {
    u: +(data.u || 0).toFixed(4),
    v: +(data.v || 0).toFixed(4),
    y: +(data.y || 0).toFixed(3),
    h: +(data.heading || 0).toFixed(3),
    l: data.layer || 0,
    s: data.world_slice || "",
  };
}

/** Apply a received network frame to position data.
 *  Sets interp targets rather than snapping, for smooth movement. */
export function applyNetworkPosition(data, frame) {
  // Set interp targets
  data._r_interp_target_u = frame.u;
  data._r_interp_target_v = frame.v;
  data._r_interp_alpha    = 0.0;   // start lerp from current position

  // Apply non-interpolated fields immediately
  data.y       = frame.y;
  data.heading = frame.h;
  data.layer   = frame.l || 0;
  if (frame.s !== undefined) data.world_slice = frame.s;

  // Mark as remote (disables local physics integration on server-owned values)
  data._r_is_remote = true;
}

/** Check if position registers are dirty and clear them.
 *  Called by the network sync loop to decide whether to transmit. */
export function consumeDirtyFlag(data) {
  if (!data._r_dirty) return false;
  data._r_dirty         = false;
  data._r_last_sent_u   = data.u;
  data._r_last_sent_v   = data.v;
  return true;
}
