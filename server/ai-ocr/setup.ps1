# One-time setup for the SacraDigit AI reader.
#   powershell -ExecutionPolicy Bypass -File server\ai-ocr\setup.ps1
# Needs Python 3.10-3.13 on PATH. Installs everything into server\ai-ocr\.venv only.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not (Test-Path .venv\Scripts\python.exe)) { python -m venv .venv }
& .venv\Scripts\python.exe -m pip install --upgrade pip
& .venv\Scripts\python.exe -m pip install -r requirements.txt

Write-Host ''
Write-Host 'Python side is ready. Two things left (one time):' -ForegroundColor Green
Write-Host '  1. Install Ollama:   https://ollama.com/download   (or: winget install Ollama.Ollama)'
Write-Host '  2. Download the AI:  ollama pull qwen2.5vl:3b      (about 3.2 GB)'
Write-Host 'Then start the reader with start.ps1.'
