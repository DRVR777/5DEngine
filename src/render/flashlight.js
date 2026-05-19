// Player flashlight — SpotLight + target object added to scene.
// mountFlashlight({ THREE, scene, getCamera }) → { flashLight, flashTarget, tick }
export function mountFlashlight({ THREE, scene, getCamera = null }) {
  const flashLight  = new THREE.SpotLight(0xfff8e0, 0, 22, 0.22, 0.55, 1.6);
  const flashTarget = new THREE.Object3D();
  scene.add(flashLight);
  scene.add(flashTarget);
  flashLight.target = flashTarget;

  function tick(flashlightOn) {
    if (!flashlightOn || !getCamera) return;
    const cam = getCamera();
    flashLight.position.copy(cam.position);
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    flashTarget.position.copy(cam.position).addScaledVector(dir, 10);
    flashTarget.updateMatrixWorld();
  }

  return { flashLight, flashTarget, tick };
}
