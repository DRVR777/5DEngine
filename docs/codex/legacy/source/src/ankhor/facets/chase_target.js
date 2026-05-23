/** chase-target facet — move this Thing's position toward (heroU, heroV)
 *  at a per-tick velocity, while hero is within sight range.
 *
 *  Lift-ready per docs/ACTOR_TRAJECTORY.md: builds the new position as a
 *  local pair (newX, newZ) before assigning. When the actor lift lands,
 *  the assignment becomes `patch: { x: newX, z: newZ }` returned to the
 *  scheduler. Same runtime today.
 *
 *  Speed + sight pulled from the Thing's variant tuning Thinga (via the
 *  spawn's mesh.tuning_ref) — keeps the per-variant numbers in tuning,
 *  not in the spawn or in handler code. Falls back to data.speed /
 *  data.sight_range if explicit.
 *
 *  Data: { speed?, sight_range?, heroU?, heroV?, _arrived? }
 *
 *  heroU/heroV are injected each frame by hero-broadcaster. */
export default {
  priority: 32,
  tick(thing, data, dt, registry) {
    if (!data || data._arrived) return;
    if (data.heroU == null || data.heroV == null) return;
    const pos = registry.facetData(thing.id, "position");
    if (!pos) return;

    const { speed, sight_range } = resolveStats(thing, data, registry);
    const du = data.heroU - pos.x;
    const dv = data.heroV - pos.z;
    const dist = Math.hypot(du, dv);
    if (dist > sight_range) return;
    if (dist < 0.01) { data._arrived = true; return; }

    const step = Math.min(dist, speed * dt);
    const newX = pos.x + (du / dist) * step;
    const newZ = pos.z + (dv / dist) * step;
    pos.x = newX;
    pos.z = newZ;
    pos.heading = Math.atan2(du, dv);
  }
};

/** Pull move_speed + sight_range from the spawn's variant tuning Thinga
 *  (looked up via the mesh facet's tuning_ref). Explicit data overrides
 *  always win. */
function resolveStats(thing, data, registry) {
  let speed       = typeof data.speed       === "number" ? data.speed       : null;
  let sight_range = typeof data.sight_range === "number" ? data.sight_range : null;
  if (speed != null && sight_range != null) return { speed, sight_range };

  const mesh = registry.facetData(thing.id, "mesh");
  if (mesh?.tuning_ref) {
    for (const t of registry.byKind("tuning")) {
      if (t.name !== mesh.tuning_ref) continue;
      const tuning = registry.facetData(t.id, "tuning") || {};
      if (speed       == null && typeof tuning.move_speed  === "number") speed       = tuning.move_speed;
      if (sight_range == null && typeof tuning.sight_range === "number") sight_range = tuning.sight_range;
      break;
    }
  }
  return { speed: speed ?? 0, sight_range: sight_range ?? 0 };
}
