// Computer overlay click delegation + wire-up helpers for Radio/Servers/Friends apps.
// mountComputerUI(deps) → void  (registers all event listeners at call time)
export function mountComputerUI({
  getAPPS,
  getDeviceBus,
  getHeroMedia,
  setHeroMedia,
  getMpState,
  getDuelMode,
  playSfx,
  showToast,
  closeComputer,
  setGameMode,
  setFirstLaunch,
}) {
  if (typeof document === "undefined") return;

  function wireRadioApp() {
    const sendBtn = document.getElementById("rfSend");
    if (!sendBtn || !getDeviceBus()) return;
    sendBtn.addEventListener("click", () => {
      const msg = (document.getElementById("rfMsg") || {}).value || "(blank)";
      getDeviceBus().send("radioA", "rf", { kind: "audio", payload: { msg } });
      document.getElementById("appBody").innerHTML = getAPPS().radio.body();
      wireRadioApp();
    });
  }

  function wireServersApp() {
    // Auto-load share URL from /api/me
    const shareEl = document.getElementById("serverShareUrl");
    if (shareEl) {
      fetch("/api/me")
        .then(r => r.json())
        .then(data => {
          if (!shareEl) return;
          const url = data.shareUrl || `http://${data.lanIp}:${data.port}`;
          shareEl.innerHTML = `<a href="${url}" target="_blank"
            style="color:#88ddff;text-decoration:underline">${url}</a>
            <span style="color:#44cc66;margin-left:8px">✓ ${data.playerCount} player(s) connected</span>`;
        })
        .catch(() => {
          if (shareEl) shareEl.textContent = window.location.href.split("?")[0];
        });
    }

    const scanBtn = document.getElementById("serverScanBtn");
    if (!scanBtn) return;
    scanBtn.addEventListener("click", () => {
      const statusEl = document.getElementById("serverScanStatus");
      const listEl   = document.getElementById("serverList");
      if (statusEl) statusEl.textContent = "Scanning…";
      if (listEl)   listEl.innerHTML = `<div style="color:#888;font-size:12px">⏳ Scanning LAN…</div>`;

      fetch("/scan")
        .then(r => r.json())
        .then(data => {
          if (statusEl) statusEl.textContent = `LAN IP: ${data.localIp || "unknown"}`;
          if (!listEl) return;
          const servers = data.servers || [];
          const currentOrigin = window.location.origin;
          if (servers.length === 0) {
            listEl.innerHTML = `<div style="color:#888;font-size:12px">
              No 5DEngine servers found — make sure the host has started start.bat.
            </div>`;
            return;
          }
          listEl.innerHTML = servers.map(s => {
            const url = `http://${s.ip}:${s.port}`;
            const isCurrent = currentOrigin === url;
            return `
            <div style="display:flex;align-items:center;gap:10px;padding:10px;margin:4px 0;
                        background:#0a1e2a;border:1px solid ${isCurrent ? "#44cc66" : "#4488cc33"};border-radius:6px">
              <div style="flex:1">
                <div style="color:#eee;font-size:12px">${url}
                  ${isCurrent ? '<span style="color:#44cc66;font-size:10px"> ← you are here</span>' : ""}
                </div>
                <div style="color:#888;font-size:11px">${s.playerCount || 0} player(s)</div>
              </div>
              ${!isCurrent ? `<button data-action="join-server" data-url="${url}"
                style="background:#4488cc;border:0;color:#fff;padding:4px 12px;
                       border-radius:4px;cursor:pointer;font-size:11px">
                → Join
              </button>` : ""}
            </div>`;
          }).join("");
        })
        .catch(() => {
          if (statusEl) statusEl.textContent = "Scan failed";
          if (listEl)   listEl.innerHTML = `<div style="color:#c44;font-size:12px">
            ⚠ /scan unreachable — open via start.bat (not file://).
          </div>`;
        });
    });
  }

  function wireFriendsApp() {
    function _loadFriends() {
      const areaEl = document.getElementById("friendListArea");
      fetch("/api/friends")
        .then(r => r.json())
        .then(data => {
          if (!areaEl) return;
          const friends = data.friends || [];
          const pending = data.pending || [];
          const mpState = getMpState();
          for (const r of pending) {
            if (!mpState.pendingFriendRequests.some(p => p.fromIp === r.fromIp)) {
              mpState.pendingFriendRequests.push(r);
            }
          }
          if (friends.length === 0) {
            areaEl.innerHTML = `<div style="color:#888;font-size:12px">
              No friends yet — use Servers app to send requests.
            </div>`;
          } else {
            areaEl.innerHTML = `<div style="color:#88a;font-size:12px;margin-bottom:6px">
                Friends (${friends.length}):
              </div>` +
              friends.map(f => `
                <div style="display:flex;align-items:center;gap:8px;padding:7px 10px;margin:3px 0;
                            background:#0a1e2a;border:1px solid #4488cc33;border-radius:6px">
                  <span style="color:${f.online ? '#44ff88' : '#888'};font-size:14px">
                    ${f.online ? "●" : "○"}
                  </span>
                  <span style="flex:1;color:#eee;font-size:12px">${f.ip}</span>
                  <span style="color:${f.online ? '#44ff88' : '#888'};font-size:11px">
                    ${f.online ? "Online" : "Offline"}
                  </span>
                </div>`).join("");
          }
        })
        .catch(() => {
          if (areaEl) areaEl.innerHTML = `<div style="color:#c44;font-size:12px">
            ⚠ /api/friends unreachable — open via start.bat (not file://).
          </div>`;
        });
    }
    _loadFriends();
    const refreshBtn = document.getElementById("friendRefreshBtn");
    if (refreshBtn) refreshBtn.addEventListener("click", () => {
      const bodyEl = document.getElementById("appBody");
      if (bodyEl) bodyEl.innerHTML = getAPPS().friends.body();
      wireFriendsApp();
    });
  }

  document.getElementById("computerOverlay").addEventListener("click", (e) => {
    if (e.target && e.target.id === "computerClose") {
      closeComputer();
      return;
    }

    const db = getDeviceBus();

    // Insert media into pc1
    if (e.target && e.target.dataset && e.target.dataset.action === "insert" && db) {
      const idx = parseInt(e.target.dataset.mediaidx, 10);
      const port = e.target.dataset.port;
      const m = getHeroMedia()[idx];
      if (m && !db.getDevice("pc1").state.slottedMedia) {
        let busMedia = db.getDevice(m.id);
        if (!busMedia) {
          db.makeStorageMedia({ id: m.id, mediaKind: m.kind, label: m.label, files: m.files });
        }
        const r = db.insertMedia("pc1", port, m.id);
        if (r.ok) {
          const arr = getHeroMedia().slice();
          arr.splice(idx, 1);
          setHeroMedia(arr);
          playSfx("tone:600:80:square", 0.5);
          document.getElementById("appBody").innerHTML = getAPPS().devices.body();
        }
      }
      return;
    }

    // Eject media from pc1
    if (e.target && e.target.dataset && e.target.dataset.action === "eject" && db) {
      const r = db.ejectMedia("pc1");
      if (r.ok) {
        const m = db.getDevice(r.mediaId);
        if (m) {
          const arr = getHeroMedia().slice();
          arr.push({ id: m.id, kind: m.state.mediaKind, label: m.state.label, files: m.state.files });
          setHeroMedia(arr);
        }
        playSfx("click", 0.5);
        document.getElementById("appBody").innerHTML = getAPPS().devices.body();
      }
      return;
    }

    // Join a discovered server — navigate to its URL so Socket.IO auto-connects on load
    const joinBtn = e.target.closest("[data-action='join-server']");
    if (joinBtn) {
      const url = joinBtn.dataset.url;
      if (url) {
        closeComputer();
        playSfx("blip", 0.6);
        showToast(`Joining ${url} …`, "info", 2000);
        setTimeout(() => { window.location.href = url; }, 400);
      }
      return;
    }

    // Send friend request to a discovered server
    if (e.target.dataset && e.target.dataset.action === "friend-request") {
      const targetIp   = e.target.dataset.ip;
      const targetPort = e.target.dataset.port || "5050";
      const scheme     = window.location.protocol.replace(":", "");
      const fromIp     = getMpState().myIp || "unknown";
      if (!targetIp) return;
      fetch(`${scheme}://${targetIp}:${targetPort}/api/friend_request`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ fromIp, fromName: "Player" }),
      })
        .then(r => r.json())
        .then(d => {
          if (d.ok) showToast(`Friend request sent to ${targetIp}`, "success", 2500);
          else      showToast(`Request failed: ${d.reason || "unknown"}`, "danger", 2500);
        })
        .catch(() => showToast(
          `Could not reach ${targetIp} — ensure both use start.bat (same protocol)`, "danger", 3500
        ));
      return;
    }

    // Accept a pending friend request
    if (e.target.dataset && e.target.dataset.action === "accept-friend") {
      const fromIp = e.target.dataset.fromip;
      if (!fromIp) return;
      fetch("/api/friend_accept", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ fromIp }),
      })
        .then(r => r.json())
        .then(d => {
          if (d.ok) {
            const mpState = getMpState();
            mpState.pendingFriendRequests = mpState.pendingFriendRequests.filter(r => r.fromIp !== fromIp);
            showToast(`✓ Accepted ${fromIp} as friend`, "success", 2500);
            const bodyEl = document.getElementById("appBody");
            if (bodyEl && document.getElementById("appTitle")?.textContent === getAPPS().friends.title) {
              bodyEl.innerHTML = getAPPS().friends.body();
              wireFriendsApp();
            }
          }
        })
        .catch(() => showToast("Accept failed — server not reachable", "danger", 2000));
      return;
    }

    // Game mode row click
    const modeEl = e.target.closest("[data-action='set-mode']");
    if (modeEl) {
      const mode = modeEl.dataset.mode;
      if (mode) {
        setGameMode(mode);
        setFirstLaunch(false);
        playSfx("blip", 0.6);
        document.getElementById("appBody").innerHTML = getAPPS().gamemodes.body();
        if (typeof EventBus !== "undefined") {
          EventBus.emit("GAME_MODE_CHANGED", { mode });
        }
        if (mode === "peaceful") {
          setTimeout(() => closeComputer(), 700);
        } else {
          setTimeout(() => {
            closeComputer();
            setTimeout(() => {
              const _dSc = document.getElementById("difficultyScreen");
              if (_dSc) _dSc.style.display = "flex";
            }, 350);
          }, 700);
        }
      }
      return;
    }

    // Duel actions
    const duelChallenge = e.target.closest("[data-action='duel-challenge']");
    if (duelChallenge && getDuelMode) {
      const peerId = duelChallenge.dataset.peerid;
      if (peerId) { getDuelMode() && getDuelMode().startDuel(peerId); playSfx("blip", 0.6); }
      document.getElementById("appBody").innerHTML = getAPPS().duel.body();
      return;
    }
    const duelAccept = e.target.closest("[data-action='duel-accept']");
    if (duelAccept && getDuelMode) {
      const fromId = duelAccept.dataset.fromid;
      if (fromId) { getDuelMode() && getDuelMode().acceptDuel(fromId); playSfx("blip", 0.8); }
      closeComputer();
      return;
    }
    const duelDecline = e.target.closest("[data-action='duel-decline']");
    if (duelDecline && getDuelMode) {
      const fromId = duelDecline.dataset.fromid;
      if (fromId) { getDuelMode() && getDuelMode().declineDuel(fromId); playSfx("blip", 0.4); }
      document.getElementById("appBody").innerHTML = getAPPS().duel.body();
      return;
    }
    const duelCancel = e.target.closest("[data-action='duel-cancel']");
    if (duelCancel && getDuelMode) {
      getDuelMode() && getDuelMode().cancelDuel();
      document.getElementById("appBody").innerHTML = getAPPS().duel.body();
      return;
    }

    // App icon click — open app in window pane
    const app = e.target.closest(".app");
    if (!app) return;
    const id = app.dataset.app;
    const spec = getAPPS()[id];
    if (!spec) return;
    document.getElementById("appHome").style.display = "none";
    document.getElementById("appTitle").textContent = spec.title;
    document.getElementById("appBody").innerHTML = spec.body();
    document.getElementById("appWindow").classList.add("open");
    if (id === "browser") {
      const goBtn = document.getElementById("browserGo");
      if (goBtn) goBtn.addEventListener("click", () => {
        document.getElementById("browserFrame").src = document.getElementById("browserUrl").value;
      });
    }
    if (id === "radio")   wireRadioApp();
    if (id === "friends") wireFriendsApp();
    if (id === "servers") wireServersApp();
    // duel app actions are handled by the delegated click handler above
  });
}
