"""
5DEngine LAN Multiplayer Server
Flask + SocketIO — same pattern as localInternetComms/server.py

HOW TO RUN:
  pip install flask flask-socketio  (only needed once)
  python game_server.py

BOTH PLAYERS OPEN:
  http://<YOUR_LAN_IP>:5050/
  (the server prints the exact URL on startup)

The server broadcasts player positions at whatever rate clients send them.
One player runs the server; the other connects to that player's IP.
No port-forwarding needed — same WiFi/LAN is enough.
"""

import os
import uuid
import time
import json
import platform
import socket as _socket
import urllib.request
import concurrent.futures
from flask import Flask, request, send_file, send_from_directory, jsonify
from flask_socketio import SocketIO, emit

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__)
app.config["SECRET_KEY"] = "5dengine-lan-mp"
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading",
                    ping_timeout=10, ping_interval=5)

# sid → { id, name, pos, last_seen }
_players = {}


def _get_local_ip():
    s = _socket.socket(_socket.AF_INET, _socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()


# ── Serve the game ───────────────────────────────────────────────────────────

@app.route("/")
def index():
    return send_file(os.path.join(BASE_DIR, "index.html"))

@app.route("/<path:filename>")
def static_files(filename):
    return send_from_directory(BASE_DIR, filename)


# ── F2: LAN discovery API ─────────────────────────────────────────────────────

@app.route("/api/status")
def api_status():
    """
    Identity endpoint — lets /scan confirm a host is running 5DEngine, not
    just any random service on port 5050.
    Returns: { server, version, playerCount, hostName, port }
    """
    port_num = int(os.environ.get("PORT", 5050))
    return jsonify({
        "server":      "5dengine",
        "version":     1,
        "playerCount": len(_players),
        "hostName":    platform.node(),
        "port":        port_num,
    })


@app.route("/scan")
def scan_lan():
    """
    LAN discovery: scans the /24 subnet of this machine's primary IP,
    probing port 5050 on each host with a 0.25 s TCP timeout.
    Hosts that respond get a secondary HTTP check against /api/status
    to confirm they are actually running 5DEngine (not some other app).

    Returns: { servers: [{ ip, hostName, playerCount, port }], localIp }
    """
    local_ip = _get_local_ip()

    # Derive the /24 prefix (e.g. "192.168.1" from "192.168.1.42")
    parts = local_ip.rsplit(".", 1)
    if len(parts) != 2:
        return jsonify({"servers": [], "error": "cannot_determine_subnet",
                        "localIp": local_ip})
    subnet_prefix = parts[0]

    def _probe(n):
        """
        Check one IP. Returns a server dict on success, None otherwise.
        Two-stage: TCP probe (fast) → HTTP /api/status confirm (accurate).
        """
        ip = f"{subnet_prefix}.{n}"
        if ip == local_ip:
            return None   # skip ourselves
        # Stage 1 — TCP SYN: is port 5050 even open?
        sock = _socket.socket(_socket.AF_INET, _socket.SOCK_STREAM)
        sock.settimeout(0.25)
        try:
            sock.connect((ip, 5050))
        except OSError:
            return None
        finally:
            sock.close()
        # Stage 2 — HTTP: confirm it speaks the 5DEngine status API
        try:
            url = f"http://{ip}:5050/api/status"
            with urllib.request.urlopen(url, timeout=1) as resp:
                data = json.loads(resp.read())
            if data.get("server") == "5dengine":
                return {
                    "ip":          ip,
                    "hostName":    data.get("hostName", ip),
                    "playerCount": data.get("playerCount", 0),
                    "port":        data.get("port", 5050),
                }
        except Exception:
            pass
        return None

    # Scan all 254 host addresses concurrently (32 threads → ~2 s worst case)
    with concurrent.futures.ThreadPoolExecutor(max_workers=32) as ex:
        results = list(ex.map(_probe, range(1, 255)))

    servers = [r for r in results if r is not None]
    return jsonify({"servers": servers, "localIp": local_ip})


# ── SocketIO: lifecycle ───────────────────────────────────────────────────────

@socketio.on("connect")
def on_connect():
    pid = str(uuid.uuid4())[:8]
    _players[request.sid] = {
        "id":        pid,
        "name":      "Player",
        "pos":       {"u": 0, "v": 0, "y": 0, "heading": 0,
                      "weapon": "pistol", "hp": 100, "anim": "idle"},
        "last_seen": time.time(),
    }
    # Welcome packet: your own ID + snapshot of every other connected player
    emit("mp_welcome", {
        "your_id": pid,
        "peers": [
            {"id": p["id"], "name": p["name"], "pos": p["pos"]}
            for sid, p in _players.items() if sid != request.sid
        ],
    })
    # Tell everyone else this player appeared
    emit("mp_player_joined", {"id": pid, "name": "Player"},
         broadcast=True, include_self=False)
    print(f"[+] {pid} joined   ({len(_players)} online)")


@socketio.on("disconnect")
def on_disconnect():
    p = _players.pop(request.sid, None)
    if p:
        emit("mp_player_left", {"id": p["id"]}, broadcast=True)
        print(f"[-] {p['id']} left   ({len(_players)} online)")


# ── SocketIO: game events ─────────────────────────────────────────────────────

@socketio.on("mp_name")
def on_name(data):
    """Client announces its display name."""
    p = _players.get(request.sid)
    if not p:
        return
    p["name"] = str(data.get("name", "Player"))[:24]
    emit("mp_player_name",
         {"id": p["id"], "name": p["name"]},
         broadcast=True, include_self=False)


@socketio.on("mp_pos")
def on_pos(data):
    """
    High-frequency position packet (client sends ~20 Hz).
    Relay to every other connected client immediately.
    Fields: u, v, y, heading, weapon, hp, anim
    """
    p = _players.get(request.sid)
    if not p:
        return
    p["pos"]       = data
    p["last_seen"] = time.time()
    data["id"]     = p["id"]          # stamp sender's ID so receiver can route it
    emit("mp_pos", data, broadcast=True, include_self=False)


@socketio.on("mp_event")
def on_event(data):
    """
    Discrete game events: enemy kills, wave state, etc.
    Shape: { type: str, ...payload }
    """
    p = _players.get(request.sid)
    if not p:
        return
    data["from_id"] = p["id"]
    emit("mp_event", data, broadcast=True, include_self=False)


# ── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5050))
    ip   = _get_local_ip()

    print()
    print("  5DEngine — LAN Multiplayer Server")
    print("  ────────────────────────────────────────")
    print(f"  Your LAN IP  : {ip}")
    print(f"  Game URL     : http://{ip}:{port}/")
    print()
    print("  1. Share the URL above with your friend")
    print("  2. Both of you open it in Chrome/Firefox")
    print("  3. Click the game canvas to lock mouse, then play")
    print()
    print("  Ctrl+C to stop the server")
    print()

    socketio.run(app, host="0.0.0.0", port=port,
                 debug=False, allow_unsafe_werkzeug=True)
