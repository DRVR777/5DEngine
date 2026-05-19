/**
 * 5DEngine game_server.js — Socket.IO relay + static file server + LAN auto-discovery
 *
 * Usage:  node game_server.js [port]        (default: 8080)
 * LAN:    other machines open http://<YOUR-LAN-IP>:<port>
 *
 * Discovery:
 *   UDP broadcast on DISCOVERY_PORT every 5 s → all 5DEngine servers on the same subnet
 *   hear each other automatically.  /scan also does an HTTP sweep of the /24 subnet.
 *
 * Protocol (matches src/social/lan_session.js):
 *   client→server: mp_name · mp_pos · mp_event
 *   server→client: mp_welcome · mp_player_joined · mp_player_left
 *                  mp_player_name · mp_pos · mp_event
 */

import express           from "express";
import { createServer }  from "http";
import { Server }        from "socket.io";
import { networkInterfaces, hostname } from "os";
import { createSocket }  from "dgram";
import path              from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT           = parseInt(process.argv[2] ?? process.env.PORT ?? "8080", 10);
const DISCOVERY_PORT = 8089;  // UDP port — all 5DEngine servers on the LAN listen here

// ── LAN IP detection ────────────────────────────────────────────────────────
function getLanIp() {
  for (const ifaces of Object.values(networkInterfaces())) {
    for (const iface of ifaces) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return "127.0.0.1";
}
const SERVER_IP       = getLanIp();
const SERVER_HOSTNAME = hostname().toLowerCase();   // e.g. "quandale-dingle"
// On Win10+/macOS/Linux with mDNS, other devices can reach us at hostname.local
const MDNS_URL        = `http://${SERVER_HOSTNAME}.local:${PORT}`;

// ── App + HTTP + Socket.IO ──────────────────────────────────────────────────
const app    = express();
const http   = createServer(app);
const io     = new Server(http, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout:  20000,
  pingInterval: 10000,
  transports:   ["websocket", "polling"],
});

// Serve static game files from repo root
app.use(express.static(__dirname, {
  index: "index.html",
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".html")) {
      res.setHeader("Cross-Origin-Opener-Policy",   "same-origin");
      res.setHeader("Cross-Origin-Embedder-Policy",  "require-corp");
    }
  },
}));

// ── Player state ────────────────────────────────────────────────────────────
const players = new Map();  // socket.id → { id, name, pos, ip }

// ── Known LAN servers (auto-populated by UDP + HTTP sweep) ─────────────────
// ip → { ip, port, playerCount, lastSeen }
const knownServers = new Map();

function _upsertServer(ip, port, playerCount) {
  if (ip === SERVER_IP && port === PORT) return;   // don't list ourselves as a peer
  knownServers.set(ip, { ip, port: port || PORT, playerCount: playerCount || 0, lastSeen: Date.now() });
}

function _pruneServers() {
  const cutoff = Date.now() - 30_000;
  for (const [ip, s] of knownServers) if (s.lastSeen < cutoff) knownServers.delete(ip);
}

// ── UDP LAN broadcast discovery ─────────────────────────────────────────────
const _udp = createSocket("udp4");

_udp.on("error", (err) => {
  // Non-fatal — UDP might be blocked by firewall; HTTP sweep still works
  if (err.code !== "EADDRINUSE") console.warn(`[UDP] ${err.message}`);
});

_udp.on("message", (msg, rinfo) => {
  try {
    const data = JSON.parse(msg.toString());
    if (data.type === "5dengine_announce" && data.ip && data.port) {
      _upsertServer(data.ip, data.port, data.playerCount || 0);
    }
  } catch { /* ignore malformed */ }
});

_udp.bind(DISCOVERY_PORT, () => {
  try {
    _udp.setBroadcast(true);
    console.log(`  UDP  → discovery on port ${DISCOVERY_PORT}`);
  } catch { /* non-fatal */ }
});

