"""
5DEngine Peer Setup — run this once to install every dependency.

Usage (as plain Python script):
    python setup_peer.py

Usage (as compiled EXE from build_exe.bat):
    5DEngine-Setup.exe

What it installs:
  • Python 3.12      (via winget — skipped if already present)
  • Python packages  flask flask-socketio pyopenssl cryptography
                     psycopg2-binary pytest requests python-socketio[client]
  • Node.js LTS      (via winget — skipped if already present)
  • npm packages     (from package.json — cors express pg)
  • PostgreSQL 16    (via winget — skipped if already present)
  • 5dengine DB      (createdb + db/schema.sql)

After setup, run:   start.bat
Run tests with:     tests\\run_tests.bat
"""

import sys
import os
import subprocess
import time
import shutil
import urllib.request
import json
import ctypes
import threading

# ── Colour helpers ────────────────────────────────────────────────────────────

RESET  = "\033[0m"
GREEN  = "\033[92m"
YELLOW = "\033[93m"
RED    = "\033[91m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"

def ok(msg):   print(f"  {GREEN}✓{RESET}  {msg}")
def warn(msg): print(f"  {YELLOW}⚠{RESET}  {msg}")
def err(msg):  print(f"  {RED}✗{RESET}  {msg}")
def info(msg): print(f"  {CYAN}→{RESET}  {msg}")
def hdr(msg):  print(f"\n{BOLD}{CYAN}{msg}{RESET}\n{'─'*50}")

# ── Utilities ─────────────────────────────────────────────────────────────────

SCRIPT_DIR = os.path.dirname(os.path.abspath(
    sys.executable if getattr(sys, "frozen", False) else __file__
))

def run(cmd, cwd=None, capture=True, timeout=300, env=None):
    """Run a shell command. Returns (returncode, stdout+stderr combined)."""
    if isinstance(cmd, str):
        cmd = cmd.split()
    try:
        result = subprocess.run(
            cmd, cwd=cwd or SCRIPT_DIR,
            capture_output=capture, text=True, timeout=timeout,
            env=env,
        )
        combined = (result.stdout or "") + (result.stderr or "")
        return result.returncode, combined.strip()
    except subprocess.TimeoutExpired:
        return 1, "TIMEOUT"
    except FileNotFoundError as e:
        return 1, str(e)

def which(name):
    """Return the full path to an executable, or None."""
    return shutil.which(name)

def find_in_path(candidates):
    """Return the first executable found in the list, or None."""
    for c in candidates:
        p = which(c)
        if p:
            return p
    return None

def is_admin():
    try:
        return ctypes.windll.shell32.IsUserAnAdmin()
    except Exception:
        return False

# ── Step 1: Python packages ───────────────────────────────────────────────────

def setup_python_packages():
    hdr("Step 1 — Python packages")

    # Determine which Python to use for pip installs.
    # When running as a frozen exe, sys.executable is the bundled Python — but
    # the user needs packages installed into their SYSTEM Python so game_server.py
    # can use them. Find system Python separately.
    system_python = find_in_path(["python", "python3", "py"])

    if getattr(sys, "frozen", False) and system_python is None:
        warn("No system Python found — attempting install via winget")
        rc, out = run(["winget", "install", "--id", "Python.Python.3.12",
                       "--accept-package-agreements", "--accept-source-agreements",
                       "--silent"])
        if rc != 0:
            err(f"winget Python install failed: {out[:200]}")
            err("Please install Python 3.12 manually from https://python.org")
            return False
        # Re-detect after install (winget updates PATH only in new shells; look at default loc)
        for candidate in [
            r"C:\Users\{}\AppData\Local\Programs\Python\Python312\python.exe".format(os.environ.get("USERNAME", "")),
            r"C:\Program Files\Python312\python.exe",
        ]:
            if os.path.exists(candidate):
                system_python = candidate
                break
        if system_python is None:
            warn("Python installed but not found in PATH — please restart and re-run setup")
            return False
        ok(f"Python installed: {system_python}")
    elif system_python:
        rc, ver = run([system_python, "--version"])
        ok(f"Python: {ver}")
    else:
        err("No Python found and not running as exe — install Python 3.12+ first")
        return False

    pip_py = system_python

    packages = [
        "flask",
        "flask-socketio",
        "pyopenssl",
        "cryptography",
        "psycopg2-binary",   # PostgreSQL driver for Python tests
        "pytest",
        "pytest-timeout",
        "requests",
        "python-socketio[client]",
        "websocket-client",
    ]
    info(f"Installing {len(packages)} Python packages...")
    rc, out = run([pip_py, "-m", "pip", "install", "--upgrade"] + packages, timeout=600)
    if rc != 0:
        err(f"pip install failed:\n{out[-500:]}")
        return False
    ok("All Python packages installed")
    return True

