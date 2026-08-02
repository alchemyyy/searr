@echo off
setlocal EnableExtensions

pushd "%~dp0" >nul 2>&1
if errorlevel 1 (
    echo ERROR: Failed to enter the Seerr directory.
    exit /b 1
)

set "NODE_ENV=production"

echo ============================================
echo  Seerr - Starting
echo ============================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH.
    goto :failure
)

set "NODE_MAJOR="
set "NODE_MINOR="
for /f "tokens=1,2 delims=." %%a in ('node -p "process.versions.node" 2^>nul') do (
    set "NODE_MAJOR=%%a"
    set "NODE_MINOR=%%b"
)
if not defined NODE_MAJOR (
    echo ERROR: Failed to determine the Node.js version.
    goto :failure
)
if %NODE_MAJOR% LSS 22 (
    echo ERROR: Node.js 22.19 or newer is required. Found:
    node -v
    goto :failure
)
if %NODE_MAJOR% EQU 22 if %NODE_MINOR% LSS 19 (
    echo ERROR: Node.js 22.19 or newer is required. Found:
    node -v
    goto :failure
)

if not exist "node_modules\next\package.json" (
    echo ERROR: Production dependencies are missing. Run install.bat first.
    goto :failure
)
if not exist ".next\BUILD_ID" (
    echo ERROR: The Next.js production build is missing.
    goto :failure
)
if not exist "dist\index.js" (
    echo ERROR: The compiled server is missing.
    goto :failure
)
if not exist "seerr-api.yml" (
    echo ERROR: The API specification is missing.
    goto :failure
)

if not exist "config" mkdir "config"
if not exist "config" (
    echo ERROR: Failed to create the config directory.
    goto :failure
)

set "DISPLAY_HOST=localhost"
if defined HOST set "DISPLAY_HOST=%HOST%"
set "DISPLAY_PORT=%PORT%"
if not defined DISPLAY_PORT set "DISPLAY_PORT=5055"

echo Server will be available at http://%DISPLAY_HOST%:%DISPLAY_PORT%
echo Press Ctrl+C to stop.
echo.

node "dist\index.js"
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" echo Server exited with code %EXIT_CODE%.
popd
if not "%EXIT_CODE%"=="0" if not defined CI if not defined SEERR_NO_PAUSE pause
exit /b %EXIT_CODE%

:failure
popd
if not defined CI if not defined SEERR_NO_PAUSE pause
exit /b 1
