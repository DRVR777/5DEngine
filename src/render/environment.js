// Environment geometry — ground, sky dome, grid, buildings.
// mountEnvironment({ THREE, scene, buildings }) → { skyUniforms, ground, sky, grid }
export function mountEnvironment({ THREE, scene, buildings }) {
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

  const groundMat = new THREE.MeshStandardMaterial({ map: makeGroundTexture(), roughness: 0.95 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const skyUniforms = {
    topColor:    { value: new THREE.Color(0x87ceeb) },
    bottomColor: { value: new THREE.Color(0xffd9aa) },
    offset:      { value: 33 },
    exponent:    { value: 0.6 },
  };
  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    vertexShader: `varying vec3 vWorld; void main(){ vWorld = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 topColor; uniform vec3 bottomColor; uniform float offset; uniform float exponent;
      varying vec3 vWorld;
      void main(){
        float h = normalize(vWorld + vec3(0.0, offset, 0.0)).y;
        gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
      }`,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), skyMat);
  scene.add(sky);
  scene.background = null;

  const grid = new THREE.GridHelper(200, 40, 0x222222, 0x222222);
  grid.position.y = 0.01;
  scene.add(grid);

  for (const bldg of buildings) {
    const { u0, v0, u1, v1 } = bldg.b.params;
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
    scene.add(mesh);
  }

  return { skyUniforms, ground, sky, grid };
}
