@echo off
title 5DEngine Launcher
echo.
echo  ============================
echo   5DEngine — Starting server
echo  ============================
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Python not found. Install Python from python.org
    pause
    exit /b 1
)

REM Check if Flask + SocketIO are available (needed for multiplayer)
python -c "import flask, flask_socketio" >nul 2>&1
if errorlevel 1 (
    echo  Flask not found — using Python built-in server ^(no multiplayer^)
    echo  To enable multiplayer: pip install flask flask-socketio
    echo.
    echo  Starting http://localhost:5050 ...
    start "" "http://localhost:5050"
    python -m http.server 5050
    goto :eof
)

REM Check if pyopenssl is available (enables HTTPS + secure WebSockets)
python -c "import OpenSSL" >nul 2>&1
if errorlevel 1 (
    echo  pyopenssl not found — running HTTP ^(no HTTPS^)
    echo  For HTTPS: pip install pyopenssl cryptography
    echo.
    echo  Starting http://localhost:5050 ...
    start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:5050"
) else (
    echo  HTTPS enabled ^(self-signed cert^)
    echo  Browser will warn once — click Advanced ^> Proceed to localhost
    echo.
    echo  Starting https://localhost:5050 ...
    start "" cmd /c "timeout /t 2 /nobreak >nul && start https://localhost:5050"
)

echo  Press Ctrl+C to stop the server.
echo.
python game_server.py
