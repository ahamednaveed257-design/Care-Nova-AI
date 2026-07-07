param(
  [ValidateSet("local", "global")]
  [string]$Mode = "local",
  [switch]$SkipBrowser
)

$ErrorActionPreference = "Stop"

$appDir = Split-Path -Parent $PSScriptRoot
$launcherPath = Join-Path $appDir "index.html"
$localRuntimeScript = Join-Path $PSScriptRoot "start-local-runtime.ps1"
$runServerScript = Join-Path $PSScriptRoot "run-care-nova-server.cmd"
$port = 4173
$browserUrl = "http://127.0.0.1:$port/"
$listenHost = if ($Mode -eq "global") { "0.0.0.0" } else { "127.0.0.1" }

function Resolve-NodeExe {
  $candidates = @(
    (Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"),
    "C:\Program Files\nodejs\node.exe",
    (Get-Command node -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue)
  ) | Where-Object { $_ -and (Test-Path $_) }

  if ($candidates.Count -gt 0) {
    return $candidates[0]
  }

  return $null
}

function Test-CareNovaHealth {
  param(
    [int]$TimeoutSec = 2
  )

  try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:$port/api/health" -TimeoutSec $TimeoutSec
    return ($health.ok -eq $true)
  } catch {
    return $false
  }
}

function Open-FallbackSurface {
  if ($SkipBrowser) {
    return
  }

  if (Test-Path $launcherPath) {
    Start-Process -FilePath $launcherPath | Out-Null
    return
  }

  Start-Process -FilePath $browserUrl | Out-Null
}

$nodeExe = Resolve-NodeExe

if (-not $nodeExe) {
  Open-FallbackSurface
  throw "Node.js runtime not found. Care Nova could not start the localhost server."
}

if (Test-Path $localRuntimeScript) {
  try {
    & $localRuntimeScript | Out-Null
  } catch {
    # Local LLM runtime is optional for the localhost app bootstrap.
  }
}

if (-not (Test-CareNovaHealth)) {
  if (-not (Test-Path $runServerScript)) {
    Open-FallbackSurface
    throw "Care Nova server launcher is missing: $runServerScript"
  }

  $env:HOST = $listenHost
  $env:PORT = [string]$port
  $env:CARE_NOVA_PRETTY_JSON = "false"

  if ($Mode -eq "global") {
    $env:NODE_ENV = "production"
    $env:FRAME_ANCESTORS = "'self'"
  } else {
    Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue
    Remove-Item Env:FRAME_ANCESTORS -ErrorAction SilentlyContinue
  }

  $env:CARE_NOVA_NODE_EXE = $nodeExe

  Start-Process -FilePath "cmd.exe" -ArgumentList @("/c", "`"$runServerScript`"") -WorkingDirectory $appDir -WindowStyle Hidden | Out-Null
}

$ready = $false

for ($attempt = 0; $attempt -lt 24; $attempt += 1) {
  if (Test-CareNovaHealth) {
    $ready = $true
    break
  }

  Start-Sleep -Milliseconds 500
}

if ($ready) {
  if (-not $SkipBrowser) {
    Start-Process -FilePath $browserUrl | Out-Null
  }

  exit 0
}

Open-FallbackSurface
throw "Care Nova AI did not become ready on $browserUrl"
