@echo off
setlocal

set "NODE_EXE=C:\Program Files\nodejs\node.exe"
set "APP_DIR=%~dp0"

if not exist "%NODE_EXE%" (
  echo Node.js was not found at %NODE_EXE%.
  echo Install Node.js or update NODE_EXE inside this file.
  pause
  exit /b 1
)

cd /d "%APP_DIR%"

echo Checking Care Nova AI deployment readiness...
"%NODE_EXE%" --check server.js || exit /b 1
"%NODE_EXE%" --check src\healthEngine.js || exit /b 1
"%NODE_EXE%" --check src\memoryStore.js || exit /b 1
"%NODE_EXE%" --check src\recordStore.js || exit /b 1
"%NODE_EXE%" --check src\offlineMedicalDatabase.js || exit /b 1
"%NODE_EXE%" --check public\app.js || exit /b 1
"%NODE_EXE%" --check public\sw.js || exit /b 1
"%NODE_EXE%" --check scripts\smoke-test.js || exit /b 1
"%NODE_EXE%" --check scripts\deployment-check.js || exit /b 1
"%NODE_EXE%" scripts\smoke-test.js || exit /b 1
"%NODE_EXE%" scripts\deployment-check.js || exit /b 1

echo.
echo Care Nova AI is deployment ready.
if /i not "%~1"=="--no-pause" pause
