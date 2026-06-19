#!/usr/bin/env pwsh
# =============================================================================
#  dev.ps1  -  Start all services (run every time)
#
#  Services launched (each in its own terminal window):
#    1. FE        - Next.js dev server     http://localhost:3000
#    2. FE Worker - BullMQ worker
#    3. BE        - Node/Express API       http://localhost:5000
#    4. Python    - FastAPI (uvicorn)      http://localhost:8001
#
#  Usage:
#    .\dev.ps1
#
#  First time? Run setup first:
#    .\setup.ps1
# =============================================================================

$root = $PSScriptRoot

# Auto-detect Python and uv paths using py.exe if they are not in PATH
if (-not (Get-Command python -ErrorAction SilentlyContinue) -or -not (Get-Command uv -ErrorAction SilentlyContinue)) {
    try {
        $pyPath = & py -c "import sys, os; print(os.path.dirname(sys.executable))" 2>$null
        if ($pyPath) {
            $pyPath = $pyPath.Trim()
            $scriptsPath = Join-Path $pyPath "Scripts"
            if (Test-Path $pyPath) {
                $env:PATH = "$pyPath;$scriptsPath;" + $env:PATH
            }
        }
    } catch {}
}

function Write-OK($msg)   { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  [!!] $msg" -ForegroundColor Yellow }
function Write-Fail($msg) { Write-Host "  [XX] $msg" -ForegroundColor Red }

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   VASL - Starting Dev Environment" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Guard: node_modules
if (-not (Test-Path "$root\node_modules")) {
    Write-Warn "node_modules missing - running npm install first..."
    Push-Location $root
    npm install --force --ignore-scripts
    Pop-Location
    Write-OK "npm install done"
    Write-Host ""
}

# Guard: Python venv
if (-not (Test-Path "$root\backend\.venv\Scripts\Activate.ps1") -and -not (Test-Path "$root\backend\venv\Scripts\Activate.ps1")) {
    Write-Warn "Python venv missing - run .\setup.ps1 first for full setup"
    Write-Host ""
}

# 1. Next.js FE
Write-Host "  [1/4] FE        - Next.js        (http://localhost:3000)" -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
    `$host.UI.RawUI.WindowTitle = 'VASL | FE - Next.js'
    Write-Host '================================================' -ForegroundColor Green
    Write-Host '  FE - Next.js Dev Server  :3000' -ForegroundColor Green
    Write-Host '================================================' -ForegroundColor Green
    cd '$root\frontend\FE'
    npm run dev
"@

# 2. BullMQ Worker
Write-Host "  [2/4] FE Worker - BullMQ" -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
    `$host.UI.RawUI.WindowTitle = 'VASL | FE Worker - BullMQ'
    Write-Host '================================================' -ForegroundColor Yellow
    Write-Host '  FE Worker - BullMQ' -ForegroundColor Yellow
    Write-Host '================================================' -ForegroundColor Yellow
    cd '$root\frontend\FE'
    npm run worker
"@

# 3. Node/Express BE
Write-Host "  [3/4] BE        - Node/Express   (http://localhost:5000)" -ForegroundColor Magenta
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
    `$host.UI.RawUI.WindowTitle = 'VASL | BE - Node/Express'
    Write-Host '================================================' -ForegroundColor Magenta
    Write-Host '  BE - Node/Express API  :5000' -ForegroundColor Magenta
    Write-Host '================================================' -ForegroundColor Magenta
    cd '$root\frontend\BE'
    npm run dev
"@

# 4. Python FastAPI
Write-Host "  [4/4] Python    - FastAPI        (http://localhost:8000)" -ForegroundColor Blue
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
    `$host.UI.RawUI.WindowTitle = 'VASL | Python - FastAPI'
    Write-Host '================================================' -ForegroundColor Blue
    Write-Host '  Python - FastAPI  :8001  /docs' -ForegroundColor Blue
    Write-Host '================================================' -ForegroundColor Blue
    cd '$root\backend'
    if (Test-Path '.venv\Scripts\Activate.ps1') {
        & '.venv\Scripts\Activate.ps1'
        Write-Host '  [OK] .venv activated' -ForegroundColor DarkCyan
    } elseif (Test-Path 'venv\Scripts\Activate.ps1') {
        & 'venv\Scripts\Activate.ps1'
        Write-Host '  [OK] venv activated' -ForegroundColor DarkCyan
    } else {
        Write-Host '  [!!] No venv found - using system Python' -ForegroundColor Yellow
    }
    uvicorn main:app --host 0.0.0.0 --reload --loop asyncio --port 8001
"@

# Summary
Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   All 4 services launched!" -ForegroundColor Cyan
Write-Host ""
Write-Host "   FE        ->  http://localhost:3000" -ForegroundColor Green
Write-Host "   BE        ->  http://localhost:5000" -ForegroundColor Magenta
Write-Host "   Python    ->  http://localhost:8001" -ForegroundColor Blue
Write-Host "   API Docs  ->  http://localhost:8001/docs" -ForegroundColor Blue
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
