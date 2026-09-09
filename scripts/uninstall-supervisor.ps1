#Requires -Version 5.1
param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)
$ErrorActionPreference = "Continue"
Set-Location $RepoRoot
& (Join-Path $PSScriptRoot "stop-supervisor.ps1") -RepoRoot $RepoRoot
foreach ($tn in @("BettingPredict-Supervisor055", "BettingPredict-Supervisor054")) {
  schtasks /Delete /TN $tn /F 2>$null
}
$startup = [Environment]::GetFolderPath("Startup")
foreach ($name in @("BettingPredict-Supervisor055.lnk", "BettingPredict-Supervisor054.lnk")) {
  $lnk = Join-Path $startup $name
  if (Test-Path $lnk) { Remove-Item $lnk -Force }
}
Write-Output "Uninstalled BettingPredict-Supervisor055/054"
