# WeChat Bot

A local WeChat private-chat auto-reply bot built with Wechaty, Ollama, and a small Agent/Client pipeline.

The project is designed around typed message data. Text, audio, images, videos, and files can all be represented as `Data`, while individual clients can transform or answer those messages. The current production path focuses on private WeChat text/audio replies.

## Features

- Listens to WeChat private chat messages through Wechaty.
- Skips group chats, official accounts, and non-individual conversations.
- Keeps an independent conversation and agent per contact.
- Batches messages by contact and replies on a fixed interval.
- Uses Ollama for local LLM replies.
- Uses `sherpa-onnx-node` with SenseVoice for local speech-to-text.
- Converts WeChat voice messages into `AudioData`, then into text before sending the conversation to Ollama.
- Splits long text replies into multiple WeChat messages by punctuation.
- Uses `brolog` with compact log formatting.
- Includes a console test mode that does not require WeChat login.

Current WeChat reply pipeline:

```text
Wechaty message event
-> Data
-> ConversationManager
-> ChatAgent
-> shared Conversation
-> AudioRecognitionClient
-> OllamaClient
-> WechatStream
-> WeChat reply
```

## Requirements

- Node.js 20+
- npm
- Ollama
- ffmpeg, required for converting WeChat audio to wav
- 7-Zip on Windows if you use `build.bat` to extract the SenseVoice `.tar.bz2` model

Default Ollama model:

```text
qwen3.5:4b
```

Default Ollama API endpoint:

```text
http://127.0.0.1:11434
```

## Preparation

You can either use the build scripts to prepare everything automatically, or configure the dependencies manually.

### Option 1: Automatic Setup

Run the build script for your platform:

```sh
./build.sh
```

or on Windows:

```bat
build.bat
```

This prepares Ollama, pulls the LLM model, downloads the speech recognition model, installs npm dependencies, and compiles the project.

### Option 2: Manual Setup

1. Install Node.js 20+ and make sure `node` and `npm` are in `PATH`.

```sh
node --version
npm --version
```

2. Install Ollama and start the local API server.

```sh
ollama serve
```

If you use the Ollama desktop app, opening the app usually starts the local API server.

3. Pull the chat model.

```sh
ollama pull qwen3.5:4b
```

4. Install ffmpeg and make sure it is in `PATH`.

```sh
ffmpeg -version
```

5. Download and extract the SenseVoice model.

The final model files must be placed here:

```text
models/sherpa-onnx/model.int8.onnx
models/sherpa-onnx/tokens.txt
```

6. Install npm dependencies.

```sh
npm install
```

or with the mirror used by the build scripts:

```sh
npm --registry=https://registry.npmmirror.com install
```

7. Build the project.

```sh
npm run build
```

### Configuration

The default configuration works without environment variables if you use:

```text
Ollama URL: http://127.0.0.1:11434
Ollama model: qwen3.5:4b
SenseVoice model directory: models/sherpa-onnx/
```

To override Ollama settings:

PowerShell:

```powershell
$env:OLLAMA_MODEL="qwen3.5:4b"
$env:OLLAMA_BASE_URL="http://127.0.0.1:11434"
```

sh:

```sh
export OLLAMA_MODEL="qwen3.5:4b"
export OLLAMA_BASE_URL="http://127.0.0.1:11434"
```

To use a different npm registry during build:

```sh
export NPM_REGISTRY="https://registry.npmmirror.com"
```

## Build Scripts

### Linux/macOS

```sh
chmod +x ./build.sh
./build.sh
```

`build.sh` does the following:

1. Checks that `npm` exists.
2. Installs Ollama with `https://ollama.com/install.sh` if `ollama` is missing.
3. Starts `ollama serve` temporarily if the Ollama API is not already running.
4. Pulls the Ollama model from `OLLAMA_MODEL`, or `qwen3.5:4b` by default.
5. Downloads the SenseVoice ONNX model archive if it is missing.
6. Extracts `model.int8.onnx` and `tokens.txt` into `models/sherpa-onnx/`.
7. Installs npm dependencies using `NPM_REGISTRY`, or `https://registry.npmmirror.com` by default.
8. Runs `npm run build`.

### Windows

```bat
build.bat
```

`build.bat` does the same setup as `build.sh`, but uses PowerShell to install/start Ollama and 7-Zip to extract the SenseVoice `.tar.bz2` archive.

The build scripts compile the project only. They do not start the WeChat bot.

## Manual Downloads

### Ollama

Download Ollama manually from:

```text
https://ollama.com/download
```

After installation, verify that it works:

```sh
ollama list
```

Pull the default model manually:

```sh
ollama pull qwen3.5:4b
```

You can use another model by setting `OLLAMA_MODEL`.

### SenseVoice Model

The speech recognition model used by this project is:

```text
sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17
```

Manual download URL:

```text
https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17.tar.bz2
```

Extract the archive and place these files here:

```text
models/sherpa-onnx/model.int8.onnx
models/sherpa-onnx/tokens.txt
```

On Windows, use 7-Zip if `tar` cannot extract `.tar.bz2` files.

### ffmpeg

Install ffmpeg manually from:

```text
https://ffmpeg.org/download.html
```

Make sure `ffmpeg` is available in `PATH`:

```sh
ffmpeg -version
```

## Install Dependencies

Normal npm install:

```sh
npm install
```

Use a temporary registry mirror:

```sh
npm --registry=https://registry.npmmirror.com install
```

## Run

Start Ollama first if it is not already running:

```sh
ollama serve
```

Run the WeChat bot in development mode:

```sh
npm run dev
```

Scan the QR code printed in the terminal to log in.

Build and run compiled JavaScript:

```sh
npm run build
npm run start
```

## Console Test Mode

Console mode uses the same Ollama client but does not start Wechaty:

```sh
npm run console
```

After building:

```sh
npm run build
npm run start:console
```

Console input is read line by line. The agent replies every 5 seconds.

## Audio Transcription Test

After the SenseVoice model is installed:

```sh
npm run transcribe -- models/sherpa-onnx/test_wavs/zh.wav
```

You can also pass your own wav file:

```sh
npm run transcribe -- path/to/audio.wav
```

## Environment Variables

```text
OLLAMA_MODEL      Ollama model name. Defaults to qwen3.5:4b.
OLLAMA_BASE_URL   Ollama API URL. Defaults to http://127.0.0.1:11434.
NPM_REGISTRY      npm registry used by build scripts. Defaults to https://registry.npmmirror.com.
```

## Project Layout

```text
src/
  agent/
    Agent.ts
    ChatAgent.ts
    SingleClientAgent.ts
  client/
    AudioRecognitionClient.ts
    Client.ts
    OllamaClient.ts
    OpenAIClient.ts
    TestClient.ts
  stream/
    IOStream.ts
    StandardStream.ts
    WechatStream.ts
  util/
    AudioTranscriber.ts
    Conversation.ts
    Misc.ts
  ConversationManager.ts
  console.ts
  main.ts
  transcribe.ts
```

## Notes

- WeChat text replies are split by punctuation before sending.
- WeChat images, videos, and files are represented in the data model, but the current WeChat output stream only sends text replies.
- Voice messages require ffmpeg conversion plus the SenseVoice model.
- If Ollama replies slowly, the local model is usually CPU/GPU bound. Use a smaller model, shorten the prompt, or lower output limits.
