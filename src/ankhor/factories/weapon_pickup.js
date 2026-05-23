/** Weapon pickup mesh factory. Group: body + grip + vertical beacon pillar.
 *  Visuals match src/systems/drop_spawner.js spawnWeaponPickup. */
import { tuned } from "../tuned.js";

export default function weaponPickup(THREE, fd, thing, registry) {
  const t = (k, v) => tuned(registry, "weapon-pickup-tuning", k, v);
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
  body.name = "weapon-body"; grp.add(body);

  const grip = new THREE.Mesh(
    new THREE.BoxGeometry(t("grip_w", 0.1), t("grip_h", 0.16), t("grip_d", 0.1)),
    new THREE.MeshStandardMaterial({ color: t("grip_color", 0x222222), metalness: 0.4, roughness: 0.7 })
  );
  grip.position.set(-0.1, -0.1, 0); grip.name = "weapon-grip"; grp.add(grip);

  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(t("pillar_r", 0.04), t("pillar_r", 0.04), t("pillar_h", 6), 6),
    new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: t("pillar_opacity_base", 0.35), depthWrite: false })
  );
  pillar.position.set(0, t("pillar_y", 3), 0); pillar.name = "weapon-pillar"; grp.add(pillar);

  return grp;
}
