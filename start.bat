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
    echo  Run SETUP.BAT first, or download from https://nodejs.org
    echo.
    pause
    exit /b 1
)

REM Install/update packages if node_modules is missing or outdated
if not exist "node_modules\express" (
    echo  Installing packages...
    call npm install --omit=dev --silent
    if errorlevel 1 (
        echo  ERROR: npm install failed. Check your internet connection.
        pause
        exit /b 1
    )
)

echo  Starting 5DEngine server on http://localhost:8080 ...
echo.

start "5DEngine Server" cmd /k "node game_server.js 8080"

REM Wait for server to be ready
timeout /t 2 /nobreak >nul

echo  Opening browser...
start "" "http://localhost:8080"

echo.
echo  ── Multiplayer ──────────────────────────────────────
echo  This machine:  http://localhost:8080
echo.
echo  Friends on the same WiFi — tell them to open this
echo  URL in their browser (shown in the server window):
echo    http://YOUR-PC-NAME.local:8080
echo.
echo  Close the server window to stop.
echo.
