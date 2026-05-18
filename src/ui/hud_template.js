// All HUD / overlay / panel HTML — injected at boot before any getElementById calls.
// oninput handlers that reference module-scope vars (scene, heroGroup) use window
// wrapper functions set up by the main module: _setFogNear, _setFogFar, _setHeroScale.
export function mountHudTemplate() {
  if (document.getElementById("fpsCounter")) return; // already mounted
  document.body.insertAdjacentHTML("beforeend", `
<div id="fpsCounter">-- FPS</div>
<div id="clockHud" style="position:fixed;top:8px;left:68px;background:var(--holo-bg);border:1px solid var(--holo-border);border-radius:4px;padding:3px 8px;font-family:var(--mono);font-size:11px;color:var(--holo-text);pointer-events:none;z-index:200;letter-spacing:0.05em">☀ 12:00</div>
<div id="ammoHud" style="display:none">12 / 60</div>
<div id="reloadCircle"><svg width="44" height="44" viewBox="0 0 44 44"><circle cx="22" cy="22" r="18" fill="none" stroke="#00ccff" stroke-width="4" stroke-dasharray="80 33" stroke-linecap="round"/></svg></div>
<div id="dmgDirIndicator" style="display:none;position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:120px;height:120px;pointer-events:none;z-index:998"></div>
<div id="grenadeWarn" style="display:none;position:fixed;left:50%;top:38%;transform:translate(-50%,-50%);pointer-events:none;z-index:999;text-align:center">
  <div style="font-family:ui-monospace,monospace;font-size:22px;font-weight:900;color:#ff2222;letter-spacing:0.12em;text-shadow:0 0 12px #ff0000">⚠ GRENADE!</div>
  <svg id="grenadeRing" width="100" height="100" viewBox="0 0 100 100" style="display:block;margin:4px auto">
    <circle cx="50" cy="50" r="42" fill="none" stroke="#ff2222" stroke-width="4" opacity="0.85" stroke-dasharray="264"/>
  </svg>
</div>
<div id="grenCookTimer" style="display:none;position:fixed;bottom:160px;left:50%;transform:translateX(-50%);font-family:ui-monospace,monospace;font-size:18px;font-weight:bold;letter-spacing:0.12em;pointer-events:none;z-index:999;text-shadow:0 0 8px currentColor"></div>
<div id="waveClearBanner" style="display:none;position:fixed;top:28%;left:50%;transform:translateX(-50%) translateY(-30px);text-align:center;pointer-events:none;z-index:997;transition:opacity 0.35s,transform 0.35s">
  <div id="waveClearTitle" style="font-family:ui-monospace,monospace;font-size:38px;font-weight:900;letter-spacing:0.18em;color:#00ffcc;text-shadow:0 0 24px #00ffccaa,0 2px 0 #004433">WAVE CLEAR</div>
  <div id="waveClearSub" style="font-family:ui-monospace,monospace;font-size:16px;color:#ffd166;margin-top:4px;letter-spacing:0.1em"></div>
</div>
<div id="perkPicker" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.78);z-index:600;flex-direction:column;align-items:center;justify-content:center;gap:18px;font-family:ui-monospace,monospace">
  <div style="font-size:22px;font-weight:900;color:#ffd166;letter-spacing:0.18em;text-shadow:0 0 16px #ffd166aa">CHOOSE A PERK</div>
  <div style="font-size:13px;color:#aaa">Wave <span id="perkWaveNum">0</span> reward &nbsp;·&nbsp; auto-select in <span id="perkTimer">10</span>s</div>
  <div id="perkCards" style="display:flex;gap:14px;flex-wrap:wrap;justify-content:center;max-width:700px"></div>
</div>
<div id="bossHpBar" style="display:none;position:fixed;top:75px;left:50%;transform:translateX(-50%);width:340px;pointer-events:none;z-index:202;text-align:center;font-family:ui-monospace,monospace">
  <div id="bossName" style="font-size:10px;font-weight:900;color:#ff4444;letter-spacing:0.22em;text-transform:uppercase;margin-bottom:4px;text-shadow:0 0 8px #ff0000aa">BOSS</div>
  <div style="width:100%;height:10px;background:rgba(60,0,0,0.7);border:1px solid rgba(255,40,0,0.5);border-radius:5px;overflow:hidden;box-shadow:0 0 12px rgba(255,40,0,0.3)">
    <div id="bossHpFill" style="height:100%;background:linear-gradient(90deg,#cc0000,#ff4400);width:100%;transition:width 0.12s ease-out;border-radius:5px"></div>
  </div>
  <div id="bossHpVal" style="font-size:9px;color:#ff8888;margin-top:3px;letter-spacing:0.1em">1200 / 1200</div>
</div>
<div id="comboHud" style="display:none;position:fixed;top:200px;right:8px;pointer-events:none;z-index:200;font-family:ui-monospace,monospace;text-align:right;min-width:56px">
  <div id="comboMulText" style="font-size:30px;font-weight:900;color:#ffd166;text-shadow:0 0 14px #ff8800cc;letter-spacing:0.04em;line-height:1">x1</div>
  <div style="font-size:9px;color:#aaa;letter-spacing:0.14em;margin-top:-2px">COMBO</div>
  <div style="height:3px;background:rgba(255,200,0,0.15);border-radius:2px;margin-top:5px;overflow:hidden"><div id="comboFill" style="height:100%;background:linear-gradient(90deg,#ff8800,#ffd166);width:100%"></div></div>
</div>
<div id="scopeOverlay" style="display:none;position:fixed;inset:0;pointer-events:none;z-index:1050">
  <div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 50%, transparent 35%, rgba(0,0,0,0.96) 37.5%)"></div>
  <svg style="position:absolute;inset:0;width:100%;height:100%" viewBox="-50 -50 100 100" preserveAspectRatio="xMidYMid meet">
    <circle cx="0" cy="0" r="35" fill="none" stroke="rgba(0,200,255,0.55)" stroke-width="0.5"/>
    <line x1="0" y1="-19" x2="0" y2="-11" stroke="rgba(0,200,255,0.85)" stroke-width="0.35"/>
    <line x1="0" y1="11"  x2="0" y2="19"  stroke="rgba(0,200,255,0.85)" stroke-width="0.35"/>
    <line x1="-19" y1="0" x2="-11" y2="0" stroke="rgba(0,200,255,0.85)" stroke-width="0.35"/>
    <line x1="11"  y1="0" x2="19"  y2="0" stroke="rgba(0,200,255,0.85)" stroke-width="0.35"/>
    <circle cx="0" cy="0" r="0.8" fill="rgba(0,200,255,0.9)"/>
    <line x1="-8" y1="3" x2="-6" y2="3" stroke="rgba(0,200,255,0.45)" stroke-width="0.2"/>
    <line x1="6"  y1="3" x2="8"  y2="3" stroke="rgba(0,200,255,0.45)" stroke-width="0.2"/>
    <line x1="-8" y1="-3" x2="-6" y2="-3" stroke="rgba(0,200,255,0.45)" stroke-width="0.2"/>
    <line x1="6"  y1="-3" x2="8"  y2="-3" stroke="rgba(0,200,255,0.45)" stroke-width="0.2"/>
  </svg>
</div>
<div id="waveBanner" style="display:none;position:fixed;left:0;right:0;top:38%;text-align:center;pointer-events:none;z-index:1100;transform:scaleY(0);transition:transform 0.18s cubic-bezier(.4,0,.2,1)">
  <div style="background:rgba(0,0,0,0.78);border-top:2px solid rgba(0,200,255,0.6);border-bottom:2px solid rgba(0,200,255,0.6);padding:14px 0;">
    <div id="waveBannerLabel" style="font-family:ui-monospace,monospace;font-size:44px;font-weight:900;color:#00ccff;letter-spacing:0.22em;text-shadow:0 0 30px rgba(0,200,255,0.7)">WAVE 1</div>
    <div id="waveBannerSub" style="font-family:ui-monospace,monospace;font-size:13px;color:#aef060;letter-spacing:0.2em;margin-top:4px">GET READY</div>
  </div>
</div>
<div id="weaponPanel">
  <div id="wpName">PISTOL</div>
  <div id="wpAmmo">12<span id="wpReserve"> / 60</span></div>
  <div id="wpMagBar" style="display:flex;gap:2px;margin-top:4px;flex-wrap:wrap;max-width:160px"></div>
  <div id="wpGrenades" style="font-size:10px;color:#ff8800;margin-top:2px;letter-spacing:0.05em">⬡ 3 grenades <span style="color:#555">[G]</span></div>
</div>
<div id="healthBar">
  <div id="hbLabel">HP</div>
  <div id="hbTrack" style="position:relative"><div id="hbGhost" style="position:absolute;top:0;left:0;height:100%;border-radius:3px;background:rgba(255,90,50,0.45);width:100%;pointer-events:none"></div><div id="hbFill" style="position:relative;width:100%;background:linear-gradient(90deg,#00ffaa,#00ccff)"></div></div>
  <div id="hbVal">100</div>
</div>
<div id="armorBar" style="display:none;position:fixed;bottom:88px;right:12px;display:flex;align-items:center;gap:6px;background:rgba(2,5,14,0.75);border:1px solid rgba(255,200,0,0.4);border-radius:4px;padding:4px 8px;pointer-events:none;z-index:200;font-family:var(--mono);font-size:11px">
  <span style="color:#ffd166;letter-spacing:0.1em">AR</span>
  <div style="width:80px;height:6px;background:rgba(255,200,0,0.15);border-radius:3px;overflow:hidden"><div id="arFill" style="height:100%;background:linear-gradient(90deg,#ffd166,#ffaa00);transition:width 0.15s ease-out;width:0%"></div></div>
  <span id="arVal" style="color:#ffd166;min-width:24px">0</span>
</div>
<div id="perkHud" style="display:none;position:fixed;bottom:110px;right:12px;flex-wrap:wrap;justify-content:flex-end;gap:4px;max-width:300px;pointer-events:none;z-index:200;font-family:var(--mono)"></div>
<div id="staminaBar" style="position:fixed;bottom:64px;right:12px;display:flex;align-items:center;gap:6px;background:rgba(2,5,14,0.75);border:1px solid rgba(0,180,255,0.3);border-radius:4px;padding:4px 8px;pointer-events:none;z-index:200;font-family:var(--mono);font-size:11px">
  <span style="color:#44aaff;letter-spacing:0.1em">ST</span>
  <div style="width:80px;height:5px;background:rgba(0,150,255,0.15);border-radius:3px;overflow:hidden"><div id="stFill" style="height:100%;background:linear-gradient(90deg,#44aaff,#00ccff);transition:width 0.08s linear;width:100%"></div></div>
</div>
<div id="statusEffectsHud" style="display:none;position:fixed;bottom:96px;right:12px;display:flex;flex-direction:column;gap:3px;pointer-events:none;z-index:200"></div>
<div id="weaponSelector" style="display:none;position:fixed;bottom:130px;right:8px;display:flex;flex-direction:column;gap:4px;pointer-events:none;z-index:201"></div>
<div id="killFeed" style="position:fixed;top:48px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:4px;pointer-events:none;z-index:200"></div>
<div id="vehicleDash" style="display:none;position:fixed;bottom:52px;left:50%;transform:translateX(-50%);background:rgba(2,8,22,0.94);border:1px solid rgba(0,200,255,0.35);border-radius:10px;padding:10px 24px;font-family:ui-monospace,'Cascadia Code',Consolas,monospace;text-align:center;z-index:200;box-shadow:0 0 24px rgba(0,200,255,0.18)">
  <div id="vdSpeed" style="color:#00ccff;font-size:28px;font-weight:bold;line-height:1">0</div>
  <div style="color:#4488aa;font-size:9px;letter-spacing:0.2em">KM/H</div>
  <div id="vdGear" style="color:#ffd166;font-size:13px;letter-spacing:0.15em;margin-top:4px">N</div>
</div>
<div id="npcDialog" style="display:none;position:fixed;bottom:110px;left:50%;transform:translateX(-50%);width:420px;background:rgba(2,8,22,0.96);border:1px solid rgba(0,200,255,0.45);border-radius:10px;padding:18px 22px;font-family:ui-monospace,'Cascadia Code',Consolas,monospace;color:#b8e8ff;z-index:500;box-shadow:0 0 40px rgba(0,200,255,0.25)">
  <div id="npcDialogName" style="color:#00ccff;font-size:10px;letter-spacing:0.2em;margin-bottom:10px"></div>
  <div id="npcDialogText" style="font-size:13px;line-height:1.6;margin-bottom:14px"></div>
  <div id="npcDialogChoices" style="display:flex;flex-direction:column;gap:6px"></div>
</div>
<div id="toastContainer" style="position:fixed;top:48px;right:8px;display:flex;flex-direction:column;gap:6px;z-index:300;pointer-events:none"></div>
<div id="dmgNumLayer" style="position:fixed;inset:0;pointer-events:none;z-index:200;overflow:hidden"></div>
<div id="questPanel" style="display:none;position:fixed;left:8px;top:50%;transform:translateY(-50%);width:240px;background:rgba(2,8,22,0.94);border:1px solid rgba(0,200,255,0.35);border-radius:8px;padding:14px;font-family:ui-monospace,'Cascadia Code',Consolas,monospace;font-size:11px;color:#b8e8ff;box-shadow:0 0 24px rgba(0,200,255,0.18);z-index:100">
  <div style="color:#00ccff;font-size:10px;letter-spacing:0.18em;margin-bottom:10px">⬡ OBJECTIVES</div>
  <div id="questList"></div>
</div>
<div id="waveHud" style="display:none;position:fixed;top:48px;left:50%;transform:translateX(-50%);
  background:rgba(2,8,22,0.92);border:1px solid rgba(0,200,255,0.4);border-radius:6px;
  padding:5px 18px;font-family:ui-monospace,'Cascadia Code',Consolas,monospace;font-size:11px;
  color:#00ccff;letter-spacing:0.1em;z-index:201;text-align:center;
  box-shadow:0 0 18px rgba(0,200,255,0.2);pointer-events:none">
  <span id="waveLabel">WAVE 1</span>
  <span id="waveDetail" style="color:#b8e8ff;margin-left:8px"></span>
  <span id="heroLevelHud" style="color:#ffd700;margin-left:10px;font-weight:bold"></span>
  <div id="waveChallengeHud" style="color:#ffd166;font-size:10px;margin-top:2px;letter-spacing:0.08em"></div>
  <span id="difficultyBadge" style="display:none;position:absolute;top:4px;right:8px;font-size:9px;font-weight:bold;letter-spacing:0.12em;opacity:0.75"></span>
</div>
<canvas id="rainCanvas" style="display:none;position:fixed;inset:0;pointer-events:none;z-index:5"></canvas>
<div id="charEditor" style="display:none;position:fixed;right:8px;top:200px;width:240px;
  background:rgba(2,8,22,0.90);border:1px solid rgba(0,200,255,0.4);border-radius:8px;
  padding:14px;font-family:ui-monospace,Consolas,monospace;font-size:11px;color:#b8e8ff;
  box-shadow:0 0 24px rgba(0,200,255,0.2);z-index:60;">
  <div style="color:#00ccff;font-size:10px;letter-spacing:0.18em;margin-bottom:10px">CHARACTER EDITOR</div>
  <div style="margin-bottom:8px;color:#778899">Drag a .glb / .obj onto the viewport to replace the hero model</div>
  <div id="charModelName" style="color:#ffd166;margin-bottom:10px">hero (primitive)</div>
  <div style="color:#00ccff;font-size:9px;letter-spacing:0.15em;margin-bottom:6px">ANIMATION STATE MACHINE</div>
  <div id="charStateMachine" style="margin-bottom:10px"></div>
  <div style="display:flex;gap:6px;align-items:center;margin-bottom:10px">
    <label style="color:#778899;font-size:9px">Blend
      <input id="charBlendTime" type="range" min="0.0" max="1.0" step="0.05" value="0.2"
        style="width:70px;accent-color:#00ccff"
        oninput="window._heroSMBlend=+this.value;document.getElementById('charBlendVal').textContent=this.value+'s'">
    </label>
    <span id="charBlendVal" style="color:#ffd166;font-size:9px">0.2s</span>
    <label style="color:#778899;font-size:9px;margin-left:6px">Speed
      <input id="charTimeScale" type="range" min="0.1" max="3" step="0.05" value="1"
        style="width:60px;accent-color:#00ccff"
        oninput="window._heroSMTimeScale=+this.value;document.getElementById('charTSVal').textContent=this.value+'×'">
    </label>
    <span id="charTSVal" style="color:#ffd166;font-size:9px">1×</span>
  </div>
  <div style="color:#00ccff;font-size:9px;letter-spacing:0.15em;margin-bottom:6px">ALL CLIPS</div>
  <div id="charClipList" style="max-height:110px;overflow-y:auto;margin-bottom:10px">
    <div style="color:#334455">no clips loaded</div>
  </div>
  <div style="color:#00ccff;font-size:9px;letter-spacing:0.15em;margin-bottom:6px">TRANSFORM</div>
  <div style="display:flex;gap:6px;flex-wrap:wrap">
    <label style="color:#778899;font-size:9px">Scale
      <input id="charScale" type="range" min="0.1" max="5" step="0.05" value="1"
        style="width:80px;accent-color:#00ccff"
        oninput="window._setHeroScale&&window._setHeroScale(+this.value)">
    </label>
  </div>
</div>
<div id="hotbar">
  <div class="hb-slot" data-slot="0"><span class="hb-num">1</span><span class="hb-icon">📦</span><span class="hb-name">empty</span></div>
  <div class="hb-slot" data-slot="1"><span class="hb-num">2</span><span class="hb-icon">📦</span><span class="hb-name">empty</span></div>
  <div class="hb-slot" data-slot="2"><span class="hb-num">3</span><span class="hb-icon">📦</span><span class="hb-name">empty</span></div>
  <div class="hb-slot" data-slot="3"><span class="hb-num">4</span><span class="hb-icon">📦</span><span class="hb-name">empty</span></div>
  <div class="hb-slot" data-slot="4"><span class="hb-num">5</span><span class="hb-icon">📦</span><span class="hb-name">empty</span></div>
  <div class="hb-slot" data-slot="5"><span class="hb-num">6</span><span class="hb-icon">📦</span><span class="hb-name">empty</span></div>
  <div class="hb-slot" data-slot="6"><span class="hb-num">7</span><span class="hb-icon">📦</span><span class="hb-name">empty</span></div>
  <div class="hb-slot" data-slot="7"><span class="hb-num">8</span><span class="hb-icon">📦</span><span class="hb-name">empty</span></div>
  <div class="hb-slot" data-slot="8"><span class="hb-num">9</span><span class="hb-icon">📦</span><span class="hb-name">empty</span></div>
</div>
<div id="creativeInv">
  <div class="ci-panel">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <h3 style="margin:0">📚 Object Library</h3>
      <span style="color:#888;font-size:11px">Tab or Esc to close &nbsp;·&nbsp; click item to add to hotbar</span>
    </div>
    <div class="ci-section">
      <h4>Primitives</h4>
      <div class="ci-grid" id="ciPrimitives">
        <div class="ci-item" data-kind="cube"><div class="ci-icon">🟦</div><div class="ci-label">Cube</div></div>
        <div class="ci-item" data-kind="sphere"><div class="ci-icon">🔵</div><div class="ci-label">Sphere</div></div>
        <div class="ci-item" data-kind="cylinder"><div class="ci-icon">🔶</div><div class="ci-label">Cylinder</div></div>
        <div class="ci-item" data-kind="plane"><div class="ci-icon">🟩</div><div class="ci-label">Plane</div></div>
        <div class="ci-item" data-kind="light"><div class="ci-icon">💡</div><div class="ci-label">Light</div></div>
      </div>
    </div>
    <div class="ci-section">
      <h4>Imported Assets <span style="color:#888;font-weight:normal">(drag .glb/.obj/.fbx to add)</span></h4>
      <div class="ci-grid" id="ciAssets"></div>
    </div>
  </div>
</div>
<div id="texturePanel">
  <h4>🎨 Textures</h4>
  <div id="texSwatches"></div>
  <div id="texDropZone">drop PNG/JPG<br>to add texture</div>
</div>
<canvas id="minimap" width="180" height="180"></canvas>
<div id="crosshair"></div>
<div id="killMarker"></div>
<div id="damageFlash"></div>
<div id="statusTint"></div>
<div id="keybindPanel" style="display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,6,18,0.96);border:1px solid rgba(0,200,255,0.4);border-radius:8px;padding:20px 28px;z-index:1500;font-family:ui-monospace,'Cascadia Code',Consolas,monospace;font-size:12px;color:#a0c8e0;min-width:320px;pointer-events:none">
  <div style="color:#00ccff;font-size:14px;font-weight:bold;margin-bottom:12px;letter-spacing:0.1em">CONTROLS  <span style="color:#445566;font-size:10px;font-weight:normal">[? to close]</span></div>
  <table style="border-collapse:collapse;width:100%">
    <tr><td style="color:#ffd166;padding:2px 12px 2px 0;min-width:90px">WASD</td><td>Move</td></tr>
    <tr><td style="color:#ffd166">Shift</td><td>Sprint (uses stamina)</td></tr>
    <tr><td style="color:#ffd166">Ctrl</td><td>Crouch</td></tr>
    <tr><td style="color:#ffd166">Space</td><td>Jump</td></tr>
    <tr><td style="color:#ffd166">X</td><td>Dodge roll (iframes, costs stamina)</td></tr>
    <tr><td colspan="2" style="padding-top:8px;color:#334455">── Combat ──</td></tr>
    <tr><td style="color:#ffd166">LMB</td><td>Shoot</td></tr>
    <tr><td style="color:#ffd166">RMB</td><td>Aim down sights</td></tr>
    <tr><td style="color:#ffd166">R</td><td>Reload</td></tr>
    <tr><td style="color:#ffd166">N</td><td>Melee attack (35 dmg, 1.5m)</td></tr>
    <tr><td style="color:#ffd166">G</td><td>Throw grenade</td></tr>
    <tr><td style="color:#ffd166">H</td><td>Use medkit</td></tr>
    <tr><td style="color:#ffd166">1–5</td><td>Select weapon</td></tr>
    <tr><td style="color:#ffd166">Scroll</td><td>Cycle weapons</td></tr>
    <tr><td colspan="2" style="padding-top:8px;color:#334455">── World ──</td></tr>
    <tr><td style="color:#ffd166">F</td><td>Toggle flashlight</td></tr>
    <tr><td style="color:#ffd166">E</td><td>Interact (vehicle / computer)</td></tr>
    <tr><td style="color:#ffd166">Tab</td><td>Shop</td></tr>
    <tr><td style="color:#ffd166">B</td><td>Build mode</td></tr>
    <tr><td style="color:#ffd166">\` (backtick)</td><td>Dev console</td></tr>
    <tr><td style="color:#ffd166">?</td><td>This help panel</td></tr>
  </table>
</div>
<div id="devConsole" style="display:none;position:fixed;bottom:0;left:0;right:0;height:220px;background:rgba(0,6,14,0.94);border-top:1px solid rgba(0,200,255,0.35);z-index:2000;font-family:ui-monospace,'Cascadia Code',Consolas,monospace;font-size:12px;flex-direction:column">
  <div id="devConsoleLogs" style="flex:1;overflow-y:auto;padding:6px 10px;color:#88ccdd;line-height:1.5;max-height:172px"></div>
  <div style="display:flex;align-items:center;border-top:1px solid rgba(0,200,255,0.2);padding:4px 8px;gap:6px">
    <span style="color:#00ccff;font-size:11px">›</span>
    <input id="devConsoleInput" type="text" autocomplete="off" spellcheck="false"
      style="flex:1;background:transparent;border:none;outline:none;color:#e0f0ff;font-family:inherit;font-size:12px"
      placeholder="god | noclip | spawn &lt;type&gt; | tp &lt;u&gt; &lt;v&gt; | wave &lt;n&gt; | heal | ammo | help">
  </div>
</div>
<div id="deathOverlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.82);z-index:1200;align-items:center;justify-content:center;flex-direction:column;font-family:ui-monospace,'Cascadia Code',Consolas,monospace;color:#eee;text-align:center;">
  <div style="font-size:52px;font-weight:bold;color:#ff3333;text-shadow:0 0 30px #ff0000aa;letter-spacing:0.08em;margin-bottom:16px">YOU DIED</div>
  <div id="deathStats" style="font-size:15px;color:#aaa;margin-bottom:24px;line-height:2"></div>
  <div style="font-size:13px;color:#888">Respawning in <b id="deathCountdown" style="color:#ffd166">5</b>s</div>
</div>
<div id="victoryOverlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:1210;align-items:center;justify-content:center;flex-direction:column;font-family:ui-monospace,'Cascadia Code',Consolas,monospace;color:#eee;text-align:center">
  <div style="font-size:48px;font-weight:900;color:#ffd166;text-shadow:0 0 40px #ffaa00cc;letter-spacing:0.1em;margin-bottom:8px">★ VICTORY ★</div>
  <div style="font-size:16px;color:#aef060;margin-bottom:20px;letter-spacing:0.08em">ALL 10 WAVES DEFEATED</div>
  <div id="victoryStats" style="font-size:15px;color:#aaa;margin-bottom:28px;line-height:2.2"></div>
  <button id="victoryPlayAgain" style="padding:10px 28px;background:rgba(255,209,102,0.15);border:2px solid #ffd166;border-radius:6px;color:#ffd166;font-family:inherit;font-size:16px;font-weight:700;cursor:pointer;letter-spacing:0.06em">▶ PLAY AGAIN</button>
</div>
<div id="difficultyScreen" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.93);z-index:1300;align-items:center;justify-content:center;flex-direction:column;font-family:ui-monospace,'Cascadia Code',Consolas,monospace;color:#eee;text-align:center;gap:28px">
  <div style="font-size:40px;font-weight:900;letter-spacing:0.14em;color:#00ffcc;text-shadow:0 0 30px #00ffccaa">SELECT DIFFICULTY</div>
  <div style="font-size:13px;color:#667;letter-spacing:0.08em">Scales enemy HP and damage for all 10 waves</div>
  <div style="display:flex;gap:18px;flex-wrap:wrap;justify-content:center">
    <button class="diffBtn" data-hp="0.65" data-dmg="0.55" style="padding:16px 28px;background:rgba(68,255,136,0.1);border:2px solid #44ff88;border-radius:8px;color:#44ff88;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;letter-spacing:0.08em;min-width:140px;transition:background 0.15s">
      <div style="font-size:20px;margin-bottom:6px">EASY</div>
      <div style="font-size:11px;opacity:0.75">65% HP · 55% DMG</div>
    </button>
    <button class="diffBtn" data-hp="1.0" data-dmg="1.0" style="padding:16px 28px;background:rgba(0,170,255,0.12);border:2px solid #00aaff;border-radius:8px;color:#00aaff;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;letter-spacing:0.08em;min-width:140px;transition:background 0.15s">
      <div style="font-size:20px;margin-bottom:6px">NORMAL</div>
      <div style="font-size:11px;opacity:0.75">100% HP · 100% DMG</div>
    </button>
    <button class="diffBtn" data-hp="1.5" data-dmg="1.35" style="padding:16px 28px;background:rgba(255,136,0,0.1);border:2px solid #ff8800;border-radius:8px;color:#ff8800;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;letter-spacing:0.08em;min-width:140px;transition:background 0.15s">
      <div style="font-size:20px;margin-bottom:6px">HARD</div>
      <div style="font-size:11px;opacity:0.75">150% HP · 135% DMG</div>
    </button>
    <button class="diffBtn" data-hp="2.2" data-dmg="1.8" style="padding:16px 28px;background:rgba(255,34,68,0.1);border:2px solid #ff2244;border-radius:8px;color:#ff2244;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;letter-spacing:0.08em;min-width:140px;transition:background 0.15s">
      <div style="font-size:20px;margin-bottom:6px">NIGHTMARE</div>
      <div style="font-size:11px;opacity:0.75">220% HP · 180% DMG</div>
    </button>
  </div>
  <div style="font-size:11px;color:#446;letter-spacing:0.06em">WASD · mouse aim · G grenade · T smoke · M mine · \` console</div>
</div>
<div id="computerOverlay">
  <div class="desktop">
    <div class="titlebar">
      <span><b style="color:#88ddff">DWRLD OS</b> <span style="color:#888">v0.1 — 5DEngine integration</span></span>
      <span>
        <span style="color:#888;margin-right:14px">[ESC] close</span>
        <span id="computerClose" style="cursor:pointer;color:#ff5d5d;font-weight:bold;font-size:16px;padding:2px 10px;background:#3a0a0a;border-radius:4px;border:1px solid #ff5d5d44">✕</span>
      </span>
    </div>
    <div id="appHome">
      <div class="grid">
        <div class="app" data-app="mail"><div class="icon">📬</div><div class="label">Mail</div></div>
        <div class="app" data-app="wallet"><div class="icon">💰</div><div class="label">Wallet</div></div>
        <div class="app" data-app="stats"><div class="icon">📊</div><div class="label">Stats</div></div>
        <div class="app" data-app="codex"><div class="icon">📖</div><div class="label">Codex</div></div>
        <div class="app" data-app="achievements"><div class="icon">🏆</div><div class="label">Achievements</div></div>
        <div class="app" data-app="map"><div class="icon">🗺️</div><div class="label">Map</div></div>
        <div class="app" data-app="market"><div class="icon">🛒</div><div class="label">Market</div></div>
        <div class="app" data-app="radio"><div class="icon">📻</div><div class="label">Radio</div></div>
      </div>
    </div>
    <div id="appWindow">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <h4 id="appTitle"></h4>
        <span style="cursor:pointer;color:#88ddff" onclick="document.getElementById('appWindow').classList.remove('open');document.getElementById('appHome').style.display='block';">[ home ]</span>
      </div>
      <div id="appBody"></div>
    </div>
  </div>
</div>
<div id="inventory">
  <div class="panel">
    <h3>Inventory <span style="color:#888;font-weight:normal;">— press I or Esc to close</span></h3>
    <div class="grid" id="invGrid"></div>
    <div style="margin-top:10px;color:#888;">Weight: <span id="invWeight">0</span> kg</div>
  </div>
</div>
<div id="shopOverlay">
  <div class="shopPanel">
    <div class="shopTitle">
      <span><b style="color:#aef060">SHOP</b> <span style="color:#888">— buy gear with coins</span></span>
      <span style="color:#ffd166">Coins: <b id="shopCoinDisplay">0</b> &nbsp;
        <span id="shopClose" style="cursor:pointer;color:#ff5d5d;font-weight:bold;font-size:16px;padding:2px 10px;background:#3a0a0a;border-radius:4px;border:1px solid #ff5d5d44">✕</span>
      </span>
    </div>
    <div class="shopGrid" id="shopGrid"></div>
  </div>
</div>
<div id="settingsOverlay">
  <div class="settingsPanel">
    <div class="sTitle">
      <span>⚙ SETTINGS</span>
      <span id="settingsClose" style="cursor:pointer;color:#ff5d5d;font-weight:bold;font-size:16px;padding:2px 10px;background:#3a0a0a;border-radius:4px;border:1px solid #ff5d5d44">✕</span>
    </div>
    <div class="sSection">
      <div class="sLabel">SENSITIVITY</div>
      <div class="sRow">
        <label>Sniper scope sensitivity</label>
        <input type="range" id="sniperSensSlider" min="1" max="8" step="0.1" value="3">
        <span class="sVal" id="sniperSensVal">3.0x</span>
      </div>
      <div class="sRow" style="font-size:10px;color:#446">Higher = slower scope movement when zoomed in</div>
    </div>
    <div class="sSection adminLock">
      <div class="sLabel" style="color:#ffd166">ADMIN PANEL</div>
      <div id="adminLockRow" style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <input type="password" id="adminPwInput" placeholder="password" style="width:140px">
        <button id="adminUnlockBtn" style="background:rgba(0,200,255,0.15);border:1px solid rgba(0,200,255,0.4);color:#00ccff;padding:4px 12px;border-radius:4px;cursor:pointer;font-family:inherit;font-size:11px">Unlock</button>
        <span id="adminLockMsg" style="font-size:10px;color:#f44"></span>
      </div>
      <div id="adminContent" style="display:none">
        <div class="sLabel" style="color:#aef060;margin-bottom:8px">WEAPON TUNING</div>
        <div id="adminWeaponGrid" class="adminGrid"></div>
      </div>
    </div>
  </div>
</div>
<div id="builderUI" style="display:none;position:fixed;top:10px;right:200px;width:290px;background:rgba(2,8,22,0.94);border:1px solid rgba(0,200,255,0.4);border-radius:8px;color:#b8e8ff;font-family:ui-monospace,'Cascadia Code',Consolas,monospace;font-size:12px;padding:12px;z-index:50;box-shadow:0 0 24px rgba(0,200,255,0.18),inset 0 0 12px rgba(0,200,255,0.04)">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
    <span style="color:#00ccff;font-weight:bold;letter-spacing:0.12em;font-size:11px">⬡ BUILD MODE</span>
    <span>
      <button id="bUndo" title="Ctrl+Z" style="background:rgba(0,200,255,0.1);border:1px solid rgba(0,200,255,0.3);color:#b8e8ff;padding:3px 8px;border-radius:3px;cursor:pointer;font-size:11px">↶ undo <span id="bUndoCount" style="color:#4488aa;font-size:10px">0</span></button>
      <button id="bRedo" title="Ctrl+Y" style="background:rgba(0,200,255,0.1);border:1px solid rgba(0,200,255,0.3);color:#b8e8ff;padding:3px 8px;border-radius:3px;cursor:pointer;font-size:11px;margin-left:2px">↷ redo <span id="bRedoCount" style="color:#4488aa;font-size:10px">0</span></button>
    </span>
  </div>
  <div style="margin-bottom:5px;color:#4488aa;font-size:10px;letter-spacing:0.1em">SPAWN OBJECT</div>
  <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px">
    <button class="b-spawn" data-kind="cube"     style="flex:1;background:rgba(0,200,255,0.08);border:1px solid rgba(0,200,255,0.25);color:#b8e8ff;padding:5px 4px;border-radius:3px;cursor:pointer;font-size:11px">Cube</button>
    <button class="b-spawn" data-kind="sphere"   style="flex:1;background:rgba(0,200,255,0.08);border:1px solid rgba(0,200,255,0.25);color:#b8e8ff;padding:5px 4px;border-radius:3px;cursor:pointer;font-size:11px">Sphere</button>
    <button class="b-spawn" data-kind="cylinder" style="flex:1;background:rgba(0,200,255,0.08);border:1px solid rgba(0,200,255,0.25);color:#b8e8ff;padding:5px 4px;border-radius:3px;cursor:pointer;font-size:11px">Cyl</button>
    <button class="b-spawn" data-kind="plane"    style="flex:1;background:rgba(0,200,255,0.08);border:1px solid rgba(0,200,255,0.25);color:#b8e8ff;padding:5px 4px;border-radius:3px;cursor:pointer;font-size:11px">Plane</button>
    <button class="b-spawn" data-kind="light"    style="flex:1;background:rgba(255,209,102,0.1);border:1px solid rgba(255,209,102,0.3);color:#ffd166;padding:5px 4px;border-radius:3px;cursor:pointer;font-size:11px">⬡ Light</button>
  </div>
  <div id="bInspector" style="display:none">
    <hr style="border:none;border-top:1px solid rgba(0,200,255,0.15);margin:8px 0">
    <div style="color:#00ccff;margin-bottom:4px;font-size:10px;letter-spacing:0.1em">SELECTED: <span id="bSelMeta" style="color:#b8e8ff;letter-spacing:0">—</span></div>
    <div style="display:grid;grid-template-columns:auto 1fr 1fr 1fr;gap:4px;align-items:center;margin-bottom:8px">
      <span style="color:#888">pos</span>
      <input id="bPosX" type="number" step="0.1" style="background:#020c1b;border:1px solid rgba(0,200,255,0.25);color:#b8e8ff;padding:3px;width:100%;border-radius:3px;font-family:inherit">
      <input id="bPosY" type="number" step="0.1" style="background:#020c1b;border:1px solid rgba(0,200,255,0.25);color:#b8e8ff;padding:3px;width:100%;border-radius:3px;font-family:inherit">
      <input id="bPosZ" type="number" step="0.1" style="background:#020c1b;border:1px solid rgba(0,200,255,0.25);color:#b8e8ff;padding:3px;width:100%;border-radius:3px;font-family:inherit">
      <span style="color:#888">rot°</span>
      <input id="bRotX" type="number" step="5" style="background:#020c1b;border:1px solid rgba(0,200,255,0.25);color:#b8e8ff;padding:3px;width:100%;border-radius:3px;font-family:inherit">
      <input id="bRotY" type="number" step="5" style="background:#020c1b;border:1px solid rgba(0,200,255,0.25);color:#b8e8ff;padding:3px;width:100%;border-radius:3px;font-family:inherit">
      <input id="bRotZ" type="number" step="5" style="background:#020c1b;border:1px solid rgba(0,200,255,0.25);color:#b8e8ff;padding:3px;width:100%;border-radius:3px;font-family:inherit">
      <span style="color:#888">scl</span>
      <input id="bSclX" type="number" step="0.1" style="background:#020c1b;border:1px solid rgba(0,200,255,0.25);color:#b8e8ff;padding:3px;width:100%;border-radius:3px;font-family:inherit">
      <input id="bSclY" type="number" step="0.1" style="background:#020c1b;border:1px solid rgba(0,200,255,0.25);color:#b8e8ff;padding:3px;width:100%;border-radius:3px;font-family:inherit">
      <input id="bSclZ" type="number" step="0.1" style="background:#020c1b;border:1px solid rgba(0,200,255,0.25);color:#b8e8ff;padding:3px;width:100%;border-radius:3px;font-family:inherit">
    </div>
    <div id="bColorRow" style="display:none;margin-bottom:8px">
      <span style="color:#888">color</span>
      <input id="bColor" type="color" value="#88aaff" style="vertical-align:middle;margin-left:6px;width:42px;height:24px;background:transparent;border:1px solid #4488cc55;border-radius:3px;cursor:pointer">
      <span id="bColorKind" style="color:#888;margin-left:6px;font-size:10px">material</span>
    </div>
    <div id="bIntensityRow" style="display:none;margin-bottom:8px">
      <span style="color:#888">intensity</span>
      <input id="bIntensity" type="range" min="0" max="5" step="0.1" value="1.5" style="width:160px;vertical-align:middle;margin-left:6px">
      <span id="bIntensityVal" style="color:#fff;margin-left:4px">1.5</span>
    </div>
    <div style="display:flex;gap:4px;margin-bottom:4px">
      <button id="bClone" style="flex:1;background:rgba(0,200,255,0.12);border:1px solid rgba(0,200,255,0.35);color:#00ccff;padding:6px;border-radius:3px;cursor:pointer">Clone (Ctrl+D)</button>
      <button id="bDelete" style="flex:1;background:rgba(255,68,102,0.12);border:1px solid rgba(255,68,102,0.35);color:#ff4466;padding:6px;border-radius:3px;cursor:pointer">Delete (Del)</button>
    </div>
    <div id="bScriptRow" style="margin-top:8px">
      <div style="color:#00ccff;font-size:9px;letter-spacing:0.14em;margin-bottom:4px">SCRIPT (JS · runs every frame)</div>
      <textarea id="bScript" rows="5" placeholder="// mesh, dt, time, state, scene, world, CFG available&#10;mesh.rotation.y += dt * 1.5;"
        style="width:100%;box-sizing:border-box;background:#020c1b;border:1px solid rgba(0,200,255,0.3);
        color:#b8e8ff;font-family:ui-monospace,Consolas,monospace;font-size:10px;
        padding:5px;border-radius:3px;resize:vertical"></textarea>
      <div style="display:flex;gap:4px;margin-top:4px">
        <button id="bScriptApply" style="flex:1;background:rgba(0,200,255,0.15);border:1px solid rgba(0,200,255,0.4);
          color:#00ccff;padding:4px;border-radius:3px;cursor:pointer;font-size:10px">Apply</button>
        <button id="bScriptClear" style="background:rgba(255,68,102,0.12);border:1px solid rgba(255,68,102,0.3);
          color:#ff4466;padding:4px 8px;border-radius:3px;cursor:pointer;font-size:10px">Clear</button>
      </div>
      <div id="bScriptError" style="color:#ff4466;font-size:9px;margin-top:4px;min-height:12px"></div>
    </div>
  </div>
  <hr style="border:none;border-top:1px solid rgba(0,200,255,0.15);margin:8px 0">
  <div style="color:#4488aa;margin-bottom:5px;font-size:10px;letter-spacing:0.1em">SCENES</div>
  <div style="display:flex;gap:4px;margin-bottom:4px">
    <select id="bSceneList" style="flex:1;background:#020c1b;color:#b8e8ff;border:1px solid rgba(0,200,255,0.25);padding:4px;border-radius:3px;font-family:inherit;font-size:11px">
      <option value="">— select —</option>
    </select>
    <button id="bSceneLoad" style="background:rgba(0,200,255,0.1);border:1px solid rgba(0,200,255,0.3);color:#b8e8ff;padding:4px 10px;border-radius:3px;cursor:pointer;font-size:11px">Load</button>
    <button id="bSceneDel"  style="background:rgba(255,68,102,0.1);border:1px solid rgba(255,68,102,0.3);color:#ff4466;padding:4px 8px;border-radius:3px;cursor:pointer;font-size:11px">×</button>
  </div>
  <div style="display:flex;gap:4px;margin-bottom:4px">
    <input id="bSceneName" type="text" placeholder="name…" style="flex:1;background:#020c1b;border:1px solid rgba(0,200,255,0.25);color:#b8e8ff;padding:4px;border-radius:3px;font-family:inherit;font-size:11px">
    <button id="bSceneSave" style="background:rgba(0,200,255,0.15);border:1px solid rgba(0,200,255,0.4);color:#00ccff;padding:4px 10px;border-radius:3px;cursor:pointer;font-size:11px">Save</button>
  </div>
  <div style="display:flex;gap:4px;margin-bottom:4px">
    <button id="bExport" style="flex:1;background:rgba(0,200,255,0.06);border:1px solid rgba(0,200,255,0.2);color:#b8e8ff;padding:4px;border-radius:3px;cursor:pointer;font-size:11px">↓ Export</button>
    <button id="bImport" style="flex:1;background:rgba(0,200,255,0.06);border:1px solid rgba(0,200,255,0.2);color:#b8e8ff;padding:4px;border-radius:3px;cursor:pointer;font-size:11px">↑ Import</button>
  </div>
  <input id="bImportFile" type="file" accept=".json,application/json" style="display:none">
  <hr style="border:none;border-top:1px solid rgba(0,200,255,0.15);margin:8px 0">
  <div style="color:#4488aa;font-size:10px;line-height:1.6">
    drag .glb/.obj/.fbx onto window<br>
    LMB=select · drag=move · Del=remove<br>
    arrows/PgUp-Dn nudge · [/] rotY<br>
    +/- scale · Ctrl+D clone · B exit<br>
    <span style="color:#00ccff">K</span>=config · <span style="color:#00ccff">O</span>=environment · <span style="color:#00ccff">P</span>=char editor · <span style="color:#00ccff">H</span>=hierarchy
  </div>
</div>
<div id="sceneHierarchy">
  <div style="color:#00ccff;font-size:10px;letter-spacing:0.18em;margin-bottom:7px;display:flex;align-items:center;gap:6px">
    <span>⬡ SCENE HIERARCHY</span>
    <span id="shCount" style="color:#4488aa;margin-left:auto;font-size:9px">0 obj</span>
  </div>
  <input id="shSearch" type="text" placeholder="filter…"
    style="width:100%;box-sizing:border-box;background:#020c1b;border:1px solid rgba(0,200,255,0.25);
    color:#b8e8ff;padding:3px 6px;border-radius:3px;font-family:inherit;font-size:10px;
    outline:none;caret-color:#00ccff;margin-bottom:6px">
  <div id="shTree"></div>
</div>
<div id="cfgEditor" style="display:none;position:fixed;top:10px;left:10px;width:310px;max-height:90vh;overflow-y:auto;background:rgba(2,8,22,0.96);border:1px solid rgba(0,200,255,0.4);border-radius:8px;color:#b8e8ff;font-family:ui-monospace,'Cascadia Code',Consolas,monospace;font-size:11px;padding:14px;z-index:60;box-shadow:0 0 30px rgba(0,200,255,0.2),inset 0 0 14px rgba(0,200,255,0.04)">
  <div style="color:#00ccff;font-weight:bold;letter-spacing:0.12em;font-size:11px;margin-bottom:12px">⬡ GAME CONFIG EDITOR</div>
  <div id="cfgSections"></div>
  <div style="display:flex;gap:6px;margin-top:14px">
    <button id="cfgApply" style="flex:1;background:rgba(0,255,170,0.12);border:1px solid rgba(0,255,170,0.4);color:#00ffaa;padding:6px;border-radius:3px;cursor:pointer;font-size:11px">Apply Live</button>
    <button id="cfgReset" style="flex:1;background:rgba(255,68,102,0.1);border:1px solid rgba(255,68,102,0.3);color:#ff4466;padding:6px;border-radius:3px;cursor:pointer;font-size:11px">Reset</button>
  </div>
  <div id="cfgMsg" style="color:#4488aa;font-size:10px;margin-top:6px;min-height:14px"></div>
</div>
<div id="envPanel" style="display:none;position:fixed;top:10px;right:260px;width:240px;max-height:88vh;overflow-y:auto;
  background:rgba(2,8,22,0.96);border:1px solid rgba(0,200,255,0.4);border-radius:8px;
  color:#b8e8ff;font-family:ui-monospace,'Cascadia Code',Consolas,monospace;font-size:11px;
  padding:14px;z-index:60;box-shadow:0 0 30px rgba(0,200,255,0.2)">
  <div style="color:#00ccff;font-weight:bold;letter-spacing:0.12em;font-size:11px;margin-bottom:12px">⬡ ENVIRONMENT</div>
  <div style="color:#00ccff;font-size:9px;letter-spacing:0.15em;margin-bottom:6px">TERRAIN</div>
  <div style="display:flex;gap:5px;margin-bottom:12px">
    <button onclick="window._generateTerrain({size:200,segments:96,maxHeight:6,seed:+(document.getElementById('terrainSeed').value||42)})" style="background:rgba(0,255,170,0.12);border:1px solid rgba(0,255,170,0.3);color:#00ffaa;border-radius:3px;padding:3px 8px;cursor:pointer;font-size:10px">⬡ Generate</button>
    <button onclick="window._removeTerrain()" style="background:rgba(255,68,102,0.1);border:1px solid rgba(255,68,102,0.3);color:#ff4466;border-radius:3px;padding:3px 8px;cursor:pointer;font-size:10px">✕ Remove</button>
    <label style="color:#778899;font-size:9px;margin-left:4px">Seed
      <input id="terrainSeed" type="number" min="1" max="9999" value="42"
        style="width:52px;background:rgba(0,8,20,0.8);border:1px solid rgba(0,200,255,0.2);color:#b8e8ff;border-radius:3px;padding:2px 4px;font-size:9px">
    </label>
  </div>
  <div style="color:#00ccff;font-size:9px;letter-spacing:0.15em;margin-bottom:6px">SKYBOX</div>
  <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px" id="skyboxBtns">
    <button onclick="window._setSkybox('day')"    style="background:rgba(135,206,235,0.15);border:1px solid rgba(0,200,255,0.3);color:#b8e8ff;border-radius:3px;padding:3px 7px;cursor:pointer;font-size:10px">☀ Day</button>
    <button onclick="window._setSkybox('sunset')" style="background:rgba(255,120,50,0.12);border:1px solid rgba(255,120,50,0.3);color:#ffaa66;border-radius:3px;padding:3px 7px;cursor:pointer;font-size:10px">🌅 Sunset</button>
    <button onclick="window._setSkybox('night')"  style="background:rgba(10,10,40,0.4);border:1px solid rgba(100,100,200,0.3);color:#8899cc;border-radius:3px;padding:3px 7px;cursor:pointer;font-size:10px">🌙 Night</button>
    <button onclick="window._setSkybox('holo')"   style="background:rgba(0,200,255,0.1);border:1px solid rgba(0,200,255,0.4);color:#00ccff;border-radius:3px;padding:3px 7px;cursor:pointer;font-size:10px">⬡ Holo</button>
    <button onclick="window._setSkybox('space')"  style="background:rgba(5,5,20,0.5);border:1px solid rgba(100,50,200,0.35);color:#aa88ff;border-radius:3px;padding:3px 7px;cursor:pointer;font-size:10px">🪐 Space</button>
  </div>
  <div style="color:#00ccff;font-size:9px;letter-spacing:0.15em;margin-bottom:6px">FOG</div>
  <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:12px">
    <label style="color:#778899;font-size:9px">Near <input id="fogNear" type="range" min="1" max="80" step="1" value="40"
      style="width:100px;accent-color:#00ccff"
      oninput="window._setFogNear&&window._setFogNear(+this.value);document.getElementById('fogNearV').textContent=this.value">
      <span id="fogNearV" style="color:#ffd166">40</span></label>
    <label style="color:#778899;font-size:9px">Far  <input id="fogFar"  type="range" min="20" max="400" step="5" value="140"
      style="width:100px;accent-color:#00ccff"
      oninput="window._setFogFar&&window._setFogFar(+this.value);document.getElementById('fogFarV').textContent=this.value">
      <span id="fogFarV" style="color:#ffd166">140</span></label>
    <label style="color:#778899;font-size:9px">Density <input id="fogDens" type="range" min="0" max="1" step="0.01" value="0"
      style="width:100px;accent-color:#00ccff"
      oninput="window._setFogDensity(+this.value);document.getElementById('fogDensV').textContent=this.value">
      <span id="fogDensV" style="color:#ffd166">0</span></label>
  </div>
  <div style="color:#00ccff;font-size:9px;letter-spacing:0.15em;margin-bottom:6px">BLOOM (post-FX)</div>
  <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:12px">
    <label style="color:#778899;font-size:9px">Strength <input id="bloomStr" type="range" min="0" max="3" step="0.05" value="0.55"
      style="width:100px;accent-color:#00ccff"
      oninput="window._bloomPass&&(window._bloomPass.strength=+this.value);document.getElementById('bloomStrV').textContent=this.value">
      <span id="bloomStrV" style="color:#ffd166">0.55</span></label>
    <label style="color:#778899;font-size:9px">Radius   <input id="bloomRad" type="range" min="0" max="2" step="0.05" value="0.40"
      style="width:100px;accent-color:#00ccff"
      oninput="window._bloomPass&&(window._bloomPass.radius=+this.value);document.getElementById('bloomRadV').textContent=this.value">
      <span id="bloomRadV" style="color:#ffd166">0.40</span></label>
    <label style="color:#778899;font-size:9px">Threshold <input id="bloomThr" type="range" min="0" max="1" step="0.02" value="0.82"
      style="width:100px;accent-color:#00ccff"
      oninput="window._bloomPass&&(window._bloomPass.threshold=+this.value);document.getElementById('bloomThrV').textContent=this.value">
      <span id="bloomThrV" style="color:#ffd166">0.82</span></label>
  </div>
  <div style="color:#00ccff;font-size:9px;letter-spacing:0.15em;margin-bottom:6px">AMBIENT LIGHT</div>
  <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:12px">
    <label style="color:#778899;font-size:9px">Intensity <input id="ambInt" type="range" min="0" max="3" step="0.05" value="0.9"
      style="width:100px;accent-color:#00ccff"
      oninput="window._ambLight&&(window._ambLight.intensity=+this.value);document.getElementById('ambIntV').textContent=this.value">
      <span id="ambIntV" style="color:#ffd166">0.9</span></label>
  </div>
  <div style="color:#00ccff;font-size:9px;letter-spacing:0.15em;margin-bottom:6px">SUN / DIRECTIONAL</div>
  <div style="display:flex;flex-direction:column;gap:5px">
    <label style="color:#778899;font-size:9px">Intensity <input id="sunInt" type="range" min="0" max="4" step="0.1" value="1.2"
      style="width:100px;accent-color:#00ccff"
      oninput="window._sunLight&&(window._sunLight.intensity=+this.value);document.getElementById('sunIntV').textContent=this.value">
      <span id="sunIntV" style="color:#ffd166">1.2</span></label>
    <label style="color:#778899;font-size:9px">Azimuth  <input id="sunAz" type="range" min="0" max="360" step="1" value="45"
      style="width:100px;accent-color:#00ccff"
      oninput="window._rotateSun(+this.value);document.getElementById('sunAzV').textContent=this.value+'°'">
      <span id="sunAzV" style="color:#ffd166">45°</span></label>
  </div>
</div>
<div id="help">
  <b>WASD</b> walk/drive &nbsp;·&nbsp; <b>SHIFT</b> sprint &nbsp;·&nbsp; <b>SPACE</b> jump/handbrake
  &nbsp;·&nbsp; <b>E</b> car/PC/click-screen &nbsp;·&nbsp; <b>I</b> inventory
  &nbsp;·&nbsp; <b>LMB</b> shoot &nbsp;·&nbsp; <b>RMB-hold</b> aim &nbsp;·&nbsp; <b>G</b> grenade &nbsp;·&nbsp; <b>1-5</b> switch weapon &nbsp;·&nbsp; <b>drone</b>: E to pilot · Space/C=up/down
  &nbsp;·&nbsp; <b>H</b> medkit &nbsp;·&nbsp; <b>N</b> melee &nbsp;·&nbsp; <b>T</b> smoke &nbsp;·&nbsp; <b>U</b> flash &nbsp;·&nbsp; <b>M</b> mine &nbsp;·&nbsp; <b>P</b> turret(20¢) &nbsp;·&nbsp; <b>Tab</b> shop &nbsp;·&nbsp; <b>J</b> quests &nbsp;·&nbsp; <b>C</b> crafting &nbsp;·&nbsp; <b>R</b> reload &nbsp;·&nbsp; <b>L</b> shoulder
  &nbsp;·&nbsp; <b>Q/V/Z</b> snap FP/TP/BIRD &nbsp;·&nbsp; <b>M</b> mouse mode &nbsp;·&nbsp; <b>B</b> build mode &nbsp;·&nbsp; <b>\`</b> dev console
  &nbsp;·&nbsp; <b>scroll</b> zoom &nbsp;·&nbsp; <b>ESC</b> close menus
  &nbsp;·&nbsp; <i style="color:#aaa">build: LMB select · drag=move · Del remove · arrows nudge · Tab=library · N=spawn point · K=config · P=char editor</i>
</div>
`);
}
