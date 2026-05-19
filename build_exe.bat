@echo off
title 5DEngine — Build Standalone EXE
echo.
echo  ====================================================
echo   5DEngine — Build Standalone EXE (no Node required)
echo  ====================================================
echo.
echo  This bundles game_server.js into a single .exe using
echo  caxa — the game files (index.html, src/) still live
echo  next to the exe, but Node.js is embedded inside it.
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Node.js not found. Run SETUP.BAT first.
    pause & exit /b 1
)

cd /d "%~dp0"

if not exist "node_modules\express" (
    echo  Installing packages first...
    call npm install --omit=dev --silent
)

echo  Installing caxa (one-time bundler)...
call npm install --save-dev caxa --silent
if errorlevel 1 (
    echo  ERROR: caxa install failed. Check internet.
    pause & exit /b 1
)

if not exist "dist" mkdir dist

echo  Bundling — this takes ~30 seconds...
echo.

call node_modules\.bin\caxa ^
  --input "." ^
  --output "dist\5DEngine.exe" ^
  --exclude "dist" ^
  --exclude ".git" ^
  --exclude "tests" ^
  --exclude "docs" ^
  -- "{{caxa}}\node_modules\.bin\node" "{{caxa}}\game_server.js" 8080

if exist "dist\5DEngine.exe" (
    echo.
    echo  ====================================================
    echo   SUCCESS:  dist\5DEngine.exe
    echo  ====================================================
    echo.
    echo  To distribute: copy the ENTIRE folder to another PC
    echo  and double-click 5DEngine.exe — no Node.js needed.
    echo  The exe carries its own Node runtime inside it.
    echo.
) else (
    echo.
    echo  Build failed — check output above for errors.
    echo  You can still use start.bat (requires Node.js).
    echo.
)

pause
