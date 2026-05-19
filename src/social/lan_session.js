// LAN multiplayer session — wraps Socket.IO for in-game peer sync.
// Connects to game_server.js running on the same host+port.
// Protocol: mp_name · mp_pos · mp_event (client→server)
//           mp_welcome · mp_player_joined · mp_player_left · mp_player_name · mp_pos · mp_event (server→client)
//
// createLanSession({ THREE, scene, state, getShowToast, getEnemies, getCamera, getGameState })
//   state = { myIp, onMpWelcomeHook, onMpBuildEvent, pendingFriendRequests }
//   getGameState() → { camYaw, currentWeaponId, heroHp, isSprinting, crouching, inCar }
// Returns proxy { enabled, peers, tick(dt), send(heroPos), sendEvent(type, data),
//                 hitPeer(id, dmg, hs), onEvent(type, cb) }
export function createLanSession({ THREE, scene, state, getShowToast, getEnemies, getCamera, getGameState }) {
  function _toast(msg, variant, ms) {
    const fn = getShowToast();
    if (fn) fn(msg, variant, ms);
  }

  // Hash socket id → unique hue for shirt color
  function _idColor(id) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff;
    const hue = Math.abs(h) % 360;
    // Convert HSL to hex (s=70%, l=50%)
    const s = 0.7, l = 0.5;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
    const m = l - c / 2;
    const hi = Math.floor(hue / 60);
    const [r, g, b] = [
      [c,x,0],[x,c,0],[0,c,x],[0,x,c],[x,0,c],[c,0,x],
    ][hi] || [0,0,0];
    return ((Math.round((r+m)*255) << 16) | (Math.round((g+m)*255) << 8) | Math.round((b+m)*255));
  }

  function _makePlayerMesh(id, name) {
    const shirtColor = _idColor(id);
    const skinMat  = new THREE.MeshStandardMaterial({ color: 0xffcc66 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x223377 });

    const grp = new THREE.Group();

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.4), shirtMat);
    torso.position.y = 1.25; torso.castShadow = true; grp.add(torso);

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), skinMat);
    head.position.y = 1.85; head.castShadow = true; grp.add(head);

    // Eyes
    const eye = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.08, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x111111 })
    );
    eye.position.set(0, 1.92, 0.23); grp.add(eye);

    // Arms
    function _arm() {
      const pivot = new THREE.Group();
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), skinMat);
      m.position.y = -0.35; m.castShadow = true; pivot.add(m);
      return pivot;
    }
    const armL = _arm(); armL.position.set(-0.45, 1.6, 0); grp.add(armL);
    const armR = _arm(); armR.position.set( 0.45, 1.6, 0); grp.add(armR);

    // Legs
    function _leg() {
      const thigh = new THREE.Group();
      const thighMesh = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.43, 0.21), pantsMat);
      thighMesh.position.y = -0.215; thighMesh.castShadow = true;
      thigh.add(thighMesh);
      const shin = new THREE.Group(); shin.position.y = -0.43;
      const shinMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.42, 0.18), pantsMat);
      shinMesh.position.y = -0.21; shinMesh.castShadow = true;
      shin.add(shinMesh);
      thigh.add(shin);
      return { thigh, shin };
    }
    const { thigh: thighL, shin: shinL } = _leg();
    const { thigh: thighR, shin: shinR } = _leg();
    thighL.position.set(-0.18, 0.85, 0); grp.add(thighL);
    thighR.position.set( 0.18, 0.85, 0); grp.add(thighR);

    // Name label (canvas sprite, billboarded each tick)
    const cvs = document.createElement("canvas");
    cvs.width = 256; cvs.height = 56;
    const ctx = cvs.getContext("2d");
    ctx.fillStyle = "rgba(0,8,22,0.85)"; ctx.fillRect(0, 0, 256, 56);
    ctx.fillStyle = "#" + shirtColor.toString(16).padStart(6, "0");
    ctx.font = "bold 24px monospace"; ctx.textAlign = "center";
    ctx.fillText((name || "?").slice(0, 14), 128, 36);
    const tex = new THREE.CanvasTexture(cvs);
    const lbl = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 0.4),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide })
    );
    lbl.position.y = 2.35;
    grp.add(lbl);
    grp._lbl = lbl;

    // Walk animation references
    grp._walkRefs = { armL, armR, thighL, thighR, shinL, shinR };
    grp._walkPhase = Math.random() * Math.PI * 2;

    scene.add(grp);
    return grp;
  }

  function _tryInit() {
    if (typeof io === "undefined") {
      return { enabled: false, peers: new Map(), tick: () => {}, send: () => {},
               sendEvent: () => {}, hitPeer: () => {}, onEvent: () => {} };
    }

    const _sock  = io({ reconnectionAttempts: 10, timeout: 5000 });
    let   _myId  = null;
    const _peers = new Map();  // id → { name, mesh, targetPos, vel, velTime, inVehicle, targetHeading, hp, lastPos }
    const _eventListeners = new Map();  // type → [callback, ...]

    function _emit(type, cb) {
      if (!_eventListeners.has(type)) _eventListeners.set(type, []);
      _eventListeners.get(type).push(cb);
    }
    function _dispatch(type, data) {
      for (const cb of (_eventListeners.get(type) || [])) { try { cb(data); } catch(e) {} }
    }

    function _removePeer(id) {
      const p = _peers.get(id);
      if (p && p.mesh) scene.remove(p.mesh);
      _peers.delete(id);
      _toast(`Player ${p ? p.name : id} left`, "info", 2000);
      _dispatch("player_left", { id, name: p ? p.name : id });
    }

    function _addPeer(id, name, pos) {
      if (_peers.has(id)) return;
      if (id === _myId) return;
      const mesh    = _makePlayerMesh(id, name || id);
      const initPos = pos ? new THREE.Vector3(pos.u || 0, pos.y || 0, pos.v || 0) : new THREE.Vector3();
      mesh.position.copy(initPos);
      _peers.set(id, {
        name: name || id, mesh, targetPos: initPos.clone(),
        vel: new THREE.Vector3(), velTime: 0, inVehicle: false,
        targetHeading: 0, hp: 100, lastPos: { u: pos ? pos.u || 0 : 0, v: pos ? pos.v || 0 : 0, y: pos ? pos.y || 0 : 0 },
      });
      _toast(`Player "${name || id}" joined!`, "success", 2500);
      _dispatch("player_joined", { id, name: name || id });
    }

    // ── Socket events ────────────────────────────────────────────────────────

    _sock.on("connect", () => {
      console.log("[MP] Connected to 5DEngine game server");
      const tag = "P" + Math.floor(Math.random() * 9000 + 1000);
      _sock.emit("mp_name", { name: tag });
    });

    _sock.on("mp_welcome", (data) => {
      _myId = data.your_id;
      if (data.myIp)    state.myIp    = data.myIp;
      if (data.serverIp) state.serverIp = data.serverIp;
      for (const peer of (data.peers || [])) _addPeer(peer.id, peer.name, peer.pos);
      const n = (data.peers || []).length + 1;
      _toast(`Multiplayer online — ${n} player(s)`, "success", 3000);

      // Show persistent LAN share banner so the host knows their URL
      if (typeof document !== "undefined" && data.serverIp) {
        const shareUrl = `http://${data.serverIp}:${window.location.port || 8080}`;
        let banner = document.getElementById("mpLanBanner");
        if (!banner) {
          banner = document.createElement("div");
          banner.id = "mpLanBanner";
          banner.style.cssText = [
            "position:fixed;bottom:54px;left:50%;transform:translateX(-50%)",
            "background:rgba(4,14,30,0.92);border:1px solid #44cc6677;border-radius:6px",
            "padding:6px 16px;color:#44cc66;font-family:monospace;font-size:12px",
            "text-align:center;z-index:8888;pointer-events:none",
          ].join(";");
          document.body.appendChild(banner);
        }
        banner.innerHTML =
          `📡 LAN link: <b style="color:#88ddff">${shareUrl}</b> ` +
          `<span style="color:#888">— share with friends on your network</span>`;
      }

      console.log(`[MP] My ID: ${_myId}  My IP: ${state.myIp}  serverIp: ${state.serverIp}  peers: ${(data.peers || []).length}`);
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
      if (data.id === _myId) return;
      let p = _peers.get(data.id);
      if (!p) { _addPeer(data.id, data.name || data.id, { u: data.u, v: data.v, y: data.y }); p = _peers.get(data.id); }
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
      p.lastPos = { u: newU, v: newV, y: newY };
      if (data.heading   != null) p.targetHeading = data.heading;
      if (data.inVehicle != null) p.inVehicle     = data.inVehicle;
    });

    _sock.on("mp_event", (data) => {
      if (data.type === "enemy_kill") {
        const en = getEnemies().find(e => e.id === data.enemy_id);
        if (en && !en.dead) { en.dead = true; en.respawnT = performance.now() / 1000; }
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

      // Incoming player hit — we were shot by a peer
      if (data.type === "player_hit" && data.targetId === _myId) {
        _dispatch("incoming_hit", { fromId: data.id, damage: data.damage, headshot: !!data.headshot });
      }

      // Duel events — forward to duel listeners
      if (data.type && data.type.startsWith("duel_")) {
        _dispatch(data.type, data);
      }
    });

    _sock.on("disconnect", () => {
      console.log("[MP] Disconnected from game server");
      _toast("Multiplayer disconnected", "danger", 3000);
      for (const [, p] of _peers) if (p.mesh) scene.remove(p.mesh);
      _peers.clear();
      _dispatch("disconnected", {});
    });

    _sock.on("connect_error", (err) => {
      console.warn("[MP] Connection error:", err.message);
    });

    // ── Tick: smooth-lerp + walk animation ────────────────────────────────────
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

        // Heading lerp
        if (p.targetHeading != null) {
          let dH = p.targetHeading - p.mesh.rotation.y;
          while (dH >  Math.PI) dH -= Math.PI * 2;
          while (dH < -Math.PI) dH += Math.PI * 2;
          p.mesh.rotation.y += dH * Math.min(1, dt * 12);
        }

        // Walk cycle animation
        const speed = p.vel.length();
        if (speed > 0.5 && p.mesh._walkRefs) {
          p.mesh._walkPhase += dt * speed * 3.5;
          const s = Math.sin(p.mesh._walkPhase) * 0.45;
          const { armL, armR, thighL, thighR, shinL, shinR } = p.mesh._walkRefs;
          armL.rotation.x  =  s * 0.6;
          armR.rotation.x  = -s * 0.6;
          thighL.rotation.x =  s;
          thighR.rotation.x = -s;
          shinL.rotation.x  = Math.max(0, -s * 0.6);
          shinR.rotation.x  = Math.max(0, s * 0.6);
        }

        // Billboard name label
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

    // Hit a peer — send damage event to server for relay to target
    function hitPeer(peerId, damage, headshot) {
      sendEvent("player_hit", { targetId: peerId, damage, headshot: !!headshot });
      // Optimistically reduce their local HP for visual feedback
      const p = _peers.get(peerId);
      if (p) {
        p.hp = Math.max(0, (p.hp || 100) - damage);
        // Show damage number over them (caller handles this)
      }
    }

    function onEvent(type, cb) { _emit(type, cb); }

    return { enabled: true, peers: _peers, tick, send, sendEvent, hitPeer, onEvent };
  }

  let _inst = null;
  setTimeout(() => { _inst = _tryInit(); }, 600);

  return {
    get enabled() { return !!(_inst && _inst.enabled); },
    get peers()   { return _inst ? _inst.peers : new Map(); },
    tick(dt)             { _inst && _inst.tick(dt); },
    send(heroPos)        { _inst && _inst.send(heroPos); },
    sendEvent(t, d)      { _inst && _inst.sendEvent(t, d); },
    hitPeer(id, dmg, hs) { _inst && _inst.hitPeer(id, dmg, hs); },
    onEvent(type, cb)    { _inst ? _inst.onEvent(type, cb) : setTimeout(() => _inst && _inst.onEvent(type, cb), 700); },
  };
}
