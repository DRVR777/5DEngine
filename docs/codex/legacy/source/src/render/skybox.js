// Skybox preset switcher + fog density + sun rotation — mounted onto window.
// mountSkybox({ THREE, scene, ambLight, sun, showToast })
export function mountSkybox({ THREE, scene, ambLight, sun, showToast }) {
  const _presets = {
    day:    { bg: 0x87ceeb, fog: 0x87ceeb, fogNear: 40, fogFar: 140, ambColor: 0xffffff, ambInt: 0.9, sunColor: 0xffffff, sunInt: 1.1 },
    sunset: { bg: 0xff7744, fog: 0xee6633, fogNear: 20, fogFar: 90,  ambColor: 0xff9966, ambInt: 0.8, sunColor: 0xff8800, sunInt: 1.4 },
    night:  { bg: 0x060a1a, fog: 0x060a1a, fogNear: 15, fogFar: 60,  ambColor: 0x223366, ambInt: 0.3, sunColor: 0x3366aa, sunInt: 0.4 },
    holo:   { bg: 0x010810, fog: 0x010810, fogNear: 30, fogFar: 100, ambColor: 0x00ccff, ambInt: 0.4, sunColor: 0x00ffaa, sunInt: 0.6 },
    space:  { bg: 0x000008, fog: 0x000008, fogNear: 60, fogFar: 300, ambColor: 0x8866ff, ambInt: 0.2, sunColor: 0xffffff, sunInt: 2.0 },
  };

  window._setSkybox = function(name) {
    const p = _presets[name];
    if (!p) return;
    scene.background = new THREE.Color(p.bg);
    if (scene.fog) { scene.fog.color.set(p.fog); scene.fog.near = p.fogNear; scene.fog.far = p.fogFar; }
    ambLight.color.set(p.ambColor); ambLight.intensity = p.ambInt;
    sun.color.set(p.sunColor); sun.intensity = p.sunInt;
    const fn = document.getElementById("fogNear"), ff = document.getElementById("fogFar");
    const ai = document.getElementById("ambInt"),  si = document.getElementById("sunInt");
    if (fn) { fn.value = p.fogNear; document.getElementById("fogNearV").textContent = p.fogNear; }
    if (ff) { ff.value = p.fogFar;  document.getElementById("fogFarV").textContent  = p.fogFar;  }
    if (ai) { ai.value = p.ambInt;  document.getElementById("ambIntV").textContent  = p.ambInt;  }
    if (si) { si.value = p.sunInt;  document.getElementById("sunIntV").textContent  = p.sunInt;  }
    showToast(`Skybox: ${name}`, "info", 1500);
  };

  window._setFogDensity = function(d) {
    if (d > 0) {
      scene.fog = new THREE.FogExp2(scene.background ? scene.background.getHex() : 0x87ceeb, d * 0.04);
    } else {
      scene.fog = new THREE.Fog(scene.background ? scene.background.getHex() : 0x87ceeb, 40, 140);
    }
  };

  window._rotateSun = function(azimuthDeg) {
    const rad = azimuthDeg * Math.PI / 180;
    sun.position.set(Math.sin(rad) * 30, 30, Math.cos(rad) * 30);
  };

  return { skyboxPresets: _presets };
}
