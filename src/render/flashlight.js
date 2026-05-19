// Player flashlight — SpotLight + target object added to scene.
// mountFlashlight({ THREE, scene }) → { flashLight, flashTarget }
// Toggling and tick are handled in index.html (player-controlled, not combat VFX).
export function mountFlashlight({ THREE, scene }) {
  const flashLight  = new THREE.SpotLight(0xfff8e0, 0, 22, 0.22, 0.55, 1.6);
  const flashTarget = new THREE.Object3D();
  scene.add(flashLight);
  scene.add(flashTarget);
  flashLight.target = flashTarget;
  return { flashLight, flashTarget };
}
