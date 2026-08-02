@echo off
setlocal EnableExtensions

pushd "%~dp0" >nul 2>&1
if errorlevel 1 (
    echo ERROR: Failed to enter the Seerr directory.
    exit /b 1
)

echo ============================================
echo  Seerr - Production Install
echo ============================================
echo.

if not exist "package.json" (
    echo ERROR: package.json is missing. Extract the complete build archive first.
    goto :failure
)
if not exist "pnpm-lock.yaml" (
    echo ERROR: pnpm-lock.yaml is missing. Extract the complete build archive first.
    goto :failure
)

call :check_node
if errorlevel 1 goto :failure

call :resolve_pnpm
if errorlevel 1 goto :failure

echo [1/3] Installing production dependencies...
rem Use a flat dependency layout so copied Next.js packages can resolve transitives
call %PNPM_COMMAND% --config.engine-strict=false --config.node-linker=hoisted install --prod --frozen-lockfile --ignore-scripts
if errorlevel 1 (
    echo ERROR: Failed to install production dependencies.
    goto :failure
)

echo [2/3] Rebuilding native runtime modules...
call %PNPM_COMMAND% --config.engine-strict=false --config.node-linker=hoisted rebuild bcrypt sharp sqlite3
if errorlevel 1 (
    echo ERROR: Failed to rebuild native runtime modules.
    goto :failure
)

echo [3/3] Verifying runtime modules...
node -e "require('next'); require('bcrypt'); require('sharp'); require('sqlite3')"
if errorlevel 1 (
    echo ERROR: One or more runtime modules failed to load.
    goto :failure
)

if not exist "config" mkdir "config"
if not exist "config" (
    echo ERROR: Failed to create the config directory.
    goto :failure
)

echo.
echo ============================================
echo  Install complete. Run run.bat to start.
echo ============================================
echo.
set "EXIT_CODE=0"
goto :finish

:failure
set "EXIT_CODE=1"

:finish
popd
if not defined CI if not defined SEERR_NO_PAUSE pause
exit /b %EXIT_CODE%

:check_node
where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH.
    echo Install Node.js 22.19 or newer from https://nodejs.org
    exit /b 1
)

set "NODE_MAJOR="
set "NODE_MINOR="
for /f "tokens=1,2 delims=." %%a in ('node -p "process.versions.node" 2^>nul') do (
    set "NODE_MAJOR=%%a"
    set "NODE_MINOR=%%b"
)
if not defined NODE_MAJOR (
    echo ERROR: Failed to determine the Node.js version.
    exit /b 1
)
if %NODE_MAJOR% LSS 22 (
    echo ERROR: Node.js 22.19 or newer is required. Found:
    node -v
    exit /b 1
)
if %NODE_MAJOR% EQU 22 if %NODE_MINOR% LSS 19 (
    echo ERROR: Node.js 22.19 or newer is required. Found:
    node -v
    exit /b 1
)
exit /b 0

:resolve_pnpm
where pnpm >nul 2>&1
if errorlevel 1 (
    where corepack >nul 2>&1
    if errorlevel 1 (
        echo ERROR: pnpm and Corepack are not installed or not in PATH.
        exit /b 1
    )
    set "PNPM_COMMAND=corepack pnpm"
) else (
    set "PNPM_COMMAND=pnpm"
)

set "PNPM_MAJOR="
for /f "tokens=1 delims=." %%v in ('call %PNPM_COMMAND% --version 2^>nul') do if not defined PNPM_MAJOR set "PNPM_MAJOR=%%v"
if not defined PNPM_MAJOR (
    echo ERROR: Failed to run pnpm.
    exit /b 1
)
if not "%PNPM_MAJOR%"=="10" (
    echo ERROR: pnpm 10 is required. Found:
    call %PNPM_COMMAND% --version
    exit /b 1
)
exit /b 0
