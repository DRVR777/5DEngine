/** Aggregates per-kind mesh factories. Add a new factory by importing it here
 *  and adding it to MESH_FACTORIES under its kind name. */
import barrel        from "./barrel.js";
import speedOrb      from "./speed_orb.js";
import coinDrop      from "./coin_drop.js";
import healthPickup  from "./health_pickup.js";
import ammoPickup    from "./ammo_pickup.js";
import weaponPickup  from "./weapon_pickup.js";
import armorShard    from "./armor_shard.js";

export const MESH_FACTORIES = {
  "barrel":         barrel,
  "speed-orb":      speedOrb,
  "coin-drop":      coinDrop,
  "health-pickup":  healthPickup,
  "ammo-pickup":    ammoPickup,
  "weapon-pickup":  weaponPickup,
  "armor-shard":    armorShard,
};
