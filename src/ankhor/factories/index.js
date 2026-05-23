/** Legacy mesh factories. Phased out per iter 715: each kind whose visuals
 *  can be expressed declaratively gets a `mesh-spec` facet on its tuning
 *  Thinga, and the mesh handler builds via src/ankhor/build_mesh.js.
 *
 *  Only kinds with runtime variation that mesh-spec doesn't yet express
 *  (e.g. weapon-pickup's color from weapon_id) remain here. The aim is
 *  for this map to be empty. */
import weaponPickup from "./weapon_pickup.js";

export const MESH_FACTORIES = {
  "weapon-pickup": weaponPickup,
};
