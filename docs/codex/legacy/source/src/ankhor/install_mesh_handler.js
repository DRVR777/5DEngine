/** mesh facet handler.
 *  Resolves the Three.js object via mesh-spec on a tuning Thinga:
 *    1. Spawn facet may carry `tuning_ref` → that tuning Thinga's mesh-spec.
 *    2. Otherwise use `<thing.kind>-tuning`.
 *  If no mesh-spec is found, log and skip. The legacy factory fallback
 *  was removed in iter 735 — all kinds now build via mesh-spec. */
import { buildMesh } from "./build_mesh.js";

export function installMeshHandler(registry, { THREE, scene }) {
  registry.registerFacetHandler("mesh", {
    priority: 70,

    init(thing, fd) {
      if (!fd || fd.threeObj) return;
      const tuningName = fd.tuning_ref || `${thing.kind}-tuning`;
      const spec = findMeshSpec(registry, tuningName);
      if (!spec) {
        console.warn(`[ankhor] mesh: no mesh-spec on "${tuningName}" for ${thing.id}`);
        return;
      }
      try {
        fd.threeObj = buildMesh(THREE, spec, thing.id);
      } catch (e) {
        console.warn(`[ankhor] mesh build failed for ${thing.id}:`, e.message);
        return;
      }
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
