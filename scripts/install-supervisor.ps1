#Requires -Version 5.1
<#
  Install supervisor autostart.
  Paths with spaces (e.g. "app previsioni sportive") MUST be quoted.
  Never report success if both Task Scheduler and Startup fail verification.
#>
param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)
$ErrorActionPreference = "Stop"
Set-Location $RepoRoot

$taskName = "BettingPredict-Supervisor055"
$startScript = Join-Path $RepoRoot "scripts\start-supervisor.ps1"
$startup = [Environment]::GetFolderPath("Startup")
$lnkPath = Join-Path $startup "BettingPredict-Supervisor055.lnk"
$xmlPath = Join-Path $env:TEMP "BettingPredict-Supervisor055.xml"
$statusDir = Join-Path $RepoRoot "audit\external\task-044\supervisor"
New-Item -ItemType Directory -Force -Path $statusDir | Out-Null

if (-not (Test-Path $startScript)) {
  Write-Error "Missing start script: $startScript"
  exit 1
}

function XmlEscape([string]$s) {
  return ($s -replace '&', '&amp;' -replace '<', '&lt;' -replace '>', '&gt;' -replace '"', '&quot;')
}

$createdTask = $false
$taskError = $null
$escapedScript = XmlEscape $startScript
$escapedRoot = XmlEscape $RepoRoot

$xml = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Betting Predict permanent-live supervisor (Lab B). Path-safe with spaces.</Description>
  </RegistrationInfo>
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
    </LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>powershell.exe</Command>
      <Arguments>-NoProfile -ExecutionPolicy Bypass -File "$escapedScript"</Arguments>
      <WorkingDirectory>$escapedRoot</WorkingDirectory>
    </Exec>
  </Actions>
</Task>
"@

try {
  [System.IO.File]::WriteAllText($xmlPath, $xml, [System.Text.UnicodeEncoding]::new($false, $true))
  $out = & schtasks.exe /Create /TN $taskName /XML $xmlPath /F 2>&1 | Out-String
  if ($LASTEXITCODE -eq 0) {
    $createdTask = $true
    Write-Output "Task Scheduler: $taskName (ONLOGON via XML - space-safe)"
  } else {
    $taskError = $out
    Write-Output "Task Scheduler FAILED: $out"
  }
} catch {
  $taskError = $_.Exception.Message
  Write-Output "Task Scheduler EXCEPTION: $taskError"
}

$shortcutOk = $false
try {
  $w = New-Object -ComObject WScript.Shell
  $lnk = $w.CreateShortcut($lnkPath)
  $lnk.TargetPath = "powershell.exe"
  $lnk.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$startScript`""
  $lnk.WorkingDirectory = $RepoRoot
  $lnk.WindowStyle = 7
  $lnk.Save()
  if (Test-Path $lnkPath) {
    $verify = $w.CreateShortcut($lnkPath)
    if ($verify.Arguments -like "*$([IO.Path]::GetFileName($startScript))*" -and $verify.Arguments -match '"') {
      $shortcutOk = $true
      Write-Output "Startup shortcut OK (quoted -File path): $lnkPath"
    } else {
      Write-Output "Startup shortcut created but path quoting verification FAILED"
    }
  }
} catch {
  Write-Output "Startup shortcut FAILED: $($_.Exception.Message)"
}

$mechanism = if ($createdTask -and $shortcutOk) { "TaskScheduler+Startup" }
  elseif ($createdTask) { "TaskSchedulerOnly" }
  elseif ($shortcutOk) { "StartupOnly" }
  else { "NONE" }

$verified = ($createdTask -or $shortcutOk)
$status = @{
  at = (Get-Date).ToUniversalTime().ToString("o")
  AUTOSTART_INSTALLED = $verified
  AUTOSTART_VERIFIED = $verified
  ACTIVE_MECHANISM = $mechanism
  task_name = $taskName
  task_created = $createdTask
  task_error = $taskError
  shortcut_path = $lnkPath
  shortcut_ok = $shortcutOk
  start_script = $startScript
  repo_root = $RepoRoot
  path_contains_spaces = ($RepoRoot -match '\s')
  open_task_056 = $false
}
$status | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 (Join-Path $statusDir "autostart-status.json")

Write-Output "AUTOSTART_INSTALLED=$($verified.ToString().ToLower())"
Write-Output "AUTOSTART_VERIFIED=$($verified.ToString().ToLower())"
Write-Output "ACTIVE_MECHANISM=$mechanism"
Write-Output "PATH_CONTAINS_SPACES=$($status.path_contains_spaces)"

if (-not $verified) {
  Write-Error "Autostart install failed - neither Task Scheduler nor Startup shortcut verified"
  exit 1
}
exit 0
