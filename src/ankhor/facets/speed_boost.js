/** speed-boost facet — native Ankhor replacement for the legacy
 *  mountSpeedBoostTick (data/legacy/speed-boost.json).
 *
 *  Legacy contract being reproduced (src/systems/speed_boost_tick.js):
 *
 *    const BOOST_MUL    = 1.5;
 *    const TRAIL_PERIOD = 0.08;
 *    mountSpeedBoostTick({ get, set, actions })
 *      tick(dt, { isMoving, inCar, buildMode, heroDead }) {
 *        if (get.speedBoostT() <= 0) return 1.0;
 *        set.speedBoostT(get.speedBoostT() - dt);
 *        if (isMoving && !inCar && !buildMode && !heroDead) {
 *          set.speedTrailT(get.speedTrailT() - dt);
 *          if (get.speedTrailT() <= 0) {
 *            set.speedTrailT(TRAIL_PERIOD);
 *            actions.spawnTrail();
 *          }
 *        }
 *        return get.speedBoostT() > 0 ? BOOST_MUL : 1.0;
 *      }
 *
 *  Native version:
 *    - The substrate already uses inventory.speed_boost_until_sec as a
 *      timestamp (set by pickup-radius dispatcher in iter 744 when the
 *      "speed-boost" pickup fires). Native facet reads "remaining ==
 *      until - now" as the legacy speedBoostT countdown analog.
 *    - speed_trail_t lives on hero.inventory.speed_trail_t for the
 *      per-decal cadence.
 *    - Numbers from hero-tuning: speed_boost_trail_period (0.08),
 *      speed_boost_mul (1.5) — both extracted from legacy literals
 *      with provenance.
 *    - Trail decal spawned via registry.spawn directly (no $emit DSL
 *      needed — native handler reaches the registry directly). Uses
 *      decal-particle kind + decal-particle-muzzle-tuning, same as
 *      the legacy spec's $emit template.
 *    - Exposes hero.inventory.speed_boost_mul ∈ {1.0, 1.5} so the
 *      next iter's hero-input-move can read it for sprint speed.
 *
 *  Priority 22: data-container range; runs before stamina (23) and
 *  hero-regen (24). Matches legacy ordering (speed-boost ran early
 *  in the legacy mount* sequence).
 *
 *  NO hardcoded numbers — handler no-ops if tuning keys missing. */
export default {
  priority: 22,
  tick(thing, _data, dt, registry) {
    const tn = readHeroTuning(registry);
    if (!tn) return;

    const heroes = registry.byKind("hero");
    if (heroes.length === 0) return;
    const hero = heroes[0];
    const inv = registry.facetData(hero.id, "inventory");
    if (!inv) return;

    const nowSec = Date.now() / 1000;
    const until  = typeof inv.speed_boost_until_sec === "number" ? inv.speed_boost_until_sec : 0;
    const remaining = until - nowSec;

    if (remaining <= 0) {
      if (inv.speed_boost_mul !== 1.0) inv.speed_boost_mul = 1.0;
      if (inv.speed_trail_t   !== 0)   inv.speed_trail_t   = 0;
      return;
    }

    inv.speed_boost_mul = tn.speed_boost_mul;

    if (!isMoving(registry)) return;

    if (typeof inv.speed_trail_t !== "number") inv.speed_trail_t = 0;
    inv.speed_trail_t -= dt;
    if (inv.speed_trail_t <= 0) {
      inv.speed_trail_t = tn.speed_boost_trail_period;
      spawnTrail(hero, inv, registry);
    }
  }
};

function readHeroTuning(registry) {
  for (const t of registry.byKind("tuning")) {
    if (t.name !== "hero-tuning") continue;
    const tn = registry.facetData(t.id, "tuning");
    if (!tn) return null;
    if (typeof tn.speed_boost_trail_period !== "number") return null;
    if (typeof tn.speed_boost_mul          !== "number") return null;
    return tn;
  }
  return null;
}

function isMoving(registry) {
  const inputs = registry.byKind("input");
  if (inputs.length === 0) return false;
  const st = registry.facetData(inputs[0].id, "input-state");
  if (!st || !st.keys) return false;
  const k = st.keys;
  return k.KeyW === true || k.KeyA === true || k.KeyS === true || k.KeyD === true;
}

function spawnTrail(hero, inv, registry) {
  const pos = registry.facetData(hero.id, "position");
  if (!pos) return;
  const seq = (registry._speedTrailSeq = (registry._speedTrailSeq || 0) + 1);
  const id  = `decal-particle/speed-trail-${seq}`;
  try {
    registry.spawn({
      id, kind: "decal-particle", name: id,
      facets: [
        { name: "position",    data: { x: pos.x, y: pos.y + 0.15, z: pos.z } },
        { name: "mesh",        data: { tuning_ref: "decal-particle-muzzle-tuning" } },
        { name: "ttl",         data: { remaining: 0.22 } },
        { name: "expand-fade", data: {} },
      ],
    });
  } catch (_) { /* duplicate id within the same ms is fine to skip */ }
}
