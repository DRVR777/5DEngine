/** respawn-on-collect facet — permanent infrastructure pickup that hides on
 *  collection and reappears after a cooldown. Used by grenade-crate and any
 *  other persistent supply cache.
 *
 *  Data: { radius, cooldown_seconds, on_pickup_action,
 *          heroU?, heroV?, cooldown_until?, last_collected_at? }
 *
 *  Caller injects heroU/heroV each frame via registry.updateFacet (same
 *  contract as pickup-radius). The Thing is NEVER despawned — only the
 *  mesh's visible flag is toggled. */
export default {
  priority: 41,
  tick(thing, data, _dt, registry) {
    if (!data) return;
    const now = (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;
    const mesh = registry.facetData(thing.id, "mesh");

    if (typeof data.cooldown_until === "number") {
      if (now >= data.cooldown_until) {
        data.cooldown_until = null;
        if (mesh?.threeObj) mesh.threeObj.visible = true;
      }
      return;
    }

    if (data.heroU == null || data.heroV == null) return;
    const pos = registry.facetData(thing.id, "position");
    if (!pos) return;
    const du = data.heroU - pos.x;
    const dv = data.heroV - pos.z;
    if (du * du + dv * dv < data.radius * data.radius) {
      data.cooldown_until    = now + data.cooldown_seconds;
      data.last_collected_at = now;
      if (mesh?.threeObj) mesh.threeObj.visible = false;
    }
  }
};
