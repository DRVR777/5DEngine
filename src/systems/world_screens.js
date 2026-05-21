// Extracted from index.html in-world screen setup.
// Behavior-preservation phase: keep screen ids, dimensions, positions, hit regions, and paint literals.

export function mountWorldScreens({
  registry = null,
  THREE,
  scene,
  screenMesh,
  worldScreens,
  worldData,
  get,
  set,
  actions,
  windowRef = window,
}) {
  if (!screenMesh) {
    return { jumbotronScreen: null, skyScreen: null, buildConsoleScreen: null, buildConsoleMesh: null };
  }

  const SM = screenMesh;
  let jumbotronScreen = null;
  let skyScreen = null;

  jumbotronScreen = SM.createScreen({
    id: "jumbotron50",
    resolutionW: 768, resolutionH: 460,
    widthM: SM.SIZE_PRESETS.jumbotron.widthM,
    heightM: SM.SIZE_PRESETS.jumbotron.heightM,
    state: { hypeClicks: 0, lastBtn: "—" },
    hitRegions: [
      { id: "btn_hype",  label: "HYPE",   x: 80,  y: 360, w: 180, h: 70,
        onClick: (sc) => { sc.state.hypeClicks++; sc.state.lastBtn = "HYPE";
                           actions.playSfx("beep:660", 0.5);
                           const deviceBus = get.deviceBus();
                           if (deviceBus) deviceBus.send("pc1", "audio_out",
                             { kind: "audio", payload: { src: "beep:880", volume: 0.5 } }); } },
      { id: "btn_radio", label: "📻 RF",  x: 290, y: 360, w: 180, h: 70,
        onClick: (sc) => {
          sc.state.lastBtn = "RF";
          actions.playSfx("blip", 0.4);
          const deviceBus = get.deviceBus();
          if (deviceBus) deviceBus.send("radioA", "rf", { kind: "audio",
            payload: { msg: "JUMBOTRON shout-out!", src: "tone:520:120:sine", volume: 0.5 } });
        } },
      { id: "btn_coin",  label: "+ COIN", x: 500, y: 360, w: 180, h: 70,
        onClick: (sc) => { sc.state.lastBtn = "COIN"; set.score(get.score() + 1);
                           actions.playSfx("tone:1000:50:sine", 0.4); } },
    ],
    paint: (ctx, sc) => {
      ctx.fillStyle = "#020514";
      ctx.fillRect(0, 0, sc.resolutionW, sc.resolutionH);
      ctx.fillStyle = "#ffd166";
      ctx.font = "bold 38px monospace";
      ctx.fillText("★ DWRLD STADIUM ★", 100, 60);
      ctx.fillStyle = "#88ddff";
      ctx.font = "22px monospace";
      ctx.fillText("LIVE FROM 5DENGINE — IT'S YOU", 120, 110);
      ctx.fillStyle = "#ff5d5d";
      ctx.font = "24px monospace";
      try {
        const hp = get.heroPos();
        ctx.fillText("POS  ( " + hp.u.toFixed(1) + " , " + hp.v.toFixed(1) + " )", 80, 170);
        ctx.fillText("COINS  " + get.score() + " / " + get.pickups().length, 80, 210);
        ctx.fillText("HP     " + Math.round(get.heroHp()) + " / " + get.heroMaxHp(), 80, 250);
        const z = sc.state.spineZone || "—";
        ctx.fillStyle = "#66cc66";
        ctx.fillText("CAM    " + z, 80, 290);
        ctx.fillStyle = "#ffd166";
        ctx.fillText("HYPE   " + sc.state.hypeClicks + "   LAST: " + sc.state.lastBtn, 80, 330);
      } catch (_) {}
      for (const r of sc.hitRegions) {
        ctx.fillStyle = "#1a3d5a";
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.strokeStyle = "#88ddff";
        ctx.lineWidth = 2;
        ctx.strokeRect(r.x, r.y, r.w, r.h);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 24px monospace";
        ctx.fillText(r.label, r.x + 18, r.y + 44);
      }
      ctx.fillStyle = "#888";
      ctx.font = "14px monospace";
      ctx.fillText("aim crosshair at a button & press E to click  ·  any surface = screen",
                   80, sc.resolutionH - 10);
    },
  });
  const jumboMesh = SM.bindToThree(THREE, jumbotronScreen, { doubleSided: true });
  if (jumboMesh) {
    const _jscr = (worldData.screens && worldData.screens.jumbotron) || { u: 30, v: 25, y_offset: 1, rotY: Math.PI };
    jumboMesh.position.set(_jscr.u, jumbotronScreen.heightM / 2 + (_jscr.y_offset || 1), _jscr.v);
    jumboMesh.rotation.y = _jscr.rotY !== undefined ? _jscr.rotY : Math.PI;
    scene.add(jumboMesh);
    worldScreens.set(jumbotronScreen.id, { screen: jumbotronScreen, mesh: jumboMesh });
  }

  skyScreen = SM.createScreen({
    id: "sky1000",
    resolutionW: 1024, resolutionH: 512,
    widthM: SM.SIZE_PRESETS.colossal.widthM,
    heightM: SM.SIZE_PRESETS.colossal.heightM,
    paint: (ctx, sc) => {
      const t = (Date.now() / 1000) % 60;
      ctx.fillStyle = "#000814";
      ctx.fillRect(0, 0, sc.resolutionW, sc.resolutionH);
      ctx.fillStyle = "#ffcc00";
      ctx.font = "bold 96px monospace";
      const msg = "▶ DWRLD ◀  ◆  WIRE THE WORLD TOGETHER  ◆  ";
      const x0 = -(t * 220) % (msg.length * 56);
      ctx.fillText(msg + msg, x0, sc.resolutionH * 0.45);
      ctx.fillStyle = "#88ddff";
      ctx.font = "bold 64px monospace";
      try {
        ctx.fillText("COINS: " + get.score() + " / " + get.pickups().length,
                     sc.resolutionW * 0.3, sc.resolutionH * 0.75);
      } catch (_) {}
    },
  });
  const skyMesh = SM.bindToThree(THREE, skyScreen, { doubleSided: true });
  if (skyMesh) {
    const _sscr = (worldData.screens && worldData.screens.sky) || { u: 0, y: 300, v: 0 };
    skyMesh.position.set(_sscr.u, _sscr.y !== undefined ? _sscr.y : 300, _sscr.v);
    scene.add(skyMesh);
    worldScreens.set(skyScreen.id, { screen: skyScreen, mesh: skyMesh });
  }

  const BUILD_CONSOLE_W = 30, BUILD_CONSOLE_H = 12;
  const BUILD_CONSOLE_RW = 1024, BUILD_CONSOLE_RH = 400;
  const _SPAWN_BTNS = ["box","sphere","cylinder","plane","cone","torus","light"];
  const _SCENE_BTNS = ["undo","redo","clone","delete","save","load"];

  function makeBuildHitRegions() {
    const regions = [];
    _SPAWN_BTNS.forEach((kind, i) => {
      const x = 20 + i * 138, y = 20, w = 126, h = 70;
      regions.push({ id: "spawn_" + kind, label: kind.toUpperCase(), x, y, w, h,
        onClick: () => {
          const hp = get.heroPos();
          const fwdX = Math.sin(get.freeCamYaw() || 0) * 4, fwdZ = Math.cos(get.freeCamYaw() || 0) * 4;
          const worldBuilder = get.worldBuilder();
          if (worldBuilder) worldBuilder.spawnPrimitive(kind, { x: (hp && hp.u || 0) + fwdX, y: 1.0, z: (hp && hp.v || 0) + fwdZ });
          actions.playSfx("blip", 0.3);
        },
      });
    });
    const acts = { undo: () => get.worldBuilder() && get.worldBuilder().undo(), redo: () => get.worldBuilder() && get.worldBuilder().redo(),
      clone: () => get.worldBuilder() && get.worldBuilder().cloneSelected(), delete: () => get.worldBuilder() && get.worldBuilder().deleteSelected(),
      save: () => { const worldBuilder = get.worldBuilder(); if (worldBuilder) { worldBuilder.saveState(); actions.showToast("Scene saved", "success", 800); } },
      load: () => { const worldBuilder = get.worldBuilder(); if (worldBuilder) { const s = worldBuilder.loadState(); if (s) worldBuilder.rehydrate(s); actions.showToast("Scene loaded", "info", 800); } },
    };
    _SCENE_BTNS.forEach((act, i) => {
      const x = 20 + i * 165, y = BUILD_CONSOLE_RH - 90, w = 153, h = 68;
      regions.push({ id: "act_" + act, label: act.toUpperCase(), x, y, w, h, onClick: acts[act] });
    });
    return regions;
  }

  const buildConsoleScreen = SM.createScreen({
    id: "buildConsole",
    resolutionW: BUILD_CONSOLE_RW, resolutionH: BUILD_CONSOLE_RH,
    widthM: BUILD_CONSOLE_W, heightM: BUILD_CONSOLE_H,
    state: { cursorX: -1, cursorY: -1, hoverBtn: null },
    hitRegions: makeBuildHitRegions(),
    paint: (ctx, sc) => {
      ctx.fillStyle = "#030c1e";
      ctx.fillRect(0, 0, BUILD_CONSOLE_RW, BUILD_CONSOLE_RH);
      ctx.fillStyle = "#00ccff";
      ctx.font = "bold 18px monospace";
      ctx.fillText("⬡ 5DENGINE BUILD CONSOLE  [LMB=click · WASD=fly · R=lock toggle]", 14, 14);
      _SPAWN_BTNS.forEach((kind, i) => {
        const x = 20 + i * 138, y = 20, w = 126, h = 70;
        const hover = sc.state.hoverBtn === "spawn_" + kind;
        ctx.fillStyle = hover ? "rgba(0,200,255,0.35)" : "rgba(0,200,255,0.1)";
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = hover ? "#00ccff" : "rgba(0,200,255,0.4)";
        ctx.lineWidth = hover ? 2 : 1;
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = "#b8e8ff";
        ctx.font = "bold 16px monospace";
        ctx.fillText(kind.toUpperCase(), x + 8, y + 34);
        const ico = { box:"▬", sphere:"●", cylinder:"⊙", plane:"▭", cone:"▲", torus:"◎", light:"☀" }[kind] || "+";
        ctx.font = "22px monospace";
        ctx.fillText(ico, x + 8, y + 62);
      });
      const selX = 20, selY = 110;
      ctx.fillStyle = "#00ccff";
      ctx.font = "bold 13px monospace";
      ctx.fillText("SELECTION", selX, selY);
      ctx.fillStyle = "#66aacc";
      ctx.font = "12px monospace";
      try {
        const worldBuilder = get.worldBuilder();
        const sel = worldBuilder && worldBuilder.getSelected();
        if (sel) {
          const p = sel.position, r = sel.rotation, s = sel.scale;
          ctx.fillStyle = "#aef060";
          ctx.fillText(sel.name || sel.uuid.slice(0, 8), selX, selY + 20);
          ctx.fillStyle = "#b8e8ff";
          ctx.fillText(`pos  (${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)})`, selX, selY + 38);
          ctx.fillText(`rot  (${(r.x*57.3).toFixed(0)}°, ${(r.y*57.3).toFixed(0)}°, ${(r.z*57.3).toFixed(0)}°)`, selX, selY + 54);
          ctx.fillText(`scl  (${s.x.toFixed(2)}, ${s.y.toFixed(2)}, ${s.z.toFixed(2)})`, selX, selY + 70);
        } else {
          ctx.fillText("(nothing selected — spawn something above)", selX, selY + 30);
        }
      } catch (_) {}
      _SCENE_BTNS.forEach((act, i) => {
        const x = 20 + i * 165, y = BUILD_CONSOLE_RH - 90, w = 153, h = 68;
        const hover = sc.state.hoverBtn === "act_" + act;
        const danger = act === "delete";
        ctx.fillStyle = danger ? (hover ? "rgba(255,60,60,0.4)" : "rgba(255,60,60,0.12)") : (hover ? "rgba(0,200,255,0.3)" : "rgba(0,200,255,0.08)");
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = danger ? (hover ? "#ff4444" : "rgba(255,60,60,0.4)") : (hover ? "#00ccff" : "rgba(0,200,255,0.3)");
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = danger ? "#ff8888" : "#b8e8ff";
        ctx.font = "bold 15px monospace";
        ctx.fillText(act.toUpperCase(), x + 10, y + 38);
      });
      if (sc.state.cursorX >= 0) {
        const cx = sc.state.cursorX, cy = sc.state.cursorY;
        ctx.strokeStyle = "#ffff00";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx - 10, cy); ctx.lineTo(cx + 10, cy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy + 10); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI*2); ctx.stroke();
      }
    },
  });
  const buildConsoleMesh = SM.bindToThree(THREE, buildConsoleScreen, { doubleSided: false });
  if (buildConsoleMesh) {
    buildConsoleMesh.position.set(0, BUILD_CONSOLE_H / 2 + 1, -88);
    buildConsoleMesh.rotation.y = 0;
    scene.add(buildConsoleMesh);
    worldScreens.set(buildConsoleScreen.id, { screen: buildConsoleScreen, mesh: buildConsoleMesh });
  }
  windowRef._buildConsoleScreen = buildConsoleScreen;
  windowRef._buildConsoleMesh = buildConsoleMesh;

  if (registry) _mountServerRoom(registry, scene, SM, THREE);

  return { jumbotronScreen, skyScreen, buildConsoleScreen, buildConsoleMesh };
}

