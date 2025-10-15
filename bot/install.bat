@echo off
echo ================================
echo Last Man Standing - Bot Installer
echo ================================
echo.

REM Prüfe ob Node.js installiert ist
node --version >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [FEHLER] Node.js ist nicht installiert oder nicht im PATH!
    echo.
    echo Bitte:
    echo 1. Installiere Node.js von: https://nodejs.org/
    echo 2. Starte den Computer NEU (wichtig!)
    echo 3. Starte dieses Script erneut
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js ist installiert
node --version
echo.

REM Prüfe ob npm installiert ist
npm --version >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [FEHLER] npm ist nicht installiert!
    echo Bitte installiere Node.js neu von: https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] npm ist installiert
npm --version
echo.

REM Installiere Dependencies
echo [INFO] Installiere Bot-Dependencies (das kann einige Minuten dauern)...
echo.
npm install
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [FEHLER] npm install ist fehlgeschlagen!
    echo.
    echo Moegliche Loesungen:
    echo 1. Internet-Verbindung pruefen
    echo 2. Als Administrator ausfuehren (Rechtsklick -^> Als Administrator ausfuehren)
    echo 3. Firewall/Antivirus kurz deaktivieren
    echo.
    pause
    exit /b 1
)

REM Prüfe ob node_modules wirklich existiert
if not exist "node_modules" (
    echo.
    echo [FEHLER] node_modules Ordner wurde nicht erstellt!
    echo Installation ist fehlgeschlagen.
    echo.
    pause
    exit /b 1
)

echo.
echo ================================
echo Installation erfolgreich!
echo ================================
echo.
echo Der node_modules Ordner wurde erstellt.
echo Starte jetzt den Bot mit: start-bot.bat
echo.
pause
