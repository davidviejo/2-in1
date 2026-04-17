# Configuration
$ErrorActionPreference = "Stop"
# Get the script directory
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
# Assume script is in /scripts/ folder, so root is parent of parent
$REPO_ROOT = Split-Path -Parent $SCRIPT_DIR

$BACKEND_DIR = Join-Path $REPO_ROOT "backend\p2"
$FRONTEND_DIR = Join-Path $REPO_ROOT "frontend\m3"
$VENV_DIR = Join-Path $BACKEND_DIR "venv"

Write-Host "-----------------------------------"
Write-Host "Starting Local Development Environment"
Write-Host "-----------------------------------"

# 1. Backend Setup
Write-Host ">> Checking Backend..."
if (-not (Test-Path "$VENV_DIR")) {
    Write-Host "Creating python venv..."
    python -m venv "$VENV_DIR"
}

# Determine python executable path
if (Test-Path "$VENV_DIR\Scripts\python.exe") {
    $PYTHON = "$VENV_DIR\Scripts\python.exe"
    $PIP = "$VENV_DIR\Scripts\pip.exe"
} else {
    # Fallback for non-windows standard layout (e.g. msys/mingw)
    $PYTHON = "$VENV_DIR\bin\python.exe"
    $PIP = "$VENV_DIR\bin\pip.exe"
}

Write-Host "Installing backend requirements..."
& $PIP install -r "$BACKEND_DIR\requirements.txt"

# Ensure spacy model is downloaded
try {
    & $PYTHON -c "import spacy; spacy.load('es_core_news_sm')" | Out-Null
} catch {
    Write-Host "Downloading spacy model es_core_news_sm..."
    & $PYTHON -m spacy download es_core_news_sm
}

# 2. Frontend Setup
Write-Host ">> Checking Frontend..."
if (-not (Test-Path "$FRONTEND_DIR\node_modules")) {
    Write-Host "Installing frontend dependencies..."
    Push-Location "$FRONTEND_DIR"
    npm install
    Pop-Location
}

# 3. Start Servers
Write-Host "-----------------------------------"
Write-Host "Starting Servers..."
Write-Host "Backend: http://localhost:5000"
Write-Host "Frontend: http://localhost:5173"
Write-Host "-----------------------------------"

# Start Backend
$env:FLASK_DEBUG = "true"
$env:PORT = "5000"
$env:SETTINGS_ENCRYPTION_KEY = "test_settings_encryption_key"

# Start Backend Process
$BackendProcess = Start-Process -FilePath $PYTHON -ArgumentList "run.py" -WorkingDirectory $BACKEND_DIR -NoNewWindow -PassThru

# Start Frontend
Push-Location "$FRONTEND_DIR"
try {
    npm run dev
} finally {
    Write-Host "Stopping Backend..."
    Stop-Process -Id $BackendProcess.Id -Force -ErrorAction SilentlyContinue
    Pop-Location
}
