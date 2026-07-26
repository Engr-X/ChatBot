@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "MODEL=%OLLAMA_MODEL%"
if "%MODEL%"=="" set "MODEL=qwen3.5:4b"

set "NPM_REGISTRY=%NPM_REGISTRY%"
if "%NPM_REGISTRY%"=="" set "NPM_REGISTRY=https://registry.npmmirror.com"

set "SENSEVOICE_MODEL_NAME=sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17"
set "SENSEVOICE_MODEL_URL=https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/%SENSEVOICE_MODEL_NAME%.tar.bz2"
set "SENSEVOICE_MODEL_DIR=%CD%\models\sherpa-onnx"
set "SENSEVOICE_DOWNLOAD_DIR=%CD%\models\downloads"
set "SENSEVOICE_ARCHIVE=%SENSEVOICE_DOWNLOAD_DIR%\%SENSEVOICE_MODEL_NAME%.tar.bz2"
set "SENSEVOICE_TAR=%SENSEVOICE_DOWNLOAD_DIR%\%SENSEVOICE_MODEL_NAME%.tar"
set "SENSEVOICE_TEMP_DIR=%SENSEVOICE_DOWNLOAD_DIR%\%SENSEVOICE_MODEL_NAME%-extract"

where npm >nul 2>nul
if errorlevel 1 (
    echo npm is not installed or not in PATH.
    exit /b 1
)

where ollama >nul 2>nul
if errorlevel 1 (
    echo Installing Ollama...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://ollama.com/install.ps1 | iex"
    if errorlevel 1 exit /b 1
)

where ollama >nul 2>nul
if errorlevel 1 (
    echo Ollama is not installed or not in PATH after installation.
    echo Please open a new terminal and run build.bat again.
    exit /b 1
)

ollama list >nul 2>nul
if errorlevel 1 (
    echo Starting Ollama...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -WindowStyle Hidden -FilePath ollama -ArgumentList 'serve'"
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$retry = 0; while ($retry -lt 30) { ollama list *> $null; if ($LASTEXITCODE -eq 0) { exit 0 }; Start-Sleep -Seconds 1; $retry++ }; exit 1"
    if errorlevel 1 (
        echo Failed to start Ollama.
        exit /b 1
    )
)

echo Pulling Ollama model %MODEL%...
ollama pull "%MODEL%"
if errorlevel 1 exit /b 1

set "SENSEVOICE_READY=0"
if exist "%SENSEVOICE_MODEL_DIR%\model.int8.onnx" if exist "%SENSEVOICE_MODEL_DIR%\tokens.txt" set "SENSEVOICE_READY=1"

if "%SENSEVOICE_READY%"=="1" (
    echo SenseVoice model already exists: %SENSEVOICE_MODEL_DIR%
) else (
    if not exist "%SENSEVOICE_DOWNLOAD_DIR%" mkdir "%SENSEVOICE_DOWNLOAD_DIR%"
    if not exist "%SENSEVOICE_MODEL_DIR%" mkdir "%SENSEVOICE_MODEL_DIR%"

    if not exist "%SENSEVOICE_ARCHIVE%" (
        where curl.exe >nul 2>nul
        if errorlevel 1 (
            echo curl.exe is not available.
            exit /b 1
        )

        echo Downloading SenseVoice model...
        curl.exe -L -o "%SENSEVOICE_ARCHIVE%" "%SENSEVOICE_MODEL_URL%"
        if errorlevel 1 exit /b 1
    )

    set "SEVEN_ZIP="
    where 7z.exe >nul 2>nul
    if not errorlevel 1 set "SEVEN_ZIP=7z.exe"

    if "!SEVEN_ZIP!"=="" if exist "C:\Program Files\7-Zip\7z.exe" set "SEVEN_ZIP=C:\Program Files\7-Zip\7z.exe"
    if "!SEVEN_ZIP!"=="" if exist "C:\Program Files (x86)\7-Zip\7z.exe" set "SEVEN_ZIP=C:\Program Files (x86)\7-Zip\7z.exe"

    if "!SEVEN_ZIP!"=="" (
        echo 7-Zip is required to extract the SenseVoice .tar.bz2 model on Windows.
        echo Please install 7-Zip from https://www.7-zip.org/ and run build.bat again.
        exit /b 1
    )

    if exist "%SENSEVOICE_TEMP_DIR%" rmdir /s /q "%SENSEVOICE_TEMP_DIR%"
    mkdir "%SENSEVOICE_TEMP_DIR%"

    echo Extracting SenseVoice bzip2 archive...
    "!SEVEN_ZIP!" x "%SENSEVOICE_ARCHIVE%" -o"%SENSEVOICE_DOWNLOAD_DIR%" -y
    if errorlevel 1 exit /b 1

    if not exist "%SENSEVOICE_TAR%" (
        echo Tar file not found after extraction: %SENSEVOICE_TAR%
        exit /b 1
    )

    echo Extracting SenseVoice tar archive...
    "!SEVEN_ZIP!" x "%SENSEVOICE_TAR%" -o"%SENSEVOICE_TEMP_DIR%" -y
    if errorlevel 1 exit /b 1

    set "FOUND_MODEL="
    set "FOUND_TOKENS="

    for /r "%SENSEVOICE_TEMP_DIR%" %%F in (model.int8.onnx) do if not defined FOUND_MODEL set "FOUND_MODEL=%%~fF"
    for /r "%SENSEVOICE_TEMP_DIR%" %%F in (tokens.txt) do if not defined FOUND_TOKENS set "FOUND_TOKENS=%%~fF"

    if "!FOUND_MODEL!"=="" (
        echo model.int8.onnx not found in extracted SenseVoice files.
        exit /b 1
    )

    if "!FOUND_TOKENS!"=="" (
        echo tokens.txt not found in extracted SenseVoice files.
        exit /b 1
    )

    copy /y "!FOUND_MODEL!" "%SENSEVOICE_MODEL_DIR%\model.int8.onnx" >nul
    if errorlevel 1 exit /b 1

    copy /y "!FOUND_TOKENS!" "%SENSEVOICE_MODEL_DIR%\tokens.txt" >nul
    if errorlevel 1 exit /b 1

    echo SenseVoice model is ready: %SENSEVOICE_MODEL_DIR%
)

echo Installing npm dependencies from %NPM_REGISTRY%...
call npm --registry=%NPM_REGISTRY% install
if errorlevel 1 exit /b 1

echo Building project...
call npm run build
if errorlevel 1 exit /b 1

echo Build complete.
exit /b 0