function _broadcastPresence() {
  const payload = Buffer.from(JSON.stringify({
    type: "5dengine_announce",
    ip:   SERVER_IP,
    port: PORT,
    playerCount: players.size,
  }));
  _udp.send(payload, 0, payload.length, DISCOVERY_PORT, "255.255.255.255", (err) => {
    if (err && err.code !== "ENETUNREACH") console.warn(`[UDP broadcast] ${err.message}`);
  });
}

// ── HTTP subnet sweep ───────────────────────────────────────────────────────
// Probes every IP on the same /24 subnet for /__health endpoint
async function _sweepSubnet() {
  const base = SERVER_IP.split(".").slice(0, 3).join(".");
  const BATCH = 16;
  const TIMEOUT_MS = 400;

  async function _probe(ip) {
    const url = `http://${ip}:${PORT}/__health`;
    try {
      const ctrl = new AbortController();
      const tid  = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      const res  = await fetch(url, { signal: ctrl.signal });
      clearTimeout(tid);
      if (res.ok) {
        const data = await res.json();
        if (data.ok !== undefined) {  // is a 5DEngine server
          _upsertServer(ip, PORT, data.players || 0);
        }
      }
    } catch { /* host not reachable */ }
  }

  const hosts = Array.from({ length: 254 }, (_, i) => `${base}.${i + 1}`);
  for (let i = 0; i < hosts.length; i += BATCH) {
    await Promise.all(hosts.slice(i, i + BATCH).map(_probe));
  }
  _pruneServers();
}

// ── HTTP API ────────────────────────────────────────────────────────────────
app.get("/__health", (_req, res) => res.json({ ok: true, players: players.size }));

app.get("/api/me", (_req, res) => res.json({
  lanIp:       SERVER_IP,
  hostname:    SERVER_HOSTNAME,
  port:        PORT,
  playerCount: players.size,
  shareUrl:    MDNS_URL,              // primary: hostname.local (no IP needed)
  shareUrlIp:  `http://${SERVER_IP}:${PORT}`,  // fallback: raw IP
}));

// /scan — trigger an HTTP sweep + return all discovered servers (including self)
app.get("/scan", async (_req, res) => {
  _pruneServers();
  // Run a background sweep (don't await — return quickly with what we know so far)
  _sweepSubnet().catch(() => {});

  const allServers = [
    { ip: SERVER_IP, port: PORT, playerCount: players.size, self: true },
    ...Array.from(knownServers.values()).map(s => ({ ...s, self: false })),
  ];
  res.json({ localIp: SERVER_IP, servers: allServers });
});

// /scan/wait — await the full sweep then return (used by in-game refresh after delay)
app.get("/scan/wait", async (_req, res) => {
  await _sweepSubnet();
  const allServers = [
    { ip: SERVER_IP, port: PORT, playerCount: players.size, self: true },
    ...Array.from(knownServers.values()).map(s => ({ ...s, self: false })),
  ];
  res.json({ localIp: SERVER_IP, servers: allServers });
});

