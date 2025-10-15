@echo off
echo ================================
echo Last Man Standing - Discord Bot
echo ================================
echo.

REM Prüfe ob node_modules existiert
if not exist "node_modules" (
    echo [FEHLER] Dependencies nicht installiert!
    echo Bitte starte zuerst: install.bat
    echo.
    pause
    exit /b 1
)

echo [INFO] Starte Discord Bot...
echo.
node discord-bot.js

pause

