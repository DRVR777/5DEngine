/** footstep-sound facet - native Ankhor replacement for mountFootstepSound.
 *
 * State lives on hero.inventory.footstepT. The substrate does not have a
 * native audio sink yet, so the legacy playSfx action is represented as
 * hero.inventory.lastFootstepSfx.
 */
export default {
  priority: 20,
  tick(thing, _data, dt, registry) {
    const tn = readHeroTuning(registry);
    if (!tn) return;

    const hero = thing.kind === "hero" ? thing : registry.byKind("hero")[0];
    if (!hero) return;
    const inv = registry.facetData(hero.id, "inventory");
    if (!inv) return;
    if (typeof inv.footstepT !== "number") inv.footstepT = 0;

    const input = readInput(registry);
    const isMoving = input.keys.KeyW === true || input.keys.KeyA === true || input.keys.KeyS === true || input.keys.KeyD === true;
    const canSprint = input.keys.ShiftLeft === true;
    const crouching = input.keys.ControlLeft === true || input.keys.ControlRight === true;
    const pointerLocked = typeof document !== "undefined" && !!document.pointerLockElement;
    const onGround = inv.onGround !== false;

    if (isMoving && inv.heroDead !== true && pointerLocked && onGround) {
      const next = inv.footstepT - dt;
      inv.footstepT = next;
      if (next <= 0) {
        const interval = canSprint
          ? tn.footstep_interval_sprint
          : (crouching ? tn.footstep_interval_crouch : tn.footstep_interval_walk);
        inv.footstepT = interval;
        const freq = tn.footstep_freq_base + Math.random() * tn.footstep_freq_jitter;
        inv.lastFootstepSfx = {
          id: `tone:${Math.round(freq)}:30:triangle`,
          volume: tn.footstep_sfx_volume,
        };
      }
    } else {
      inv.footstepT = 0;
    }
  }
};

function readHeroTuning(registry) {
  for (const t of registry.byKind("tuning")) {
    if (t.name !== "hero-tuning") continue;
    const tn = registry.facetData(t.id, "tuning");
    if (!tn) return null;
    if (typeof tn.footstep_interval_sprint !== "number") return null;
    if (typeof tn.footstep_interval_walk !== "number") return null;
    if (typeof tn.footstep_interval_crouch !== "number") return null;
    if (typeof tn.footstep_freq_base !== "number") return null;
    if (typeof tn.footstep_freq_jitter !== "number") return null;
    if (typeof tn.footstep_sfx_volume !== "number") return null;
    return tn;
  }
  return null;
}

function readInput(registry) {
  const input = registry.byKind("input")[0];
  const st = input ? registry.facetData(input.id, "input-state") : null;
  return { keys: st?.keys || {} };
}
