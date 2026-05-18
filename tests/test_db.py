"""
test_db.py — pytest suite for PostgreSQL + server.js (Node/Express) API.

Tests two layers:
  1. Direct psycopg2 connection — schema integrity, seed data, CRUD per table.
  2. HTTP requests to server.js (port 3001) — REST API correctness.

Prerequisites:
  - PostgreSQL running with 5dengine DB + schema.sql applied
    (run setup_peer.py or: createdb 5dengine && psql -d 5dengine -f db/schema.sql)
  - server.js running on port 3001
    (run: node server.js   or the tests will skip the HTTP layer)

Run with:  pytest tests/test_db.py -v
Or via:    tests\\run_tests.bat
"""

import os
import sys
import time
import subprocess
import requests
import pytest

# ── Configuration ─────────────────────────────────────────────────────────────

PG_DSN = {
    "dbname":          "5dengine",
    "user":            "postgres",
    "password":        "postgres",
    "host":            "localhost",
    "port":            5432,
    "connect_timeout": 5,
}

NODE_BASE = "http://127.0.0.1:3001"

# ── psycopg2 skip guard ────────────────────────────────────────────────────────

try:
    import psycopg2
    import psycopg2.extras
    _PG_AVAILABLE = True
except ImportError:
    _PG_AVAILABLE = False

skip_if_no_psycopg2 = pytest.mark.skipif(
    not _PG_AVAILABLE,
    reason="psycopg2 not installed — run: pip install psycopg2-binary",
)


# ── Connection fixture ────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def pg():
    """Open a single DB connection for the whole session."""
    if not _PG_AVAILABLE:
        pytest.skip("psycopg2 not available")
    try:
        conn = psycopg2.connect(**PG_DSN)
        conn.autocommit = True
    except Exception as e:
        pytest.skip(f"PostgreSQL not reachable: {e}")
    yield conn
    conn.close()


# ── 1. Schema integrity ───────────────────────────────────────────────────────

EXPECTED_TABLES = [
    "engine_sessions",
    "engine_scenes",
    "engine_assets",
    "engine_npc_dialogs",
    "engine_quest_defs",
    "engine_quest_progress",
    "engine_world_objects",
]


class TestSchema:
    @skip_if_no_psycopg2
    def test_all_expected_tables_exist(self, pg):
        cur = pg.cursor()
        cur.execute("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public'
        """)
        existing = {row[0] for row in cur.fetchall()}
        for table in EXPECTED_TABLES:
            assert table in existing, f"Missing table: {table}"

    @skip_if_no_psycopg2
    def test_quest_defs_seeded(self, pg):
        """schema.sql seeds at least 3 quest definitions."""
        cur = pg.cursor()
        cur.execute("SELECT COUNT(*) FROM engine_quest_defs")
        (count,) = cur.fetchone()
        assert count >= 3, f"Expected ≥3 seed quests, got {count}"

    @skip_if_no_psycopg2
    def test_quest_defs_have_expected_columns(self, pg):
        cur = pg.cursor()
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'engine_quest_defs'
        """)
        cols = {row[0] for row in cur.fetchall()}
        for expected in ("id", "title", "description"):
            assert expected in cols, f"Missing column: {expected}"


# ── 2. CRUD: engine_sessions ──────────────────────────────────────────────────
# Schema: user_id TEXT, world_name TEXT, score INT, hero_hp INT, ...
# UNIQUE: (user_id, world_name)

class TestSessionsCRUD:
    @skip_if_no_psycopg2
    def test_insert_and_select_session(self, pg):
        cur = pg.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        # Upsert using real schema columns
        cur.execute("""
            INSERT INTO engine_sessions (user_id, world_name, score, hero_hp)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (user_id, world_name) DO UPDATE
                SET score   = EXCLUDED.score,
                    hero_hp = EXCLUDED.hero_hp
            RETURNING user_id, score
        """, ("pytest-player-001", "pytest-world", 42, 80))
        row = cur.fetchone()
        assert row["user_id"] == "pytest-player-001"
        assert row["score"] == 42

    @skip_if_no_psycopg2
    def test_select_session(self, pg):
        cur = pg.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "SELECT score, hero_hp FROM engine_sessions "
            "WHERE user_id = %s AND world_name = %s",
            ("pytest-player-001", "pytest-world"),
        )
        row = cur.fetchone()
        assert row is not None
        assert row["score"] == 42
        assert row["hero_hp"] == 80


# ── 3. CRUD: engine_scenes ────────────────────────────────────────────────────
# Schema: user_id TEXT, world_name TEXT, name TEXT, objects JSONB, ...
# UNIQUE: (user_id, world_name, name)

