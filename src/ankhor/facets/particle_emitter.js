/** particle-emitter facet — spawn short-lived child Things at random offsets
 *  within a radius, at a probability per tick. Used by smoke hazard-zone
 *  and any future zone that "puffs" things into the world.
 *
 *  Lift-readiness note: this handler calls registry.spawn directly today
 *  — that's mutate+reach. The lift-ready form is `emit: [{spawn: thinga}]`
 *  envelopes returned to the scheduler. Per ACTOR_TRAJECTORY.md 3-strike
 *  rule, this is STRIKE 1/3 — the spawn-as-side-effect pattern.
 *  Note in commit if a future kind makes this two-of-three.
 *
 *  Data: {
 *    particle_kind:        the kind to spawn (e.g. "smoke-particle")
 *    particle_tuning_ref:  tuning_ref to attach to the spawned particle's mesh facet
 *    radius:               horizontal jitter (m)
 *    y_base / y_jitter:    vertical position range
 *    spawn_probability:    chance per tick to emit (0..1)
 *    particle_ttl:         seconds the spawned particle lives
 *    _seq?:                internal counter for unique ids
 *  } */
export default {
  priority: 60,
  tick(thing, data, _dt, registry) {
    if (!data) return;
    if (Math.random() >= data.spawn_probability) return;
    const pos = registry.facetData(thing.id, "position");
    if (!pos) return;
    const seq = (data._seq = (data._seq || 0) + 1);
    const jitterU = (Math.random() - 0.5) * data.radius * 2;
    const jitterV = (Math.random() - 0.5) * data.radius * 2;
    const y = data.y_base + Math.random() * data.y_jitter;
    const spawned = {
      id:   `${data.particle_kind}/${thing.id.replace(/[/]/g, "_")}-${seq}`,
      kind: data.particle_kind,
      name: `${data.particle_kind}_${seq}`,
      facets: [
        { name: "position", data: { x: pos.x + jitterU, y, z: pos.z + jitterV } },
        { name: "mesh",     data: { tuning_ref: data.particle_tuning_ref } },
        { name: "ttl",      data: { remaining: data.particle_ttl } }
      ]
    };
    try { registry.spawn(spawned); }
    catch (e) { console.warn(`[ankhor] particle-emitter spawn ${spawned.id}:`, e.message); }
  }
};
