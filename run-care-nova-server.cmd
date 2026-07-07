@echo off
setlocal

cd /d "%~dp0\.."

if not defined HOST set "HOST=127.0.0.1"
if not defined PORT set "PORT=4173"
set "NODE_EXE="

if defined CARE_NOVA_NODE_EXE if exist "%CARE_NOVA_NODE_EXE%" set "NODE_EXE=%CARE_NOVA_NODE_EXE%"
if not defined NODE_EXE if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "NODE_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not defined NODE_EXE if exist "C:\Program Files\nodejs\node.exe" set "NODE_EXE=C:\Program Files\nodejs\node.exe"
if not defined NODE_EXE (
  for /f "delims=" %%N in ('where node 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%N"
)

if not defined CARE_NOVA_PRETTY_JSON set "CARE_NOVA_PRETTY_JSON=false"

if not defined NODE_EXE (
  echo [%date% %time%] Node.js runtime not found.>> "care-nova-server.err.log"
  exit /b 1
)

echo [%date% %time%] Starting Care Nova AI on %HOST%:%PORT% with %NODE_EXE%>> "care-nova-server.log"
"%NODE_EXE%" server.js >> "care-nova-server.log" 2>> "care-nova-server.err.log"