class TestScenesCRUD:
    _scene_id = None

    @skip_if_no_psycopg2
    def test_insert_scene(self, pg):
        cur = pg.cursor()
        cur.execute("""
            INSERT INTO engine_scenes (user_id, world_name, name, objects)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (user_id, world_name, name) DO UPDATE
                SET objects = EXCLUDED.objects
            RETURNING id
        """, ("pytest-user", "pytest-world", "pytest-scene",
              psycopg2.extras.Json([])))
        (scene_id,) = cur.fetchone()
        TestScenesCRUD._scene_id = scene_id
        assert scene_id is not None

    @skip_if_no_psycopg2
    def test_select_scene(self, pg):
        assert TestScenesCRUD._scene_id is not None, "Depends on test_insert_scene"
        cur = pg.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT name FROM engine_scenes WHERE id = %s",
                    (TestScenesCRUD._scene_id,))
        row = cur.fetchone()
        assert row is not None
        assert row["name"] == "pytest-scene"

    @skip_if_no_psycopg2
    def test_delete_scene(self, pg):
        if TestScenesCRUD._scene_id is None:
            pytest.skip("No scene to delete")
        cur = pg.cursor()
        cur.execute("DELETE FROM engine_scenes WHERE id = %s",
                    (TestScenesCRUD._scene_id,))
        assert cur.rowcount == 1


# ── 4. CRUD: engine_quest_progress ───────────────────────────────────────────
# Schema: user_id TEXT, quest_id TEXT (from engine_quest_defs.quest_id),
#         steps_done BOOLEAN[], is_complete BOOLEAN
# UNIQUE: (user_id, quest_id)

class TestQuestProgressCRUD:
    @skip_if_no_psycopg2
    def test_insert_and_select_progress(self, pg):
        cur = pg.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        # Get a valid quest_id string (TEXT, not the serial PK)
        cur.execute("SELECT quest_id FROM engine_quest_defs LIMIT 1")
        row = cur.fetchone()
        if row is None:
            pytest.skip("No quest_defs seeded")
        quest_id = row["quest_id"]  # e.g. "intro"

        cur.execute("""
            INSERT INTO engine_quest_progress (user_id, quest_id, is_complete)
            VALUES (%s, %s, %s)
            ON CONFLICT (user_id, quest_id) DO UPDATE
                SET is_complete = EXCLUDED.is_complete
            RETURNING is_complete
        """, ("pytest-player-001", quest_id, False))
        result = cur.fetchone()
        assert result["is_complete"] is False


# ── 5. server.js HTTP API ─────────────────────────────────────────────────────

def _node_running():
    """Return True if server.js is reachable on port 3001."""
    try:
        r = requests.get(f"{NODE_BASE}/api/ping", timeout=2)
        return r.status_code == 200
    except Exception:
        return False


skip_if_no_node = pytest.mark.skipif(
    not _node_running(),
    reason="server.js not running on port 3001 — start it with: node server.js",
)


class TestNodeApi:
    @skip_if_no_node
    def test_ping(self):
        r = requests.get(f"{NODE_BASE}/api/ping", timeout=5)
        assert r.status_code == 200
        assert r.json().get("ok") is True

    @skip_if_no_node
    def test_upsert_session(self):
        r = requests.post(
            f"{NODE_BASE}/api/sessions",
            json={"playerId": "pytest-node-001", "data": {"hp": 80}},
            timeout=5,
        )
        assert r.status_code == 200
        data = r.json()
        assert data.get("player_id") == "pytest-node-001"

    @skip_if_no_node
    def test_get_scenes(self):
        r = requests.get(f"{NODE_BASE}/api/scenes", timeout=5)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    @skip_if_no_node
    def test_create_and_get_scene(self):
        # Create
        r = requests.post(
            f"{NODE_BASE}/api/scenes",
            json={"name": "pytest-node-scene", "data": {"objects": []}},
            timeout=5,
        )
        assert r.status_code == 200
        scene_id = r.json().get("id")
        assert scene_id is not None

        # Fetch all — our scene should be in the list
        r2 = requests.get(f"{NODE_BASE}/api/scenes", timeout=5)
        ids = [s["id"] for s in r2.json()]
        assert scene_id in ids

        # Cleanup
        requests.delete(f"{NODE_BASE}/api/scenes/{scene_id}", timeout=5)

    @skip_if_no_node
    def test_quest_progress_endpoint(self):
        """GET /api/quest-progress?playerId=X must return a list."""
        r = requests.get(
            f"{NODE_BASE}/api/quest-progress",
            params={"playerId": "pytest-node-001"},
            timeout=5,
        )
        assert r.status_code == 200
        assert isinstance(r.json(), list)
