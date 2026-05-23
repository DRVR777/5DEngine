// Extracted from index.html asset loading bootstrap.
// Behavior-preservation phase: keep delay, asset ids, placeholder positions, and logging.

export function mountAssetBootstrap({
  windowRef = window,
  THREE,
  Loaders,
  scene,
  get,
  actions,
  delayMs = 200,
}) {
  return actions.setTimeout(() => {
    if (!windowRef.AssetLoader) return;
    windowRef.AssetLoader.load(THREE, Loaders).then((r) => {
      if (!r || !r.ok) {
        actions.info("Assets: manifest load skipped/failed:", r && r.reason);
        return;
      }
      actions.info("Assets: loaders ready", r.formats, "—", r.slotCount, "slots");
      if (windowRef.registerGunMesh) {
        const pistolPlaceholder = get.gunMeshes().get("pistol");
        windowRef.AssetLoader.replacePlaceholder("pistol", get.gunMount(), pistolPlaceholder, { position: { x: 0, y: 0, z: 0 } });
      }
      windowRef.AssetLoader.replacePlaceholder("car", get.carGroup(), get.carBody(), { position: { x: 0, y: 0.7, z: 0 } });
      if (get.pickupMeshes()) {
        for (const pk of get.pickups()) {
          const m = get.pickupMeshes().get(pk.id);
          windowRef.AssetLoader.replacePlaceholder("coin", scene, m, { position: { x: pk.u, y: 1.0, z: pk.v } });
        }
      }
    }).catch((e) => actions.warn("Assets: load threw:", e.message));
  }, delayMs);
}
