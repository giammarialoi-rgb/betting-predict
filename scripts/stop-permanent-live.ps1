#Requires -Version 5.1
param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)
$ErrorActionPreference = "Continue"
$lock = Join-Path $RepoRoot "audit\external\task-044\collector.lock"
$status = Join-Path $RepoRoot "audit\external\task-044\collector-status.json"
if (Test-Path $lock) {
  try {
    $j = Get-Content $lock -Raw | ConvertFrom-Json
    if ($j.pid) {
      Stop-Process -Id $j.pid -Force -ErrorAction SilentlyContinue
      Write-Output "Stopped permanent-live pid=$($j.pid)"
    }
  } catch {}
  Remove-Item $lock -Force -ErrorAction SilentlyContinue
}
if (Test-Path $status) {
  try {
    $h = Get-Content $status -Raw | ConvertFrom-Json
    $h.status = "STOPPED"
    $h.pid = $null
    $h | ConvertTo-Json -Depth 8 | Set-Content -Path $status -Encoding UTF8
  } catch {}
}
Write-Output "Permanent-live stop requested (Lab A collector 042 left running unless you stop it separately)"
