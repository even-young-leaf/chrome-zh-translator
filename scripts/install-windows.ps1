param(
  [string]$Model = "qwen3:8b",
  [string]$ExtensionId = "cplehmmdegoebbhfonddkfeefboonpdb",
  [string]$OllamaHostValue = "127.0.0.1:11434"
)

$ErrorActionPreference = "Stop"
$OllamaOriginsValue = "chrome-extension://$ExtensionId,http://127.0.0.1,http://localhost"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ExtensionDir = Resolve-Path (Join-Path $ScriptDir "..")
$LogOutFile = Join-Path $ExtensionDir "ollama-extension.out.log"
$LogErrFile = Join-Path $ExtensionDir "ollama-extension.err.log"

function Get-OllamaExe {
  $cmd = Get-Command ollama -ErrorAction SilentlyContinue
  if ($cmd) {
    return $cmd.Source
  }

  $candidates = @()
  if ($env:LOCALAPPDATA) {
    $candidates += Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama.exe"
  }
  if ($env:ProgramFiles) {
    $candidates += Join-Path $env:ProgramFiles "Ollama\ollama.exe"
  }
  if (${env:ProgramFiles(x86)}) {
    $candidates += Join-Path ${env:ProgramFiles(x86)} "Ollama\ollama.exe"
  }

  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path $candidate)) {
      return $candidate
    }
  }

  return $null
}

function Install-Ollama {
  if (Get-OllamaExe) {
    return
  }

  Write-Host "Installing Ollama..."
  Invoke-RestMethod https://ollama.com/install.ps1 | Invoke-Expression

  $ollama = Get-OllamaExe
  if (-not $ollama) {
    throw "Ollama was installed, but ollama.exe was not found. Open a new PowerShell window and run this script again."
  }
}

function Wait-Ollama {
  for ($i = 0; $i -lt 40; $i++) {
    try {
      Invoke-RestMethod "http://$OllamaHostValue/api/tags" | Out-Null
      return
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }

  throw "Ollama did not become ready on http://$OllamaHostValue. Check $LogOutFile and $LogErrFile for details."
}

Install-Ollama
$OllamaExe = Get-OllamaExe

Write-Host "Setting Ollama environment for Chrome extension access..."
[Environment]::SetEnvironmentVariable("OLLAMA_HOST", $OllamaHostValue, "User")
[Environment]::SetEnvironmentVariable("OLLAMA_ORIGINS", $OllamaOriginsValue, "User")
$env:OLLAMA_HOST = $OllamaHostValue
$env:OLLAMA_ORIGINS = $OllamaOriginsValue

Write-Host "Stopping existing Ollama processes..."
Get-Process ollama -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

Write-Host "Starting Ollama for this extension..."
$serve = Start-Process -FilePath $OllamaExe -ArgumentList "serve" -WindowStyle Hidden -PassThru -RedirectStandardOutput $LogOutFile -RedirectStandardError $LogErrFile
Wait-Ollama

Write-Host "Pulling model: $Model"
& $OllamaExe pull $Model

Start-Process "chrome://extensions/" -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Done."
Write-Host ""
Write-Host "1. Chrome has been opened to chrome://extensions/ when possible."
Write-Host "2. Enable Developer mode."
Write-Host "3. Click 'Load unpacked'."
Write-Host "4. Select this folder:"
Write-Host "   $ExtensionDir"
Write-Host ""
Write-Host "Ollama API: http://$OllamaHostValue"
Write-Host "Model: $Model"
Write-Host "Log: $LogOutFile"
