#!/usr/bin/env pwsh
# =============================================================================
#  setup.ps1  -  First-time project setup (run once)
#
#  What it does:
#    1. Checks Node.js and Python are installed
#    2. Installs all JS dependencies (npm workspaces - FE + BE together)
#    3. Creates Python venv if missing and installs pip packages
#    4. Generates Prisma client
#    5. Creates .env files from .env.example if they don't exist
#    6. Runs Prisma migrations (frontend/BE  ->  vasl_ts database)
#
#  ⚠  DATABASE REQUIREMENT (read before running):
#     This project needs TWO PostgreSQL databases created manually:
#       • vasl_ts  — used by the Node/Express API  (frontend/BE)
#       • vasl     — used by the Python FastAPI     (backend)
#     See the DATABASE SETUP section below for exact SQL commands.
#
#  Usage:
#    .\setup.ps1
# =============================================================================

$root = $PSScriptRoot
$ErrorActionPreference = "Stop"

function Write-Step($n, $total, $msg, $color = "Cyan") {
    Write-Host ""
    Write-Host "[$n/$total] $msg" -ForegroundColor $color
    Write-Host "---------------------------------------------------" -ForegroundColor DarkGray
}

function Write-OK($msg)   { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  [!!] $msg" -ForegroundColor Yellow }
function Write-Fail($msg) { Write-Host "  [XX] $msg" -ForegroundColor Red }

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   VASL - Project Setup" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# ── DATABASE ALERT ────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=============================================" -ForegroundColor Yellow
Write-Host "  ⚠  DATABASE SETUP REQUIRED (first time)" -ForegroundColor Yellow
Write-Host "=============================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "  This project needs TWO PostgreSQL databases." -ForegroundColor White
Write-Host "  If you haven't created them yet, run these" -ForegroundColor White
Write-Host "  commands in psql (or pgAdmin) before continuing:" -ForegroundColor White
Write-Host ""
Write-Host "    CREATE DATABASE vasl_ts;   -- Node/Express API  (frontend/BE)" -ForegroundColor Cyan
Write-Host "    CREATE DATABASE vasl;      -- Python FastAPI    (backend)" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Connection defaults (edit your .env files to match):" -ForegroundColor White
Write-Host "    Host: localhost   Port: 5432   User: postgres" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Prisma migrations for vasl_ts will run automatically" -ForegroundColor White
Write-Host "  in Step 5 below.  The vasl database is managed by" -ForegroundColor White
Write-Host "  Flyway — see backend/vasl-db/migrations/ for SQL files." -ForegroundColor White
Write-Host ""
Write-Host "=============================================" -ForegroundColor Yellow
Write-Host ""

$confirm = Read-Host "  Have you created both databases? (y/n)"
if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Warn "Please create the databases first, then re-run .\setup.ps1"
    Write-Host ""
    exit 0
}
Write-Host ""

# Step 1: Check prerequisites
Write-Step 1 6 "Checking prerequisites..."

try {
    $nodeVer = node --version 2>&1
    Write-OK "Node.js $nodeVer"
} catch {
    Write-Fail "Node.js not found. Install from https://nodejs.org"
    exit 1
}

try {
    $npmVer = npm --version 2>&1
    Write-OK "npm v$npmVer"
} catch {
    Write-Fail "npm not found."
    exit 1
}

try {
    $pyVer = python --version 2>&1
    Write-OK "Python $pyVer"
} catch {
    Write-Fail "Python not found. Install from https://python.org"
    exit 1
}

try {
    $uvVer = uv --version 2>&1
    Write-OK "uv $uvVer"
} catch {
    Write-Fail "uv not found. Install with: powershell -ExecutionPolicy ByPass -c `"irm https://astral.sh/uv/install.ps1 | iex`""
    exit 1
}

# Step 2: JS dependencies (npm workspaces)
Write-Step 2 6 "Installing JS dependencies (FE + BE)..." "Green"

