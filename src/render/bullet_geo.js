// Tracer-style bullet geometry — thin elongated box, rotated to face travel direction.
// mountBulletGeo({ THREE }) → { bulletGeo, bulletMat }
export function mountBulletGeo({ THREE }) {
  const bulletGeo = new THREE.BoxGeometry(0.025, 0.025, 0.28);
  const bulletMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
  return { bulletGeo, bulletMat };
}
