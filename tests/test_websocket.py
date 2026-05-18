"""
test_websocket.py — pytest suite for game_server.py WebSocket (socket.io) events.

Starts game_server.py on port 15051, connects two socket.io clients, and
verifies the real-time event relay pipeline end-to-end.

Requires:  pip install python-socketio[client] websocket-client

Run with:  pytest tests/test_websocket.py -v
Or via:    tests\\run_tests.bat
"""

import os
import sys
import time
import subprocess
import threading
import pytest
import socketio as sio_lib

# ── Configuration ─────────────────────────────────────────────────────────────

SERVER_PORT = 15051
BASE_URL    = f"http://127.0.0.1:{SERVER_PORT}"
SERVER_PY   = os.path.join(os.path.dirname(__file__), "..", "game_server.py")

# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(scope="function")
def ws_server():
    """
    Start game_server.py for a single WebSocket test, then kill it.

    Function-scoped (one server per test) so that thread state from previous
    tests' WebSocket connections never bleeds into the next test.  The first
    few tests run in ~1-2 s each so the overhead is acceptable.
    """
    env = {**os.environ, "PORT": str(SERVER_PORT),
           "PYTHONIOENCODING": "utf-8", "TEST_HTTP": "1"}
    proc = subprocess.Popen(
        [sys.executable, SERVER_PY],
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
    )
    # Wait for server to be ready (up to 10 s)
    import requests
    deadline = time.time() + 10
    ready = False
    while time.time() < deadline:
        try:
            r = requests.get(f"{BASE_URL}/api/status", timeout=1)
            if r.status_code == 200:
                ready = True
                break
        except Exception:
            time.sleep(0.3)

    if not ready:
        proc.kill()
        out, err = proc.communicate(timeout=3)
        pytest.fail(f"game_server.py failed to start.\nstdout:{out[:400]}\nstderr:{err[:400]}")

    yield proc
    proc.kill()
    proc.communicate(timeout=3)


def _make_client():
    """Return a fresh python-socketio SimpleClient connected to the test server."""
    client = sio_lib.SimpleClient()
    client.connect(BASE_URL, transports=["websocket"])
    return client


# ── Tests ─────────────────────────────────────────────────────────────────────

class TestConnect:
    def test_connect_receives_mp_welcome(self, ws_server):
        """On connect the server must emit mp_welcome with your_id and peers list."""
        client = _make_client()
        try:
            event = client.receive(timeout=3)
            assert event[0] == "mp_welcome", f"Expected mp_welcome, got {event[0]}"
            payload = event[1]
            assert "your_id" in payload
            assert "peers" in payload
            assert isinstance(payload["peers"], list)
        finally:
            client.disconnect()

    def test_welcome_includes_my_ip(self, ws_server):
        """mp_welcome payload must include myIp (used for cross-server friend requests)."""
        client = _make_client()
        try:
            event = client.receive(timeout=3)
            payload = event[1]
            assert "myIp" in payload
        finally:
            client.disconnect()


class TestPlayerJoined:
    def test_second_player_triggers_mp_player_joined(self, ws_server):
        """
        When a second client connects, the first client must receive mp_player_joined.
        """
        c1 = _make_client()
        # Drain the welcome event for c1
        c1.receive(timeout=3)

        c2 = _make_client()
        # Drain c2's welcome
        c2.receive(timeout=3)

        try:
            # c1 should now have a mp_player_joined queued
            event = c1.receive(timeout=3)
            assert event[0] == "mp_player_joined", (
                f"Expected mp_player_joined, got {event[0]}"
            )
            assert "id" in event[1]
        finally:
            c1.disconnect()
            c2.disconnect()


