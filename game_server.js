/**
 * 5DEngine game_server.js — Socket.IO relay + static file server
 *
 * Usage:  node game_server.js [port]        (default: 8080)
 * LAN:    other machines open http://<YOUR-LAN-IP>:<port>
 *
 * Protocol (matches src/social/lan_session.js):
 *   client→server: mp_name · mp_pos · mp_event
 *   server→client: mp_welcome · mp_player_joined · mp_player_left
 *                  mp_player_name · mp_pos · mp_event
 */

import express      from "express";
import { createServer } from "http";
import { Server }   from "socket.io";
import { networkInterfaces } from "os";
import path         from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.argv[2] ?? process.env.PORT ?? "8080", 10);

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
    // Allow SharedArrayBuffer (needed by some audio libs)
    if (filePath.endsWith(".html")) {
      res.setHeader("Cross-Origin-Opener-Policy",   "same-origin");
      res.setHeader("Cross-Origin-Embedder-Policy",  "require-corp");
    }
  },
}));

// Healthcheck
app.get("/__health", (_req, res) => res.json({ ok: true, players: players.size }));

// ── Player state ────────────────────────────────────────────────────────────
// players: socket.id → { id, name, pos: {u,v,y}, ip }
const players = new Map();

function getLanIp() {
  for (const ifaces of Object.values(networkInterfaces())) {
    for (const iface of ifaces) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return "127.0.0.1";
}

const SERVER_IP = getLanIp();

// ── Socket.IO events ────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  const clientIp = (socket.handshake.headers["x-forwarded-for"] || socket.handshake.address || "?")
    .split(",")[0].trim();

  console.log(`[+] ${socket.id} connected  (ip: ${clientIp}  total: ${players.size + 1})`);

  // Register with placeholder name until mp_name arrives
  players.set(socket.id, { id: socket.id, name: socket.id.slice(0, 6), pos: null, ip: clientIp });

  // Welcome: send current peer list immediately
  const peerList = [];
  for (const [, p] of players) {
    if (p.id === socket.id) continue;
    peerList.push({ id: p.id, name: p.name, pos: p.pos });
  }
  socket.emit("mp_welcome", {
    your_id: socket.id,
    myIp:    clientIp,
    serverIp: SERVER_IP,
    peers:   peerList,
  });

  // ── Client sets display name ──────────────────────────────────────────────
  socket.on("mp_name", (data) => {
    if (!data || typeof data.name !== "string") return;
    const name = data.name.slice(0, 24).replace(/[<>"']/g, "") || socket.id.slice(0, 6);
    const player = players.get(socket.id);
    if (!player) return;
    player.name = name;

    // Tell everyone else this player's name (and that they joined)
    socket.broadcast.emit("mp_player_joined", { id: socket.id, name });
    // Also send name update so already-connected clients can update their records
    socket.broadcast.emit("mp_player_name",   { id: socket.id, name });

    console.log(`[~] ${socket.id} → name: "${name}"`);
  });

  // ── Position update ───────────────────────────────────────────────────────
  socket.on("mp_pos", (data) => {
    if (!data) return;
    const player = players.get(socket.id);
    if (!player) return;

    // Clamp to prevent absurd values crashing peers
    const u = Math.max(-2000, Math.min(2000, Number(data.u) || 0));
    const v = Math.max(-2000, Math.min(2000, Number(data.v) || 0));
    const y = Math.max(-200,  Math.min(200,  Number(data.y) || 0));

    player.pos = { u, v, y };

    // Relay to all peers (add sender id)
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

  // ── Game events (kills, builds, friend requests, etc.) ────────────────────
  socket.on("mp_event", (data) => {
    if (!data || typeof data.type !== "string") return;
    const player = players.get(socket.id);
    const allowedTypes = ["enemy_kill", "build", "friend_request", "friend_accepted",
                          "chat", "emote", "wave_sync",
                          "player_hit",
                          "duel_challenge", "duel_accept", "duel_decline",
                          "duel_round_start", "duel_round_end", "duel_match_end", "duel_cancel"];
    if (!allowedTypes.includes(data.type)) return;   // drop unknown event types

    // Relay with sender metadata
    socket.broadcast.emit("mp_event", Object.assign({}, data, {
      id:       socket.id,
      fromName: player ? player.name : "?",
      fromIp:   clientIp,
    }));
  });

  // ── Disconnect ────────────────────────────────────────────────────────────
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
  console.log(`  LAN    → http://${SERVER_IP}:${PORT}`);
  console.log(`  Health → http://localhost:${PORT}/__health`);
  console.log("");
  console.log("  Open the URL above in multiple tabs or on other LAN devices.");
  console.log("  Press Ctrl+C to stop.\n");
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

// ── Stay alive — catch unhandled errors without crashing ────────────────────
process.on("uncaughtException",  (err) => console.error("[!] Uncaught exception:", err));
process.on("unhandledRejection", (err) => console.error("[!] Unhandled rejection:", err));
process.on("SIGTERM", () => { console.log("\n  Shutting down..."); http.close(() => process.exit(0)); });
process.on("SIGINT",  () => { console.log("\n  Shutting down..."); http.close(() => process.exit(0)); });
