@echo off
title 5DEngine Launcher

REM ── Self-elevate to Administrator (needed for firewall rule) ─────────────────
net session >nul 2>&1
if errorlevel 1 (
    echo  Requesting administrator access to open firewall port 8080...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"
echo.
echo  ====================================================
echo   5DEngine — Multiplayer Server + Game
echo  ====================================================
echo.

REM ── Optional git pull ─────────────────────────────────────────────────────────
where git >nul 2>&1
if not errorlevel 1 (
    set /p PULL_CHOICE= Pull latest from GitHub? [Y/N]:
    if /i "%PULL_CHOICE%"=="Y" (
        echo  Pulling latest...
        git pull
        if errorlevel 1 (
            echo  WARNING: git pull failed. Continuing with local version.
        ) else (
            echo  Up to date.
        )
        echo.
    )
)

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

REM Install packages if missing
if not exist "node_modules\express" (
    echo  Installing packages...
    call npm install --omit=dev --silent
    if errorlevel 1 (
        echo  ERROR: npm install failed.
        pause
        exit /b 1
    )
)

REM ── Firewall rule — allows LAN computers to reach port 8080 ──────────────────
netsh advfirewall firewall delete rule name="5DEngine-8080" >nul 2>&1
netsh advfirewall firewall add rule name="5DEngine-8080" dir=in action=allow protocol=TCP localport=8080 >nul 2>&1
echo  Firewall: port 8080 opened for LAN access.

REM ── Get LAN IP ────────────────────────────────────────────────────────────────
set LAN_IP=
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "127.0"') do (
    if not defined LAN_IP set LAN_IP=%%a
)
set LAN_IP=%LAN_IP: =%

echo.
echo  Starting 5DEngine server...
start "5DEngine Server" cmd /k "node game_server.js 8080"
timeout /t 2 /nobreak >nul

echo  Opening browser...
start "" "http://localhost:8080"

echo.
echo  ── Friends on the same WiFi open one of these ───────
if defined LAN_IP (
echo    http://%LAN_IP%:8080
)
for /f %%h in ('hostname') do echo    http://%%h.local:8080
echo.
echo  Firewall rule added. Close the server window to stop.
echo.
pause
