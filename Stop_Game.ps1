$ErrorActionPreference = "Continue"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$profile = Join-Path $root ".browser-profile"

Write-Host "Đang tắt Chromium local của game..."

$escapedProfile = $profile.Replace("\", "\\")
$chromeProcesses = Get-CimInstance Win32_Process -Filter "name = 'chrome.exe'" |
  Where-Object {
    $_.CommandLine -like "*--user-data-dir=$profile*" -or
    $_.CommandLine -like "*--user-data-dir=`"$profile`"*" -or
    $_.CommandLine -like "*$escapedProfile*"
  }

foreach ($proc in $chromeProcesses) {
  Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
}

Write-Host "Đang tắt Gateway/Agentshire trên port 55210 và 55211..."

$portProcesses = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalPort -in 55210, 55211 } |
  Select-Object -ExpandProperty OwningProcess -Unique

foreach ($processId in $portProcesses) {
  Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
}

Start-Sleep -Seconds 1

$remaining = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalPort -in 55210, 55211 }

if ($remaining) {
  Write-Host "Vẫn còn process dùng port 55210/55211:"
  $remaining | Select-Object LocalAddress, LocalPort, OwningProcess | Format-Table -AutoSize
} else {
  Write-Host "Đã tắt game và Gateway."
}
