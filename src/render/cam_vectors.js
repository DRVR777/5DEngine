export function mountCamVectors({ THREE }) {
  const _camTarget    = new THREE.Vector3();
  const _camOff       = new THREE.Vector3();
  const _camLook      = new THREE.Vector3();
  const _camAimTarget = new THREE.Vector3();
  const _camBuildLook = new THREE.Vector3();
  return { _camTarget, _camOff, _camLook, _camAimTarget, _camBuildLook };
}
