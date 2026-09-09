#Requires -Version 5.1
<#
.SYNOPSIS
  Install TASK 042 persistent collector autostart via Startup folder shortcut
  (works without admin; path may contain spaces).
#>
param(
  [string]$TaskName = "BettingPredict-Collector042",
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$ErrorActionPreference = "Continue"
$ps1 = Join-Path $RepoRoot "scripts\start-task-042.ps1"

# Try Scheduled Task with carefully escaped TR (optional)
$tr = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "' + $ps1 + '"'
$sch = cmd.exe /c "schtasks /Create /TN `"$TaskName`" /TR `"$tr`" /SC ONLOGON /RL LIMITED /F"
Write-Output $sch

$startup = [Environment]::GetFolderPath("Startup")
$lnkPath = Join-Path $startup "BettingPredict-Collector042.lnk"
$w = New-Object -ComObject WScript.Shell
$sc = $w.CreateShortcut($lnkPath)
$sc.TargetPath = "powershell.exe"
$sc.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ps1`""
$sc.WorkingDirectory = $RepoRoot
$sc.Save()

Write-Output "Installed Startup shortcut: $lnkPath"
Write-Output "(Scheduled Task may also be present if schtasks succeeded.)"
Write-Output "WorkingDirectory: $RepoRoot"
Write-Output "Manual start: pnpm collector:task-042:start"
