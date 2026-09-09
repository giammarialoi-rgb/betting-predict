#Requires -Version 5.1
param([string]$TaskName = "BettingPredict-Collector042")
$ErrorActionPreference = "Continue"
& schtasks.exe /Delete /TN "$TaskName" /F 2>$null | Out-Null
$startup = [Environment]::GetFolderPath("Startup")
$lnkPath = Join-Path $startup "BettingPredict-Collector042.lnk"
if (Test-Path $lnkPath) { Remove-Item $lnkPath -Force }
Write-Output "Uninstalled Scheduled Task (if present) and Startup shortcut (if present)."
Write-Output "Running collector process is NOT killed; use stop-task-042.ps1"
