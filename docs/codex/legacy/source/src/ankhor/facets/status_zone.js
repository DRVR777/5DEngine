/** status-zone facet — periodically apply a named status (poisoned, burning,
 *  blinded, etc.) to the hero while inside a radius. Pure detection + recording;
 *  a future hero-state system consumes data.pending_statuses.
 *
 *  Data: { radius, status_name, interval_seconds, heroU?, heroV?,
 *          _next_apply_at?, pending_statuses? } */
export default {
  priority: 43,
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
      if (!Array.isArray(data.pending_statuses)) data.pending_statuses = [];
      data.pending_statuses.push({ name: data.status_name, at: now });
      data._next_apply_at = now + data.interval_seconds;
    }
  }
};
