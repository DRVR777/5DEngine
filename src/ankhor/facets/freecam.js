/** freecam facet — native Ankhor replacement for the legacy
 *  mountFreecamTick (data/legacy/freecam.json).
 *
 *  Legacy contract (src/systems/freecam_tick.js):
 *
 *    mountFreecamTick({ get, actions })
 *      tick(dt, { buildMode, speed, speedFast, keys }) {
 *        if (!buildMode) return;
 *        const spd = keys.ShiftLeft ? speedFast : speed;
 *        const fwd = (sin(yaw)*cos(pitch), sin(pitch), cos(yaw)*cos(pitch));
 *        const rgt = (cos(yaw), 0, -sin(yaw));
 *        keys.W → move +fwd*spd*dt; KeyS → -fwd
 *        keys.A → move -rgt*spd*dt; KeyD → +rgt
 *        keys.Space → moveY +spd*dt; KeyC → -spd*dt
 *      }
 *
 *  Native version:
 *    - Active only when hero.inventory.build_mode === true (otherwise
 *      no-op, matching the legacy gate).
 *    - Yaw/pitch from hero.inventory.{freecam_yaw, freecam_pitch}
 *      (default 0 — no rotation system yet writes these).
 *    - Movement applied to substrate "camera" Thing's position; if no
 *      camera Thing exists yet, the math still runs but the write is
 *      skipped (no silent crash).
 *    - speed + speed_fast from hero-tuning (freecam_speed,
 *      freecam_speed_fast).
 *
 *  Priority 18: runs before all hero-state facets so a freecam-driven
 *  camera move is visible to anything that depends on camera position.
 *
 *  NO hardcoded numbers; no `??` fallbacks. */
export default {
  priority: 18,
  tick(_thing, _data, dt, registry) {
    const tn = readHeroTuning(registry);
    if (!tn) return;

    const heroes = registry.byKind("hero");
    if (heroes.length === 0) return;
    const inv = registry.facetData(heroes[0].id, "inventory");
    if (!inv || inv.build_mode !== true) return;

    const keys = readInputKeys(registry);
    const yaw   = typeof inv.freecam_yaw   === "number" ? inv.freecam_yaw   : 0;
    const pitch = typeof inv.freecam_pitch === "number" ? inv.freecam_pitch : 0;
    const spd = keys.ShiftLeft === true ? tn.freecam_speed_fast : tn.freecam_speed;

    const fwdX = Math.sin(yaw) * Math.cos(pitch);
    const fwdY = Math.sin(pitch);
    const fwdZ = Math.cos(yaw) * Math.cos(pitch);
    const rgtX = Math.cos(yaw);
    const rgtZ = -Math.sin(yaw);

    let dx = 0, dy = 0, dz = 0;
    if (keys.KeyW  === true) { dx += fwdX * spd * dt; dy += fwdY * spd * dt; dz += fwdZ * spd * dt; }
    if (keys.KeyS  === true) { dx -= fwdX * spd * dt; dy -= fwdY * spd * dt; dz -= fwdZ * spd * dt; }
    if (keys.KeyA  === true) { dx -= rgtX * spd * dt;                       dz -= rgtZ * spd * dt; }
    if (keys.KeyD  === true) { dx += rgtX * spd * dt;                       dz += rgtZ * spd * dt; }
    if (keys.Space === true)   dy += spd * dt;
    if (keys.KeyC  === true)   dy -= spd * dt;

    if (dx === 0 && dy === 0 && dz === 0) return;

    const camPos = readCameraPos(registry);
    if (!camPos) return;
    camPos.x += dx;
    camPos.y += dy;
    camPos.z += dz;
  },
};

function readHeroTuning(registry) {
  for (const t of registry.byKind("tuning")) {
    if (t.name !== "hero-tuning") continue;
    const tn = registry.facetData(t.id, "tuning");
    if (!tn) return null;
    if (typeof tn.freecam_speed       !== "number") return null;
    if (typeof tn.freecam_speed_fast  !== "number") return null;
    return tn;
  }
  return null;
}

function readInputKeys(registry) {
  const inputs = registry.byKind("input");
  if (inputs.length === 0) return {};
  const st = registry.facetData(inputs[0].id, "input-state");
  return (st && st.keys) ? st.keys : {};
}

function readCameraPos(registry) {
  const rcs = registry.byKind("render-context");
  if (rcs.length === 0) return null;
  const rc = registry.facetData(rcs[0].id, "render-context");
  if (!rc || !rc.camera || !rc.camera.position) return null;
  return rc.camera.position;
}
