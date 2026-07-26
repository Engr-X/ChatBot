#!/usr/bin/env sh
set -eu

OLLAMA_LOG_FILE="${OLLAMA_LOG_FILE:-ollama.log}"

if ! command -v ollama >/dev/null 2>&1; then
    echo "ollama is not installed or not in PATH" >&2
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
    ollama serve >"$OLLAMA_LOG_FILE" 2>&1 &
    OLLAMA_PID=$!
    trap cleanup EXIT INT TERM

    retry=0
    until ollama list >/dev/null 2>&1; do
        retry=$((retry + 1))

        if [ "$retry" -ge 30 ]; then
            echo "Failed to start Ollama. See $OLLAMA_LOG_FILE" >&2
            exit 1
        fi

        sleep 1
    done
fi

npm run build
npm run start
