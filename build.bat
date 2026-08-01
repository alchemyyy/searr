@echo off
setlocal

echo ============================================
echo  Seerr - Production Build
echo ============================================
echo.

:: Check for required tools
where node >nul 2>&1 || (echo ERROR: Node.js not found & exit /b 1)
where pnpm >nul 2>&1 || (echo ERROR: pnpm not found & exit /b 1)
where tar >nul 2>&1 || (echo ERROR: tar not found & exit /b 1)

echo [1/4] Installing dependencies...
call pnpm install --frozen-lockfile
if errorlevel 1 (
    echo ERROR: Failed to install dependencies.
    exit /b 1
)

echo [2/4] Building Next.js and the server...
call pnpm build
if errorlevel 1 (
    echo ERROR: Build failed.
    exit /b 1
)

echo [3/4] Preparing production package...
set "STAGE=build-output\seerr"
if exist "build-output" rmdir /s /q "build-output"
mkdir "%STAGE%"

:: Copy runtime files
copy "package.json" "%STAGE%\"
copy "pnpm-lock.yaml" "%STAGE%\"
copy "next.config.ts" "%STAGE%\"
copy "seerr-api.yml" "%STAGE%\"
copy "install.bat" "%STAGE%\"
copy "run.bat" "%STAGE%\"

xcopy ".next" "%STAGE%\.next\" /e /i /q
xcopy "dist" "%STAGE%\dist\" /e /i /q
xcopy "public" "%STAGE%\public\" /e /i /q
mkdir "%STAGE%\config"

:: Remove the build cache from the deployable archive
if exist "%STAGE%\.next\cache" rmdir /s /q "%STAGE%\.next\cache"

echo [4/4] Creating zip...
set "ZIP_NAME=seerr-build.zip"
if exist "%ZIP_NAME%" del "%ZIP_NAME%"
tar -a -cf "%ZIP_NAME%" -C "build-output" "seerr"
if errorlevel 1 (
    echo ERROR: Failed to create the archive.
    exit /b 1
)

rmdir /s /q "build-output"

echo.
echo ============================================
echo  Build complete: %ZIP_NAME%
echo ============================================
echo.
echo To deploy:
echo   1. Extract %ZIP_NAME% on the target machine
echo   2. Run install.bat to install production dependencies
echo   3. Run run.bat to start the server
echo.
pause