function _hdr(ctx, text, y) {
  ctx.fillStyle = "#00ff88";
  ctx.font = "bold 18px monospace";
  ctx.fillText(text, 8, y);
}
function _rows(ctx, lines, y0) {
  ctx.fillStyle = "#c0ffc0";
  ctx.font = "14px monospace";
  lines.slice(0, 12).forEach((l, i) => ctx.fillText(l.slice(0, 48), 8, y0 + i * 18));
}
function _bg(ctx) {
  ctx.fillStyle = "#050f0a";
  ctx.fillRect(0, 0, 512, 256);
}
function _mountServerRoom(registry, scene, SM, THREE) {
  const SCREENS = [
    { id:"srv_nginx",    label:"NGINX / HTTP REQUESTS", facet:"http",    rotY: Math.PI/2,       pos:[-27,2, 0],
      row(t,f){ return (f.method||"GET")+" "+(f.path||"").slice(0,28)+" "+(f.status||""); } },
    { id:"srv_procs",    label:"SERVER PROCESSES",       facet:"process", rotY: Math.PI/2,       pos:[-27,2, 4],
      row(t,f){ return (t.name||"").slice(0,20)+"  pid="+(f.pid||"?")+"  cpu="+(f.cpu||"?")+"%"; } },
    { id:"srv_db",       label:"DATABASE ACTIVITY",      facet:"db",      rotY: Math.PI/2,       pos:[-27,2,-4],
      row(t,f){ return (f.query||t.name||"").slice(0,46); } },
    { id:"srv_journal",  label:"SYSTEM JOURNAL",         facet:"journal", rotY: Math.PI/2-0.35,  pos:[-27,2, 8],
      row(t,f){ return (f.unit||"?").slice(0,12)+"  "+(f.message||t.name||"").slice(0,32); } },
  ];
  const active = [];
  for (const cfg of SCREENS) {
    const s = SM.createScreen({
      id: cfg.id, widthM: 3.2, heightM: 1.8, resolutionX: 512, resolutionY: 256,
      paint(ctx) {
        _bg(ctx); _hdr(ctx, cfg.label, 20);
        const things = registry.byFacet ? registry.byFacet(cfg.facet) : [];
        const lines = things.map(t => {
          const f = registry.facetData ? registry.facetData(t.id, cfg.facet) : {};
          return cfg.row(t, f);
        });
        _rows(ctx, lines.length ? lines : ["(no data)"], 42);
      },
    });
    const mesh = SM.bindToThree(THREE, s, { doubleSided: false });
    mesh.position.set(...cfg.pos);
    mesh.rotation.y = cfg.rotY;
    scene.add(mesh);
    active.push(s);
  }
  return active;
}
