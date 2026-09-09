#Requires -Version 5.1
param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)
$ErrorActionPreference = "Stop"
Set-Location $RepoRoot
$lock = Join-Path $RepoRoot "audit\external\task-039\collector.lock"
if (Test-Path $lock) {
  try {
    $j = Get-Content $lock -Raw | ConvertFrom-Json
    if ($j.pid) {
      $p = Get-Process -Id $j.pid -ErrorAction SilentlyContinue
      if ($p) {
        Write-Output "Collector already running pid=$($j.pid)"
        exit 0
      }
    }
  } catch {}
}
$logDir = Join-Path $RepoRoot "audit\external\task-039"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$outLog = Join-Path $logDir "collector-stdout.log"
$errLog = Join-Path $logDir "collector-stderr.log"
$arg = "/c pnpm exec tsx src/scripts/collector-task-042-run.ts >> `"$outLog`" 2>> `"$errLog`""
Start-Process -FilePath "cmd.exe" -ArgumentList $arg -WorkingDirectory $RepoRoot -WindowStyle Hidden
Start-Sleep -Seconds 3
if (Test-Path $lock) {
  Write-Output "Started collector daemon. Check: pnpm collector:task-042:status"
} else {
  Write-Output "Start issued; lock not yet visible - check collector-stderr.log"
  if (Test-Path $errLog) { Get-Content $errLog -Tail 20 }
}
