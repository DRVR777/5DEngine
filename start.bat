@echo off
title 5DEngine Launcher
echo.
echo  ================================
echo   5DEngine — Two-server launcher
echo  ================================
echo.

REM Kill any previous instances on these ports
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":8080 " ^| findstr LISTENING') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":8081 " ^| findstr LISTENING') do taskkill /PID %%a /F >nul 2>&1

echo  Starting Player 1 server on http://localhost:8080 ...
start "5DEngine P1 :8080" cmd /k "npx serve . --listen 8080 --no-clipboard"

echo  Starting Player 2 server on http://localhost:8081 ...
start "5DEngine P2 :8081" cmd /k "npx serve . --listen 8081 --no-clipboard"

echo  Waiting 2 seconds for servers to start...
timeout /t 2 /nobreak >nul

echo  Opening browsers...
start "" "http://localhost:8080"
start "" "http://localhost:8081"

echo.
echo  Both servers running.
echo  Close the two server windows to stop.
echo.
