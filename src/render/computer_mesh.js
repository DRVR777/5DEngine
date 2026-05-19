// Computer entity mesh — desk box + glowing screen front panel.
// mountComputerMesh({ THREE, scene, computerEntity }) → { compGroup }
export function mountComputerMesh({ THREE, scene, computerEntity }) {
  const compGroup = new THREE.Group();

  const deskBox = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 1.2, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x333333 })
  );
  deskBox.position.y = 0.6; deskBox.castShadow = true; compGroup.add(deskBox);

  const screenFront = new THREE.Mesh(
    new THREE.PlaneGeometry(1.0, 0.7),
    new THREE.MeshBasicMaterial({ color: 0x44ccff })
  );
  screenFront.position.set(0, 1.0, 0.31); compGroup.add(screenFront);

  compGroup.position.set(computerEntity.u, 0, computerEntity.v);
  scene.add(compGroup);

  return { compGroup, screenFront };
}
