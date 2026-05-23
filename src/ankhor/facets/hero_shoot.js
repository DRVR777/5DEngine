/** hero-shoot facet — left-mouse-down spawns hero bullets at cadence,
 *  travelling in the camera's facing direction from a muzzle offset
 *  in front of the hero.
 *
 *  Lift-ready per docs/ACTOR_TRAJECTORY.md: builds the spawn `envelope`
 *  as a local before delivering via registry.spawn. After the actor
 *  lift, the assignment becomes `emit: [envelope]` returned to the
 *  scheduler.
 *
 *  This is the **second spawn-envelope handler** (particle-emitter
 *  iter 736 was the first). STRIKE 2/3 toward the actor lift — when
 *  the third handler needs the same `{to, message: {kind:"spawn"}}`
 *  pattern, do the lift.
 *
 *  Data: { _next_fire_at? } — everything else from input + tuning. */
export default {
  priority: 12,
  tick(thing, data, _dt, registry) {
    const inputs = registry.byKind("input");
    if (inputs.length === 0) return;
    const input = registry.facetData(inputs[0].id, "input-state");
    if (!input || !input.mouseHeld) return;

    const pos = registry.facetData(thing.id, "position");
    if (!pos) return;

    const tuning = resolveHeroTuning(registry);
    if (tuning.fire_interval <= 0 || tuning.bullet_speed <= 0) return;

    const nowSec = Date.now() / 1000;
    if (data._next_fire_at && nowSec < data._next_fire_at) return;
    data._next_fire_at = nowSec + tuning.fire_interval;

    const yaw = input.yaw || 0;
    const fwdX = -Math.sin(yaw);
    const fwdZ = -Math.cos(yaw);

    const seq = (data._seq = (data._seq || 0) + 1);
    const envelope = {
      to: `bullet/hero-${thing.id.replace(/[/]/g, "_")}-${seq}`,
      message: {
        kind: "spawn",
        facets: [
          { name: "position", data: {
            x: pos.x + fwdX * tuning.muzzle_forward,
            y: pos.y + tuning.muzzle_up,
            z: pos.z + fwdZ * tuning.muzzle_forward,
            velocity: { x: fwdX * tuning.bullet_speed, y: 0, z: fwdZ * tuning.bullet_speed },
          }},
          { name: "mesh",        data: { tuning_ref: "bullet-hero-tuning" } },
          { name: "ttl",         data: { remaining: tuning.bullet_ttl } },
          { name: "kinetic-hit", data: { radius: tuning.bullet_hit_radius, damage: tuning.bullet_damage,
                                         target_kind: "enemy", despawn_on_hit: true } },
        ],
      },
    };

    try {
      registry.spawn({ id: envelope.to, kind: "bullet", name: envelope.to, facets: envelope.message.facets });
    } catch (e) {
      console.warn(`[ankhor] hero-shoot spawn ${envelope.to}:`, e.message);
    }
  }
};

function resolveHeroTuning(registry) {
  const empty = { fire_interval: 0, bullet_speed: 0, bullet_damage: 0,
                  bullet_ttl: 0, bullet_hit_radius: 0,
                  muzzle_forward: 0, muzzle_up: 0 };
  for (const t of registry.byKind("tuning")) {
    if (t.name !== "hero-tuning") continue;
    const tn = registry.facetData(t.id, "tuning");
    if (!tn) return empty;
    const out = { ...empty };
    if (typeof tn.hero_fire_interval     === "number") out.fire_interval     = tn.hero_fire_interval;
    if (typeof tn.hero_bullet_speed      === "number") out.bullet_speed      = tn.hero_bullet_speed;
    if (typeof tn.hero_bullet_damage     === "number") out.bullet_damage     = tn.hero_bullet_damage;
    if (typeof tn.hero_bullet_ttl        === "number") out.bullet_ttl        = tn.hero_bullet_ttl;
    if (typeof tn.hero_bullet_hit_radius === "number") out.bullet_hit_radius = tn.hero_bullet_hit_radius;
    if (typeof tn.hero_muzzle_forward    === "number") out.muzzle_forward    = tn.hero_muzzle_forward;
    if (typeof tn.hero_muzzle_up         === "number") out.muzzle_up         = tn.hero_muzzle_up;
    return out;
  }
  return empty;
}
