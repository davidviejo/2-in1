@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "PS_SCRIPT=%SCRIPT_DIR%launcher_gui.ps1"

if not exist "%PS_SCRIPT%" (
    echo [ERROR] No se encontro el script de launcher: "%PS_SCRIPT%"
    pause
    exit /b 1
)

where powershell >nul 2>&1
if errorlevel 1 (
    echo [ERROR] PowerShell no esta disponible en este equipo.
    pause
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%"
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
    echo.
    echo [ERROR] launcher_gui.ps1 finalizo con codigo %EXIT_CODE%.
    echo Revisa los mensajes mostrados arriba para identificar el problema.
    pause
)

endlocal & exit /b %EXIT_CODE%
