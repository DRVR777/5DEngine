/** cam-pitch-springs facet — native Ankhor replacement for the
 *  legacy mountCamPitchSprings (data/legacy/cam-pitch-springs.json).
 *
 *  Legacy contract (src/systems/cam_pitch_springs.js):
 *
 *    mountCamPitchSprings({ camPitchMax, get, set })
 *      tick(dt) {
 *        if (recoilPitch !== 0) {
 *          camPitch += recoilPitch * dt * 8
 *          next = recoilPitch + (0 - recoilPitch) * min(1, dt*8)
 *          recoilPitch = |next| < 0.0001 ? 0 : next
 *        }
 *        if (hitPunchPitch > 0.0001) {
 *          camPitch = min(camPitchMax, camPitch + hitPunchPitch * dt * 10)
 *          decayed = hitPunchPitch * exp(-dt * 14)
 *          hitPunchPitch = decayed < 0.0001 ? 0 : decayed
 *        }
 *      }
 *
 *  Native version:
 *    - State on hero.inventory: cam_pitch, recoil_pitch, hit_punch_pitch.
 *      Until a recoil-producing facet writes recoil_pitch / hit_punch_pitch,
 *      both stay 0 and the tick is a clean no-op.
 *    - Constants from hero-tuning:
 *        cam_pitch_max (0.4), cam_recoil_spring_rate (8),
 *        cam_recoil_zero_threshold (0.0001),
 *        cam_hitpunch_spring_rate (10), cam_hitpunch_decay_rate (14).
 *
 *  Priority 21: data-container slot; runs before stamina (23) and
 *  hero-regen (24) — matches legacy ordering of camera-springs early
 *  in the mount* sequence.
 *
 *  NO hardcoded numbers; no `??` fallbacks — handler no-ops if any
 *  tuning key is missing. */
export default {
  priority: 21,
  tick(_thing, _data, dt, registry) {
    const tn = readHeroTuning(registry);
    if (!tn) return;

    const heroes = registry.byKind("hero");
    if (heroes.length === 0) return;
    const inv = registry.facetData(heroes[0].id, "inventory");
    if (!inv) return;

    if (typeof inv.cam_pitch       !== "number") inv.cam_pitch       = 0;
    if (typeof inv.recoil_pitch    !== "number") inv.recoil_pitch    = 0;
    if (typeof inv.hit_punch_pitch !== "number") inv.hit_punch_pitch = 0;

    if (inv.recoil_pitch !== 0) {
      inv.cam_pitch += inv.recoil_pitch * dt * tn.cam_recoil_spring_rate;
      const next = inv.recoil_pitch + (0 - inv.recoil_pitch) * Math.min(1, dt * tn.cam_recoil_spring_rate);
      inv.recoil_pitch = Math.abs(next) < tn.cam_recoil_zero_threshold ? 0 : next;
    }

    if (inv.hit_punch_pitch > tn.cam_recoil_zero_threshold) {
      inv.cam_pitch = Math.min(
        tn.cam_pitch_max,
        inv.cam_pitch + inv.hit_punch_pitch * dt * tn.cam_hitpunch_spring_rate,
      );
      const decayed = inv.hit_punch_pitch * Math.exp(-dt * tn.cam_hitpunch_decay_rate);
      inv.hit_punch_pitch = decayed < tn.cam_recoil_zero_threshold ? 0 : decayed;
    }
  },
};

function readHeroTuning(registry) {
  for (const t of registry.byKind("tuning")) {
    if (t.name !== "hero-tuning") continue;
    const tn = registry.facetData(t.id, "tuning");
    if (!tn) return null;
    if (typeof tn.cam_pitch_max               !== "number") return null;
    if (typeof tn.cam_recoil_spring_rate      !== "number") return null;
    if (typeof tn.cam_recoil_zero_threshold   !== "number") return null;
    if (typeof tn.cam_hitpunch_spring_rate    !== "number") return null;
    if (typeof tn.cam_hitpunch_decay_rate     !== "number") return null;
    return tn;
  }
  return null;
}
