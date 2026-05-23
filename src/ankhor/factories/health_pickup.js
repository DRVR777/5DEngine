/** Health pickup mesh factory. Visuals match src/systems/drop_spawner.js spawnHealthPickup. */
import { tuned } from "../tuned.js";

export default function healthPickup(THREE, fd, thing, registry) {
  const t = (k, v) => tuned(registry, "health-pickup-tuning", k, v);
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
}
