# Lunar Browser - Windows Build Script
# Run this in PowerShell on Windows to build the EXE

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Building Lunar Browser for Windows" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check prerequisites
Write-Host "[1/5] Checking prerequisites..." -ForegroundColor Yellow

if (-not (Get-Command rustc -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Rust is not installed." -ForegroundColor Red
    Write-Host "Install from: https://rustup.rs/" -ForegroundColor Red
    exit 1
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Node.js is not installed." -ForegroundColor Red
    Write-Host "Install from: https://nodejs.org/" -ForegroundColor Red
    exit 1
}

Write-Host "  Rust: $(rustc --version)" -ForegroundColor Green
Write-Host "  Node: $(node --version)" -ForegroundColor Green
Write-Host ""

# Install dependencies
Write-Host "[2/5] Installing npm dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) { Write-Host "npm install failed" -ForegroundColor Red; exit 1 }
Write-Host ""

# Build
Write-Host "[3/5] Building Lunar (this may take 5-10 minutes)..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "Build failed" -ForegroundColor Red; exit 1 }
Write-Host ""

# Verify outputs
Write-Host "[4/5] Verifying build artifacts..." -ForegroundColor Yellow

$artifacts = @(
    "src-tauri\target\release\Lunar.exe",
    "src-tauri\target\release\bundle\nsis\Lunar_1.0.0_x64-setup.exe",
    "src-tauri\target\release\bundle\msi\Lunar_1.0.0_x64_en-US.msi"
)

foreach ($path in $artifacts) {
    if (Test-Path $path) {
        $size = (Get-Item $path).Length / 1MB
        Write-Host "  OK: $path ($([math]::Round($size, 2)) MB)" -ForegroundColor Green
    } else {
        Write-Host "  MISSING: $path" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "[5/5] Done!" -ForegroundColor Green
Write-Host ""
Write-Host "Lunar EXE location:" -ForegroundColor Cyan
Write-Host "  src-tauri\target\release\Lunar.exe" -ForegroundColor White
Write-Host ""
Write-Host "Installers:" -ForegroundColor Cyan
Write-Host "  src-tauri\target\release\bundle\nsis\Lunar_1.0.0_x64-setup.exe" -ForegroundColor White
Write-Host "  src-tauri\target\release\bundle\msi\Lunar_1.0.0_x64_en-US.msi" -ForegroundColor White
Write-Host ""