class TestMpName:
    def test_name_event_relayed_to_peer(self, ws_server):
        """
        Sending mp_name should relay mp_player_name to all other connected clients.
        """
        c1 = _make_client()
        c1.receive(timeout=3)  # consume welcome

        c2 = _make_client()
        c2.receive(timeout=3)  # consume welcome
        c1.receive(timeout=3)  # consume player_joined on c1

        try:
            c2.emit("mp_name", {"name": "Alice"})
            event = c1.receive(timeout=3)
            assert event[0] == "mp_player_name", f"Got {event[0]}"
            assert event[1].get("name") == "Alice"
        finally:
            c1.disconnect()
            c2.disconnect()


class TestMpPos:
    def test_position_relayed_with_sender_id(self, ws_server):
        """
        Sending mp_pos from c2 should arrive at c1 with the sender's id stamped.
        """
        c1 = _make_client()
        welcome = c1.receive(timeout=3)[1]

        c2 = _make_client()
        c2_welcome = c2.receive(timeout=3)[1]
        c1.receive(timeout=3)  # player_joined

        try:
            pos = {"u": 1.5, "v": 2.5, "y": 0.0, "heading": 90.0,
                   "weapon": "rifle", "hp": 100, "anim": "run"}
            c2.emit("mp_pos", pos)
            event = c1.receive(timeout=3)
            assert event[0] == "mp_pos", f"Got {event[0]}"
            payload = event[1]
            # Server stamps the sender's id
            assert "id" in payload
            assert payload["id"] == c2_welcome["your_id"]
        finally:
            c1.disconnect()
            c2.disconnect()


class TestMpEvent:
    def test_custom_event_relayed_with_from_id(self, ws_server):
        """
        mp_event from c2 should reach c1 with from_id set to c2's player id.
        """
        c1 = _make_client()
        c1.receive(timeout=3)

        c2 = _make_client()
        c2_welcome = c2.receive(timeout=3)[1]
        c1.receive(timeout=3)  # player_joined

        try:
            c2.emit("mp_event", {"type": "test_ping", "data": "hello"})
            event = c1.receive(timeout=3)
            assert event[0] == "mp_event", f"Got {event[0]}"
            payload = event[1]
            assert payload.get("type") == "test_ping"
            assert "from_id" in payload
            assert payload["from_id"] == c2_welcome["your_id"]
        finally:
            c1.disconnect()
            c2.disconnect()

    def test_friend_request_event_broadcast(self, ws_server):
        """
        A /api/friend_request POST should broadcast mp_event {type:'friend_request'}
        to all connected socket clients.

        We use a short-lived urllib.request call (not requests) so we don't
        accidentally reuse a connection that socket.io has upgraded to WebSocket.
        """
        import urllib.request
        import json as _json

        c1 = _make_client()
        c1.receive(timeout=3)  # consume welcome

        try:
            body = _json.dumps({"fromIp": "3.3.3.3", "fromName": "FriendBot"}).encode()
            req = urllib.request.Request(
                f"{BASE_URL}/api/friend_request",
                data=body,
                method="POST",
                headers={"Content-Type": "application/json"},
            )
            # Use a fresh urllib connection — no shared pool with socket.io client
            with urllib.request.urlopen(req, timeout=8) as resp:
                resp_data = _json.loads(resp.read())
            assert resp_data.get("ok") is True

            event = c1.receive(timeout=5)
            assert event[0] == "mp_event", f"Got {event[0]}"
            assert event[1].get("type") == "friend_request"
            assert event[1].get("fromIp") == "3.3.3.3"
        finally:
            c1.disconnect()


class TestDisconnect:
    def test_disconnect_triggers_mp_player_left(self, ws_server):
        """When c2 disconnects, c1 must receive mp_player_left with c2's id."""
        c1 = _make_client()
        c1.receive(timeout=3)  # welcome

        c2 = _make_client()
        c2_welcome = c2.receive(timeout=3)[1]
        c1.receive(timeout=3)  # player_joined

        try:
            c2.disconnect()
            event = c1.receive(timeout=4)
            assert event[0] == "mp_player_left", f"Got {event[0]}"
            assert event[1].get("id") == c2_welcome["your_id"]
        finally:
            c1.disconnect()
