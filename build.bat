@echo off
setlocal EnableExtensions

pushd "%~dp0" >nul 2>&1
if errorlevel 1 (
    echo ERROR: Failed to enter the repository directory.
    exit /b 1
)

echo ============================================
echo  Seerr - Production Build
echo ============================================
echo.

call :check_node
if errorlevel 1 goto :failure

call :resolve_pnpm
if errorlevel 1 goto :failure

where tar >nul 2>&1
if errorlevel 1 (
    echo ERROR: tar is not installed or not in PATH.
    goto :failure
)

echo [1/5] Installing dependencies...
call %PNPM_COMMAND% --config.engine-strict=false install --frozen-lockfile
if errorlevel 1 (
    echo ERROR: Failed to install dependencies.
    goto :failure
)

echo [2/5] Building Next.js...
call %PNPM_COMMAND% --config.engine-strict=false build:next
if errorlevel 1 (
    echo ERROR: Next.js build failed.
    goto :failure
)

echo [3/5] Building the server...
call %PNPM_COMMAND% --config.engine-strict=false build:server
if errorlevel 1 (
    echo ERROR: Server build failed.
    goto :failure
)

if not exist ".next\BUILD_ID" (
    echo ERROR: Next.js did not produce .next\BUILD_ID.
    goto :failure
)
if not exist "dist\index.js" (
    echo ERROR: Server build did not produce dist\index.js.
    goto :failure
)
if not exist "public" (
    echo ERROR: The public directory is missing.
    goto :failure
)

echo [4/5] Preparing production package...
set "BUILD_OUTPUT=%CD%\build-output"
set "STAGE=%BUILD_OUTPUT%\seerr"
set "ZIP_PATH=%CD%\seerr-build.zip"

if exist "%BUILD_OUTPUT%" rmdir /s /q "%BUILD_OUTPUT%"
if exist "%BUILD_OUTPUT%" (
    echo ERROR: Failed to clear %BUILD_OUTPUT%.
    goto :failure
)

mkdir "%STAGE%"
if errorlevel 1 (
    echo ERROR: Failed to create %STAGE%.
    goto :failure
)

rem Copy files required by the production server and installer
copy /y "package.json" "%STAGE%\" >nul
if errorlevel 1 goto :package_failure
copy /y "pnpm-lock.yaml" "%STAGE%\" >nul
if errorlevel 1 goto :package_failure
copy /y ".npmrc" "%STAGE%\" >nul
if errorlevel 1 goto :package_failure
copy /y "next.config.ts" "%STAGE%\" >nul
if errorlevel 1 goto :package_failure
copy /y "seerr-api.yml" "%STAGE%\" >nul
if errorlevel 1 goto :package_failure
copy /y "install.bat" "%STAGE%\" >nul
if errorlevel 1 goto :package_failure
copy /y "run.bat" "%STAGE%\" >nul
if errorlevel 1 goto :package_failure

xcopy ".next" "%STAGE%\.next\" /e /i /q /y >nul
if errorlevel 1 goto :package_failure
xcopy "dist" "%STAGE%\dist\" /e /i /q /y >nul
if errorlevel 1 goto :package_failure
xcopy "public" "%STAGE%\public\" /e /i /q /y >nul
if errorlevel 1 goto :package_failure

mkdir "%STAGE%\config"
if errorlevel 1 goto :package_failure

rem Exclude the build cache from the deployable archive
if exist "%STAGE%\.next\cache" rmdir /s /q "%STAGE%\.next\cache"
if exist "%STAGE%\.next\cache" (
    echo ERROR: Failed to remove the staged Next.js cache.
    goto :failure
)

echo [5/5] Creating archive...
if exist "%ZIP_PATH%" del /q "%ZIP_PATH%"
if exist "%ZIP_PATH%" (
    echo ERROR: Failed to replace %ZIP_PATH%.
    goto :failure
)

tar -a -cf "%ZIP_PATH%" -C "%BUILD_OUTPUT%" "seerr"
if errorlevel 1 (
    if exist "%ZIP_PATH%" del /q "%ZIP_PATH%"
    echo ERROR: Failed to create the archive.
    goto :failure
)
if not exist "%ZIP_PATH%" (
    echo ERROR: The archive command completed without creating %ZIP_PATH%.
    goto :failure
)

rmdir /s /q "%BUILD_OUTPUT%"

echo.
echo ============================================
echo  Build complete: %ZIP_PATH%
echo ============================================
echo.
echo To deploy:
echo   1. Extract seerr-build.zip on the target machine
echo   2. Run install.bat to install production dependencies
echo   3. Run run.bat to start the server
echo.
set "EXIT_CODE=0"
goto :finish

:package_failure
echo ERROR: Failed to copy files into %STAGE%.

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