// ── Socket.IO events ────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  const clientIp = (socket.handshake.headers["x-forwarded-for"] || socket.handshake.address || "?")
    .split(",")[0].trim();

  console.log(`[+] ${socket.id} connected  (ip: ${clientIp}  total: ${players.size + 1})`);

  players.set(socket.id, { id: socket.id, name: socket.id.slice(0, 6), pos: null, ip: clientIp });

  const peerList = [];
  for (const [, p] of players) {
    if (p.id === socket.id) continue;
    peerList.push({ id: p.id, name: p.name, pos: p.pos });
  }
  socket.emit("mp_welcome", {
    your_id:  socket.id,
    myIp:     clientIp,
    serverIp: SERVER_IP,
    peers:    peerList,
  });

  socket.on("mp_name", (data) => {
    if (!data || typeof data.name !== "string") return;
    const name = data.name.slice(0, 24).replace(/[<>"']/g, "") || socket.id.slice(0, 6);
    const player = players.get(socket.id);
    if (!player) return;
    player.name = name;
    socket.broadcast.emit("mp_player_joined", { id: socket.id, name });
    socket.broadcast.emit("mp_player_name",   { id: socket.id, name });
    console.log(`[~] ${socket.id} → name: "${name}"`);
  });

  socket.on("mp_pos", (data) => {
    if (!data) return;
    const player = players.get(socket.id);
    if (!player) return;
    const u = Math.max(-2000, Math.min(2000, Number(data.u) || 0));
    const v = Math.max(-2000, Math.min(2000, Number(data.v) || 0));
    const y = Math.max(-200,  Math.min(200,  Number(data.y) || 0));
    player.pos = { u, v, y };
    socket.broadcast.emit("mp_pos", {
      id:        socket.id,
      u, v, y,
      heading:   Number(data.heading)   || 0,
      weapon:    String(data.weapon     || "pistol").slice(0, 20),
      hp:        Math.max(0, Math.min(9999, Number(data.hp) || 100)),
      anim:      ["idle","sprint","crouch"].includes(data.anim) ? data.anim : "idle",
      inVehicle: !!data.inVehicle,
    });
  });

  socket.on("mp_event", (data) => {
    if (!data || typeof data.type !== "string") return;
    const player = players.get(socket.id);
    const allowedTypes = ["enemy_kill", "build", "friend_request", "friend_accepted",
                          "chat", "emote", "wave_sync",
                          "player_hit",
                          "duel_challenge", "duel_accept", "duel_decline",
                          "duel_round_start", "duel_round_end", "duel_match_end", "duel_cancel"];
    if (!allowedTypes.includes(data.type)) return;
    socket.broadcast.emit("mp_event", Object.assign({}, data, {
      id:       socket.id,
      fromName: player ? player.name : "?",
      fromIp:   clientIp,
    }));
  });

  socket.on("disconnect", (reason) => {
    const player = players.get(socket.id);
    players.delete(socket.id);
    io.emit("mp_player_left", { id: socket.id });
    console.log(`[-] ${socket.id} (${player ? player.name : "?"}) disconnected — ${reason}  remaining: ${players.size}`);
  });

  socket.on("error", (err) => {
    console.error(`[!] Socket error (${socket.id}):`, err.message);
  });
});

// ── Start ───────────────────────────────────────────────────────────────────
http.listen(PORT, "0.0.0.0", () => {
  console.log("");
  console.log("  ╔══════════════════════════════════════════╗");
  console.log("  ║       5DEngine Multiplayer Server        ║");
  console.log("  ╚══════════════════════════════════════════╝");
  console.log(`  Local  → http://localhost:${PORT}`);
  console.log(`  LAN    → ${MDNS_URL}   ← share this (works on same network, no IP needed)`);
  console.log(`  LAN IP → http://${SERVER_IP}:${PORT}   ← fallback if .local doesn't resolve`);
  console.log(`  Health → http://localhost:${PORT}/__health`);
  console.log("");
  console.log("  Friend on same WiFi? Tell them to open the LAN URL above in any browser.");
  console.log("  Press Ctrl+C to stop.\n");

  // Start broadcasting presence immediately and every 5 s
  _broadcastPresence();
  setInterval(_broadcastPresence, 5_000);

  // Run an initial HTTP sweep 2s after startup (give network time to settle)
  setTimeout(() => _sweepSubnet().catch(() => {}), 2_000);
});

http.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n  [ERROR] Port ${PORT} is already in use.`);
    console.error(`  Run:  netstat -ano | findstr :${PORT}  to find the process.\n`);
  } else {
    console.error("[ERROR] HTTP server error:", err);
  }
  process.exit(1);
});

process.on("uncaughtException",  (err) => console.error("[!] Uncaught exception:", err));
process.on("unhandledRejection", (err) => console.error("[!] Unhandled rejection:", err));
process.on("SIGTERM", () => { console.log("\n  Shutting down..."); _udp.close(); http.close(() => process.exit(0)); });
process.on("SIGINT",  () => { console.log("\n  Shutting down..."); _udp.close(); http.close(() => process.exit(0)); });
