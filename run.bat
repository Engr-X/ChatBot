@echo off
setlocal EnableExtensions

where ollama.exe >nul 2>nul
if errorlevel 1 (
    echo ollama is not installed or not in PATH.
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

call npm run build
if errorlevel 1 exit /b 1

call npm run start
exit /b %ERRORLEVEL%
