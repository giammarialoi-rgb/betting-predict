#Requires -Version 5.1
param(
  [string]$TaskName = "BettingPredict-Brain051",
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)
$ErrorActionPreference = "Continue"

# Stop running brain first
& (Join-Path $PSScriptRoot "stop-brain.ps1") -RepoRoot $RepoRoot | Write-Output

cmd.exe /c "schtasks /Delete /TN `"$TaskName`" /F" | Write-Output

$startup = [Environment]::GetFolderPath("Startup")
$lnkPath = Join-Path $startup "BettingPredict-Brain051.lnk"
if (Test-Path $lnkPath) {
  Remove-Item $lnkPath -Force -ErrorAction SilentlyContinue
  Write-Output "Removed Startup shortcut: $lnkPath"
}
Write-Output "Brain autostart uninstalled"
