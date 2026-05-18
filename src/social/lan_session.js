// LAN multiplayer session — wraps Socket.IO for in-game peer sync.
// Connects to game_server.py. Fully optional; game works solo without the server.
// Protocol: mp_name · mp_pos · mp_event (client→server)
//           mp_welcome · mp_player_joined · mp_player_left · mp_player_name · mp_pos · mp_event (server→client)
//
// createLanSession({ THREE, scene, state, getShowToast, getEnemies, getCamera, getGameState })
//   state = { myIp, onMpWelcomeHook, onMpBuildEvent, pendingFriendRequests }
//   getGameState() → { camYaw, currentWeaponId, heroHp, isSprinting, crouching, inCar }
// Returns proxy { enabled, tick(dt), send(heroPos), sendEvent(type, data) }
export function createLanSession({ THREE, scene, state, getShowToast, getEnemies, getCamera, getGameState }) {
  function _toast(msg, variant, ms) {
    const fn = getShowToast();
    if (fn) fn(msg, variant, ms);
  }

  function _tryInit() {
    if (typeof io === "undefined") {
      return { enabled: false, tick: () => {}, send: () => {}, sendEvent: () => {} };
    }

    const _sock  = io({ reconnectionAttempts: 5, timeout: 4000 });
    let   _myId  = null;
    const _peers = new Map();  // id → { name, mesh, targetPos, vel, velTime, inVehicle, targetHeading }

    function _makeGhostMesh(name) {
      const grp  = new THREE.Group();
      const bMat = new THREE.MeshStandardMaterial({ color: 0x0077ff, roughness: 0.7 });

      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.2, 8), bMat);
      body.position.y = 0.9; body.castShadow = true;
      grp.add(body);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), bMat);
      head.position.y = 1.72; head.castShadow = true;
      grp.add(head);

      // Name label — canvas texture, billboarded toward camera each tick
      const cvs = document.createElement("canvas");
      cvs.width = 256; cvs.height = 64;
      const ctx = cvs.getContext("2d");
      ctx.fillStyle = "rgba(0,8,22,0.85)"; ctx.fillRect(0, 0, 256, 64);
      ctx.fillStyle = "#00ccff"; ctx.font = "bold 26px monospace";
      ctx.textAlign = "center"; ctx.fillText((name || "?").slice(0, 14), 128, 42);
      const tex = new THREE.CanvasTexture(cvs);
      const lbl = new THREE.Mesh(
        new THREE.PlaneGeometry(1.5, 0.38),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide })
      );
      lbl.position.y = 2.3;
      grp.add(lbl);
      grp._lbl = lbl;

      scene.add(grp);
      return grp;
    }

    function _removePeer(id) {
      const p = _peers.get(id);
      if (p && p.mesh) scene.remove(p.mesh);
      _peers.delete(id);
      _toast(`Player ${p ? p.name : id} left`, "info", 2000);
    }

    function _addPeer(id, name, pos) {
      if (_peers.has(id)) return;
      const mesh    = _makeGhostMesh(name || id);
      const initPos = pos ? new THREE.Vector3(pos.u || 0, pos.y || 0, pos.v || 0) : new THREE.Vector3();
      mesh.position.copy(initPos);
      _peers.set(id, {
        name: name || id, mesh, targetPos: initPos.clone(),
        vel: new THREE.Vector3(), velTime: 0, inVehicle: false,
      });
      _toast(`Player "${name || id}" joined!`, "success", 2500);
    }

    // ── Socket events ────────────────────────────────────────────────────────

    _sock.on("connect", () => {
      console.log("[MP] Connected to 5DEngine game server");
      const tag = "P" + Math.floor(Math.random() * 9000 + 1000);
      _sock.emit("mp_name", { name: tag });
    });

    _sock.on("mp_welcome", (data) => {
      _myId = data.your_id;
      if (data.myIp) state.myIp = data.myIp;
      for (const peer of (data.peers || [])) _addPeer(peer.id, peer.name, peer.pos);
      const n = (data.peers || []).length + 1;
      _toast(`Multiplayer online — ${n} player(s)`, "success", 3000);
      console.log(`[MP] My ID: ${_myId}  My IP: ${state.myIp}  peers: ${(data.peers || []).length}`);
      if (state.onMpWelcomeHook) setTimeout(state.onMpWelcomeHook, 400);
    });

    _sock.on("mp_player_joined", (data) => {
      _addPeer(data.id, data.name, null);
      if (state.onMpWelcomeHook) setTimeout(state.onMpWelcomeHook, 1000);
    });

    _sock.on("mp_player_left", (data) => {
      _removePeer(data.id);
    });

    _sock.on("mp_player_name", (data) => {
      const p = _peers.get(data.id);
      if (p) p.name = data.name;
    });

    _sock.on("mp_pos", (data) => {
      const p = _peers.get(data.id);
      if (!p) return;
      const now  = performance.now();
      const newU = data.u || 0, newY = data.y || 0, newV = data.v || 0;
      if (p.velTime > 0) {
        const dtMs = now - p.velTime;
        if (dtMs >= 10 && dtMs < 500) {
          p.vel.set(
            (newU - p.targetPos.x) / (dtMs / 1000),
            (newY - p.targetPos.y) / (dtMs / 1000),
            (newV - p.targetPos.z) / (dtMs / 1000),
          );
        }
      }
      p.velTime = now;
      p.targetPos.set(newU, newY, newV);
      if (data.heading   != null) p.targetHeading = data.heading;
      if (data.inVehicle != null) p.inVehicle     = data.inVehicle;
    });

    _sock.on("mp_event", (data) => {
      if (data.type === "enemy_kill") {
        const en = getEnemies().find(e => e.id === data.enemy_id);
        if (en && !en.dead) {
          en.dead = true;
          en.respawnT = performance.now() / 1000;
        }
      }
      if (data.type === "build" && state.onMpBuildEvent) state.onMpBuildEvent(data);

      if (data.type === "friend_request") {
        const from = data.fromName || data.fromIp || "someone";
        state.pendingFriendRequests.push({ fromIp: data.fromIp, fromName: data.fromName });
        _toast(`👥 Friend request from ${from} — open Friends app to accept`, "info", 5000);
      }
      if (data.type === "friend_accepted") {
        _toast(`✓ ${data.byIp || "Someone"} accepted your friend request!`, "success", 3000);
      }
    });

    _sock.on("disconnect", () => {
      console.log("[MP] Disconnected from game server");
      _toast("Multiplayer disconnected", "danger", 3000);
      for (const [, p] of _peers) if (p.mesh) scene.remove(p.mesh);
      _peers.clear();
    });

    // ── Tick: smooth-lerp ghost meshes toward received positions ─────────────
    // Dead-reckoning: when no packet has arrived for >60ms and the peer is in a
    // vehicle, extrapolate targetPos forward using last computed velocity (capped
    // 300ms so we don't teleport on reconnect). Lerp: 8 for vehicles, 12 for walkers.
    function tick(dt) {
      const cam = getCamera();
      const now = performance.now();
      for (const [, p] of _peers) {
        if (!p.mesh) continue;
        let drTarget = p.targetPos;
        const msSinceUpdate = p.velTime > 0 ? now - p.velTime : 0;
        if (p.inVehicle && msSinceUpdate > 60 && p.velTime > 0) {
          const extrapolateS = Math.min(msSinceUpdate / 1000, 0.3);
          drTarget = p.targetPos.clone().addScaledVector(p.vel, extrapolateS);
        }
        const lerpK = p.inVehicle ? 8 : 12;
        p.mesh.position.lerp(drTarget, Math.min(1, dt * lerpK));
        if (p.targetHeading != null) {
          let dH = p.targetHeading - p.mesh.rotation.y;
          while (dH >  Math.PI) dH -= Math.PI * 2;
          while (dH < -Math.PI) dH += Math.PI * 2;
          p.mesh.rotation.y += dH * Math.min(1, dt * 12);
        }
        if (p.mesh._lbl && cam) p.mesh._lbl.lookAt(cam.position);
      }
    }

    function send(heroPos) {
      if (!_sock.connected) return;
      const gs = getGameState();
      _sock.emit("mp_pos", {
        u:         heroPos.u || 0,
        v:         heroPos.v || 0,
        y:         heroPos.y || 0,
        heading:   gs.camYaw ?? 0,
        weapon:    gs.currentWeaponId ?? "pistol",
        hp:        gs.heroHp ?? 100,
        anim:      gs.isSprinting ? "sprint" : gs.crouching ? "crouch" : "idle",
        inVehicle: !!gs.inCar,
      });
    }

    function sendEvent(type, data) {
      if (!_sock.connected) return;
      _sock.emit("mp_event", Object.assign({ type }, data));
    }

    return { enabled: true, tick, send, sendEvent, peers: _peers };
  }

  let _inst = null;
  setTimeout(() => { _inst = _tryInit(); }, 600);
  return {
    get enabled() { return !!(_inst && _inst.enabled); },
    tick(dt)        { _inst && _inst.tick(dt); },
    send(heroPos)   { _inst && _inst.send(heroPos); },
    sendEvent(t, d) { _inst && _inst.sendEvent(t, d); },
  };
}
