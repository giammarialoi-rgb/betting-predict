#Requires -Version 5.1
<#
.SYNOPSIS
  Install TASK 051 autonomous brain autostart (Task Scheduler + Startup shortcut fallback).
#>
param(
  [string]$TaskName = "BettingPredict-Brain051",
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$ErrorActionPreference = "Continue"
$ps1 = Join-Path $RepoRoot "scripts\start-brain.ps1"

$tr = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "' + $ps1 + '"'
$sch = cmd.exe /c "schtasks /Create /TN `"$TaskName`" /TR `"$tr`" /SC ONLOGON /RL LIMITED /F"
Write-Output $sch

$startup = [Environment]::GetFolderPath("Startup")
$lnkPath = Join-Path $startup "BettingPredict-Brain051.lnk"
$w = New-Object -ComObject WScript.Shell
$sc = $w.CreateShortcut($lnkPath)
$sc.TargetPath = "powershell.exe"
$sc.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ps1`""
$sc.WorkingDirectory = $RepoRoot
$sc.Save()

Write-Output "Installed Startup shortcut: $lnkPath"
Write-Output "(Scheduled Task may also be present if schtasks succeeded.)"
Write-Output "WorkingDirectory: $RepoRoot"
Write-Output "Manual start: pnpm brain:start"
