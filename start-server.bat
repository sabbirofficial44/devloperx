@echo off
cd /d "%~dp0"
echo.
echo ==========================================
echo   Veu Unlimited SaaS Server
echo   http://localhost:8090
echo ==========================================
echo.
node extension\dev-server.js
pause
