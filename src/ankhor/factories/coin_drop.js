/** Coin drop mesh factory. Visuals match src/systems/drop_spawner.js spawnCoinDrop. */
import { tuned } from "../tuned.js";

export default function coinDrop(THREE, fd, thing, registry) {
  const t = (k, v) => tuned(registry, "coin-drop-tuning", k, v);
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
}
