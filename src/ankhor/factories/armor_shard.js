/** Armor shard mesh factory. Visuals match src/systems/drop_spawner.js spawnArmorShard. */
import { tuned } from "../tuned.js";

export default function armorShard(THREE, fd, thing, registry) {
  const t = (k, v) => tuned(registry, "armor-shard-tuning", k, v);
  const mesh = new THREE.Mesh(
    new THREE.TetrahedronGeometry(t("radius", 0.22), 0),
    new THREE.MeshStandardMaterial({
      color:             t("body_color",         0xffd166),
      emissive:          t("emissive_color",     0xcc8800),
      emissiveIntensity: t("emissive_intensity", 0.7),
      metalness:         t("metalness",          0.6),
      roughness:         t("roughness",          0.3),
    })
  );
  mesh.castShadow = true;
  mesh.name = thing?.id || "armor-shard";
  return mesh;
}
