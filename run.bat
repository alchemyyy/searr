@echo off
setlocal

set "NODE_ENV=production"

echo ============================================
echo  Seerr - Starting
echo ============================================
echo.

if not exist "node_modules" (
    echo ERROR: Dependencies are not installed. Run install.bat first.
    pause
    exit /b 1
)

echo Server will be available at http://localhost:5055
echo Press Ctrl+C to stop.
echo.

node dist/index.js
