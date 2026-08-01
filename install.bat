@echo off
setlocal

echo ============================================
echo  Seerr - Production Install
echo ============================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH.
    echo Install Node.js 22.19 or newer from https://nodejs.org
    pause
    exit /b 1
)

for /f "tokens=1,2 delims=." %%a in ('node -p "process.versions.node"') do (
    set "NODE_MAJOR=%%a"
    set "NODE_MINOR=%%b"
)
if %NODE_MAJOR% lss 22 goto :unsupported_node
if %NODE_MAJOR% equ 22 if %NODE_MINOR% lss 19 goto :unsupported_node

where pnpm >nul 2>&1
if errorlevel 1 (
    echo pnpm not found, enabling it through Corepack...
    call corepack enable
    if errorlevel 1 (
        echo ERROR: Failed to enable Corepack. Try running as administrator.
        pause
        exit /b 1
    )
)

echo Installing production dependencies...
call pnpm install --prod --frozen-lockfile --ignore-scripts
if errorlevel 1 (
    echo ERROR: Failed to install dependencies.
    pause
    exit /b 1
)

echo Rebuilding native modules...
call pnpm rebuild sqlite3
if errorlevel 1 (
    echo ERROR: Failed to rebuild sqlite3.
    pause
    exit /b 1
)

echo.
echo ============================================
echo  Install complete. Run run.bat to start.
echo ============================================
pause
exit /b 0

:unsupported_node
echo ERROR: Node.js 22.19 or newer is required. Found:
node -v
pause
exit /b 1
