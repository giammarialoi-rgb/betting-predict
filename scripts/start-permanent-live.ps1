#Requires -Version 5.1
param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)
$ErrorActionPreference = "Stop"
Set-Location $RepoRoot
$lock = Join-Path $RepoRoot "audit\external\task-044\collector.lock"
if (Test-Path $lock) {
  try {
    $j = Get-Content $lock -Raw | ConvertFrom-Json
    if ($j.pid) {
      $p = Get-Process -Id $j.pid -ErrorAction SilentlyContinue
      if ($p) {
        Write-Output "Permanent-live already running pid=$($j.pid)"
        exit 0
      }
    }
  } catch {}
}
$logDir = Join-Path $RepoRoot "audit\external\task-044"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$outLog = Join-Path $logDir "collector-stdout.log"
$errLog = Join-Path $logDir "collector-stderr.log"
$arg = "/c pnpm exec tsx src/scripts/permanent-live-run.ts >> `"$outLog`" 2>> `"$errLog`""
Start-Process -FilePath "cmd.exe" -ArgumentList $arg -WorkingDirectory $RepoRoot -WindowStyle Hidden
Start-Sleep -Seconds 3
Write-Output "Started permanent-live daemon. Check: pnpm permanent-live:status"
# Also keep Lab A scientific collector if not running
& pnpm collector:task-042:start | Write-Output
