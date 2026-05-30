/**
 * remote-player-mesh — Three.js visual for a remote player Thinga.
 *
 * Spawns a blue capsule + name label + health bar when the remote-player Thinga
 * is created. Updates position/health each tick from facet data.
 * Auto-despawns the Thinga after 8s without a state update.
 */
export default {
  priority: 81,

  init(thing, data, registry) {
    const ctx = registry.byKind("render-context")[0];
    if (!ctx) return;
    const rc = registry.facetData(ctx.id, "render-context");
    if (!rc?.THREE || !rc.scene) return;
    const { THREE, scene } = rc;

    // ── Body ────────────────────────────────────────────────────────────────
    const geo = new THREE.CapsuleGeometry(0.4, 1.0, 4, 8);
    const mat = new THREE.MeshLambertMaterial({ color: 0x1177ff });
    data._body = new THREE.Mesh(geo, mat);
    data._body.castShadow = true;

    // ── Health bar ─────────────────────────────────────────────────────────
    const barGeo = new THREE.PlaneGeometry(0.8, 0.07);
    const barMat = new THREE.MeshBasicMaterial({ color: 0x22ee44, side: THREE.DoubleSide, depthTest: false });
    data._bar = new THREE.Mesh(barGeo, barMat);
    data._bar.position.set(0, 2.0, 0);
    data._body.add(data._bar);

    // Background bar (dark gray)
    const bgGeo = new THREE.PlaneGeometry(0.82, 0.09);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide, depthTest: false });
    const bg = new THREE.Mesh(bgGeo, bgMat);
    bg.position.set(0, 2.0, -0.001);
    data._body.add(bg);

    // ── Name label (sprite) ─────────────────────────────────────────────────
    const cnv = document.createElement("canvas");
    cnv.width = 256; cnv.height = 48;
    const ctx2d = cnv.getContext("2d");
    ctx2d.fillStyle = "rgba(0,0,0,0.55)";
    ctx2d.roundRect?.(0, 0, 256, 48, 6);
    ctx2d.fill?.();
    ctx2d.fillStyle = "#7ccfff";
    ctx2d.font = "bold 18px monospace";
    ctx2d.fillText(thing.name || "???", 8, 32);
    const tex = new THREE.CanvasTexture(cnv);
    data._label = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
    data._label.scale.set(2.5, 0.47, 1);
    data._label.position.set(0, 2.55, 0);
    data._body.add(data._label);

    scene.add(data._body);
  },

  tick(thing, data, _dt, registry) {
    if (!data._body) return;

    const pos = registry.facetData(thing.id, "position");
    const hd  = registry.facetData(thing.id, "health-display");
    const rp  = registry.facetData(thing.id, "remote-player");

    // Update mesh position + rotation
    if (pos) {
      data._body.position.set(pos.x, (pos.y ?? 0) + 0.9, pos.z);
      if (pos.rotY !== undefined) data._body.rotation.y = pos.rotY;
    }

    // Update health bar (scale.x + color)
    if (hd && data._bar) {
      const pct = Math.max(0, Math.min(1, (hd.hp ?? 100) / 100));
      data._bar.scale.x = pct;
      // Green → Red hue shift
      data._bar.material.color.setHSL(pct * 0.33, 1.0, 0.55);
    }

    // Timeout: despawn if no updates for 8 seconds
    if (rp && Date.now() - rp.lastSeen > 8000) {
      registry.despawn(thing.id, "timeout");
    }
  },

  cleanup(thing, data) {
    if (data._body) {
      data._body.parent?.remove(data._body);
      data._body.geometry?.dispose();
      data._body.material?.dispose();
      data._bar?.geometry?.dispose();
      data._bar?.material?.dispose();
      data._label?.material?.map?.dispose();
      data._label?.material?.dispose();
    }
  },
};
