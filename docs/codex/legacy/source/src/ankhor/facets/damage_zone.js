/** damage-zone facet — periodic damage to anything (hero/enemy/barrel) inside
 *  a radius. Records hits in data.pending_hits; a future combat system reads
 *  and applies them. The facet is pure detection + interval gating.
 *
 *  Data: { radius, damage, interval_seconds, heroU?, heroV?, _next_apply_at?,
 *          pending_hits?, also_apply_status? }
 *
 *  Caller injects heroU/heroV each frame. Enemy/barrel targets attach to
 *  the data.pending_hits list as the combat system grows. */
export default {
  priority: 42,
  tick(thing, data, _dt, registry) {
    if (!data) return;
    const now = (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;
    if (typeof data._next_apply_at === "number" && now < data._next_apply_at) return;
    if (data.heroU == null || data.heroV == null) return;
    const pos = registry.facetData(thing.id, "position");
    if (!pos) return;
    const du = data.heroU - pos.x;
    const dv = data.heroV - pos.z;
    if (du * du + dv * dv < data.radius * data.radius) {
      if (!Array.isArray(data.pending_hits)) data.pending_hits = [];
      data.pending_hits.push({ target: "hero", damage: data.damage, at: now, status: data.also_apply_status });
      data._next_apply_at = now + data.interval_seconds;
    }
  }
};
