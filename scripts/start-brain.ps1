#Requires -Version 5.1
param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)
$ErrorActionPreference = "Stop"
Set-Location $RepoRoot
$lock = Join-Path $RepoRoot "audit\external\task-044\brain\watchdog.lock"
if (Test-Path $lock) {
  try {
    $j = Get-Content $lock -Raw | ConvertFrom-Json
    if ($j.pid) {
      $p = Get-Process -Id $j.pid -ErrorAction SilentlyContinue
      if ($p) {
        Write-Output "Brain watchdog already running pid=$($j.pid)"
        exit 0
      }
    }
  } catch {}
}
$logDir = Join-Path $RepoRoot "audit\external\task-044\brain\logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$outLog = Join-Path $logDir "watchdog-stdout.log"
$errLog = Join-Path $logDir "watchdog-stderr.log"
$arg = "/c pnpm exec tsx src/scripts/brain-watchdog.ts >> `"$outLog`" 2>> `"$errLog`""
Start-Process -FilePath "cmd.exe" -ArgumentList $arg -WorkingDirectory $RepoRoot -WindowStyle Hidden
Start-Sleep -Seconds 3
Write-Output "Started brain watchdog (+ worker). Check: pnpm brain:status"
