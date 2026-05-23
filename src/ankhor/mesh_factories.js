/**
 * src/ankhor/mesh_factories.js
 *
 * Named Three.js mesh factories invoked by the `mesh` facet handler.
 * Each factory takes (THREE, facetData, thing) and returns a Three.Object3D.
 *
 * The factory NAME is referenced from a `mesh` facet's data: { factory: "<name>" }.
 * This indirection keeps kind JSON serializable (no JS functions in data files)
 * while keeping rendering pluggable.
 *
 * Visuals MUST match the legacy implementation in src/systems/<kind>_system.js
 * exactly — the feel-preservation contract is "no visible difference."
 * Magic numbers used here are dimensions only; behavioral magic numbers go
 * into data/tuning/<kind>.json with provenance.
 */

// Color constants come from data/tuning/*.json (loaded as tuning Things).
// Inline fallbacks here match the legacy values for visual safety if tuning
// loading fails — but the canonical source is the tuning Thing.
const LEGACY_BARREL = Object.freeze({
  bodyColor:        0xcc2200,
  stripeColor:      0xffcc00,
  stripeEmissive:   0x552200,
  stripeIntensity:  0.6,
  bodyRadius:       0.28,
  bodyHeight:       0.85,
  bodyY:            0.425,
  stripeRadius:     0.285,
  stripeHeight:     0.12,
  stripeY:          0.52,
  bodyMetalness:    0.6,
  bodyRoughness:    0.5,
  segments:         10,
});

// Lookup helper: prefer tuning-Thing values when available, fall back to legacy.
function tuned(registry, kind, key, fallback) {
  if (!registry) return fallback;
  const things = registry.byKind ? registry.byKind("tuning") : [];
  for (const t of things) {
    if (t.name !== `${kind}-tuning`) continue;
    const fd = registry.facetData(t.id, "tuning");
    if (fd && key in fd) return fd[key];
  }
  return fallback;
}

