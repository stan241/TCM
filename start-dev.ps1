# TCM Development Startup Script
# Starts API (port 4000) and Portal (port 3000) simultaneously in separate windows.
#
# Usage: .\start-dev.ps1
# Prerequisites:
#   1. PostgreSQL running on port 5432 (net start postgresql-x64-16)
#   2. npm install run from D:\TCM

param(
  [switch]$NoInstall
)

$Root = $PSScriptRoot

Write-Host ""
Write-Host "=== TokenCap Miner — Dev Environment ===" -ForegroundColor Cyan
Write-Host ""

# ── Check Node ────────────────────────────────────────────────────────────────
$nodeVer = & node --version 2>&1
Write-Host "  Node.js: $nodeVer" -ForegroundColor Green

# ── Optional: npm install ─────────────────────────────────────────────────────
if (-not $NoInstall) {
  Write-Host ""
  Write-Host "  Running npm install..." -ForegroundColor Yellow
  Push-Location $Root
  & npm install --silent
  Pop-Location
  Write-Host "  Dependencies ready." -ForegroundColor Green
}

# ── Check PostgreSQL ──────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  Checking PostgreSQL..." -ForegroundColor Yellow
$pgRunning = $false
try {
  $result = & "$Root\node_modules\.bin\pg_isready.cmd" -h localhost -p 5432 2>&1
  $pgRunning = ($LASTEXITCODE -eq 0)
} catch {}

if (-not $pgRunning) {
  Write-Host "  PostgreSQL not ready — attempting to start service..." -ForegroundColor Yellow
  Start-Process -FilePath "net" -ArgumentList "start","postgresql-x64-16" -Verb RunAs -Wait -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 3
}

Write-Host "  PostgreSQL: OK" -ForegroundColor Green

# ── Load .env ─────────────────────────────────────────────────────────────────
$envFile = "$Root\.env"
if (Test-Path $envFile) {
  Get-Content $envFile | Where-Object { $_ -match '^\s*[A-Z_]+=.+' } | ForEach-Object {
    $parts = $_ -split '=', 2
    $name  = $parts[0].Trim()
    $value = $parts[1].Trim().Trim('"')
    [System.Environment]::SetEnvironmentVariable($name, $value, 'Process')
  }
  Write-Host "  .env loaded" -ForegroundColor Green
}

# ── Run migration 015 if needed ───────────────────────────────────────────────
$psqlBin = "psql"
$migFile = "$Root\packages\db\migrations\015_sync_pipeline_cursors.sql"
if (Test-Path $migFile) {
  Write-Host "  Applying migration 015..." -ForegroundColor Yellow
  $env:PGPASSWORD = "test123"
  & $psqlBin -U postgres -h localhost -p 5432 -f $migFile -q 2>&1 | Out-Null
  Write-Host "  Migration 015: done" -ForegroundColor Green
}

# ── Start API ─────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  Starting API on port 4000..." -ForegroundColor Cyan
$apiCmd = "Set-Location '$Root'; `$env:NODE_ENV='development'; node node_modules\.bin\tsx packages\api\src\index.ts"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $apiCmd -WindowStyle Normal

Start-Sleep -Seconds 2

# ── Start Portal ──────────────────────────────────────────────────────────────
Write-Host "  Starting Portal on port 3000..." -ForegroundColor Cyan
$portalCmd = "Set-Location '$Root\apps\portal'; `$env:NODE_ENV='development'; node ..\..\node_modules\.bin\next dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $portalCmd -WindowStyle Normal

Start-Sleep -Seconds 1

Write-Host "  Starting Admin portal on port 3001..." -ForegroundColor Cyan
$adminCmd = "Set-Location '$Root\apps\admin'; `$env:NODE_ENV='development'; node ..\..\node_modules\.bin\next dev -p 3001"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $adminCmd -WindowStyle Normal

Write-Host ""
Write-Host "=== Dev servers starting ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Portal → http://localhost:3000"       -ForegroundColor White
Write-Host "   Admin  → http://localhost:3001"       -ForegroundColor White
Write-Host "   API    → http://localhost:4000"       -ForegroundColor White
Write-Host "   Health → http://localhost:4000/health" -ForegroundColor White
Write-Host ""
Write-Host "  Press Ctrl+C in each window to stop." -ForegroundColor DarkGray
Write-Host ""
