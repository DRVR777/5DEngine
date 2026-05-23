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

  // ── Future factories (add as kinds are migrated per docs/codex/specs/migration-sequence.md):
  // ammoPickup, weaponPickup, armorShard,
  // crate, grenadeCrate, hazardZone, bullet, enemy, vehicle, npc, screen, ...
};
