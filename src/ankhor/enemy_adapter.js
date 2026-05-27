/**
 * Enemy Render Adapter — updates enemy mesh positions from AI scaffold.
 * The enemy_ai_scaffold facet mutates en.u/en.v directly.
 * This adapter syncs those to the Three.js mesh positions.
 */

export function enemyRenderAdapter(scene, registry, dt) {
  const enemies = registry.byKind?.("enemy") || [];
  for (const en of enemies) {
    const fd = registry.facetData(en.id, "mesh");
    if (!fd?.threeObj) continue;

    // Read position from AI scaffold's direct mutations
    const u = en._u ?? en.u ?? 0;
    const v = en._v ?? en.v ?? 0;
    const y = en._y ?? en.y ?? 0;

    fd.threeObj.position.set(u, y, v);

    // Update heading
    if (typeof en.heading === "number") {
      fd.threeObj.rotation.y = en.heading;
    }
  }
}
