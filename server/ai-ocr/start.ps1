# Starts the SacraDigit AI reader on http://127.0.0.1:8008
#   Run from anywhere:  powershell -ExecutionPolicy Bypass -File server\ai-ocr\start.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$py = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
if (-not (Test-Path $py)) {
  Write-Host 'The Python environment is missing. Run setup.ps1 first.' -ForegroundColor Yellow
  exit 1
}

# Load optional .env
if (Test-Path .env) {
  Get-Content .env | Where-Object { $_ -match '^\s*[^#\s][^=]*=' } | ForEach-Object {
    $k, $v = $_ -split '=', 2
    [Environment]::SetEnvironmentVariable($k.Trim(), $v.Trim(), 'Process')
  }
}
$model = if ($env:OLLAMA_MODEL) { $env:OLLAMA_MODEL } else { 'qwen2.5vl:3b' }

if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) {
  Write-Host 'Ollama is not installed (https://ollama.com/download). The AI step will be skipped until it is.' -ForegroundColor Yellow
} else {
  try { Invoke-RestMethod http://127.0.0.1:11434/api/tags -TimeoutSec 2 | Out-Null }
  catch { Write-Host 'Starting Ollama...'; Start-Process ollama -ArgumentList 'serve' -WindowStyle Hidden; Start-Sleep 3 }
  if (-not ((ollama list) -match [regex]::Escape($model.Split(':')[0]))) {
    Write-Host "Model $model is not downloaded yet. Run: ollama pull $model" -ForegroundColor Yellow
  }
}

& $py -m uvicorn app:app --host 127.0.0.1 --port 8008
