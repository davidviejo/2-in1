#!/bin/bash

# Configuration
# Detect root directory of the repo
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
BACKEND_DIR="$REPO_ROOT/backend/p2"
FRONTEND_DIR="$REPO_ROOT/frontend/m3"
VENV_DIR="$BACKEND_DIR/venv"

echo "-----------------------------------"
echo "Starting Local Development Environment"
echo "-----------------------------------"

# 1. Backend Setup
echo ">> Checking Backend..."
if [ ! -d "$VENV_DIR" ]; then
    echo "Creating python venv..."
    python3 -m venv "$VENV_DIR"
fi

# Activate venv
if [ -f "$VENV_DIR/bin/activate" ]; then
    source "$VENV_DIR/bin/activate"
else
    echo "Error: Virtual environment not found at $VENV_DIR"
    exit 1
fi

echo "Installing backend requirements..."
pip install -r "$BACKEND_DIR/requirements.txt"

# Ensure spacy model is downloaded
if ! python3 -c "import spacy; spacy.load('es_core_news_sm')" > /dev/null 2>&1; then
    echo "Downloading spacy model es_core_news_sm..."
    python3 -m spacy download es_core_news_sm
fi

# 2. Frontend Setup
echo ">> Checking Frontend..."
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo "Installing frontend dependencies..."
    (cd "$FRONTEND_DIR" && npm install)
fi

# 3. Start Servers
echo "-----------------------------------"
echo "Starting Servers..."
echo "Backend: http://localhost:5000"
echo "Frontend: http://localhost:5173"
echo "-----------------------------------"

# Trap Ctrl+C to kill both processes
trap 'kill 0' SIGINT

# Start Backend in background
export FLASK_DEBUG=true
export PORT=5000
export SECRET_KEY=test_secret
export JWT_SECRET=test_jwt_secret
export GOOGLE_DEFAULT_COOKIE=test_cookie
# Ensure we run from backend/p2 so relative paths work if any
(cd "$BACKEND_DIR" && python3 run.py) &

# Start Frontend
(cd "$FRONTEND_DIR" && npm run dev) &

# Wait for both
wait
