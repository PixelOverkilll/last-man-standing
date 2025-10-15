@echo off
echo ================================
echo Node.js Installation Check
echo ================================
echo.

REM Versuche Node.js zu finden
where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Node.js gefunden:
    node --version
    echo.
    where npm >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        echo [OK] npm gefunden:
        npm --version
    ) else (
        echo [FEHLER] npm nicht gefunden!
    )
) else (
    echo [FEHLER] Node.js ist nicht installiert oder nicht im PATH!
    echo.
    echo Bitte installiere Node.js von: https://nodejs.org/
    echo Lade die "LTS" Version herunter und installiere sie.
    echo.
    echo WICHTIG:
    echo 1. Starte den Computer nach der Installation NEU
    echo 2. Oder schliesse alle Command Prompt Fenster und öffne ein neues
)

echo.
pause

