@echo off
setlocal

set "MODEL=%OLLAMA_MODEL%"
if "%MODEL%"=="" set "MODEL=qwen3.5:4b"

set "NPM_REGISTRY=%NPM_REGISTRY%"
if "%NPM_REGISTRY%"=="" set "NPM_REGISTRY=https://registry.npmmirror.com"

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
    call :wait_ollama
    if errorlevel 1 exit /b 1
)

echo Pulling Ollama model %MODEL%...
ollama pull "%MODEL%"
if errorlevel 1 exit /b 1

echo Installing npm dependencies from %NPM_REGISTRY%...
call npm --registry=%NPM_REGISTRY% install
if errorlevel 1 exit /b 1

echo Building project...
call npm run build
if errorlevel 1 exit /b 1

echo Starting project...
call npm run start
exit /b %ERRORLEVEL%

:wait_ollama
set /a RETRY=0

:wait_ollama_loop
ollama list >nul 2>nul
if not errorlevel 1 exit /b 0

set /a RETRY=%RETRY% + 1
if %RETRY% GEQ 30 (
    echo Failed to start Ollama.
    exit /b 1
)

timeout /t 1 /nobreak >nul
goto wait_ollama_loop
