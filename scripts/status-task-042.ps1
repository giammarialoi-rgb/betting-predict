#Requires -Version 5.1
param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [string]$TaskName = "BettingPredict-Collector042"
)
Set-Location $RepoRoot
Write-Output "=== Scheduled Task ==="
Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue | Format-List TaskName,State
Write-Output "=== Collector status (JSON) ==="
pnpm exec tsx src/scripts/collector-task-042-status.ts
