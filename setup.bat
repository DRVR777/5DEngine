@echo off
title 5DEngine Setup
echo.
echo  ====================================================
echo   5DEngine Setup
echo  ====================================================
echo.

REM ── 1. Check for Node.js ─────────────────────────────────────────────────────
where node >nul 2>&1
if not errorlevel 1 goto :node_ok

echo  Node.js not found. Installing via winget...
echo  (This requires Windows 10 version 1709 or later)
echo.

winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
if errorlevel 1 (
    echo.
    echo  winget install failed. Trying direct download...
    echo  Downloading Node.js LTS installer...
    echo.
    REM Download via PowerShell
    powershell -NoProfile -Command ^
      "Invoke-WebRequest -Uri 'https://nodejs.org/dist/lts/node-lts-win-x64.zip' -OutFile '%TEMP%\node_installer.msi' -UseBasicParsing; Start-Process -FilePath msiexec -ArgumentList '/i','%TEMP%\node_installer.msi','/qn' -Wait"
    if errorlevel 1 (
        echo.
        echo  ERROR: Could not auto-install Node.js.
        echo.
        echo  Please install it manually from: https://nodejs.org
        echo  Then re-run this setup.
        echo.
        pause
        exit /b 1
    )
)

REM Refresh PATH so node is visible in this session
for /f "tokens=*" %%i in ('where node 2^>nul') do set "NODE_PATH=%%i"
if "%NODE_PATH%"=="" (
    REM Common install location
    set "PATH=%PATH%;%ProgramFiles%\nodejs"
)

where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo  Node.js was installed but requires a terminal restart.
    echo  Please CLOSE this window and run setup.bat again.
    echo.
    pause
    exit /b 1
)

:node_ok
for /f "tokens=*" %%v in ('node --version') do set NODE_VER=%%v
echo  Node.js found: %NODE_VER%
echo.

REM ── 2. Install npm packages ───────────────────────────────────────────────────
echo  Installing packages (express, socket.io)...
cd /d "%~dp0"
call npm install --omit=dev
if errorlevel 1 (
    echo.
    echo  ERROR: npm install failed.
    echo  Make sure you have internet access and try again.
    echo.
    pause
    exit /b 1
)
echo.
echo  Packages installed.
echo.

REM ── 3. Done ───────────────────────────────────────────────────────────────────
echo  ====================================================
echo   Setup complete!
echo  ====================================================
echo.
echo  Run START.BAT to launch 5DEngine.
echo.
pause
