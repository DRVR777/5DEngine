// Scene lighting — ambient light, directional sun, shadow setup, DayNight init.
// mountLighting({ THREE, scene, Engine, renderer }) → { ambLight, sun }
export function mountLighting({ THREE, scene, Engine, renderer }) {
  const ambLight = new THREE.AmbientLight(0xffffff, 0.9);
  scene.add(ambLight);
  window._ambLight = ambLight;

  const sun = new THREE.DirectionalLight(0xffffff, 1.1);
  sun.position.set(20, 30, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left   = -40; sun.shadow.camera.right  = 40;
  sun.shadow.camera.top    =  40; sun.shadow.camera.bottom = -40;
  scene.add(sun);
  window._sunLight = sun;
  window._renderer = renderer;
  window._scene    = scene;

  if (typeof DayNight !== "undefined") {
    DayNight.init({ scene, sunLight: sun, ambLight, renderer, speed: 1, startHour: 8 });
    Engine.register("dayNight", DayNight);
    Engine.addCommand("hour", "Get/set hour  hour [0-24]", (args) => {
      if (args[0] !== undefined) DayNight.setHour(parseFloat(args[0]));
      return `hour = ${DayNight.getHour().toFixed(2)}`;
    });
    Engine.addCommand("dayspeed", "Get/set day cycle speed  dayspeed [n]", (args) => {
      if (args[0] !== undefined) DayNight.speed = parseFloat(args[0]);
      return `dayspeed = ${DayNight.speed}`;
    });
  }

  return { ambLight, sun };
}
