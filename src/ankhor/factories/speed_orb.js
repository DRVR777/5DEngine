/** Speed orb mesh factory. Visuals match src/systems/speed_orb_spawner.js. */
import { tuned } from "../tuned.js";

export default function speedOrb(THREE, fd, thing, registry) {
  const t = (k, v) => tuned(registry, "speed-orb-tuning", k, v);
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
}
