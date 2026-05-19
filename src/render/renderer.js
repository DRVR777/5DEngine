// WebGL renderer + perspective camera factory with resize handler.
// mountRenderer({ THREE, getComposer }) → { renderer, camera }
// getComposer: () => composer | null  — used by resize listener for post-processing
export function mountRenderer({ THREE, getComposer }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(devicePixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 500);
  addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    const _c = getComposer();
    if (_c) _c.setSize(innerWidth, innerHeight);
  });

  return { renderer, camera };
}
