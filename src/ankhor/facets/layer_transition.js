/** layer-transition facet — native Ankhor replacement for the legacy
 *  mountLayerTransitionTick (data/legacy/layer-transition.json).
 *
 *  Legacy contract (src/systems/layer_transition_tick.js):
 *
 *    mountLayerTransitionTick({ get, actions })
 *      tick(dt, { heroU, heroV, buildings }) {
 *        const insideNow = actions.boundaryAt(heroU, heroV, buildings);
 *        const targetLayer = insideNow ? insideNow.targetLayerId : 1;
 *        if (targetLayer !== get.layerId()) {
 *          actions.logTransition(get.layerId(), targetLayer);
 *          actions.showToast(...); actions.playSfx(...);
 *        }
 *        return { insideNow };
 *      }
 *
 *  Native version:
 *    - State on hero.inventory.layer_id (default 1, the "outside" layer).
 *    - Reads hero.position.x/z (legacy u/v → substrate world coords).
 *    - Reads building Thingas by kind "building" (none exist yet);
 *      each building exposes a boundary facet with bounding rectangle
 *      + targetLayerId. When no boundary contains hero, target=1.
 *    - When target changes, writes new layer_id; toast/sfx/log are
 *      stubbed (no UI/SFX subsystem yet — match legacy bridge's
 *      $log:[layer ...] no-side-effects discipline).
 *
 *  Priority 17: runs before freecam (18) so a layer change is visible
 *  to camera-positioning facets the same frame.
 *
 *  NO hardcoded numbers; no `??` fallbacks. */
const OUTSIDE_LAYER = 1;

export default {
  priority: 17,
  tick(_thing, _data, _dt, registry) {
    const heroes = registry.byKind("hero");
    if (heroes.length === 0) return;
    const hero = heroes[0];
    const inv = registry.facetData(hero.id, "inventory");
    const pos = registry.facetData(hero.id, "position");
    if (!inv || !pos) return;

    if (typeof inv.layer_id !== "number") inv.layer_id = OUTSIDE_LAYER;

    const insideNow = findBoundary(pos.x, pos.z, registry);
    const targetLayer = insideNow ? insideNow.targetLayerId : OUTSIDE_LAYER;

    if (targetLayer !== inv.layer_id) {
      inv.layer_id = targetLayer;
    }
  },
};

function findBoundary(heroX, heroZ, registry) {
  // Use byFacet so this works even before a "building" kind is registered:
  // any Thinga that carries a "boundary" facet contributes its rectangle.
  const ids = registry.byFacet("boundary");
  for (const id of ids) {
    const boundary = registry.facetData(id, "boundary");
    if (!boundary) continue;
    if (heroX >= boundary.minX && heroX <= boundary.maxX
     && heroZ >= boundary.minZ && heroZ <= boundary.maxZ) {
      return { targetLayerId: boundary.targetLayerId };
    }
  }
  return null;
}
