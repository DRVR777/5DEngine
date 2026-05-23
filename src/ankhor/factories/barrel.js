/** Barrel mesh factory. Visuals match src/systems/barrel_system.js line 14–29 exactly.
 *  Tuning values come from data/tuning/barrel.json with hard-coded fallbacks. */
import { tuned } from "../tuned.js";

export default function barrel(THREE, fd, thing, registry) {
  const t = (k, v) => tuned(registry, "barrel-tuning", k, v);
  const g = new THREE.Group();
  g.name = thing?.id || "barrel";

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(t("body_radius", 0.28), t("body_radius", 0.28), t("body_height", 0.85), 10),
    new THREE.MeshStandardMaterial({
      color:     t("body_color",     0xcc2200),
      metalness: t("body_metalness", 0.6),
      roughness: t("body_roughness", 0.5),
    })
  );
  body.position.y = t("body_y", 0.425); body.castShadow = true;
  g.add(body);

  const stripe = new THREE.Mesh(
    new THREE.CylinderGeometry(t("stripe_radius", 0.285), t("stripe_radius", 0.285), t("stripe_height", 0.12), 10),
    new THREE.MeshStandardMaterial({
      color:             t("stripe_color",     0xffcc00),
      emissive:          t("stripe_emissive",  0x552200),
      emissiveIntensity: t("stripe_intensity", 0.6),
    })
  );
  stripe.position.y = t("stripe_y", 0.52);
  g.add(stripe);

  return g;
}
