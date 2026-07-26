#!/usr/bin/env sh
set -eu

MODEL="${OLLAMA_MODEL:-qwen3.5:4b}"
NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmmirror.com}"
SENSEVOICE_MODEL_NAME="sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17"
SENSEVOICE_MODEL_URL="https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/$SENSEVOICE_MODEL_NAME.tar.bz2"
ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
SENSEVOICE_MODEL_DIR="$ROOT_DIR/models/sherpa-onnx"
SENSEVOICE_DOWNLOAD_DIR="$ROOT_DIR/models/downloads"
SENSEVOICE_ARCHIVE="$SENSEVOICE_DOWNLOAD_DIR/$SENSEVOICE_MODEL_NAME.tar.bz2"
SENSEVOICE_TEMP_DIR="$SENSEVOICE_DOWNLOAD_DIR/$SENSEVOICE_MODEL_NAME-extract"

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

install_sensevoice_model()
{
    if [ -f "$SENSEVOICE_MODEL_DIR/model.int8.onnx" ] && [ -f "$SENSEVOICE_MODEL_DIR/tokens.txt" ]; then
        echo "SenseVoice model already exists: $SENSEVOICE_MODEL_DIR"
        return 0
    fi

    mkdir -p "$SENSEVOICE_MODEL_DIR" "$SENSEVOICE_DOWNLOAD_DIR"

    if [ ! -f "$SENSEVOICE_ARCHIVE" ]; then
        echo "Downloading SenseVoice model..."

        if command -v curl >/dev/null 2>&1; then
            curl -L -o "$SENSEVOICE_ARCHIVE" "$SENSEVOICE_MODEL_URL"
        elif command -v wget >/dev/null 2>&1; then
            wget -O "$SENSEVOICE_ARCHIVE" "$SENSEVOICE_MODEL_URL"
        else
            echo "curl or wget is required to download the SenseVoice model." >&2
            exit 1
        fi
    fi

    rm -rf "$SENSEVOICE_TEMP_DIR"
    mkdir -p "$SENSEVOICE_TEMP_DIR"

    echo "Extracting SenseVoice model..."
    if tar -xjf "$SENSEVOICE_ARCHIVE" -C "$SENSEVOICE_TEMP_DIR" 2>/dev/null; then
        :
    elif command -v 7z >/dev/null 2>&1; then
        7z x "$SENSEVOICE_ARCHIVE" -o"$SENSEVOICE_DOWNLOAD_DIR" -y
        tar_file="$SENSEVOICE_DOWNLOAD_DIR/$SENSEVOICE_MODEL_NAME.tar"

        if [ ! -f "$tar_file" ]; then
            echo "Tar file not found after extraction: $tar_file" >&2
            exit 1
        fi

        7z x "$tar_file" -o"$SENSEVOICE_TEMP_DIR" -y
    else
        echo "Failed to extract $SENSEVOICE_ARCHIVE. Install bzip2/tar support or 7-Zip." >&2
        exit 1
    fi

    model_file=$(find "$SENSEVOICE_TEMP_DIR" -name model.int8.onnx -type f | head -n 1)
    tokens_file=$(find "$SENSEVOICE_TEMP_DIR" -name tokens.txt -type f | head -n 1)

    if [ "$model_file" = "" ]; then
        echo "model.int8.onnx not found in extracted SenseVoice files." >&2
        exit 1
    fi

    if [ "$tokens_file" = "" ]; then
        echo "tokens.txt not found in extracted SenseVoice files." >&2
        exit 1
    fi

    cp "$model_file" "$SENSEVOICE_MODEL_DIR/model.int8.onnx"
    cp "$tokens_file" "$SENSEVOICE_MODEL_DIR/tokens.txt"

    echo "SenseVoice model is ready: $SENSEVOICE_MODEL_DIR"
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

install_sensevoice_model

echo "Installing npm dependencies from $NPM_REGISTRY..."
npm --registry="$NPM_REGISTRY" install

echo "Building project..."
npm run build

echo "Build complete."
