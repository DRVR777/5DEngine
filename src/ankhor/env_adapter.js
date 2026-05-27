/**
 * Environment Render Adapter — EXACT environment from game.html (mountEnvironment).
 * Ground with checkerboard texture, custom sky shader gradient, grid, buildings.
 */

import * as THREE from "three";

let _skyUniforms = null;
let _init = false;

export function envRenderAdapter(scene, registry, dt) {
  if (!_init) {
    buildEnvironment(scene);
    _init = true;
    console.log("[adapter] environment — exact game.html replica");
  }
  updateSkyColors(registry);
}

function makeGroundTexture(size = 256) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  g.fillStyle = "#4a7c59"; g.fillRect(0, 0, size, size);
  g.fillStyle = "#3f6b4d";
  for (let y = 0; y < size; y += 32)
    for (let x = (y / 32) % 2 === 0 ? 0 : 32; x < size; x += 64)
      g.fillRect(x, y, 32, 32);
  for (let i = 0; i < 1500; i++) {
    g.fillStyle = `rgba(${100 + Math.random()*80|0}, ${140 + Math.random()*60|0}, ${80 + Math.random()*40|0}, 0.5)`;
    g.fillRect(Math.random() * size | 0, Math.random() * size | 0, 1, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(20, 20);
  return tex;
}

function buildEnvironment(scene) {
  // Building definitions — from world_data.js
  const buildings = [
    { id: "shop",    color: 0xff6b6b, u0:  10, v0:  -4, u1:  16, v1:   4 },
    { id: "tower",   color: 0x4ecdc4, u0: -16, v0:   6, u1: -10, v1:  12 },
    { id: "house",   color: 0xffe66d, u0:  -6, v0: -14, u1:   0, v1:  -8 },
    { id: "garage",  color: 0xa8dadc, u0:   6, v0:  10, u1:  12, v1:  16 },
    { id: "diner",   color: 0xff9f1c, u0: -22, v0: -12, u1: -16, v1:  -6 },
    { id: "server_room", color: 0x1a3a5c, u0: -38, v0:  -8, u1: -26, v1:   8 },
    { id: "bank",    color: 0x9b5de5, u0:  18, v0:  12, u1:  24, v1:  18 },
    { id: "park",    color: 0x80ed99, u0: -10, v0:  18, u1:  -2, v1:  26 },
    { id: "studio",  color: 0xf72585, u0:  20, v0: -22, u1:  26, v1: -14 },
  ];

  // Ground
  const groundMat = new THREE.MeshStandardMaterial({ map: makeGroundTexture(), roughness: 0.95 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = "ground";
  scene.add(ground);

  // Sky gradient shader
  _skyUniforms = {
    topColor:    { value: new THREE.Color(0x87ceeb) },
    bottomColor: { value: new THREE.Color(0xffd9aa) },
    offset:      { value: 33 },
    exponent:    { value: 0.6 },
  };
  const skyMat = new THREE.ShaderMaterial({
    uniforms: _skyUniforms,
    vertexShader: `varying vec3 vWorld; void main(){ vWorld = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 topColor; uniform vec3 bottomColor; uniform float offset; uniform float exponent;
      varying vec3 vWorld;
      void main(){
        float h = normalize(vWorld + vec3(0.0, offset, 0.0)).y;
        gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
      }`,
    side: THREE.BackSide, depthWrite: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), skyMat);
  sky.name = "sky";
  scene.add(sky);
  scene.background = null;

  // Grid
  const grid = new THREE.GridHelper(200, 40, 0x222222, 0x222222);
  grid.position.y = 0.01;
  grid.name = "grid";
  scene.add(grid);

  // Ambient + directional
  const amb = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(amb);
  const sun = new THREE.DirectionalLight(0xffffff, 0.85);
  sun.position.set(5, 10, 5);
  sun.name = "sun";
  scene.add(sun);

  // Buildings — exact code from game.html mountEnvironment
  for (const bldg of buildings) {
    const { u0, v0, u1, v1 } = bldg;
    const w = u1 - u0, d = v1 - v0;
    const h = 4 + Math.random() * 6;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: bldg.color })
    );
    mesh.position.set((u0 + u1) / 2, h / 2, (v0 + v1) / 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.id = bldg.id;
    mesh.name = "building-" + bldg.id;
    scene.add(mesh);
  }

  window._scene = scene;
}

function updateSkyColors(registry) {
  if (!_skyUniforms) return;
  const worlds = (registry.byKind?.("world") || []).concat(registry.byKind?.("root") || []);
  for (const wp of worlds) {
    const dn = registry.facetData(wp.id, "day-night");
    if (!dn || dn.sky === undefined) continue;
    _skyUniforms.topColor.value.setHex(dn.sky);
    return;
  }
}
