$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$chrome = Join-Path $root ".browsers\chromium-1234\chrome-win64\chrome.exe"
$profile = Join-Path $root ".browser-profile"
$url = "http://localhost:55210?ws=ws://localhost:55211&lang=vi"

if (-not (Test-Path -LiteralPath $chrome)) {
  Write-Host "Không tìm thấy Chromium local tại: $chrome"
  Write-Host "Hãy chạy lại: npx playwright install chromium"
  exit 1
}

New-Item -ItemType Directory -Force -Path $profile | Out-Null

Start-Process -FilePath $chrome -ArgumentList @(
  "--user-data-dir=$profile",
  "--new-window",
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-extensions",
  "--disable-background-mode",
  "--no-service-autorun",
  "--disable-features=DownloadBubble,DownloadBubbleV2",
  $url
)

Write-Host "Đã mở Agentshire bằng Chromium local:"
Write-Host $chrome
Write-Host "Profile riêng:"
Write-Host $profile
Write-Host $url
