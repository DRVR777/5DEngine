/** health-display facet — floating HP bar above a Thing. Creates a
 *  small plane in the scene on first tick (lazy install — render-context
 *  may not exist at facet init time), updates position + width each
 *  tick from the host's health facet, removes the plane on cleanup.
 *
 *  Plane is camera-billboarded each tick (face the camera around Y so
 *  the bar always reads correctly from a third-person POV).
 *
 *  Height offset is per-host: pulled from the variant tuning's
 *  body_height (+ a small padding constant from hud-default-tuning).
 *
 *  Priority 65: after combat (kinetic-hit 45, enemy-death-cleanup 28)
 *  so a freshly-killed enemy doesn't render a bar this frame, but
 *  before hud (95) so the bar is positioned for the same frame.
 *
 *  Data: { _plane?, _mat?, _geom? } */
const HUD_TUNING = "hud-default-tuning";

export default {
  priority: 65,
  tick(thing, data, _dt, registry) {
    if (!data) return;
    const ctxThing = registry.byKind("render-context")[0];
    if (!ctxThing) return;
    const ctx = registry.facetData(ctxThing.id, "render-context");
    if (!ctx || !ctx.THREE || !ctx.scene) return;

    const health = registry.facetData(thing.id, "health");
    if (!health || typeof health.hp !== "number" || typeof health.maxHp !== "number") return;
    if (health.hp >= health.maxHp) {
      if (data._plane) data._plane.visible = false;
      return;
    }
    const t = resolveTuning(thing, registry);
    if (!t) return;

    if (!data._plane) installPlane(data, ctx, t);
    data._plane.visible = true;

    const pos = registry.facetData(thing.id, "position");
    if (!pos) return;
    const frac = Math.max(0, Math.min(1, health.hp / health.maxHp));

    data._plane.position.set(pos.x, pos.y + t.bar_y_offset, pos.z);
    if (ctx.camera) data._plane.lookAt(ctx.camera.position.x, data._plane.position.y, ctx.camera.position.z);
    data._plane.scale.set(t.bar_width * frac, t.bar_height, 1);
    if (data._mat) {
      data._mat.color.setHex(frac > t.bar_color_threshold ? t.bar_color_full_hex : t.bar_color_low_hex);
    }
  },

  cleanup(thing, data, registry) {
    if (!data || !data._plane) return;
    const ctxThing = registry.byKind("render-context")[0];
    const ctx = ctxThing ? registry.facetData(ctxThing.id, "render-context") : null;
    if (ctx && ctx.scene) ctx.scene.remove(data._plane);
    data._geom?.dispose?.();
    data._mat?.dispose?.();
    data._plane = null; data._geom = null; data._mat = null;
  }
};

function resolveTuning(thing, registry) {
  let body_height = null;
  const mesh = registry.facetData(thing.id, "mesh");
  if (mesh && typeof mesh.tuning_ref === "string") {
    for (const tt of registry.byKind("tuning")) {
      if (tt.name !== mesh.tuning_ref) continue;
      const tn = registry.facetData(tt.id, "tuning");
      if (tn && typeof tn.body_height === "number") body_height = tn.body_height;
      break;
    }
  }
  let hud = null;
  for (const tt of registry.byKind("tuning")) {
    if (tt.name !== HUD_TUNING) continue;
    hud = registry.facetData(tt.id, "tuning");
    break;
  }
  if (!hud) return null;
  if (typeof hud.enemy_hp_bar_width        !== "number") return null;
  if (typeof hud.enemy_hp_bar_height       !== "number") return null;
  if (typeof hud.enemy_hp_bar_padding      !== "number") return null;
  if (typeof hud.enemy_hp_bar_color_full   !== "number") return null;
  if (typeof hud.enemy_hp_bar_color_low    !== "number") return null;
  if (typeof hud.enemy_hp_bar_color_threshold !== "number") return null;
  const defaultY = typeof body_height === "number" ? body_height + hud.enemy_hp_bar_padding : 2.4;
  return {
    bar_width:           hud.enemy_hp_bar_width,
    bar_height:          hud.enemy_hp_bar_height,
    bar_y_offset:        defaultY,
    bar_color_full_hex:  hud.enemy_hp_bar_color_full,
    bar_color_low_hex:   hud.enemy_hp_bar_color_low,
    bar_color_threshold: hud.enemy_hp_bar_color_threshold,
  };
}

function installPlane(data, ctx, t) {
  const geom = new ctx.THREE.PlaneGeometry(1, 1);
  const mat  = new ctx.THREE.MeshBasicMaterial({
    color: t.bar_color_full_hex, transparent: true, opacity: 0.92,
    depthTest: false, depthWrite: false,
  });
  const mesh = new ctx.THREE.Mesh(geom, mat);
  mesh.renderOrder = 999;
  ctx.scene.add(mesh);
  data._plane = mesh; data._geom = geom; data._mat = mat;
}
