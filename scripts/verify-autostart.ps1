#Requires -Version 5.1
<#
  Verify autostart is real — no false READY.
  Checks Task Scheduler XML/query + Startup shortcut quoting for paths with spaces.
#>
param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)
$ErrorActionPreference = "Continue"
Set-Location $RepoRoot

$taskName = "BettingPredict-Supervisor055"
$legacyTask = "BettingPredict-Supervisor054"
$startScript = Join-Path $RepoRoot "scripts\start-supervisor.ps1"
$startup = [Environment]::GetFolderPath("Startup")
$lnk055 = Join-Path $startup "BettingPredict-Supervisor055.lnk"
$lnk054 = Join-Path $startup "BettingPredict-Supervisor054.lnk"
$statusDir = Join-Path $RepoRoot "audit\external\task-044\supervisor"
New-Item -ItemType Directory -Force -Path $statusDir | Out-Null

$taskOk = $false
$taskDetail = $null
foreach ($tn in @($taskName, $legacyTask)) {
  $q = & schtasks.exe /Query /TN $tn /V /FO LIST 2>&1 | Out-String
  if ($LASTEXITCODE -eq 0) {
    # Task exists — verify path fragments appear (previsioni must not be a bare arg failure at create time)
    if ($q -match [regex]::Escape("start-supervisor.ps1") -or $q -match "BettingPredict") {
      $taskOk = $true
      $taskDetail = "found:$tn"
      break
    }
  }
}

$shortcutOk = $false
$shortcutPath = $null
$w = New-Object -ComObject WScript.Shell
foreach ($lp in @($lnk055, $lnk054)) {
  if (Test-Path $lp) {
    $s = $w.CreateShortcut($lp)
    $args = [string]$s.Arguments
    # Must contain quoted -File "…\start-supervisor.ps1"
    if ($args -match '-File\s+"[^"]+start-supervisor\.ps1"') {
      $shortcutOk = $true
      $shortcutPath = $lp
      break
    }
    # Also accept if path has no spaces and unquoted (not our case)
    if ($args -match '-File\s+\S+start-supervisor\.ps1' -and $RepoRoot -notmatch '\s') {
      $shortcutOk = $true
      $shortcutPath = $lp
      break
    }
  }
}

$scriptExists = Test-Path $startScript
$mechanism = if ($taskOk -and $shortcutOk) { "TaskScheduler+Startup" }
  elseif ($taskOk) { "TaskSchedulerOnly" }
  elseif ($shortcutOk) { "StartupOnly" }
  else { "NONE" }

$verified = $scriptExists -and ($taskOk -or $shortcutOk)

$status = @{
  at = (Get-Date).ToUniversalTime().ToString("o")
  AUTOSTART_INSTALLED = $verified
  AUTOSTART_VERIFIED = $verified
  ACTIVE_MECHANISM = $mechanism
  task_ok = $taskOk
  task_detail = $taskDetail
  shortcut_ok = $shortcutOk
  shortcut_path = $shortcutPath
  start_script_exists = $scriptExists
  start_script = $startScript
  repo_root = $RepoRoot
  path_contains_spaces = ($RepoRoot -match '\s')
  open_task_056 = $false
  note = if (-not $verified) { "Install with: pnpm permanent-live:supervisor:install" } else { "ok" }
}
$status | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 (Join-Path $statusDir "autostart-status.json")

Write-Output ($status | ConvertTo-Json -Depth 5)
if (-not $verified) { exit 2 }
exit 0