# ── Step 2: Node.js ───────────────────────────────────────────────────────────

def setup_nodejs():
    hdr("Step 2 — Node.js")

    node = find_in_path(["node"])
    if node:
        rc, ver = run([node, "--version"])
        ok(f"Node.js already installed: {ver}")
    else:
        info("Installing Node.js LTS via winget...")
        rc, out = run([
            "winget", "install", "--id", "OpenJS.NodeJS.LTS",
            "--accept-package-agreements", "--accept-source-agreements", "--silent"
        ], timeout=300)
        if rc != 0:
            err(f"winget Node.js install failed: {out[:200]}")
            warn("Install Node.js manually from https://nodejs.org — server.js needs it")
            return False
        ok("Node.js installed (restart terminal to use it in PATH)")

    # npm install
    npm = find_in_path(["npm"])
    if npm:
        info("Running npm install...")
        rc, out = run([npm, "install"], cwd=SCRIPT_DIR, timeout=120)
        if rc != 0:
            err(f"npm install failed: {out[-300:]}")
            return False
        ok("npm packages installed (cors, express, pg)")
    else:
        warn("npm not in PATH yet — run 'npm install' manually after restarting terminal")

    return True

# ── Step 3: PostgreSQL ────────────────────────────────────────────────────────

def _pg_bin():
    """Find the PostgreSQL bin directory."""
    # Check PATH first
    for exe in ["psql", "createdb"]:
        p = which(exe)
        if p:
            return os.path.dirname(p)
    # Common Windows install locations
    import glob
    for pattern in [
        r"C:\Program Files\PostgreSQL\*\bin",
        r"C:\Program Files (x86)\PostgreSQL\*\bin",
    ]:
        matches = sorted(glob.glob(pattern), reverse=True)  # highest version first
        if matches:
            return matches[0]
    return None

def setup_postgres():
    hdr("Step 3 — PostgreSQL")

    pg = _pg_bin()
    if pg:
        ok(f"PostgreSQL found: {pg}")
    else:
        info("Installing PostgreSQL 16 via winget...")
        rc, out = run([
            "winget", "install", "--id", "PostgreSQL.PostgreSQL.16",
            "--accept-package-agreements", "--accept-source-agreements",
        ], timeout=600)
        if rc != 0:
            err(f"winget PostgreSQL install failed:\n{out[:300]}")
            warn("Install PostgreSQL 16 manually from https://www.postgresql.org/download/windows/")
            return False
        time.sleep(5)
        pg = _pg_bin()
        if not pg:
            warn("PostgreSQL installed but bin not found — restart and re-run setup")
            return False
        ok(f"PostgreSQL installed: {pg}")

    # Ensure the service is running
    info("Starting PostgreSQL service...")
    for svc in ["postgresql-x64-16", "postgresql-x64-15", "postgresql-x64-14", "postgresql"]:
        rc, _ = run(["net", "start", svc])
        if rc == 0:
            ok(f"Service '{svc}' started")
            break
        rc2, st = run(["sc", "query", svc])
        if "RUNNING" in st:
            ok(f"Service '{svc}' already running")
            break
    else:
        warn("Could not auto-start PostgreSQL service — start it manually if DB init fails")

    time.sleep(2)

    # Create the 5dengine database
    createdb = os.path.join(pg, "createdb.exe")
    psql     = os.path.join(pg, "psql.exe")

    if not os.path.exists(createdb):
        err(f"createdb not found at {createdb}")
        return False

    info("Creating database '5dengine'...")
    rc, out = run([createdb, "-U", "postgres", "--if-not-exists", "5dengine"],
                  env={**os.environ, "PGPASSWORD": "postgres"})
    # createdb doesn't support --if-not-exists on older versions; ignore "already exists"
    if rc != 0 and "already exists" not in out:
        err(f"createdb failed: {out}")
        return False
    ok("Database '5dengine' ready")

    # Apply schema
    schema_path = os.path.join(SCRIPT_DIR, "db", "schema.sql")
    if not os.path.exists(schema_path):
        err(f"schema.sql not found at {schema_path}")
        return False

    info("Applying db/schema.sql...")
    rc, out = run([psql, "-U", "postgres", "-d", "5dengine", "-f", schema_path],
                  env={**os.environ, "PGPASSWORD": "postgres"})
    if rc != 0:
        err(f"schema apply failed: {out[-400:]}")
        return False
    ok("Schema applied (all tables + seed quest data)")
    return True

