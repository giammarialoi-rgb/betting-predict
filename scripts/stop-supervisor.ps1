#Requires -Version 5.1
param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)
$ErrorActionPreference = "Continue"
Set-Location $RepoRoot
$supLock = Join-Path $RepoRoot "audit\external\task-044\supervisor\supervisor.lock"
$workerLock = Join-Path $RepoRoot "audit\external\task-044\brain\worker.lock"
$wdLock = Join-Path $RepoRoot "audit\external\task-044\brain\watchdog.lock"

function Stop-LockPid([string]$path) {
  if (-not (Test-Path $path)) { return }
  try {
    $j = Get-Content $path -Raw | ConvertFrom-Json
    if ($j.pid) {
      Stop-Process -Id $j.pid -Force -ErrorAction SilentlyContinue
      Write-Output "Stopped pid=$($j.pid) from $path"
    }
  } catch {}
  Remove-Item $path -Force -ErrorAction SilentlyContinue
}

Stop-LockPid $supLock
Stop-LockPid $wdLock
Stop-LockPid $workerLock
Write-Output "Supervisor + worker stop requested"
