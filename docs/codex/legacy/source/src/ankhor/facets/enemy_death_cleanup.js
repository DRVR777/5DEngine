/** enemy-death-cleanup facet — when this enemy's health.hp drops to or
 *  below 0, despawn the Thing with reason "killed". Sibling facets'
 *  cleanup hooks (notably drop-on-death) get the chance to fire on the
 *  way out. Required on every enemy.
 *
 *  Priority 28: runs after kinetic-hit (45 wait — actually 45 is later;
 *  priority is ascending so 28 < 45, runs BEFORE kinetic-hit). But hp
 *  reduction happens during the previous frame's kinetic-hit tick, so
 *  this frame we see the latest hp.
 *
 *  Lift-ready: despawn IS the effect; no envelope today. After the
 *  actor lift, this returns `emit: [{ to: thing.id, message: { kind:
 *  "despawn", reason: "killed" } }]` and the scheduler handles delivery. */
export default {
  priority: 28,
  tick(thing, _data, _dt, registry) {
    const health = registry.facetData(thing.id, "health");
    if (!health || typeof health.hp !== "number") return;
    if (health.hp > 0) return;
    try { registry.despawn(thing.id, "killed"); }
    catch (e) { console.warn(`[ankhor] enemy-death-cleanup despawn ${thing.id}:`, e.message); }
  }
};
