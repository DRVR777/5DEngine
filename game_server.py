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
import sys
import ssl
import uuid
import time
import json
import base64
import threading
import platform
import socket as _socket
import urllib.request
import concurrent.futures

# ── Security config (CRYPT_ANALYST_20260322 patch) ────────────────────────────
# VERIFY_SIGS=0 (default): soft mode — log warnings but relay any frame
# VERIFY_SIGS=1: hard mode — require identity registration, block impersonation
VERIFY_SIGS = os.environ.get("VERIFY_SIGS", "0") == "1"

# ── Pubkey cache: sid → { node_id, pubkey_b64, registered_at } ───────────────
# Populated by "register_identity" event (once per connection).
# Prevents impersonation: a client can only relay under their registered node_id.
# Ed25519 signature verification happens in the receiving browser (WebCrypto).
_pubkey_cache = {}

# Force UTF-8 output so Unicode banners work on Windows consoles and in
# subprocess captures (pytest, PyInstaller, etc.) regardless of locale.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
from flask import Flask, request, send_file, send_from_directory, jsonify, Response
from flask_socketio import SocketIO, emit

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__)
app.config["SECRET_KEY"] = "5dengine-lan-mp"
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading",
                    ping_timeout=10, ping_interval=5)

# ── CORS ─────────────────────────────────────────────────────────────────────
# Required so that a browser tab on port 5050 can POST /api/friend_request to
# a server on port 5051 (or any other origin) without the browser blocking it.

@app.after_request
def add_cors(response):
    response.headers["Access-Control-Allow-Origin"]  = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response

