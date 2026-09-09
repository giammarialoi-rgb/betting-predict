#Requires -Version 5.1
param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)
$ErrorActionPreference = "Stop"
Set-Location $RepoRoot
$lock = Join-Path $RepoRoot "audit\external\task-044\supervisor\supervisor.lock"
if (Test-Path $lock) {
  try {
    $j = Get-Content $lock -Raw | ConvertFrom-Json
    if ($j.pid) {
      $p = Get-Process -Id $j.pid -ErrorAction SilentlyContinue
      if ($p) {
        Write-Output "Supervisor already running pid=$($j.pid)"
        exit 0
      }
    }
  } catch {}
}
$logDir = Join-Path $RepoRoot "audit\external\task-044\supervisor\logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$outLog = Join-Path $logDir "supervisor-stdout.log"
$errLog = Join-Path $logDir "supervisor-stderr.log"
$arg = "/c pnpm exec tsx src/scripts/permanent-live-supervisor.ts run >> `"$outLog`" 2>> `"$errLog`""
Start-Process -FilePath "cmd.exe" -ArgumentList $arg -WorkingDirectory $RepoRoot -WindowStyle Hidden
Start-Sleep -Seconds 4
Write-Output "Started permanent-live supervisor (+ worker heal). Check: pnpm permanent-live:supervisor:status"
