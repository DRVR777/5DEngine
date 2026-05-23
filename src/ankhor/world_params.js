/** Apply a world Thinga's world-params facet to the scene. Constructs the
 *  background, fog, ambient + directional lights, and ground grid. Returns
 *  camera config (creation params + animation params) for the boot loop.
 *  All values come from the world-params facet — no fallbacks. */
import { requireParam as need } from "./require_param.js";

const W = "world-params";

export function applyWorldParams(THREE, scene, p) {
  const bg = need(p, "background_color", W);
  scene.background = new THREE.Color(bg);
  scene.fog        = new THREE.FogExp2(bg, need(p, "fog_density", W));

  scene.add(new THREE.AmbientLight(
    need(p, "ambient_color", W),
    need(p, "ambient_intensity", W)
  ));

  const sun = new THREE.DirectionalLight(
    need(p, "sun_color", W),
    need(p, "sun_intensity", W)
  );
  const sp = need(p, "sun_position", W);
  sun.position.set(sp[0], sp[1], sp[2]);
  scene.add(sun);

  scene.add(new THREE.GridHelper(
    need(p, "grid_size", W),
    need(p, "grid_divisions", W),
    need(p, "grid_color_major", W),
    need(p, "grid_color_minor", W),
  ));

  return {
    fov:      need(p, "camera_fov", W),
    near:     need(p, "camera_near", W),
    far:      need(p, "camera_far", W),
    init_pos: need(p, "camera_initial_position", W),
    look_at:  need(p, "camera_look_at", W),
    orbit:    need(p, "camera_orbit_radius", W),
    height:   need(p, "camera_height", W),
    speed:    need(p, "camera_orbit_speed", W),
  };
}
