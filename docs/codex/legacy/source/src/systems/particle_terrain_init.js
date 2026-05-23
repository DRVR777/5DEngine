// Initialises ParticleSystem and wires terrain generate/remove window helpers.
// All calls are guarded so missing globals are silently skipped.
export function mountParticleAndTerrain({ THREE, scene, showToast }) {
  if (typeof ParticleSystem !== "undefined") ParticleSystem.init(THREE, scene);

  window._terrainEnabled = false;
  window._generateTerrain = function(opts) {
    if (typeof Terrain === "undefined") return;
    window._terrainEnabled = true;
    window._terrainApi = Terrain.generate(THREE, scene, opts || {
      size: 200, segments: 96, maxHeight: 6, seed: 42,
    });
    showToast("Terrain generated", "success", 2000);
  };
  window._removeTerrain = function() {
    if (typeof Terrain !== "undefined") Terrain.dispose();
    window._terrainEnabled = false;
    window._terrainApi = null;
  };
}
