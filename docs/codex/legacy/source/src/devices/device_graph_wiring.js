// Extracted from index.html device graph setup.
// Behavior-preservation phase: keep device ids, ports, positions, files, radio ranges, and mon1 bridge.

export function mountDeviceGraphWiring({
  THREE,
  scene,
  devicesApi,
  wiresApi,
  screenMesh,
  worldData,
  computerEntity,
  worldScreens,
  windowRef = window,
}) {
  const deviceBus = (devicesApi && devicesApi.createBus)
    ? devicesApi.createBus()
    : null;
  const wireMeshes = new Map();
  const devicePositions = new Map();

  function rebuildDeviceWires() {
    if (!deviceBus || !wiresApi) return;
    for (const m of wireMeshes.values()) scene.remove(m);
    wireMeshes.clear();
    const map = wiresApi.buildAllWireMeshes(THREE, deviceBus, (id) => {
      const v = devicePositions.get(id);
      return v ? { x: v.x, y: v.y, z: v.z } : null;
    });
    for (const [wireId, mesh] of map) {
      scene.add(mesh);
      wireMeshes.set(wireId, mesh);
    }
  }

  if (!deviceBus) {
    return { deviceBus, wireMeshes, devicePositions, rebuildDeviceWires };
  }

  const _devs = worldData.devices || {};
  function devPos(key, fallbackDu, fallbackDv, fallbackDy) {
    const d = _devs[key] || {};
    if (d.u !== undefined) return { u: d.u, v: d.v, y: d.dy !== undefined ? d.dy : fallbackDy };
    return {
      u: computerEntity.u + (d.du !== undefined ? d.du : fallbackDu),
      v: computerEntity.v + (d.dv !== undefined ? d.dv : fallbackDv),
      y: d.dy !== undefined ? d.dy : fallbackDy,
    };
  }
  const PC_POS  = devPos("pc",     0,     0,    1.1);
  const MON_POS = devPos("mon",    0,     0,    1.6);
  const SPK_POS = devPos("spk",    1.0,  -0.2,  0.8);
  const USB_POS = devPos("usb",   -0.4,   0.1,  1.0);
  const RADIO_A = devPos("radioA", 0.3,  -0.2,  1.4);
  const RADIO_B = devPos("radioB", 14.0,  4.0,  1.0);

  deviceBus.makeComputer({ id: "pc1", position: PC_POS,
    files: { "/boot.txt": "DWRLD OS v0.1", "/readme": "wire stuff together!" } });
  deviceBus.makeMonitor({ id: "mon1", position: MON_POS, size: "small" });
  deviceBus.makeSpeaker({ id: "spk1", position: SPK_POS });
  deviceBus.makeStorageMedia({ id: "usb1", mediaKind: "usb", position: USB_POS,
    files: { "/notes.txt": "your personal stash" }, label: "MY_USB" });
  deviceBus.makeRadio({ id: "radioA", position: RADIO_A, frequency: 94.7,
    txRange: 80, rxRange: 80 });
  deviceBus.makeRadio({ id: "radioB", position: RADIO_B, frequency: 94.7,
    txRange: 80, rxRange: 80 });

  deviceBus.connect("pc1", "video_out", "mon1", "video_in", "video");
  deviceBus.connect("pc1", "audio_out", "spk1", "audio_in", "audio");
  deviceBus.insertMedia("pc1", "usb_a", "usb1");

  function proxy(color, w, h, d, pos) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: color, metalness: 0.4, roughness: 0.4 })
    );
    m.position.set(pos.u, pos.y, pos.v);
    m.castShadow = true;
    scene.add(m);
    return m;
  }

  proxy(0x553311, 0.3, 0.5, 0.3, SPK_POS);
  if (screenMesh) {
    const monScreen = screenMesh.createScreen({
      id: "mon1_phys",
      resolutionW: 384, resolutionH: 224,
      widthM: 0.7, heightM: 0.5,
      state: { lastFrame: "(no signal — boot the PC and click Devices)" },
      paint: (ctx, sc) => {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, sc.resolutionW, sc.resolutionH);
        for (let y = 0; y < sc.resolutionH; y += 2) {
          ctx.fillStyle = "rgba(50, 80, 120, 0.05)";
          ctx.fillRect(0, y, sc.resolutionW, 1);
        }
        ctx.fillStyle = "#88ddff";
        ctx.font = "bold 16px monospace";
        ctx.fillText("MON1  ◯ ON", 8, 22);
        ctx.font = "12px monospace";
        ctx.fillStyle = "#aaccff";
        const lines = String(sc.state.lastFrame || "").split("\n");
        let y = 50;
        for (const line of lines) {
          ctx.fillText(line, 8, y); y += 16;
          if (y > sc.resolutionH - 8) break;
        }
      },
    });
    const monMesh = screenMesh.bindToThree(THREE, monScreen, { doubleSided: true });
    if (monMesh) {
      monMesh.position.set(MON_POS.u, MON_POS.y, MON_POS.v + 0.1);
      monMesh.rotation.y = Math.PI;
      scene.add(monMesh);
      worldScreens.set(monScreen.id, { screen: monScreen, mesh: monMesh });
      windowRef.__mon1Bridge = {
        screen: monScreen,
        pollAndPaint: () => {
          if (!deviceBus) return;
          const frames = deviceBus.drain("mon1", "video_in");
          if (frames.length > 0) {
            const last = frames[frames.length - 1];
            const payload = last.payload || {};
            const txt = payload.frame || JSON.stringify(payload);
            monScreen.state.lastFrame = txt;
          }
        },
      };
    }
  } else {
    proxy(0x222244, 0.7, 0.5, 0.05, MON_POS);
  }
  proxy(0xcccccc, 0.08, 0.25, 0.05, USB_POS);
  proxy(0x222233, 0.18, 0.25, 0.12, RADIO_A);
  proxy(0x222233, 0.18, 0.25, 0.12, RADIO_B);

  devicePositions.set("pc1",    new THREE.Vector3(PC_POS.u,  PC_POS.y,  PC_POS.v));
  devicePositions.set("mon1",   new THREE.Vector3(MON_POS.u, MON_POS.y, MON_POS.v));
  devicePositions.set("spk1",   new THREE.Vector3(SPK_POS.u, SPK_POS.y, SPK_POS.v));
  devicePositions.set("usb1",   new THREE.Vector3(USB_POS.u, USB_POS.y, USB_POS.v));
  devicePositions.set("radioA", new THREE.Vector3(RADIO_A.u, RADIO_A.y, RADIO_A.v));
  devicePositions.set("radioB", new THREE.Vector3(RADIO_B.u, RADIO_B.y, RADIO_B.v));

  rebuildDeviceWires();

  return { deviceBus, wireMeshes, devicePositions, rebuildDeviceWires };
}
