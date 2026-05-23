/** Apply a world Thinga's world-params facet to a Three.js scene. Returns
 *  camera animation params for the boot loop. */
export function applyWorldParams(THREE, scene, p) {
  p = p || {};
  scene.background = new THREE.Color(p.background_color ?? 0x0b0d12);
  scene.fog        = new THREE.FogExp2(p.background_color ?? 0x0b0d12, p.fog_density ?? 0.018);
  scene.add(new THREE.AmbientLight(0xffffff, p.ambient_intensity ?? 0.55));
  const sun = new THREE.DirectionalLight(0xffffff, p.sun_intensity ?? 0.85);
  sun.position.set(5, 10, 5); scene.add(sun);
  return {
    orbit:  p.camera_orbit_radius ?? 28,
    height: p.camera_height       ?? 14,
    speed:  p.camera_orbit_speed  ?? 0.00008,
  };
}
