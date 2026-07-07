$knownOllamaPaths = @(
  (Get-Command ollama -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue),
  (Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'),
  (Join-Path $env:ProgramFiles 'Ollama\ollama.exe'),
  (Join-Path $env:LOCALAPPDATA 'Programs\CareNovaOllama\ollama.exe')
) | Where-Object { $_ -and (Test-Path $_) }

$knownLmStudioPaths = @(
  (Join-Path $env:LOCALAPPDATA 'Programs\LM Studio\LM Studio.exe'),
  (Join-Path $env:LOCALAPPDATA 'lm-studio\LM Studio.exe')
) | Where-Object { $_ -and (Test-Path $_) }

function Wait-ForUrl {
  param(
    [string]$Url,
    [int]$Attempts = 15,
    [int]$DelayMs = 1000
  )

  for ($i = 0; $i -lt $Attempts; $i++) {
    try {
      $null = Invoke-RestMethod -Uri $Url -Method Get -TimeoutSec 4
      return $true
    } catch {
      Start-Sleep -Milliseconds $DelayMs
    }
  }

  return $false
}

if ($knownOllamaPaths.Count -gt 0) {
  $ollamaExe = $knownOllamaPaths[0]
  $listener = Get-NetTCPConnection -LocalPort 11434 -State Listen -ErrorAction SilentlyContinue

  if (-not $listener) {
    Start-Process -FilePath $ollamaExe -ArgumentList 'serve' -WindowStyle Hidden
  }

  if (Wait-ForUrl -Url 'http://127.0.0.1:11434/api/tags') {
    Write-Output "Ollama runtime is ready on http://127.0.0.1:11434"
    exit 0
  }

  Write-Error "Ollama was found at '$ollamaExe' but the local API did not become ready."
  exit 1
}

if ($knownLmStudioPaths.Count -gt 0) {
  $lmStudioExe = $knownLmStudioPaths[0]
  Start-Process -FilePath $lmStudioExe -WindowStyle Hidden
  Write-Output "LM Studio was launched from '$lmStudioExe'. Enable the local server and load a model so http://127.0.0.1:1234/v1/models responds."
  exit 0
}

Write-Error "No Ollama or LM Studio runtime was found on this machine."
exit 1
