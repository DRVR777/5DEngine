/** build_mesh — generic Three.js mesh builder driven by a mesh-spec Thinga
 *  facet. No per-kind code; the visual structure lives in data.
 *
 *  Spec shape:
 *    { kind: "mesh",  geometry, material, position?, cast_shadow?, name? }
 *    { kind: "group", parts: [<part>, <part>, ...], name? }
 *  Part shape: same fields as a "mesh" spec, sans the outer "kind".
 *
 *  Geometry: { kind: <name>, args: [...] }  — kind is a key in GEOMETRY below.
 *  Material: { kind: <name>, ...props }     — kind is a key in MATERIAL below.
 *             Snake_case props are translated to Three's camelCase. */

const GEOMETRY = {
  cylinder:     (THREE, a) => new THREE.CylinderGeometry   (...a),
  sphere:       (THREE, a) => new THREE.SphereGeometry     (...a),
  box:          (THREE, a) => new THREE.BoxGeometry        (...a),
  dodecahedron: (THREE, a) => new THREE.DodecahedronGeometry(...a),
  octahedron:   (THREE, a) => new THREE.OctahedronGeometry (...a),
  tetrahedron:  (THREE, a) => new THREE.TetrahedronGeometry(...a),
  icosahedron:  (THREE, a) => new THREE.IcosahedronGeometry(...a),
  cone:         (THREE, a) => new THREE.ConeGeometry       (...a),
  plane:        (THREE, a) => new THREE.PlaneGeometry      (...a),
};

const MATERIAL = {
  standard: (THREE, p) => new THREE.MeshStandardMaterial(p),
  basic:    (THREE, p) => new THREE.MeshBasicMaterial(p),
  phong:    (THREE, p) => new THREE.MeshPhongMaterial(p),
  lambert:  (THREE, p) => new THREE.MeshLambertMaterial(p),
};

const PROP_RENAME = {
  emissive_intensity: "emissiveIntensity",
  depth_write:        "depthWrite",
  depth_test:         "depthTest",
  side:               "side",
};

function materialProps(matSpec) {
  const out = {};
  for (const [k, v] of Object.entries(matSpec)) {
    if (k === "kind") continue;
    out[PROP_RENAME[k] || k] = v;
  }
  return out;
}

function buildPart(THREE, part) {
  const gKind = part?.geometry?.kind;
  const mKind = part?.material?.kind;
  if (!GEOMETRY[gKind]) throw new Error(`build_mesh: unknown geometry "${gKind}"`);
  if (!MATERIAL[mKind]) throw new Error(`build_mesh: unknown material "${mKind}"`);
  const geom = GEOMETRY[gKind](THREE, part.geometry.args || []);
  const mat  = MATERIAL[mKind](THREE, materialProps(part.material));
  const mesh = new THREE.Mesh(geom, mat);
  if (part.position) {
    if (part.position.x != null) mesh.position.x = part.position.x;
    if (part.position.y != null) mesh.position.y = part.position.y;
    if (part.position.z != null) mesh.position.z = part.position.z;
  }
  if (part.cast_shadow) mesh.castShadow = true;
  if (part.name) mesh.name = part.name;
  return mesh;
}

export function buildMesh(THREE, spec, ownerId) {
  if (!spec) throw new Error(`build_mesh: no spec provided (owner ${ownerId || "?"})`);
  if (spec.kind === "group") {
    const g = new THREE.Group();
    g.name = spec.name || ownerId || "group";
    for (const part of spec.parts || []) g.add(buildPart(THREE, part));
    return g;
  }
  const m = buildPart(THREE, spec);
  m.name = m.name || ownerId || "mesh";
  return m;
}
