"""
5DEngine LAN Multiplayer Server
Flask + SocketIO — WebSocket-based multiplayer + friend system + LAN discovery.

HOW TO RUN:
  pip install flask flask-socketio        (required)
  pip install pyopenssl cryptography      (optional — enables HTTPS)
  python game_server.py

BOTH PLAYERS OPEN:
  https://<YOUR_LAN_IP>:5050/   (HTTPS if pyopenssl installed)
  http://<YOUR_LAN_IP>:5050/    (HTTP fallback)

The server prints the exact URL on startup.
One player runs the server; the other connects to that player's IP.
No port-forwarding needed — same WiFi/LAN is enough.

⚠ HTTPS uses a self-signed cert — browser will warn once per IP.
  Click "Advanced" → "Proceed to <IP>" to accept it.
"""

import os
import ssl
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

# ── In-memory state ───────────────────────────────────────────────────────────

# sid → { id, name, ip, pos, last_seen }
_players = {}

# ip → set of friend ips (cleared on server restart; session-scoped)
_friend_list = {}

# ip → [{ fromIp, fromName, ts }]  pending incoming requests
_pending_requests = {}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_local_ip():
    s = _socket.socket(_socket.AF_INET, _socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()


def _insecure_ssl_ctx():
    """Return an SSL context that accepts self-signed certs (for LAN /scan only)."""
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


# ── Serve the game ────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return send_file(os.path.join(BASE_DIR, "index.html"))

@app.route("/<path:filename>")
def static_files(filename):
    return send_from_directory(BASE_DIR, filename)


# ── LAN discovery ─────────────────────────────────────────────────────────────

@app.route("/api/status")
def api_status():
    """
    Identity endpoint — lets /scan confirm a host is running 5DEngine.
    Returns: { server, version, playerCount, hostName, port, https }
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
    LAN discovery: concurrent /24 subnet probe on port 5050.
    Stage 1 — TCP SYN (0.25 s timeout): is anything on port 5050?
    Stage 2 — HTTP/HTTPS /api/status: is it a 5DEngine server?
    Self-signed cert check is intentionally bypassed for Stage 2.
    Returns: { servers: [{ ip, hostName, playerCount, port }], localIp }
    """
    local_ip = _get_local_ip()
    parts = local_ip.rsplit(".", 1)
    if len(parts) != 2:
        return jsonify({"servers": [], "error": "cannot_determine_subnet",
                        "localIp": local_ip})
    subnet_prefix = parts[0]
    ssl_ctx = _insecure_ssl_ctx()  # accept self-signed certs from peers

    def _probe(n):
        ip = f"{subnet_prefix}.{n}"
        if ip == local_ip:
            return None
        # Stage 1 — TCP connect
        sock = _socket.socket(_socket.AF_INET, _socket.SOCK_STREAM)
        sock.settimeout(0.25)
        try:
            sock.connect((ip, 5050))
        except OSError:
            return None
        finally:
            sock.close()
        # Stage 2 — try HTTPS first, fall back to HTTP
        for scheme in ("https", "http"):
            try:
                url = f"{scheme}://{ip}:5050/api/status"
                kw = {"timeout": 1}
                if scheme == "https":
                    kw["context"] = ssl_ctx
                with urllib.request.urlopen(url, **kw) as resp:
                    data = json.loads(resp.read())
                if data.get("server") == "5dengine":
                    return {
                        "ip":          ip,
                        "hostName":    data.get("hostName", ip),
                        "playerCount": data.get("playerCount", 0),
                        "port":        data.get("port", 5050),
                        "scheme":      scheme,
                    }
                break
            except Exception:
                continue
        return None

    with concurrent.futures.ThreadPoolExecutor(max_workers=32) as ex:
        results = list(ex.map(_probe, range(1, 255)))

    servers = [r for r in results if r is not None]
    return jsonify({"servers": servers, "localIp": local_ip})


# ── Friend system ─────────────────────────────────────────────────────────────

@app.route("/api/friend_request", methods=["POST"])
def api_friend_request():
    """
    Player A POSTs here to send a friend request to all players on this server.
    The server broadcasts mp_event { type: "friend_request", fromIp, fromName }
    to every connected player so they see the toast + Accept button.
    """
    data = request.get_json(force=True) or {}
    from_ip   = data.get("fromIp")   or request.remote_addr
    from_name = data.get("fromName") or from_ip
    # Store as pending for each connected player (by their IP)
    for p in _players.values():
        ip = p.get("ip", "unknown")
        if ip == from_ip:
            continue
        _pending_requests.setdefault(ip, []).append({
            "fromIp":   from_ip,
            "fromName": from_name,
            "ts":       time.time(),
        })
    # Broadcast so any open Friends app can refresh live
    socketio.emit("mp_event", {
        "type":     "friend_request",
        "fromIp":   from_ip,
        "fromName": from_name,
    })
    return jsonify({"ok": True})


@app.route("/api/friend_accept", methods=["POST"])
def api_friend_accept():
    """
    Accept a pending friend request. Adds both IPs to each other's friend list.
    """
    data    = request.get_json(force=True) or {}
    my_ip   = request.remote_addr
    from_ip = data.get("fromIp", "")
    if not from_ip:
        return jsonify({"ok": False, "reason": "missing_fromIp"})
    _friend_list.setdefault(my_ip,   set()).add(from_ip)
    _friend_list.setdefault(from_ip, set()).add(my_ip)
    # Clear the pending request
    _pending_requests[my_ip] = [
        r for r in _pending_requests.get(my_ip, []) if r["fromIp"] != from_ip
    ]
    # Let the requester know they were accepted
    socketio.emit("mp_event", {
        "type":   "friend_accepted",
        "byIp":   my_ip,
        "fromIp": from_ip,
    })
    return jsonify({"ok": True, "friends": list(_friend_list.get(my_ip, []))})


@app.route("/api/friends")
def api_friends():
    """
    Returns the caller's friend list + pending incoming requests.
    Online status is derived from _players (socket-connected = online).
    """
    my_ip = request.remote_addr
    online_ips = {p.get("ip") for p in _players.values()}
    friends = [
        {"ip": ip, "online": ip in online_ips}
        for ip in _friend_list.get(my_ip, set())
    ]
    pending = _pending_requests.get(my_ip, [])
    return jsonify({"friends": friends, "pending": pending, "myIp": my_ip})


# ── SocketIO: lifecycle ───────────────────────────────────────────────────────

@socketio.on("connect")
def on_connect():
    pid = str(uuid.uuid4())[:8]
    _players[request.sid] = {
        "id":        pid,
        "name":      "Player",
        "ip":        request.remote_addr,   # needed for friend system
        "pos":       {"u": 0, "v": 0, "y": 0, "heading": 0,
                      "weapon": "pistol", "hp": 100, "anim": "idle"},
        "last_seen": time.time(),
    }
    emit("mp_welcome", {
        "your_id": pid,
        "myIp":    request.remote_addr,     # client can use this for friend requests
        "peers": [
            {"id": p["id"], "name": p["name"], "pos": p["pos"]}
            for sid, p in _players.items() if sid != request.sid
        ],
    })
    emit("mp_player_joined", {"id": pid, "name": "Player"},
         broadcast=True, include_self=False)
    print(f"[+] {pid} ({request.remote_addr}) joined   ({len(_players)} online)")


@socketio.on("disconnect")
def on_disconnect():
    p = _players.pop(request.sid, None)
    if p:
        emit("mp_player_left", {"id": p["id"]}, broadcast=True)
        print(f"[-] {p['id']} left   ({len(_players)} online)")


# ── SocketIO: game events ─────────────────────────────────────────────────────

@socketio.on("mp_name")
def on_name(data):
    p = _players.get(request.sid)
    if not p:
        return
    p["name"] = str(data.get("name", "Player"))[:24]
    emit("mp_player_name", {"id": p["id"], "name": p["name"]},
         broadcast=True, include_self=False)


@socketio.on("mp_pos")
def on_pos(data):
    """High-frequency position packet (~20 Hz). Relay to every other client."""
    p = _players.get(request.sid)
    if not p:
        return
    p["pos"]       = data
    p["last_seen"] = time.time()
    data["id"]     = p["id"]
    emit("mp_pos", data, broadcast=True, include_self=False)


@socketio.on("mp_event")
def on_event(data):
    """Discrete game events — relay with sender ID stamped."""
    p = _players.get(request.sid)
    if not p:
        return
    data["from_id"] = p["id"]
    emit("mp_event", data, broadcast=True, include_self=False)


# ── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5050))
    ip   = _get_local_ip()

    # Detect HTTPS capability (requires pyopenssl + cryptography)
    use_https = False
    try:
        import OpenSSL  # noqa: F401 — just checking it's installed
        use_https = True
    except ImportError:
        pass

    protocol = "https" if use_https else "http"
    ssl_ctx  = "adhoc" if use_https else None

    print()
    print("  5DEngine — LAN Multiplayer Server")
    print("  ────────────────────────────────────────────────")
    print(f"  Protocol     : {protocol.upper()}")
    print(f"  Your LAN IP  : {ip}")
    print(f"  Game URL     : {protocol}://{ip}:{port}/")
    print(f"  Localhost    : {protocol}://localhost:{port}/")
    print()
    if use_https:
        print("  ⚠  First visit: browser warns about self-signed cert.")
        print("     Click  Advanced → Proceed to localhost  to accept it.")
        print("     After that, WebSockets (wss://) connect automatically.")
    else:
        print("  ℹ  Install pyopenssl + cryptography for HTTPS:")
        print("     pip install pyopenssl cryptography")
    print()
    print("  Ctrl+C to stop")
    print()

    socketio.run(app, host="0.0.0.0", port=port,
                 ssl_context=ssl_ctx,
                 debug=False, allow_unsafe_werkzeug=True)
