/** mesh facet handler.
 *  Resolution order for building the Three.js object:
 *    1. Spawn facet may carry `tuning_ref` → use that tuning Thinga's mesh-spec.
 *    2. Otherwise use `<thing.kind>-tuning`.
 *    3. Otherwise, if `factories[fd.factory]` exists, use it (legacy path —
 *       being phased out as each kind gets a mesh-spec).
 *  If none of the above produce a Three.js object, log and skip. */
import { buildMesh } from "./build_mesh.js";

export function installMeshHandler(registry, { THREE, scene, factories = {} }) {
  registry.registerFacetHandler("mesh", {
    priority: 70,

    init(thing, fd) {
      if (!fd || fd.threeObj) return;
      const tuningName = fd.tuning_ref || `${thing.kind}-tuning`;
      const spec = findMeshSpec(registry, tuningName);
      if (spec) {
        try { fd.threeObj = buildMesh(THREE, spec, thing.id); }
        catch (e) { console.warn(`[ankhor] mesh build failed for ${thing.id}:`, e.message); }
      } else if (fd.factory && factories[fd.factory]) {
        try { fd.threeObj = factories[fd.factory](THREE, fd, thing, registry); }
        catch (e) { console.warn(`[ankhor] mesh factory failed for ${thing.id}:`, e.message); }
      } else {
        console.warn(`[ankhor] mesh: no mesh-spec on "${tuningName}" and no factory for ${thing.id}`);
      }
      if (!fd.threeObj) return;
      const pos = registry.facetData(thing.id, "position");
      if (pos) fd.threeObj.position.set(pos.x, pos.y, pos.z);
      scene.add(fd.threeObj);
    },

    tick(thing, fd) {
      if (!fd?.threeObj) return;
      const pos = registry.facetData(thing.id, "position");
      if (!pos) return;
      fd.threeObj.position.set(pos.x, pos.y, pos.z);
      if (typeof pos.heading === "number") fd.threeObj.rotation.y = pos.heading;
    },

    cleanup(thing, fd) {
      if (!fd?.threeObj) return;
      scene.remove(fd.threeObj);
      fd.threeObj.traverse?.((o) => {
        o.geometry?.dispose?.();
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose?.());
        else o.material?.dispose?.();
      });
      fd.threeObj = null;
    },
  });
}

function findMeshSpec(registry, tuningName) {
  for (const t of registry.byKind("tuning")) {
    if (t.name !== tuningName) continue;
    return registry.facetData(t.id, "mesh-spec");
  }
  return null;
}