# ── Step 4: Smoke test ────────────────────────────────────────────────────────

def smoke_test():
    hdr("Step 4 — Smoke test")
    import importlib

    passed = 0
    failed = 0

    def check(label, fn):
        nonlocal passed, failed
        try:
            fn()
            ok(label)
            passed += 1
        except Exception as e:
            err(f"{label}: {e}")
            failed += 1

    # Python imports
    check("import flask",           lambda: importlib.import_module("flask"))
    check("import flask_socketio",  lambda: importlib.import_module("flask_socketio"))
    check("import OpenSSL",         lambda: importlib.import_module("OpenSSL"))
    check("import cryptography",    lambda: importlib.import_module("cryptography"))
    check("import psycopg2",        lambda: importlib.import_module("psycopg2"))
    check("import socketio",        lambda: importlib.import_module("socketio"))

    # PostgreSQL connectivity
    def _pg_connect():
        import psycopg2
        conn = psycopg2.connect(
            dbname="5dengine", user="postgres", password="postgres",
            host="localhost", connect_timeout=5
        )
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM engine_quest_defs")
        (n,) = cur.fetchone()
        assert n >= 3, f"Expected ≥3 quest_defs, got {n}"
        conn.close()
    check("PostgreSQL: connect + quest_defs seeded", _pg_connect)

    # game_server.py can be imported without crashing
    def _import_game_server():
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "game_server", os.path.join(SCRIPT_DIR, "game_server.py")
        )
        mod = importlib.util.module_from_spec(spec)
        # Don't actually exec (runs the server), just check it parses
        import ast
        with open(os.path.join(SCRIPT_DIR, "game_server.py")) as f:
            ast.parse(f.read())
    check("game_server.py: syntax valid", _import_game_server)

    print()
    print(f"  Smoke test: {GREEN}{passed} passed{RESET}  " +
          (f"{RED}{failed} failed{RESET}" if failed else f"{GREEN}0 failed{RESET}"))
    return failed == 0

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    # Enable ANSI colours on Windows
    os.system("")

    print(f"""
{BOLD}{CYAN}╔══════════════════════════════════════════════╗
║       5DEngine Peer Setup v1.0               ║
║       Sets up everything to run the game     ║
╚══════════════════════════════════════════════╝{RESET}

  This will install:
    • Python packages  (flask, socket.io, SSL, postgres driver, pytest)
    • Node.js LTS      (needed for server.js API)
    • PostgreSQL 16    (session / scene / asset persistence)
    • 5dengine DB      (schema + seed data)

  Existing installs are skipped. No data is deleted.
""")

    if sys.platform != "win32":
        warn("This setup script is designed for Windows.")
        warn("On Linux/Mac: pip install flask flask-socketio pyopenssl cryptography")
        warn("              brew install postgresql / apt install postgresql")
        warn("              createdb 5dengine && psql -d 5dengine -f db/schema.sql")
        sys.exit(1)

    steps = [
        ("Python packages", setup_python_packages),
        ("Node.js + npm",   setup_nodejs),
        ("PostgreSQL + DB", setup_postgres),
        ("Smoke test",      smoke_test),
    ]

    all_ok = True
    for name, fn in steps:
        try:
            result = fn()
            if result is False:
                all_ok = False
        except Exception as e:
            err(f"Unexpected error in '{name}': {e}")
            all_ok = False

    print()
    if all_ok:
        print(f"{GREEN}{BOLD}  ✓ Setup complete!{RESET}")
        print("""
  Next steps:
    1. Double-click  start.bat       → starts the HTTPS game server
    2. Accept the self-signed cert in your browser (one time)
    3. Share your LAN IP with friends — they open the same URL
    4. Press E near the in-game computer → Friends → Servers

  Run tests anytime:
    tests\\run_tests.bat
""")
    else:
        print(f"{YELLOW}{BOLD}  ⚠ Setup finished with warnings — see errors above.{RESET}")
        print("  Some steps may need manual intervention.")
        print("  The game still runs without PostgreSQL (solo play is unaffected).")

    if getattr(sys, "frozen", False):
        input("\n  Press Enter to close...")

if __name__ == "__main__":
    main()
