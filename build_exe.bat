@echo off
title 5DEngine — Build Setup EXE
echo.
echo  ====================================================
echo   5DEngine — Building setup_peer.py → .exe
echo  ====================================================
echo.

REM Ensure PyInstaller is available
python -m pip install --upgrade pyinstaller >nul 2>&1
if errorlevel 1 (
    echo  ERROR: pip/python not found. Install Python 3.12+ first.
    pause
    exit /b 1
)

echo  Building single-file executable...
echo.

REM --onefile   = single .exe (slower startup, easier to distribute)
REM --name      = output filename
REM --console   = keep console window so progress is visible
REM --clean     = purge PyInstaller cache before build
python -m PyInstaller --onefile --name "5DEngine-Setup" --console --clean setup_peer.py

if errorlevel 1 (
    echo.
    echo  ERROR: PyInstaller build failed. See errors above.
    pause
    exit /b 1
)

echo.
echo  ====================================================
echo   Done!  Executable is at:  dist\5DEngine-Setup.exe
echo.
echo   Share that file with peers.
echo   They run it once — it installs everything.
echo   Then they run start.bat to launch the game.
echo  ====================================================
echo.
pause
