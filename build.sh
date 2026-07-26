#!/usr/bin/env sh
set -eu

MODEL="${OLLAMA_MODEL:-qwen3.5:4b}"
NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmmirror.com}"

if ! command -v npm >/dev/null 2>&1; then
    echo "npm is not installed or not in PATH." >&2
    exit 1
fi

if ! command -v ollama >/dev/null 2>&1; then
    echo "Installing Ollama..."

    if ! command -v curl >/dev/null 2>&1; then
        echo "curl is required to install Ollama." >&2
        exit 1
    fi

    curl -fsSL https://ollama.com/install.sh | sh
fi

if ! command -v ollama >/dev/null 2>&1; then
    echo "Ollama is not installed or not in PATH after installation." >&2
    echo "Please open a new terminal and run ./build.sh again." >&2
    exit 1
fi

cleanup()
{
    if [ "${OLLAMA_PID:-}" != "" ]; then
        kill "$OLLAMA_PID" >/dev/null 2>&1 || true
    fi
}

if ! ollama list >/dev/null 2>&1; then
    echo "Starting Ollama..."
    ollama serve >/dev/null 2>&1 &
    OLLAMA_PID=$!
    trap cleanup EXIT INT TERM

    retry=0
    until ollama list >/dev/null 2>&1; do
        retry=$((retry + 1))

        if [ "$retry" -ge 30 ]; then
            echo "Failed to start Ollama." >&2
            exit 1
        fi

        sleep 1
    done
fi

echo "Pulling Ollama model $MODEL..."
ollama pull "$MODEL"

echo "Installing npm dependencies from $NPM_REGISTRY..."
npm --registry="$NPM_REGISTRY" install

echo "Building project..."
npm run build

echo "Starting project..."
npm run start
