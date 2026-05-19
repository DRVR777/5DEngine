// Lazily populates Loaders with Three.js add-on loaders via dynamic imports.
// Returns the Loaders object immediately; loader classes fill in asynchronously.
export function mountLoaders() {
  const Loaders = {};
  import("three/addons/loaders/GLTFLoader.js")
    .then((m) => { Loaders.GLTFLoader = m.GLTFLoader; })
    .catch((e) => { console.warn("GLTFLoader unavailable:", e.message); });
  import("three/addons/loaders/OBJLoader.js")
    .then((m) => { Loaders.OBJLoader = m.OBJLoader; })
    .catch((e) => { console.warn("OBJLoader unavailable:", e.message); });
  import("three/addons/loaders/MTLLoader.js")
    .then((m) => { Loaders.MTLLoader = m.MTLLoader; })
    .catch((e) => { console.warn("MTLLoader unavailable:", e.message); });
  import("three/addons/loaders/FBXLoader.js")
    .then((m) => { Loaders.FBXLoader = m.FBXLoader; })
    .catch((e) => { console.warn("FBXLoader unavailable:", e.message); });
  return { Loaders };
}