@app.route("/api/<path:path>", methods=["OPTIONS"])
def handle_preflight(path):
    """Handle CORS preflight (OPTIONS) requests for all /api/* endpoints."""
    return Response(status=204, headers={
        "Access-Control-Allow-Origin":  "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    })

# ── In-memory state ───────────────────────────────────────────────────────────

# sid → { id, name, ip, pos, last_seen }
_players = {}

# ── SocketIO security handlers ────────────────────────────────────────────────

@socketio.on("register_identity")
def handle_register_identity(data):
    """
    Browser calls this once on connect with its Ed25519 identity.
    Stores node_id + pubkey for anti-impersonation checks in relay.
    CRYPT_ANALYST_20260322 security patch.
    """
    node_id = data.get("node_id", "")
    pubkey  = data.get("pubkey_b64", "")
    if not node_id or not pubkey:
        return
    try:
        pk_bytes = base64.b64decode(pubkey)
        if len(pk_bytes) != 32:
            return  # Ed25519 verifying keys are exactly 32 bytes
    except Exception:
        return
    _pubkey_cache[request.sid] = {
        "node_id": node_id, "pubkey_b64": pubkey, "registered_at": time.time()
    }
    if VERIFY_SIGS:
        print(f"[security] Identity registered: {node_id} (sid={request.sid[:8]})")


@socketio.on("bridge_frame")
def handle_bridge_frame_secure(frame):
    """
    STATELESS RELAY — Never interprets payload. Only forwards signed blobs.
    Anti-impersonation check: claimed node_id must match registered identity.
    CRYPT_ANALYST_20260322 security patch (replaces old bridge_frame handler).
    """
    channel = frame.get("channel")
    payload = frame.get("payload", "")
    node_id = frame.get("_node_id") or frame.get("node_id", "")

    if channel is None or payload is None:
        return  # Malformed — drop silently

    cached = _pubkey_cache.get(request.sid)
    if cached and node_id and node_id != cached["node_id"]:
        if VERIFY_SIGS:
            print(f"[security] IMPERSONATION blocked: sid={request.sid[:8]} "
                  f"claims {node_id} != registered {cached['node_id']}")
            return
        else:
            print(f"[security] WARN impersonation: {node_id} != {cached.get('node_id')}")

    if VERIFY_SIGS and not cached:
        print(f"[security] UNREGISTERED relay attempt on ch{channel}")
        return

    # Soft mode metrics: log unsigned frames on important channels
    if not VERIFY_SIGS:
        has_sig = bool(frame.get("_epoch_sig") or frame.get("_mac"))
        if not has_sig and channel in (1, 2, 4):
            print(f"[security] WARN unsigned frame ch{channel} from {node_id or 'unknown'}")

    # RELAY only — never unpack or interpret payload
    emit("bridge_frame", frame, broadcast=True, include_self=False)

# ip → set of friend ips (cleared on server restart; session-scoped)
_friend_list = {}

# ip → [{ fromIp, fromName, ts }]  pending incoming requests
_pending_requests = {}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _emit_bg(event, data):
    """
    Emit a socket.io event from a plain daemon thread with an app context.

    Calling socketio.emit() directly inside a Flask HTTP route handler can
    deadlock in threading async_mode because Werkzeug's thread pool may be
    saturated by long-lived WebSocket connections, leaving no thread to drain
    the emit queue. Running the emit in a separate daemon thread side-steps
    this completely — the HTTP response returns immediately and the broadcast
    fires independently.
    """
    def _do():
        with app.app_context():
            socketio.emit(event, data)
    threading.Thread(target=_do, daemon=True).start()


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
    _emit_bg("mp_event", {"type": "friend_request", "fromIp": from_ip, "fromName": from_name})
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
    _emit_bg("mp_event", {"type": "friend_accepted", "byIp": my_ip, "fromIp": from_ip})
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
    # Clean up pubkey cache (CRYPT_ANALYST_20260322 security patch)
    _pubkey_cache.pop(request.sid, None)


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


# ── WorldWideComms / MKii bridge relay ───────────────────────────────────────
#
# Relays binary frames between the browser (socket.io) and the local MKii
# GameBridge process (TCP localhost:7780).
#
# Wire format (game_bridge.py protocol): [channel:1 big-endian][length:4 big-endian][data:N]
#
# Flow:
#   Browser → socket.io "bridge_frame" {peerId, channel, data} → TCP frame → game_bridge:7780
#   game_bridge:7780 → TCP frame → socket.io "bridge_frame" {channel, data} → Browser
#
# The relay connects to port 7780 lazily (first "bridge_frame" event). If the bridge
# is not running the relay is silently skipped — the game continues without mkii.
# ─────────────────────────────────────────────────────────────────────────────

import struct as _struct

_BRIDGE_HOST  = "127.0.0.1"
_BRIDGE_PORT  = 7780
_BRIDGE_HEADER_FMT  = "!BI"           # network-order: uint8 channel + uint32 length
_BRIDGE_HEADER_SIZE = _struct.calcsize(_BRIDGE_HEADER_FMT)

_bridge_sock = None        # TCP socket to game_bridge.py
_bridge_lock = threading.Lock()


def _bridge_connect():
    """Try to open a TCP connection to the MKii GameBridge. Returns socket or None."""
    global _bridge_sock
    with _bridge_lock:
        if _bridge_sock is not None:
            return _bridge_sock
        try:
            s = _socket.socket(_socket.AF_INET, _socket.SOCK_STREAM)
            s.settimeout(1.0)
            s.connect((_BRIDGE_HOST, _BRIDGE_PORT))
            s.settimeout(None)
            _bridge_sock = s
            # Start reader thread once connected
            threading.Thread(target=_bridge_reader, daemon=True).start()
            print(f"[bridge] Connected to MKii GameBridge at {_BRIDGE_HOST}:{_BRIDGE_PORT}")
            return _bridge_sock
        except OSError:
            return None


def _bridge_reader():
    """Background thread: read TCP frames from game_bridge and emit to all browser clients."""
    global _bridge_sock
    while True:
        sock = _bridge_sock
        if sock is None:
            break
        try:
            header = b""
            while len(header) < _BRIDGE_HEADER_SIZE:
                chunk = sock.recv(_BRIDGE_HEADER_SIZE - len(header))
                if not chunk:
                    raise ConnectionError("bridge closed")
                header += chunk
            channel, length = _struct.unpack(_BRIDGE_HEADER_FMT, header)
            data = b""
            while len(data) < length:
                chunk = sock.recv(length - len(data))
                if not chunk:
                    raise ConnectionError("bridge closed mid-frame")
                data += chunk
            # Decode JSON if possible, otherwise send raw hex
            try:
                payload = data.decode("utf-8")
            except UnicodeDecodeError:
                payload = data.hex()
            socketio.emit("bridge_frame", {"channel": channel, "data": payload})
        except (OSError, ConnectionError):
            with _bridge_lock:
                if _bridge_sock is sock:
                    _bridge_sock = None
            print("[bridge] MKii GameBridge disconnected")
            break


@socketio.on("bridge_frame")
def on_bridge_frame(data):
    """
    Browser → bridge relay. Packs a socket.io bridge_frame into TCP wire format.
    data: { peerId, channel, data }  (data is a JSON-serializable object)
    """
    channel = int(data.get("channel", 0))
    payload = data.get("data", {})
    try:
        raw = json.dumps(payload).encode("utf-8")
    except (TypeError, ValueError):
        raw = str(payload).encode("utf-8")

    sock = _bridge_connect()
    if sock is None:
        return  # bridge not running — silently drop

    header = _struct.pack(_BRIDGE_HEADER_FMT, channel, len(raw))
    try:
        with _bridge_lock:
            sock.sendall(header + raw)
    except OSError:
        with _bridge_lock:
            global _bridge_sock
            _bridge_sock = None


# ── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5050))
    ip   = _get_local_ip()

    # Detect HTTPS capability (requires pyopenssl + cryptography).
    # Set env var TEST_HTTP=1 to force HTTP regardless (used by pytest fixtures).
    use_https = False
    if not os.environ.get("TEST_HTTP"):
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
