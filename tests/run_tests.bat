@echo off
title 5DEngine — Test Suite
setlocal enabledelayedexpansion

echo.
echo  ====================================================
echo   5DEngine — Running full test suite
echo  ====================================================
echo.

REM Check Python/pytest
python -m pytest --version >nul 2>&1
if errorlevel 1 (
    echo  ERROR: pytest not found.
    echo  Run:   pip install pytest pytest-timeout requests python-socketio[client] websocket-client psycopg2-binary
    pause
    exit /b 1
)

REM Track pass/fail counts across test files
set PASS_COUNT=0
set FAIL_COUNT=0
set RESULTS=

echo  --- Server API tests (game_server.py Flask endpoints) ---
python -m pytest tests\test_server_api.py -v --timeout=40 --tb=short
if errorlevel 1 (
    set /a FAIL_COUNT+=1
    set RESULTS=!RESULTS! [FAIL] test_server_api
) else (
    set /a PASS_COUNT+=1
    set RESULTS=!RESULTS! [PASS] test_server_api
)

echo.
echo  --- WebSocket tests (socket.io real-time events) ---
python -m pytest tests\test_websocket.py -v --timeout=30 --tb=short
if errorlevel 1 (
    set /a FAIL_COUNT+=1
    set RESULTS=!RESULTS! [FAIL] test_websocket
) else (
    set /a PASS_COUNT+=1
    set RESULTS=!RESULTS! [PASS] test_websocket
)

echo.
echo  --- Database tests (PostgreSQL + server.js API) ---
echo  NOTE: PostgreSQL must be running. server.js tests are skipped if node server.js is not running.
python -m pytest tests\test_db.py -v --timeout=15 --tb=short
if errorlevel 1 (
    set /a FAIL_COUNT+=1
    set RESULTS=!RESULTS! [FAIL] test_db
) else (
    set /a PASS_COUNT+=1
    set RESULTS=!RESULTS! [PASS] test_db
)

echo.
echo  ====================================================
echo   SUMMARY
echo  ====================================================
for %%R in (!RESULTS!) do echo    %%R
echo.
if !FAIL_COUNT! EQU 0 (
    echo   ALL SUITES PASSED  (%PASS_COUNT% / %PASS_COUNT%)
) else (
    echo   %FAIL_COUNT% suite(s) FAILED  ^(%PASS_COUNT% passed, %FAIL_COUNT% failed^)
)
echo  ====================================================
echo.

if !FAIL_COUNT! GTR 0 (
    exit /b 1
)
exit /b 0
