@echo off
title 5DEngine Launcher
echo.
echo  ============================
echo   5DEngine — Starting server
echo  ============================
echo.

REM Try game_server.py first (Flask + SocketIO — enables multiplayer)
python --version >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Python not found. Install Python from python.org
    pause
    exit /b 1
)

REM Check if Flask is available (needed for game_server.py)
python -c "import flask, flask_socketio" >nul 2>&1
if errorlevel 1 (
    echo  Flask not found — using Python built-in server (no multiplayer^)
    echo  To enable multiplayer: pip install flask flask-socketio
    echo.
    echo  Starting http://localhost:5050 ...
    start "" "http://localhost:5050"
    python -m http.server 5050
) else (
    echo  Starting multiplayer server at http://localhost:5050 ...
    echo  Press Ctrl+C to stop.
    echo.
    REM Open browser after 1.5s (gives server time to start)
    start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:5050"
    python game_server.py
)
