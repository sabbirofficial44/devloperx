@echo off
cd /d "%~dp0"
echo.
echo ╔═══════════════════════════════════════════╗
echo ║       DeveloperX — SaaS Starter          ║
echo ╚═══════════════════════════════════════════╝
echo.
echo Starting DeveloperX API Server...
start "DeveloperX Server" node extension\dev-server.js
echo.
echo ┌─────────────────────────────────────────┐
echo │  Admin Panel:  http://localhost:8090     │
echo │  Admin Key:     veu-admin-2026           │
echo │  Extension:     extension\ folder        │
echo └─────────────────────────────────────────┘
echo.
echo ▸ Chrome → chrome://extensions
echo ▸ Load unpacked → D:\Script\VeuUnlimited\extension
echo ▸ Popup → any email/password → Sign In (auto trial)
echo.
pause
