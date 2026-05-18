"""
test_server_api.py — pytest suite for game_server.py Flask REST endpoints.

Starts game_server.py in a subprocess on port 15050 (avoids colliding with a
live server on 5050), runs all HTTP assertions, then kills the subprocess.

Run with:  pytest tests/test_server_api.py -v
Or via:    tests\\run_tests.bat
"""

import os
import sys
import time
import json
import subprocess
import threading
import requests
import pytest

# ── Configuration ─────────────────────────────────────────────────────────────

SERVER_PORT = 15050
BASE_URL    = f"http://127.0.0.1:{SERVER_PORT}"
SERVER_PY   = os.path.join(os.path.dirname(__file__), "..", "game_server.py")
TIMEOUT     = 5  # seconds per request

# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def server():
    """
    Start game_server.py on a test port for the whole session.
    Killed automatically after all tests complete.
    NOTE: Forces HTTP (no HTTPS) by temporarily unsetting PYTHONPATH tricks —
    we just ensure pyopenssl is NOT imported by patching PORT env.
    The server auto-uses HTTPS only if pyopenssl is importable; we run HTTP
    here by passing PORT env and relying on the server's import logic.
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

    # Wait up to 8 seconds for the server to be ready
    deadline = time.time() + 8
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
        pytest.fail(f"game_server.py failed to start on port {SERVER_PORT}.\n"
                    f"stdout: {out[:500]}\nstderr: {err[:500]}")

    yield proc

    proc.kill()
    proc.communicate(timeout=3)


# ── /api/status ───────────────────────────────────────────────────────────────

class TestApiStatus:
    def test_returns_200(self, server):
        r = requests.get(f"{BASE_URL}/api/status", timeout=TIMEOUT)
        assert r.status_code == 200

    def test_content_type_json(self, server):
        r = requests.get(f"{BASE_URL}/api/status", timeout=TIMEOUT)
        assert "application/json" in r.headers.get("Content-Type", "")

    def test_server_field_is_5dengine(self, server):
        data = requests.get(f"{BASE_URL}/api/status", timeout=TIMEOUT).json()
        assert data.get("server") == "5dengine"

    def test_version_is_numeric(self, server):
        data = requests.get(f"{BASE_URL}/api/status", timeout=TIMEOUT).json()
        assert isinstance(data.get("version"), int)

    def test_player_count_present(self, server):
        data = requests.get(f"{BASE_URL}/api/status", timeout=TIMEOUT).json()
        assert "playerCount" in data
        assert isinstance(data["playerCount"], int)

    def test_hostname_present(self, server):
        data = requests.get(f"{BASE_URL}/api/status", timeout=TIMEOUT).json()
        assert "hostName" in data

    def test_port_matches(self, server):
        data = requests.get(f"{BASE_URL}/api/status", timeout=TIMEOUT).json()
        assert data.get("port") == SERVER_PORT


# ── /scan ─────────────────────────────────────────────────────────────────────

class TestScan:
    def test_returns_200(self, server):
        r = requests.get(f"{BASE_URL}/scan", timeout=30)
        assert r.status_code == 200

    def test_has_servers_list(self, server):
        data = requests.get(f"{BASE_URL}/scan", timeout=30).json()
        assert "servers" in data
        assert isinstance(data["servers"], list)

    def test_has_local_ip(self, server):
        data = requests.get(f"{BASE_URL}/scan", timeout=30).json()
        assert "localIp" in data

    def test_local_ip_format(self, server):
        data = requests.get(f"{BASE_URL}/scan", timeout=30).json()
        parts = data["localIp"].split(".")
        assert len(parts) == 4


# ── /api/friend_request ───────────────────────────────────────────────────────

class TestFriendRequest:
    def test_post_returns_ok(self, server):
        r = requests.post(
            f"{BASE_URL}/api/friend_request",
            json={"fromIp": "1.2.3.4", "fromName": "TestPlayer"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_no_body_still_returns_ok(self, server):
        """Server falls back to request.remote_addr if fromIp missing."""
        r = requests.post(f"{BASE_URL}/api/friend_request", json={}, timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_content_type_json(self, server):
        r = requests.post(
            f"{BASE_URL}/api/friend_request",
            json={"fromIp": "1.2.3.4", "fromName": "TestPlayer"},
            timeout=TIMEOUT,
        )
        assert "application/json" in r.headers.get("Content-Type", "")


# ── /api/friend_accept ────────────────────────────────────────────────────────

class TestFriendAccept:
    def test_missing_from_ip_returns_not_ok(self, server):
        r = requests.post(f"{BASE_URL}/api/friend_accept", json={}, timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is False
        assert "missing_fromIp" in data.get("reason", "")

    def test_accept_valid_request(self, server):
        """
        Send a friend request first so there's a pending entry, then accept it.
        Both steps must return ok=True.
        """
        from_ip = "9.8.7.6"
        # Seed a pending request
        requests.post(
            f"{BASE_URL}/api/friend_request",
            json={"fromIp": from_ip, "fromName": "PeerPlayer"},
            timeout=TIMEOUT,
        )
        # Accept it (our IP as seen by the server is 127.0.0.1)
        r = requests.post(
            f"{BASE_URL}/api/friend_accept",
            json={"fromIp": from_ip},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is True

    def test_accept_returns_friend_list(self, server):
        from_ip = "5.5.5.5"
        requests.post(
            f"{BASE_URL}/api/friend_request",
            json={"fromIp": from_ip, "fromName": "AnotherPeer"},
            timeout=TIMEOUT,
        )
        r = requests.post(
            f"{BASE_URL}/api/friend_accept",
            json={"fromIp": from_ip},
            timeout=TIMEOUT,
        )
        data = r.json()
        assert "friends" in data
        assert isinstance(data["friends"], list)


# ── /api/friends ──────────────────────────────────────────────────────────────

class TestFriendsList:
    def test_returns_200(self, server):
        r = requests.get(f"{BASE_URL}/api/friends", timeout=TIMEOUT)
        assert r.status_code == 200

    def test_has_required_fields(self, server):
        data = requests.get(f"{BASE_URL}/api/friends", timeout=TIMEOUT).json()
        assert "friends" in data
        assert "pending" in data
        assert "myIp" in data

    def test_friends_is_list(self, server):
        data = requests.get(f"{BASE_URL}/api/friends", timeout=TIMEOUT).json()
        assert isinstance(data["friends"], list)

    def test_pending_is_list(self, server):
        data = requests.get(f"{BASE_URL}/api/friends", timeout=TIMEOUT).json()
        assert isinstance(data["pending"], list)

    def test_accepted_friend_appears_in_list(self, server):
        """Accept a request then verify the friend shows in /api/friends."""
        from_ip = "7.7.7.7"
        requests.post(
            f"{BASE_URL}/api/friend_request",
            json={"fromIp": from_ip, "fromName": "FriendCheck"},
            timeout=TIMEOUT,
        )
        requests.post(
            f"{BASE_URL}/api/friend_accept",
            json={"fromIp": from_ip},
            timeout=TIMEOUT,
        )
        data = requests.get(f"{BASE_URL}/api/friends", timeout=TIMEOUT).json()
        friend_ips = [f["ip"] for f in data["friends"]]
        assert from_ip in friend_ips


# ── Static file serving ───────────────────────────────────────────────────────

class TestStaticServing:
    def test_root_returns_html(self, server):
        r = requests.get(f"{BASE_URL}/", timeout=TIMEOUT)
        assert r.status_code == 200
        assert "text/html" in r.headers.get("Content-Type", "")
