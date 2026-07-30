$ErrorActionPreference = "Continue"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$profile = Join-Path $root ".browser-profile"

Write-Host "Đang tắt Chromium local của game..."

$chromeProcesses = @()
try {
  $escapedProfile = $profile.Replace("\", "\\")
  $chromeProcesses = Get-CimInstance Win32_Process -Filter "name = 'chrome.exe'" -ErrorAction Stop |
    Where-Object {
      $_.CommandLine -like "*--user-data-dir=$profile*" -or
      $_.CommandLine -like "*--user-data-dir=`"$profile`"*" -or
      $_.CommandLine -like "*$escapedProfile*"
    }
} catch {
  $chromeProcesses = Get-Process chrome -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -like (Join-Path $root ".browsers\*") }
}

foreach ($proc in $chromeProcesses) {
  $processId = if ($proc.PSObject.Properties.Name -contains "ProcessId") { $proc.ProcessId } else { $proc.Id }
  Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
}

Write-Host "Đang tắt Gateway/Agentshire trên port 55210 và 55211..."

$portProcesses = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalPort -in 55210, 55211 } |
  Select-Object -ExpandProperty OwningProcess -Unique

if (-not $portProcesses) {
  $portProcesses = netstat -ano -p tcp |
    Select-String "LISTENING" |
    Where-Object { $_.Line -match ":(55210|55211)\s" } |
    ForEach-Object {
      if ($_.Line -match "\s(\d+)\s*$") { [int] $Matches[1] }
    } |
    Select-Object -Unique
}

foreach ($processId in $portProcesses) {
  Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
}

Start-Sleep -Seconds 1

$remaining = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalPort -in 55210, 55211 }

if (-not $remaining) {
  $remaining = netstat -ano -p tcp |
    Select-String "LISTENING" |
    Where-Object { $_.Line -match ":(55210|55211)\s" }
}

if ($remaining) {
  Write-Host "Vẫn còn process dùng port 55210/55211:"
  $remaining | Select-Object LocalAddress, LocalPort, OwningProcess | Format-Table -AutoSize
} else {
  Write-Host "Đã tắt game và Gateway."
}
