/** attack-target facet — melee damage delivery on cadence.
 *
 *  When the broadcast hero pose is within `attack_range` (pulled from
 *  the spawn's variant tuning via mesh.tuning_ref), apply `damage` to
 *  the hero Thing's health.hp every `attack_interval` seconds.
 *
 *  Lift-ready per docs/ACTOR_TRAJECTORY.md: builds an explicit
 *  {to, message} damage envelope before delivering (same shape as
 *  kinetic-hit). When the actor lift lands, the deliver becomes an
 *  `emit` and this handler returns the envelope.
 *
 *  Ranged variants (sniper, robot) will get a sibling `ranged-attack`
 *  facet that spawns a bullet instead of applying damage directly —
 *  same envelope shape, different recipient and message kind.
 *
 *  Data: { heroU?, heroV?, damage?, attack_range?, attack_interval?, _next_fire_at? }
 *
 *  heroU/heroV injected each tick by hero-broadcaster. */
export default {
  priority: 34,
  tick(thing, data, _dt, registry) {
    if (!data || data.heroU == null || data.heroV == null) return;
    const pos = registry.facetData(thing.id, "position");
    if (!pos) return;

    const { damage, attack_range, attack_interval } = resolveStats(thing, data, registry);
    if (damage <= 0 || attack_range <= 0 || attack_interval <= 0) return;

    const du = data.heroU - pos.x;
    const dv = data.heroV - pos.z;
    if (du * du + dv * dv > attack_range * attack_range) return;

    const nowSec = Date.now() / 1000;
    if (data._next_fire_at && nowSec < data._next_fire_at) return;
    data._next_fire_at = nowSec + attack_interval;

    const heroes = registry.byKind("hero");
    if (heroes.length === 0) return;
    const hero = heroes[0];

    const envelope = {
      to: hero.id,
      message: { kind: "damage", amount: damage, source: thing.id, at: nowSec },
    };

    const heroHealth = registry.facetData(hero.id, "health");
    if (heroHealth && typeof heroHealth.hp === "number") {
      heroHealth.hp -= envelope.message.amount;
    }

    if (!Array.isArray(data.pending_hits)) data.pending_hits = [];
    data.pending_hits.push(envelope);
  }
};

function resolveStats(thing, data, registry) {
  let damage          = typeof data.damage          === "number" ? data.damage          : null;
  let attack_range    = typeof data.attack_range    === "number" ? data.attack_range    : null;
  let attack_interval = typeof data.attack_interval === "number" ? data.attack_interval : null;
  if (damage != null && attack_range != null && attack_interval != null) {
    return { damage, attack_range, attack_interval };
  }

  const mesh = registry.facetData(thing.id, "mesh");
  if (mesh?.tuning_ref) {
    for (const t of registry.byKind("tuning")) {
      if (t.name !== mesh.tuning_ref) continue;
      const tuning = registry.facetData(t.id, "tuning") || {};
      if (damage          == null && typeof tuning.damage          === "number") damage          = tuning.damage;
      if (attack_range    == null && typeof tuning.attack_range    === "number") attack_range    = tuning.attack_range;
      if (attack_interval == null && typeof tuning.attack_interval === "number") attack_interval = tuning.attack_interval;
      break;
    }
  }
  return { damage: damage ?? 0, attack_range: attack_range ?? 0, attack_interval: attack_interval ?? 0 };
}