Push-Location $root
try {
    npm install
    Write-OK "npm install complete - packages hoisted to root node_modules/"
} catch {
    Write-Fail "npm install failed. Check errors above."
    exit 1
} finally {
    Pop-Location
}

# Step 3: Python venv + pip install
Write-Step 3 6 "Setting up Python environment (uv)..." "Blue"

$venvPath = "$root\backend\.venv"

if (Test-Path "$venvPath\Scripts\Activate.ps1") {
    Write-OK ".venv already exists"
} else {
    Write-Warn ".venv not found - creating with: uv venv --python 3.12"
    Push-Location "$root\backend"
    uv venv --python 3.12
    Pop-Location
    Write-OK ".venv created"
}

Write-Host "  Installing pip packages with uv..." -ForegroundColor Blue
Push-Location "$root\backend"
try {
    uv pip install -r requirements.txt
    Write-OK "uv pip install complete"
} catch {
    Write-Fail "uv pip install failed. Check errors above."
    exit 1
} finally {
    Pop-Location
}

# Step 4: Prisma generate
Write-Step 4 6 "Generating Prisma client..." "Magenta"

Push-Location "$root\frontend\BE"
try {
    npx prisma generate
    Write-OK "Prisma client generated"
} catch {
    Write-Warn "Prisma generate had issues - check schema.prisma"
} finally {
    Pop-Location
}

# Step 5: .env files
Write-Step 5 6 "Checking .env files..." "Yellow"

$envFiles = @(
    @{ example = "$root\frontend\FE\.env.example"; target = "$root\frontend\FE\.env.local" },
    @{ example = "$root\frontend\BE\.env.example"; target = "$root\frontend\BE\.env" },
    @{ example = "$root\backend\.env.example";     target = "$root\backend\.env" }
)

foreach ($e in $envFiles) {
    $rel = $e.target.Replace($root, "").TrimStart("\")
    if (Test-Path $e.target) {
        Write-OK "$rel already exists"
    } elseif (Test-Path $e.example) {
        Copy-Item $e.example $e.target
        Write-Warn "$rel created from .env.example - fill in your values!"
    } else {
        Write-Warn "No .env.example found for $rel - create it manually"
    }
}

# Step 6: Prisma migrations (frontend/BE -> vasl_ts)
Write-Step 6 6 "Running Prisma migrations (frontend/BE -> vasl_ts)..." "Cyan"

Push-Location "$root\frontend\BE"
try {
    # Use 'migrate deploy' for CI-safe, non-interactive migration application.
    # It applies any pending migrations without prompting or creating new ones.
    npx prisma migrate deploy
    Write-OK "Prisma migrations applied to vasl_ts"
} catch {
    Write-Warn "Prisma migrate deploy failed."
    Write-Warn "Make sure DATABASE_URL in frontend\BE\.env points to a running"
    Write-Warn "PostgreSQL instance with the vasl_ts database already created."
    Write-Warn "Then re-run:  npx prisma migrate deploy  inside frontend\BE\"
} finally {
    Pop-Location
}

# Done
Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "   Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "   Next steps:" -ForegroundColor White
Write-Host "   1. Fill in .env files with your credentials" -ForegroundColor White
Write-Host "      frontend\FE\.env.local  — Next.js" -ForegroundColor DarkGray
Write-Host "      frontend\BE\.env        — Node/Express + Prisma (vasl_ts)" -ForegroundColor DarkGray
Write-Host "      backend\.env            — Python FastAPI (vasl)" -ForegroundColor DarkGray
Write-Host "   2. For the Python 'vasl' DB: apply Flyway migrations in" -ForegroundColor White
Write-Host "      backend\vasl-db\migrations\ manually (or via docker-compose)" -ForegroundColor DarkGray
Write-Host "   3. Run:  .\dev.ps1  to start all services" -ForegroundColor White
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