export const MESH_FACTORIES = {
  // Barrel — explosive red cylinder with yellow warning stripe.
  // Reference: src/systems/barrel_system.js line 14–29 (legacy makeBarrel).
  barrel(THREE, fd, thing, registry) {
    const T = LEGACY_BARREL;
    const t = (k, v) => tuned(registry, "barrel", k, v);

    const g = new THREE.Group();
    g.name = thing?.id || "barrel";

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(
        t("body_radius", T.bodyRadius),
        t("body_radius", T.bodyRadius),
        t("body_height", T.bodyHeight),
        T.segments
      ),
      new THREE.MeshStandardMaterial({
        color:      t("body_color",     T.bodyColor),
        metalness:  t("body_metalness", T.bodyMetalness),
        roughness:  t("body_roughness", T.bodyRoughness),
      })
    );
    body.position.y = t("body_y", T.bodyY);
    body.castShadow = true;
    g.add(body);

    const stripe = new THREE.Mesh(
      new THREE.CylinderGeometry(
        t("stripe_radius", T.stripeRadius),
        t("stripe_radius", T.stripeRadius),
        t("stripe_height", T.stripeHeight),
        T.segments
      ),
      new THREE.MeshStandardMaterial({
        color:             t("stripe_color",      T.stripeColor),
        emissive:          t("stripe_emissive",   T.stripeEmissive),
        emissiveIntensity: t("stripe_intensity",  T.stripeIntensity),
      })
    );
    stripe.position.y = t("stripe_y", T.stripeY);
    g.add(stripe);

    return g;
  },

  // Speed orb — yellow dodecahedron with emissive pulse.
  // Reference: src/systems/speed_orb_spawner.js line 6–13 (legacy spawnSpeedOrb).
  "speed-orb"(THREE, fd, thing, registry) {
    const t = (k, v) => tuned(registry, "speed-orb", k, v);
    const mesh = new THREE.Mesh(
      new THREE.DodecahedronGeometry(t("radius", 0.22), 0),
      new THREE.MeshStandardMaterial({
        color:             t("body_color",       0xffdd00),
        emissive:          t("emissive_color",   0xffa500),
        emissiveIntensity: t("emissive_intensity", 0.9),
        metalness:         t("metalness",        0.2),
      })
    );
    mesh.name = thing?.id || "speed-orb";
    return mesh;
  },

  // Coin drop — small gold sphere with subtle emissive.
  // Reference: src/systems/drop_spawner.js spawnCoinDrop (gold SphereGeometry).
  "coin-drop"(THREE, fd, thing, registry) {
    const t = (k, v) => tuned(registry, "coin-drop", k, v);
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(t("radius", 0.18), 8, 8),
      new THREE.MeshStandardMaterial({
        color:     t("body_color",     0xffd700),
        emissive:  t("emissive_color", 0x554400),
        metalness: t("metalness",      0.7),
        roughness: t("roughness",      0.2),
      })
    );
    mesh.name = thing?.id || "coin-drop";
    return mesh;
  },

  // Health pickup — green octahedron, restores HP.
  // Reference: src/systems/drop_spawner.js spawnHealthPickup.
  "health-pickup"(THREE, fd, thing, registry) {
    const t = (k, v) => tuned(registry, "health-pickup", k, v);
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(t("radius", 0.22), 0),
      new THREE.MeshStandardMaterial({
        color:             t("body_color",         0x00ff88),
        emissive:          t("emissive_color",     0x00bb44),
        emissiveIntensity: t("emissive_intensity", 0.5),
      })
    );
    mesh.castShadow = true;
    mesh.name = thing?.id || "health-pickup";
    return mesh;
  },

  // Ammo pickup — orange box, magazine-shaped.
  // Reference: src/systems/drop_spawner.js spawnAmmoPickup.
  "ammo-pickup"(THREE, fd, thing, registry) {
    const t = (k, v) => tuned(registry, "ammo-pickup", k, v);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(t("width", 0.18), t("height", 0.08), t("depth", 0.28)),
      new THREE.MeshStandardMaterial({
        color:     t("body_color", 0xffaa00),
        metalness: t("metalness",  0.5),
        roughness: t("roughness",  0.4),
      })
    );
    mesh.castShadow = true;
    mesh.name = thing?.id || "ammo-pickup";
    return mesh;
  },

  // Weapon pickup — Group of weapon body + grip + vertical beacon pillar.
  // Reference: src/systems/drop_spawner.js spawnWeaponPickup.
  // facetData.weapon_id chooses color from the pickup-color map.
  "weapon-pickup"(THREE, fd, thing, registry) {
    const t = (k, v) => tuned(registry, "weapon-pickup", k, v);
    const colors = t("pickup_colors", { rifle: 0x445566, smg: 0x226699, sniper: 0x224433 });
    const col = colors[fd?.weapon_id] || t("default_color", 0x556677);

    const grp = new THREE.Group();
    grp.name = thing?.id || "weapon-pickup";

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(t("body_w", 0.55), t("body_h", 0.08), t("body_d", 0.14)),
      new THREE.MeshStandardMaterial({
        color: col, metalness: t("body_metalness", 0.75), roughness: t("body_roughness", 0.3),
        emissive: col, emissiveIntensity: t("body_emissive_intensity", 0.5),
      })
    );
    body.name = "weapon-body";
    grp.add(body);

    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(t("grip_w", 0.1), t("grip_h", 0.16), t("grip_d", 0.1)),
      new THREE.MeshStandardMaterial({ color: t("grip_color", 0x222222), metalness: 0.4, roughness: 0.7 })
    );
    grip.position.set(-0.1, -0.1, 0);
    grip.name = "weapon-grip";
    grp.add(grip);

    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(t("pillar_r", 0.04), t("pillar_r", 0.04), t("pillar_h", 6), 6),
      new THREE.MeshBasicMaterial({
        color: col, transparent: true, opacity: t("pillar_opacity_base", 0.35), depthWrite: false,
      })
    );
    pillar.position.set(0, t("pillar_y", 3), 0);
    pillar.name = "weapon-pillar";
    grp.add(pillar);

    return grp;
  },

  // ── Future factories (add as kinds are migrated per docs/codex/specs/migration-sequence.md):
  // armorShard, crate, grenadeCrate, hazardZone, bullet, enemy, vehicle, npc, screen, ...
};
