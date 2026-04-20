@echo off
setlocal

set SCRIPT_DIR=%~dp0
powershell -NoProfile -ExecutionPolicy Bypass -Command "Set-Location '%SCRIPT_DIR%'; & '.\launcher_gui.ps1'"

endlocal
