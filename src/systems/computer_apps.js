// In-world computer OS apps.
// buildComputerApps(getState) → APPS object  { appId: { title, body() } }
// getState() is called each time body() renders — always reads live values.
// addDynamicIcons() injects extra grid icons that aren't in the static HTML.
export function buildComputerApps(getState) {
  return {
    mail: {
      title: "📬 Mail",
      body: () => `<p style="color:#aac;font-size:13px">Inbox (offline-only for now):</p>
      <ul style="color:#ccd;line-height:1.6;font-size:12px">
        <li>[system] Welcome to DWRLD OS. Try the Browser app.</li>
        <li>[system] Press E near a wired screen to interact in-world (planned).</li>
      </ul>`,
    },
    wallet: {
      title: "💰 Wallet",
      body: () => {
        const s = getState();
        const _sw = s.getWeapon();
        const ammo = s.pistolAmmo;
        const bagAmmo = s.Inv.countItem(s.heroInv, _sw.ammoItem || "pistol_9mm");
        const meds    = s.Inv.countItem(s.heroInv, "medkit");
        const hp = (typeof s.heroHealth.hp === "number") ? s.heroHealth.hp : (s.CFG.heroMaxHp || 100);
        return `<pre>player:    hero
score:     ${s.score} coins
weapon:    ${_sw.name || _sw.id} — ${ammo}/${_sw.magCap} mag, ${bagAmmo} reserve
medkits:   ${meds}
HP:        ${hp}/${s.heroHealth.max || 100}</pre>`;
      },
    },
    stats: {
      title: "📊 Stats",
      body: () => {
        const s = getState();
        const hero = s.world.players.get("hero");
        return `<pre>position:  (${hero.u.toFixed(1)}, ${hero.v.toFixed(1)})
in car:    ${s.inCar}
gear:      ${s.carState.gearName || "—"} (${(s.carState.speed || 0).toFixed(1)} m/s)
camDist:   ${s.camDist.toFixed(2)} m
shoulder:  ${s.camSide > 0 ? "right" : "left"} (L to flip)
nearComp:  ${s.nearComputer}</pre>`;
      },
    },
    codex: {
      title: "📖 Codex",
      body: () => `<pre>Codex entries (placeholder — wire to codex.js next):
- DWRLD City   (auto-unlock: enter the world)
- The PC       (auto-unlock: press E on it)
- The Car      (auto-unlock: drive it)
- The Gun      (auto-unlock: fire it)</pre>`,
    },
    achievements: {
      title: "🏆 Achievements",
      body: () => {
        const s = getState();
        return `<pre>${s.score > 0 ? "✓" : "·"} First Coin (collect 1 coin)
${s.score >= 8 ? "✓" : "·"} Coin Hoarder (collect all 8)
${s.inCar ? "✓" : "·"} Behind the Wheel (drive any vehicle)
${s.pistolAmmo < s.getWeapon().magCap ? "✓" : "·"} Pulled the Trigger (fire weapon)</pre>`;
      },
    },
    map: {
      title: "🗺️ Map",
      body: () => {
        const s = getState();
        const buildingList = s.buildings.map(b => `  ${b.id.padEnd(8)} at (${b.b.params.u0},${b.b.params.v0})`).join("\n");
        return `<pre>world: city demo
buildings:
${buildingList}
computer: (${s.computerEntity.u}, ${s.computerEntity.v})
${s.VEHICLE_DEFS.map(v => { const p = s.world.players.get(v.id); return `${v.id}: (${p.u.toFixed(1)}, ${p.v.toFixed(1)})`; }).join("\n")}</pre>`;
      },
    },
    market: {
      title: "🛒 Market",
      body: () => `<pre>Listings (placeholder — wire to marketplace_search.js):
  pistol_9mm × 60      120 coin
  medkit                80 coin
  gun_pistol           500 coin
  car_paint_red         50 coin</pre>`,
    },
    radio: {
      title: "📻 Radio",
      body: () => {
        const s = getState();
        if (!s.deviceBus) return `<pre>device bus not loaded</pre>`;
        const rA = s.deviceBus.getDevice("radioA");
        const rB = s.deviceBus.getDevice("radioB");
        const inbox = s.deviceBus.peek("radioB", "rf").slice(-6);
        const inboxStr = inbox.length ? inbox.map(p => "  • " + JSON.stringify(p.payload)).join("\n") : "  (silence)";
        return `<pre>tuned to: ${rA ? rA.state.frequency : "?"} MHz
yourRadio:   pos (${rA.position.u.toFixed(1)}, ${rA.position.v.toFixed(1)})
remoteRadio: pos (${rB.position.u.toFixed(1)}, ${rB.position.v.toFixed(1)}) — listening on same freq

Last messages remoteRadio heard:
${inboxStr}</pre>
<div style="margin-top:10px">
  <input id="rfMsg" type="text" placeholder="say something..." style="flex:1;background:#0a1626;border:1px solid #4488cc55;color:#eee;padding:6px;border-radius:4px;font-family:inherit;font-size:12px;width:60%">
  <button id="rfSend" style="background:#4488cc;border:0;color:#fff;padding:6px 14px;border-radius:4px;cursor:pointer">📡 Broadcast</button>
</div>`;
      },
    },
    devices: {
      title: "🔌 Devices",
      body: () => {
        const s = getState();
        if (!s.deviceBus) return `<pre>device bus not loaded</pre>`;
        const stats = s.deviceBus.stats();
        const devs = s.deviceBus.listDevices();
        const wires = s.deviceBus.listWires();
        const devLines = devs.map(d => {
          const portStrs = Object.values(d.ports).map(p => `${p.name}[${p.direction}/${p.kind}]`).join(", ");
          return `  ${d.id}  (${d.kind})  ports: ${portStrs}`;
        }).join("\n");
        const wireLines = wires.map(w =>
          `  ${w.kind.padEnd(6)} ${w.a.deviceId}.${w.a.port}  →  ${w.b.deviceId}.${w.b.port}`
        ).join("\n") || "  (no wires)";
        const pc = s.deviceBus.getDevice("pc1");
        const slotted = pc && pc.state.slottedMedia;
        const carriedLines = s.heroMedia.length > 0
          ? s.heroMedia.map((m, i) => {
              const icon = m.kind === "cd" ? "📀" : "💾";
              const port = m.kind === "cd" ? "cd_slot" : "usb_b";
              return `<div style="display:flex;align-items:center;gap:8px;margin:4px 0">
              <span style="flex:1">${icon} ${m.label} <span style="color:#888">(${m.id})</span></span>
              <button data-action="insert" data-mediaidx="${i}" data-port="${port}"
                      style="background:#4488cc;border:0;color:#fff;padding:4px 12px;border-radius:4px;cursor:pointer">Insert → ${port}</button>
            </div>`;
            }).join("")
          : `<div style="color:#888">(no media carried — walk over the CDs/USBs near spawn)</div>`;
        const slottedLine = slotted
          ? `<div style="margin:6px 0;color:#88ddff">Slotted: ${slotted.mediaId} in ${slotted.hostPort}
             <button data-action="eject" style="background:#aa3a3a;border:0;color:#fff;padding:2px 10px;border-radius:4px;cursor:pointer;margin-left:8px">Eject</button>
           </div>`
          : `<div style="color:#888;margin:6px 0">Slotted: (nothing)</div>`;
        return `<pre style="margin-bottom:10px">bus stats: ${stats.deviceCount} devices, ${stats.wireCount} wires
kinds: ${JSON.stringify(stats.kinds)}</pre>
<div style="background:#0a1626;padding:8px;border-radius:6px;border:1px solid #4488cc55;margin-bottom:10px">
  <div style="color:#ffd166;margin-bottom:6px">Carried media:</div>
  ${carriedLines}
  ${slottedLine}
</div>
<pre>== devices ==
${devLines}

== wires ==
${wireLines}</pre>`;
      },
    },
    friends: {
      title: "👥 Friends",
      body: () => {
        const s = getState();
        const pendingHtml = s.mpState.pendingFriendRequests.length > 0
          ? `<div style="color:#ffd166;font-weight:bold;font-size:12px;margin-bottom:6px">
               Pending requests (${s.mpState.pendingFriendRequests.length}):
             </div>` +
            s.mpState.pendingFriendRequests.map(r => `
              <div style="display:flex;align-items:center;gap:10px;padding:8px;margin:3px 0;
                          background:#1a2a10;border:1px solid #66cc4444;border-radius:6px">
                <span style="flex:1;color:#eee;font-size:12px">${r.fromName || r.fromIp}</span>
                <button data-action="accept-friend" data-fromip="${r.fromIp}"
                  style="background:#44aa44;border:0;color:#fff;padding:4px 12px;
                         border-radius:4px;cursor:pointer;font-size:12px">
                  ✓ Accept
                </button>
              </div>`).join("")
          : "";
        return `
          <div style="color:#88a;font-size:12px;margin-bottom:10px">
            Friends are session-scoped — reconnecting to the same server restores the list.
          </div>
          ${pendingHtml}
          <div id="friendListArea">
            <div style="color:#888;font-size:12px">⏳ Loading friend list…</div>
          </div>
          <button id="friendRefreshBtn"
            style="margin-top:10px;background:#4488cc;border:0;color:#fff;padding:5px 14px;
                   border-radius:4px;cursor:pointer;font-size:12px">
            🔄 Refresh
          </button>`;
      },
    },
    servers: {
      title: "🖥️ Servers",
      body: () => `
        <div style="color:#88a;font-size:12px;margin-bottom:10px">
          Find 5DEngine servers on your local network (port 5050).
          Requires HTTP — open via <b style="color:#44ccff">start.bat</b>, not file://.
        </div>
        <div style="display:flex;gap:8px;margin-bottom:12px;align-items:center">
          <button id="serverScanBtn"
            style="background:#4488cc;border:0;color:#fff;padding:6px 16px;
                   border-radius:4px;cursor:pointer;font-size:12px">
            🔍 Scan LAN
          </button>
          <span id="serverScanStatus" style="color:#888;font-size:11px"></span>
        </div>
        <div id="serverList">
          <div style="color:#888;font-size:12px">(press Scan to discover servers)</div>
        </div>`,
    },
    gamemodes: {
      title: "🎮 Game Modes",
      body: () => {
        const s = getState();
        const modes = [
          { id: "peaceful",     icon: "🕊️",  label: "Peaceful",
            desc: "No enemies. Explore and build freely. This is the default state." },
          { id: "solo",         icon: "🎯", label: "Solo",
            desc: "Single-player with enemies — explore, build, and survive." },
          { id: "wave_defense", icon: "🌊", label: "Wave Defense",
            desc: "Survive escalating enemy waves. Turrets recommended." },
        ];
        const rows = modes.map(m => {
          const active  = s.gameMode === m.id;
          const border  = active ? "2px solid #44ccff" : "1px solid #4488cc44";
          const bg      = active ? "#0a2040"           : "#050d1a";
          const check   = active
            ? `<span style="color:#44ccff;font-weight:bold;margin-left:auto;font-size:13px">✓ Active</span>`
            : "";
          return `<div data-action="set-mode" data-mode="${m.id}"
            style="display:flex;align-items:center;gap:12px;padding:10px 14px;margin:6px 0;
                   background:${bg};border:${border};border-radius:6px;cursor:pointer">
            <span style="font-size:20px;pointer-events:none">${m.icon}</span>
            <div style="flex:1;pointer-events:none">
              <div style="color:#eee;font-weight:bold;font-size:13px">${m.label}</div>
              <div style="color:#88a;font-size:11px;margin-top:2px">${m.desc}</div>
            </div>
            ${check}
          </div>`;
        }).join("");
        return `<div style="color:#88a;font-size:12px;margin-bottom:10px">
          Select a game mode — you can change this any time from the Game Modes app.
          <br>Current: <b style="color:#44ccff">${s.gameMode}</b>
        </div>${rows}`;
      },
    },
    files: {
      title: "📁 Files",
      body: () => {
        const s = getState();
        if (!s.deviceBus) return `<pre>device bus not loaded</pre>`;
        const pc = s.deviceBus.getDevice("pc1");
        const slot = pc && pc.state.slottedMedia;
        if (!slot) return `<pre>(no media slotted — go to Devices, insert a CD or USB first)</pre>`;
        const media = s.deviceBus.getDevice(slot.mediaId);
        if (!media) return `<pre>(slot points at missing device)</pre>`;
        const fs = media.state.files || {};
        const paths = Object.keys(fs).sort();
        const writable = media.state.writable ? " (R/W)" : " (R only)";
        const lines = paths.map(p => `  ${p}  ${fs[p].length} bytes`).join("\n");
        const bodies = paths.map(p =>
          `<details style="margin:4px 0"><summary style="cursor:pointer;color:#88ddff">${p}</summary><pre style="background:#0a1626;padding:8px;margin-top:4px">${String(fs[p]).replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]))}</pre></details>`
        ).join("");
        return `<pre>mount: ${media.state.label}${writable}
slot:  ${slot.hostPort}
files: ${paths.length}

${lines}</pre>
<div style="margin-top:10px">${bodies}</div>`;
      },
    },
    duel: {
      title: "⚔️ 1v1 Duel",
      body: () => {
        const s = getState();
        const duel = s.duelMode;
        if (!duel) return `<pre style="color:#888">(duel mode not loaded)</pre>`;
        const duelState    = duel.getDuelState();
        const pending      = duel.getPendingChallenge();
        const peers        = s.mp ? [...s.mp.peers.entries()] : [];

        if (duelState) {
          const phase = duelState.phase;
          const opp   = peers.find(([id]) => id === duelState.opponentId);
          const oppName = opp ? opp[1].name : duelState.opponentId.slice(0, 6);
          return `<div style="text-align:center;padding:12px">
            <div style="color:#ff6644;font-size:16px;font-weight:bold;margin-bottom:8px">⚔️ DUEL IN PROGRESS</div>
            <div style="color:#ccc;font-size:13px;margin-bottom:12px">vs <b>${oppName}</b></div>
            <div style="font-family:monospace;font-size:20px;margin-bottom:12px">
              <span style="color:#44ff88">${duelState.myWins}</span>
              <span style="color:#888"> — </span>
              <span style="color:#ff4444">${duelState.oppWins}</span>
            </div>
            <div style="color:#aaa;font-size:12px;margin-bottom:16px">
              Round ${duelState.round}/10 · ${Math.ceil(duelState.roundTimer)}s remaining
            </div>
            <button data-action="duel-cancel"
              style="background:#aa3333;border:0;color:#fff;padding:7px 20px;border-radius:5px;cursor:pointer;font-size:13px">
              Forfeit Duel
            </button>
          </div>`;
        }

        if (pending) {
          return `<div style="text-align:center;padding:14px">
            <div style="color:#ffcc44;font-size:15px;font-weight:bold;margin-bottom:8px">
              ⚔️ Duel Challenge!
            </div>
            <div style="color:#ccc;font-size:13px;margin-bottom:16px">
              <b>${pending.fromName}</b> wants to 1v1 you (10 rounds)
            </div>
            <div style="display:flex;gap:12px;justify-content:center">
              <button data-action="duel-accept" data-fromid="${pending.fromId}"
                style="background:#228833;border:0;color:#fff;padding:7px 22px;border-radius:5px;cursor:pointer;font-size:13px">
                ✓ Accept
              </button>
              <button data-action="duel-decline" data-fromid="${pending.fromId}"
                style="background:#663333;border:0;color:#fff;padding:7px 22px;border-radius:5px;cursor:pointer;font-size:13px">
                ✗ Decline
              </button>
            </div>
          </div>`;
        }

        if (peers.length === 0) {
          return `<div style="color:#888;padding:16px;text-align:center;font-size:13px">
            No other players connected.<br>Share <b style="color:#44ccff">http://localhost:8080</b>
            or your LAN IP with a friend.
          </div>`;
        }

        const rows = peers.map(([id, p]) => `
          <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;margin:4px 0;
                      background:#0a1626;border:1px solid #4488cc44;border-radius:6px">
            <div style="width:10px;height:10px;border-radius:50%;background:#44ff88;flex-shrink:0"></div>
            <span style="flex:1;color:#eee;font-size:13px">${p.name || id.slice(0,6)}</span>
            <span style="color:#555;font-size:11px">${p.hp != null ? p.hp + " HP" : ""}</span>
            <button data-action="duel-challenge" data-peerid="${id}"
              style="background:#cc5522;border:0;color:#fff;padding:5px 14px;border-radius:4px;cursor:pointer;font-size:12px">
              ⚔️ Challenge
            </button>
          </div>`).join("");

        return `<div style="color:#88a;font-size:12px;margin-bottom:12px">
          Challenge a connected player to a 10-round 1v1. First to 6 wins.
        </div>${rows}`;
      },
    },
    browser: {
      title: "🌐 Browser",
      body: () => `<div style="display:flex;gap:6px;margin-bottom:8px">
  <input id="browserUrl" type="text" value="https://example.com/" style="flex:1;background:#0a1626;border:1px solid #4488cc55;color:#eee;padding:6px;border-radius:4px;font-family:inherit;font-size:12px"/>
  <button id="browserGo" style="background:#4488cc;border:0;color:#fff;padding:6px 14px;border-radius:4px;cursor:pointer">Go</button>
</div>
<iframe id="browserFrame" src="https://example.com/" style="width:100%;height:320px;border:1px solid #4488cc55;border-radius:4px;background:#fff" sandbox="allow-scripts allow-same-origin allow-forms"></iframe>
<div style="color:#88a;font-size:11px;margin-top:6px">⚠ Cross-origin sites may refuse to embed (X-Frame-Options). Try local pages or sites that allow embedding.</div>`,
    },
  };
}

export function addDynamicIcons() {
  if (typeof document === "undefined") return;
  const grid = document.querySelector("#computerOverlay .grid");
  if (!grid) return;
  const extras = [
    { id: "gamemodes", icon: "🎮", label: "Game Modes" },
    { id: "friends",   icon: "👥", label: "Friends"    },
    { id: "servers",   icon: "🖥️",  label: "Servers"    },
    { id: "browser",   icon: "🌐", label: "Browser" },
    { id: "devices",   icon: "🔌", label: "Devices" },
    { id: "files",     icon: "📁", label: "Files" },
    { id: "duel",      icon: "⚔️",  label: "1v1 Duel"  },
  ];
  for (const e of extras) {
    if (grid.querySelector('[data-app="' + e.id + '"]')) continue;
    const div = document.createElement("div");
    div.className = "app"; div.dataset.app = e.id;
    div.innerHTML = '<div class="icon">' + e.icon + '</div><div class="label">' + e.label + '</div>';
    grid.appendChild(div);
  }
}
