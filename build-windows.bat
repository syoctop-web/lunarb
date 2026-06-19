@echo off
REM Lunar Browser - Windows Build Script (CMD version)
echo ========================================
echo   Building Lunar Browser for Windows
echo ========================================
echo.

where rustc >nul 2>&1
if errorlevel 1 (
    echo ERROR: Rust is not installed.
    echo Install from: https://rustup.rs/
    exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed.
    echo Install from: https://nodejs.org/
    exit /b 1
)

echo Installing npm dependencies...
call npm install
if errorlevel 1 goto :error

echo.
echo Building Lunar (this may take 5-10 minutes)...
call npm run build
if errorlevel 1 goto :error

echo.
echo Build successful!
echo EXE: src-tauri\target\release\Lunar.exe
echo Installer: src-tauri\target\release\bundle\nsis\Lunar_1.0.0_x64-setup.exe
exit /b 0

:error
echo Build failed.
exit /b 1
