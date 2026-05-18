@echo off
title 5DEngine Launcher
echo.
echo  ====================================================
echo   5DEngine — Multiplayer Server + Game
echo  ====================================================
echo.

REM Kill any previous instance on port 8080
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":8080 " ^| findstr LISTENING') do taskkill /PID %%a /F >nul 2>&1

REM Check Node is available
where node >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Node.js not found.
    echo  Download from https://nodejs.org
    pause
    exit /b 1
)

REM Check socket.io is installed
if not exist "node_modules\socket.io" (
    echo  Installing socket.io...
    npm install socket.io --silent
)

echo  Starting 5DEngine server on http://localhost:8080 ...
echo  Open multiple tabs at that URL to test multiplayer.
echo  LAN players: use the LAN IP shown below.
echo.

start "5DEngine Server" cmd /k "node game_server.js 8080"

REM Wait for server to be ready
timeout /t 2 /nobreak >nul

echo  Opening browser...
start "" "http://localhost:8080"

echo.
echo  To add a second player: open http://localhost:8080 in another tab or window.
echo  Close the server window to stop.
echo.
