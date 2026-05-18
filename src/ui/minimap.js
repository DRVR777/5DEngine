// Minimap renderer — extracted from index.html
// draw(ctx, state) — call once per frame inside tick()
// state: { world, buildings, VEHICLE_DEFS, NPC_DEFS, pickups, ammoPickups,
//          grenadeCrates, crates, weaponPickups, armorPickups, healthPickups,
//          speedOrbs, grenades3D, enemies, heroGroupRotY, MINI_HALF,
//          spawnPoints, nearNpc }

let _sweepAngle = 0;

export function draw(mini, state) {
  const {
    world, buildings, VEHICLE_DEFS, NPC_DEFS, pickups, ammoPickups,
    grenadeCrates, crates, weaponPickups, armorPickups, healthPickups,
    speedOrbs, grenades3D, enemies, heroGroupRotY, MINI_HALF,
    spawnPoints, nearNpc,
  } = state;

  const W = 180, H = 180, CX = W/2, CY = H/2, R = W/2 - 2;
  mini.clearRect(0, 0, W, H);

  mini.save();
  mini.beginPath(); mini.arc(CX, CY, R, 0, Math.PI*2); mini.clip();
  mini.fillStyle = "rgba(0,8,22,0.90)"; mini.fillRect(0, 0, W, H);

  mini.strokeStyle = "rgba(0,200,255,0.08)"; mini.lineWidth = 1;
  for (let g = -4; g <= 4; g++) {
    const gx = CX + g * R / 4;
    mini.beginPath(); mini.moveTo(gx, 0); mini.lineTo(gx, H); mini.stroke();
    mini.beginPath(); mini.moveTo(0, CY + g * R / 4); mini.lineTo(W, CY + g * R / 4); mini.stroke();
  }

  const trailGrad = mini.createConicalGradient
    ? mini.createConicalGradient(_sweepAngle, CX, CY) : null;
  if (trailGrad) {
    trailGrad.addColorStop(0, "rgba(0,200,255,0)");
    trailGrad.addColorStop(0.9, "rgba(0,200,255,0.14)");
    trailGrad.addColorStop(1, "rgba(0,200,255,0)");
    mini.fillStyle = trailGrad;
    mini.beginPath(); mini.arc(CX, CY, R, 0, Math.PI * 2); mini.fill();
  } else {
    mini.strokeStyle = "rgba(0,200,255,0.35)"; mini.lineWidth = 2;
    mini.beginPath(); mini.moveTo(CX, CY);
    mini.lineTo(CX + Math.cos(_sweepAngle) * R, CY + Math.sin(_sweepAngle) * R);
    mini.stroke();
  }

  const hero = world.players.get("hero");
  const u2x = (u) => CX + ((u - hero.u) / MINI_HALF) * R;
  const v2y = (v) => CY + ((v - hero.v) / MINI_HALF) * R;

  for (const bldg of buildings) {
    const { u0, v0, u1, v1 } = bldg.b.params;
    const hex = bldg.color.toString(16).padStart(6, "0");
    mini.fillStyle = "#" + hex + "44"; mini.strokeStyle = "#" + hex + "99"; mini.lineWidth = 1;
    const x0 = u2x(u0), y0 = v2y(v0), x1 = u2x(u1), y1 = v2y(v1);
    const rx = Math.min(x0,x1), ry = Math.min(y0,y1), rw = Math.abs(x1-x0), rh = Math.abs(y1-y0);
    mini.fillRect(rx, ry, rw, rh); mini.strokeRect(rx, ry, rw, rh);
  }

  for (const v of VEHICLE_DEFS) {
    const vp = world.players.get(v.id);
    const vx = u2x(vp.u), vy = v2y(vp.v);
    const col = "#" + (v.color || 0xc1121f).toString(16).padStart(6, "0") + "dd";
    if (v.type === "drone") {
      mini.fillStyle = "#00bbffcc";
      mini.beginPath(); mini.moveTo(vx, vy-5); mini.lineTo(vx+4, vy+3); mini.lineTo(vx-4, vy+3); mini.closePath(); mini.fill();
    } else if (v.type === "mech") {
      mini.fillStyle = "#556677dd"; mini.fillRect(vx - 4, vy - 5, 8, 10);
      mini.fillStyle = "#ff6600bb"; mini.fillRect(vx - 2, vy - 5, 4, 3);
    } else { mini.fillStyle = col; mini.fillRect(vx - 3, vy - 4, 6, 8); }
  }

  for (const n of NPC_DEFS) {
    const np = world.players.get(n.id);
    mini.fillStyle = "#" + n.color.toString(16).padStart(6, "0") + "99";
    mini.beginPath(); mini.arc(u2x(np.u), v2y(np.v), 2, 0, Math.PI*2); mini.fill();
  }

  for (const pk of pickups) {
    if (pk.collected) continue;
    mini.fillStyle = "#ffd700cc";
    mini.beginPath(); mini.arc(u2x(pk.u), v2y(pk.v), 2, 0, Math.PI*2); mini.fill();
  }
  for (const ap of ammoPickups) {
    if (ap.collected) continue;
    mini.fillStyle = "#ffaa00bb"; mini.fillRect(u2x(ap.u) - 2, v2y(ap.v) - 2, 4, 4);
  }
  for (const gc of grenadeCrates) {
    if (!gc.active) continue;
    mini.fillStyle = "#44ff44cc"; mini.fillRect(u2x(gc.u) - 2, v2y(gc.v) - 2, 5, 5);
  }
  for (const cr of crates) {
    if (cr.broken) continue;
    mini.fillStyle = "#aa6622cc"; mini.fillRect(u2x(cr.u) - 3, v2y(cr.v) - 3, 6, 6);
  }
  for (const wp of weaponPickups) {
    if (wp.collected) continue;
    mini.fillStyle = "#aaddffcc";
    mini.fillRect(u2x(wp.u) - 3, v2y(wp.v) - 1, 6, 3);
    mini.fillRect(u2x(wp.u) - 1, v2y(wp.v) - 3, 3, 7);
  }
  for (const av of armorPickups) {
    if (!av.active) continue;
    const ax = u2x(av.u), ay = v2y(av.v);
    mini.fillStyle = "#ffd166cc";
    mini.beginPath(); mini.moveTo(ax, ay-4); mini.lineTo(ax+3, ay); mini.lineTo(ax, ay+3); mini.lineTo(ax-3, ay); mini.closePath(); mini.fill();
  }
  for (const hp of healthPickups) {
    if (hp.collected) continue;
    const hx = u2x(hp.u), hy = v2y(hp.v);
    mini.fillStyle = "#00ff88cc";
    mini.fillRect(hx - 1, hy - 4, 2, 8); mini.fillRect(hx - 4, hy - 1, 8, 2);
  }

  { const _soPulse = 0.5 + 0.5 * Math.sin(performance.now() / 150);
    for (const _so of speedOrbs) {
      if (_so.collected) continue;
      const _sox = u2x(_so.u), _soy = v2y(_so.v);
      mini.fillStyle = `rgba(255,220,0,${0.8 + _soPulse * 0.2})`;
      mini.beginPath();
      for (let _soi2 = 0; _soi2 < 5; _soi2++) {
        const _a1 = _soi2 * Math.PI * 2 / 5 - Math.PI / 2;
        const _a2 = _a1 + Math.PI / 5;
        const _sop = _soi2 === 0 ? mini.moveTo.bind(mini) : mini.lineTo.bind(mini);
        _sop(_sox + Math.cos(_a1) * 5, _soy + Math.sin(_a1) * 5);
        mini.lineTo(_sox + Math.cos(_a2) * 2.5, _soy + Math.sin(_a2) * 2.5);
      }
      mini.closePath(); mini.fill();
    }
  }

  { const _gPulse = 0.5 + 0.5 * Math.sin(performance.now() / 100);
    for (const _grd of grenades3D) {
      const _gx = u2x(_grd.u), _gy = v2y(_grd.v);
      const _isSmk = _grd._isSmoke, _isFlsh = _grd._isFlash;
      mini.strokeStyle = _isSmk ? `rgba(100,180,100,${0.7+_gPulse*0.3})` : _isFlsh ? `rgba(255,255,200,${0.7+_gPulse*0.3})` : `rgba(255,120,0,${0.7+_gPulse*0.3})`;
      mini.lineWidth = 1.5;
      mini.beginPath(); mini.arc(_gx, _gy, 4 + _gPulse * 2, 0, Math.PI * 2); mini.stroke();
      mini.fillStyle = _isSmk ? "#88cc88" : _isFlsh ? "#ffffaa" : "#ff8800";
      mini.beginPath(); mini.arc(_gx, _gy, 2, 0, Math.PI * 2); mini.fill();
    }
  }

  for (const en of enemies) {
    if (en.dead) continue;
    const ep = world.players.get(en.id);
    if (!ep) continue;
    const ex = u2x(ep.u), ey = v2y(ep.v);
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 300);
    if (en.type === "boss") {
      mini.fillStyle = `rgba(220,0,0,${0.8 + pulse * 0.2})`;
      mini.beginPath(); mini.moveTo(ex, ey-8); mini.lineTo(ex+6, ey); mini.lineTo(ex, ey+8); mini.lineTo(ex-6, ey); mini.closePath(); mini.fill();
      mini.strokeStyle = "#ff4444cc"; mini.lineWidth = 1.5; mini.stroke();
    } else if (en.type === "heavy") {
      mini.fillStyle = `rgba(255,120,0,${0.75 + pulse * 0.25})`;
      mini.beginPath(); mini.moveTo(ex, ey-6); mini.lineTo(ex+5, ey); mini.lineTo(ex, ey+6); mini.lineTo(ex-5, ey); mini.closePath(); mini.fill();
    } else if (en.type === "robot") {
      mini.fillStyle = `rgba(0,180,255,${0.7 + pulse * 0.3})`; mini.fillRect(ex - 3, ey - 3, 6, 6);
    } else {
      mini.fillStyle = `rgba(255,40,80,${0.7 + pulse * 0.3})`;
      mini.beginPath(); mini.moveTo(ex, ey-5); mini.lineTo(ex+4, ey); mini.lineTo(ex, ey+5); mini.lineTo(ex-4, ey); mini.closePath(); mini.fill();
    }
  }

  const _aliveEns = enemies.filter(e => !e.dead);
  if (_aliveEns.length === 1) {
    const _le = _aliveEns[0], _lep = world.players.get(_le.id);
    if (_lep) {
      const _lex = u2x(_lep.u), _ley = v2y(_lep.v);
      const _lePulse = 0.5 + 0.5 * Math.sin(performance.now() / 180);
      mini.strokeStyle = `rgba(255,220,0,${0.7 + _lePulse * 0.3})`;
      mini.lineWidth = 1.5 + _lePulse * 1.0;
      mini.beginPath(); mini.arc(_lex, _ley, 9 + _lePulse * 4, 0, Math.PI * 2); mini.stroke();
    }
  }

  mini.fillStyle = "#ffd166";
  mini.beginPath(); mini.arc(CX, CY, 4, 0, Math.PI*2); mini.fill();
  mini.strokeStyle = "#ffd166bb"; mini.lineWidth = 2;
  mini.beginPath(); mini.moveTo(CX, CY);
  mini.lineTo(CX + Math.sin(heroGroupRotY)*9, CY - Math.cos(heroGroupRotY)*9); mini.stroke();

  mini.restore();

  mini.strokeStyle = "rgba(0,200,255,0.45)"; mini.lineWidth = 1.5;
  mini.beginPath(); mini.arc(CX, CY, R, 0, Math.PI*2); mini.stroke();
  mini.strokeStyle = "rgba(0,200,255,0.30)"; mini.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI / 4);
    mini.beginPath();
    mini.moveTo(CX + Math.cos(a) * (R-4), CY + Math.sin(a) * (R-4));
    mini.lineTo(CX + Math.cos(a) * R,     CY + Math.sin(a) * R);
    mini.stroke();
  }

  mini.fillStyle = "rgba(0,200,255,0.85)"; mini.font = "bold 9px monospace"; mini.textAlign = "center";
  mini.fillText("N", CX, 11); mini.fillText("S", CX, H - 3);
  mini.fillStyle = "rgba(0,200,255,0.55)"; mini.font = "8px monospace";
  mini.fillText("E", W - 5, CY + 3); mini.fillText("W", 5, CY + 3);
  mini.textAlign = "left";

  const spGlow = 0.5 + 0.5 * Math.sin(Date.now() / 400);
  for (const sp of spawnPoints) {
    const sx = u2x(sp.u), sy = v2y(sp.v);
    mini.save(); mini.globalAlpha = 0.5 + 0.4 * spGlow;
    mini.fillStyle = "#00ffaa"; mini.translate(sx, sy); mini.rotate(Math.PI / 4);
    mini.fillRect(-3, -3, 6, 6); mini.restore();
  }

  if (nearNpc) {
    const np = world.players.get(nearNpc.id);
    if (np) {
      mini.strokeStyle = "rgba(0,255,170,0.9)"; mini.lineWidth = 1.5;
      mini.beginPath(); mini.arc(u2x(np.u), v2y(np.v), 5, 0, Math.PI * 2); mini.stroke();
    }
  }

  _sweepAngle = (_sweepAngle + 0.05) % (Math.PI * 2);
}

export const Minimap = { draw };
export default Minimap;
