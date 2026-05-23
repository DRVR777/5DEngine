/** Ammo pickup mesh factory. Visuals match src/systems/drop_spawner.js spawnAmmoPickup. */
import { tuned } from "../tuned.js";

export default function ammoPickup(THREE, fd, thing, registry) {
  const t = (k, v) => tuned(registry, "ammo-pickup-tuning", k, v);
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
}
