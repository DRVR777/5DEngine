@echo off
title 5DEngine — Dual-Server Local Test
echo.
echo  ====================================================
echo   5DEngine — Launching TWO servers for local testing
echo   Player 1: https://localhost:5050
echo   Player 2: https://localhost:5051
echo  ====================================================
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Python not found. Run setup_peer.py first.
    pause
    exit /b 1
)

REM Check Flask
python -c "import flask, flask_socketio" >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Flask not installed. Run: pip install flask flask-socketio
    pause
    exit /b 1
)

REM Detect HTTPS
python -c "import OpenSSL" >nul 2>&1
if errorlevel 1 (
    set PROTO=http
) else (
    set PROTO=https
)

echo  Protocol: %PROTO%
echo.
echo  Starting server A on port 5050 in new window...
start "5DEngine Server A — port 5050" cmd /c "set PORT=5050 && python game_server.py"

REM Give A a moment to bind before B starts so logs are clean
timeout /t 2 /nobreak >nul

echo  Starting server B on port 5051 in new window...
start "5DEngine Server B — port 5051" cmd /c "set PORT=5051 && python game_server.py"

timeout /t 3 /nobreak >nul

echo.
echo  Opening both browser tabs...
start "" cmd /c "timeout /t 1 /nobreak >nul && start %PROTO%://localhost:5050/"
timeout /t 1 /nobreak >nul
start "" cmd /c "timeout /t 1 /nobreak >nul && start %PROTO%://localhost:5051/"

echo.
echo  Both servers are running.
echo  Tab 1  -->  %PROTO%://localhost:5050/   (Player 1)
echo  Tab 2  -->  %PROTO%://localhost:5051/   (Player 2)
echo.
echo  To test friends: in each tab, open the computer (E key),
echo  go to Servers, click Scan, then send a friend request.
echo.
echo  Close the two server windows to stop.
pause
