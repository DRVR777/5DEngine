/** jump-gravity facet — native Ankhor replacement for the legacy
 *  mountJumpGravityTick (data/legacy/jump-gravity.json).
 *
 *  Legacy contract (src/systems/jump_gravity_tick.js):
 *
 *    tick(dt, { spaceDown, buildMode }) {
 *      if (buildMode) return { onGround: false };
 *      pos = actions.getPos();
 *      support = actions.getSupport(pos.u, pos.v, pos.y);
 *      onSupport = pos.y <= support.topY + 0.001;
 *      spaceRising = spaceDown && !spaceWasDown;
 *      if (spaceDown && onSupport) {
 *        velocityY = jumpV; canDoubleJump = true;
 *      } else if (spaceRising && !onSupport && canDoubleJump
 *                 && stamina >= 20 && !heroDead) {
 *        velocityY = jumpV * 0.85; canDoubleJump = false;
 *        stamina -= 20; spawnDoubleJumpFx(pos.u, pos.y, pos.v);
 *      }
 *      spaceWasDown = spaceDown;
 *      velocityY += gravity * dt;
 *      newY = pos.y + velocityY * dt;
 *      supportAfter = actions.getSupport(...);
 *      if (newY < supportAfter.topY) {
 *        impact = velocityY; newY = topY; velocityY = 0;
 *        onGround = true; actions.onLand(impact);
 *      }
 *      if (newY < 0) { newY = 0; velocityY = 0; onGround = true; }
 *      actions.setPos(pos.x, newY, pos.z, pos.u, pos.v);
 *    }
 *
 *  Native version:
 *    - State on hero.inventory: velocity_y, can_double_jump,
 *      space_was_down. on_ground exposed back on inv for downstream
 *      facets (footstep-sound, etc.).
 *    - hero.position.y is the substrate's altitude (3D world); no
 *      u/v slice yet, so support is just the ground plane at
 *      tuning.jump_ground_y. Boundary/structure support arrives when
 *      buildings + topology facets exist.
 *    - Reads input Space key from input-state, build_mode + hero_dead
 *      + stamina from hero.inventory.
 *    - Tuning: jump_v, jump_gravity, double_jump_v_mul,
 *      double_jump_stamina_cost, jump_ground_y, jump_support_epsilon,
 *      double_jump_fx_ttl.
 *    - Double-jump FX spawned as a decal-particle via direct
 *      registry.spawn — same payload as the legacy spec's $emit
 *      template (decal-particle-impact-tuning + expand-fade).
 *
 *  Priority 16: runs before layer-transition (17) so the new y is
 *  visible to anything that reacts to falling/landing this frame.
 *
 *  NO hardcoded numbers; no `??` fallbacks. */
export default {
  priority: 16,
  tick(_thing, _data, dt, registry) {
    const tn = readHeroTuning(registry);
    if (!tn) return;

    const heroes = registry.byKind("hero");
    if (heroes.length === 0) return;
    const hero = heroes[0];
    const inv = registry.facetData(hero.id, "inventory");
    const pos = registry.facetData(hero.id, "position");
    if (!inv || !pos) return;

    if (typeof inv.velocity_y      !== "number")  inv.velocity_y      = 0;
    if (typeof inv.can_double_jump !== "boolean") inv.can_double_jump = false;
    if (typeof inv.space_was_down  !== "boolean") inv.space_was_down  = false;
    if (typeof inv.stamina         !== "number")  inv.stamina         = 0;

    if (inv.build_mode === true) {
      inv.on_ground = false;
      return;
    }

    const keys      = readInputKeys(registry);
    const spaceDown = keys.Space === true;
    const heroDead  = inv.hero_dead === true;

    const topY      = tn.jump_ground_y;
    const onSupport = pos.y <= topY + tn.jump_support_epsilon;
    let onGround    = onSupport;

    const spaceRising = spaceDown && !inv.space_was_down;

    if (spaceDown && onSupport) {
      inv.velocity_y      = tn.jump_v;
      inv.can_double_jump = true;
    } else if (spaceRising && !onSupport && inv.can_double_jump
               && inv.stamina >= tn.double_jump_stamina_cost && !heroDead) {
      inv.velocity_y      = tn.jump_v * tn.double_jump_v_mul;
      inv.can_double_jump = false;
      inv.stamina         = Math.max(0, inv.stamina - tn.double_jump_stamina_cost);
      spawnDoubleJumpFx(pos, registry, tn);
    }

    inv.space_was_down = spaceDown;
    inv.velocity_y    += tn.jump_gravity * dt;

    let newY = pos.y + inv.velocity_y * dt;
    if (newY < topY) {
      newY           = topY;
      inv.velocity_y = 0;
      onGround       = true;
    }
    if (newY < 0) {
      newY           = 0;
      inv.velocity_y = 0;
      onGround       = true;
    }

    pos.y = newY;
    inv.on_ground = onGround;
  },
};

function readHeroTuning(registry) {
  for (const t of registry.byKind("tuning")) {
    if (t.name !== "hero-tuning") continue;
    const tn = registry.facetData(t.id, "tuning");
    if (!tn) return null;
    if (typeof tn.jump_v                    !== "number") return null;
    if (typeof tn.jump_gravity              !== "number") return null;
    if (typeof tn.double_jump_v_mul         !== "number") return null;
    if (typeof tn.double_jump_stamina_cost  !== "number") return null;
    if (typeof tn.jump_ground_y             !== "number") return null;
    if (typeof tn.jump_support_epsilon      !== "number") return null;
    if (typeof tn.double_jump_fx_ttl        !== "number") return null;
    return tn;
  }
  return null;
}

function readInputKeys(registry) {
  const inputs = registry.byKind("input");
  if (inputs.length === 0) return {};
  const st = registry.facetData(inputs[0].id, "input-state");
  return (st && st.keys) ? st.keys : {};
}

function spawnDoubleJumpFx(pos, registry, tn) {
  const seq = (registry._doubleJumpFxSeq = (registry._doubleJumpFxSeq || 0) + 1);
  const id  = `decal-particle/dj-fx-${seq}`;
  try {
    registry.spawn({
      id, kind: "decal-particle", name: id,
      facets: [
        { name: "position",    data: { x: pos.x, y: pos.y, z: pos.z } },
        { name: "mesh",        data: { tuning_ref: "decal-particle-impact-tuning" } },
        { name: "ttl",         data: { remaining: tn.double_jump_fx_ttl } },
        { name: "expand-fade", data: {} },
      ],
    });
  } catch (_) { /* duplicate within same ms ok */ }
}
