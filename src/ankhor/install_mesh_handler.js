/** mesh facet handler — installs into a Registry, closing over THREE+scene+factories.
 *  init: spawn the Three object via the factory; tick: sync from position;
 *  cleanup: dispose on despawn (regret #3). */
export function installMeshHandler(registry, { THREE, scene, factories }) {
  registry.registerFacetHandler("mesh", {
    priority: 70,

    init(thing, fd) {
      if (!fd || fd.threeObj) return;
      const factory = factories[fd.factory];
      if (!factory) { console.warn(`[ankhor] mesh: no factory "${fd.factory}" on ${thing.id}`); return; }
      fd.threeObj = factory(THREE, fd, thing, registry);
      if (!fd.threeObj) return;
      const pos = registry.facetData(thing.id, "position");
      if (pos) fd.threeObj.position.set(pos.x ?? pos.u ?? 0, pos.y ?? 0, pos.z ?? pos.v ?? 0);
      scene.add(fd.threeObj);
    },

    tick(thing, fd) {
      if (!fd?.threeObj) return;
      const pos = registry.facetData(thing.id, "position");
      if (!pos) return;
      fd.threeObj.position.set(pos.x ?? pos.u ?? 0, pos.y ?? 0, pos.z ?? pos.v ?? 0);
      if (pos.heading != null) fd.threeObj.rotation.y = pos.heading;
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
