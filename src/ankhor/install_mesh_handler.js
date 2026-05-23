/**
 * src/ankhor/install_mesh_handler.js
 *
 * Installs the `mesh` facet handler into a Registry, closing over the active
 * Three.js scene and the registered mesh factories. Separated from the
 * generic facetHandlers in handlers.js because the mesh handler needs
 * substrate-level dependencies (THREE, scene) that aren't available to the
 * pure data-tick handlers.
 *
 * Spec: docs/codex/specs/facet-catalog.md §mesh
 * Priority: 70 (render-class, runs after physics+behavior, before cleanup)
 */

export function installMeshHandler(registry, { THREE, scene, factories }) {
  registry.registerFacetHandler("mesh", {
    priority: 70,

    // Called by registry on spawn (registry.js _setFacet with init: true).
    init(thing, fd) {
      if (!fd || fd.threeObj) return;
      const factory = factories[fd.factory];
      if (!factory) {
        console.warn(`[ankhor] mesh handler: no factory for "${fd.factory}" on ${thing.id}`);
        return;
      }
      fd.threeObj = factory(THREE, fd, thing, registry);
      if (!fd.threeObj) return;
      const pos = registry.facetData(thing.id, "position");
      if (pos) {
        fd.threeObj.position.set(pos.x ?? pos.u ?? 0, pos.y ?? 0, pos.z ?? pos.v ?? 0);
      }
      scene.add(fd.threeObj);
    },

    // Called every tick. Sync position from the position facet (canonical).
    tick(thing, fd) {
      if (!fd?.threeObj) return;
      const pos = registry.facetData(thing.id, "position");
      if (!pos) return;
      fd.threeObj.position.set(pos.x ?? pos.u ?? 0, pos.y ?? 0, pos.z ?? pos.v ?? 0);
      if (pos.heading != null) fd.threeObj.rotation.y = pos.heading;
    },

    // Called by registry on despawn (regret #3: broadcast before delete).
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
