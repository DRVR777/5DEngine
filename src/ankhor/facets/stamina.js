/** stamina facet — native Ankhor replacement for the legacy
 *  mountStaminaTick (data/legacy/stamina.json).
 *
 *  Legacy contract being reproduced (src/systems/stamina_tick.js):
 *
 *    mountStaminaTick({ STAMINA_DRAIN, STAMINA_REGEN, STAMINA_MAX,
 *                       STAMINA_LOCKOUT, get, set })
 *      tick(dt, { wantsSprint, isSprinting, inputMoving }) {
 *        if (get.heroEmpT() > 0) set.heroEmpT(get.heroEmpT() - dt);
 *        const canSprint = wantsSprint
 *           && get.stamina() >= (isSprinting ? 1 : STAMINA_LOCKOUT)
 *           && get.heroEmpT() <= 0;
 *        if (canSprint && inputMoving) {
 *          set.stamina(Math.max(0, get.stamina() - STAMINA_DRAIN * dt));
 *        } else if (!wantsSprint || get.stamina() <= 0) {
 *          set.stamina(Math.min(STAMINA_MAX + get.heroExtraStaminaMax(),
 *                               get.stamina() + STAMINA_REGEN * dt));
 *        }
 *        return canSprint;
 *      }
 *
 *  Native version:
 *    - State lives on hero.inventory.stamina + hero.inventory.heroEmpT
 *      (lifted from data/legacy/stamina.json's _stamina + _heroEmpT
 *      scratch into proper hero inventory fields, accessible to other
 *      facets — e.g., hero-input-move can read inventory.canSprint
 *      next iter).
 *    - Numbers from hero-tuning (stamina_max/drain/regen/lockout).
 *    - Input from byKind("input")[0].input-state:
 *        wantsSprint  = keys.ShiftLeft
 *        isSprinting  = same (legacy treats both equivalently in tick body)
 *        inputMoving  = any of W/A/S/D held
 *    - heroExtraStaminaMax + perk bonus from hero.inventory.perks.stamina_bonus
 *      (default 0 — perk system not in substrate yet).
 *    - canSprint exposed back on hero.inventory.canSprint so other
 *      facets can read it without re-doing the calculation.
 *
 *  Priority 23: data-container range, before combat (kinetic-hit 45)
 *  and before HUD (95). Matches legacy ordering.
 *
 *  NO hardcoded numbers — handler no-ops if any tuning key missing. */
export default {
  priority: 23,
  tick(thing, _data, dt, registry) {
    const tn = readHeroTuning(registry);
    if (!tn) return;

    const heroes = registry.byKind("hero");
    if (heroes.length === 0) return;
    const hero = heroes[0];
    const inv = registry.facetData(hero.id, "inventory");
    if (!inv) return;

    // Initialise scratch fields on first tick.
    if (typeof inv.stamina   !== "number") inv.stamina   = tn.stamina_max;
    if (typeof inv.heroEmpT  !== "number") inv.heroEmpT  = 0;

    // EMP timer countdown.
    if (inv.heroEmpT > 0) inv.heroEmpT = Math.max(0, inv.heroEmpT - dt);

    const { wantsSprint, isSprinting, inputMoving } = readInputs(registry);
    const extraMax = readHeroPerkBonus(inv, "stamina_max_bonus");
    const totalMax = tn.stamina_max + extraMax;

    const threshold = isSprinting ? 1 : tn.stamina_lockout;
    const canSprint = wantsSprint && inv.stamina >= threshold && inv.heroEmpT <= 0;

    if (canSprint && inputMoving) {
      inv.stamina = Math.max(0, inv.stamina - tn.stamina_drain * dt);
    } else if (!wantsSprint || inv.stamina <= 0) {
      inv.stamina = Math.min(totalMax, inv.stamina + tn.stamina_regen * dt);
    }

    // Expose canSprint for other facets (movement multiplier, HUD).
    inv.canSprint = canSprint;
  }
};

function readHeroTuning(registry) {
  for (const t of registry.byKind("tuning")) {
    if (t.name !== "hero-tuning") continue;
    const tn = registry.facetData(t.id, "tuning");
    if (!tn) return null;
    if (typeof tn.stamina_max     !== "number") return null;
    if (typeof tn.stamina_drain   !== "number") return null;
    if (typeof tn.stamina_regen   !== "number") return null;
    if (typeof tn.stamina_lockout !== "number") return null;
    return tn;
  }
  return null;
}

function readInputs(registry) {
  const inputs = registry.byKind("input");
  if (inputs.length === 0) return { wantsSprint: false, isSprinting: false, inputMoving: false };
  const st = registry.facetData(inputs[0].id, "input-state");
  if (!st || !st.keys) return { wantsSprint: false, isSprinting: false, inputMoving: false };
  const k = st.keys;
  const sprint = k.ShiftLeft === true;
  const moving = k.KeyW === true || k.KeyA === true || k.KeyS === true || k.KeyD === true;
  return { wantsSprint: sprint, isSprinting: sprint, inputMoving: moving };
}

function readHeroPerkBonus(inv, key) {
  if (!inv.perks || typeof inv.perks !== "object") return 0;
  return typeof inv.perks[key] === "number" ? inv.perks[key] : 0;
}
