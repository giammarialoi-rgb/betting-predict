#Requires -Version 5.1
param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)
$ErrorActionPreference = "Continue"
$brainDir = Join-Path $RepoRoot "audit\external\task-044\brain"
$wdLock = Join-Path $brainDir "watchdog.lock"
$wkLock = Join-Path $brainDir "worker.lock"
$statePath = Join-Path $brainDir "brain-state.json"

function Stop-LockPid([string]$path, [string]$label) {
  if (-not (Test-Path $path)) { return }
  try {
    $j = Get-Content $path -Raw | ConvertFrom-Json
    if ($j.pid) {
      Stop-Process -Id $j.pid -Force -ErrorAction SilentlyContinue
      Write-Output "Stopped $label pid=$($j.pid)"
    }
  } catch {}
  Remove-Item $path -Force -ErrorAction SilentlyContinue
}

Stop-LockPid $wdLock "watchdog"
Stop-LockPid $wkLock "worker"

if (Test-Path $statePath) {
  try {
    $raw = Get-Content $statePath -Raw
    $raw = $raw -replace '^\uFEFF', ''
    $h = $raw | ConvertFrom-Json
    $h.status = "STOPPED"
    $h.worker_pid = $null
    $h.watchdog_pid = $null
    $json = $h | ConvertTo-Json -Depth 8
    [System.IO.File]::WriteAllText($statePath, $json)
  } catch {}
}
Write-Output "Brain stop requested"
