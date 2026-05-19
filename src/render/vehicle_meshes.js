// Vehicle mesh setup — builds one group per vehicle def and adds each to scene.
// mountVehicleMeshes({ THREE, scene, vehicleDefs, makeVehicleMesh }) → { vehicleMeshes, carGroup, carBody }
export function mountVehicleMeshes({ THREE, scene, vehicleDefs, makeVehicleMesh }) {
  const vehicleMeshes = new Map();
  for (const vDef of vehicleDefs) {
    const grp = makeVehicleMesh(vDef);
    vehicleMeshes.set(vDef.id, grp);
    scene.add(grp);
  }
  const carGroup = vehicleMeshes.get(vehicleDefs[0].id) || new THREE.Group();
  const carBody  = carGroup._bodyMesh || carGroup;
  return { vehicleMeshes, carGroup, carBody };
}
