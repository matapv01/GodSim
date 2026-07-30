$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$chrome = Join-Path $root ".browsers\chromium-1234\chrome-win64\chrome.exe"
$profile = Join-Path $root ".browser-profile"
$url = "http://localhost:55210?ws=ws://localhost:55211&lang=vi"

if (-not (Test-Path -LiteralPath $chrome)) {
  $localBrowserRoot = Join-Path $root ".browsers"
  $localChrome = Get-ChildItem -Path $localBrowserRoot -Filter chrome.exe -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -like "*\chrome-win64\chrome.exe" } |
    Select-Object -First 1

  if ($localChrome) {
    $chrome = $localChrome.FullName
  }
}

if (-not (Test-Path -LiteralPath $chrome)) {
  $browserCandidates = @(
    (Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe"),
    (Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe"),
    (Join-Path $env:ProgramFiles "Microsoft\Edge\Application\msedge.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "Microsoft\Edge\Application\msedge.exe")
  ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }

  if ($browserCandidates.Count -gt 0) {
    $chrome = $browserCandidates[0]
    Write-Host "Khong tim thay Chromium local, dung browser he thong: $chrome"
  }
}

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
