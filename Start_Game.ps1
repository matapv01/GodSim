$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$agentshire = Join-Path $root "Agentshire"
$runtime = Join-Path $root ".runtime"
$nodeDir = Join-Path $root ".tools\node-v24.18.0-win-x64"
$npx = Join-Path $nodeDir "npx.cmd"
$openclawCached = Join-Path $env:LOCALAPPDATA "npm-cache\_npx\a8ec5c4d22baabed\node_modules\.bin\openclaw.cmd"
$openclawLocal = Join-Path $agentshire "node_modules\.bin\openclaw.cmd"
$openBrowserScript = Join-Path $root "Open_Agentshire_Browser.ps1"
$gatewayOut = Join-Path $runtime "openclaw-gateway.out.log"
$gatewayErr = Join-Path $runtime "openclaw-gateway.err.log"
$llmEnv = Join-Path $root "LLM_Env.ps1"

if (-not (Test-Path -LiteralPath $npx)) {
  $systemNpx = Get-Command npx.cmd -ErrorAction SilentlyContinue
  if (-not $systemNpx) {
    $systemNpx = Get-Command npx -ErrorAction SilentlyContinue
  }
  if ($systemNpx) {
    $npx = $systemNpx.Source
  }
}

function Test-PortListening {
  param([int] $Port)
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $connect = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
    if (-not $connect.AsyncWaitHandle.WaitOne(200, $false)) {
      return $false
    }
    $client.EndConnect($connect)
    return $true
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

function Wait-Port {
  param(
    [int] $Port,
    [int] $TimeoutSeconds = 60
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-PortListening -Port $Port) {
      return $true
    }
    Start-Sleep -Milliseconds 500
  }
  return $false
}

if (-not (Test-Path -LiteralPath $agentshire)) {
  Write-Host "Không tìm thấy thư mục Agentshire: $agentshire"
  exit 1
}

if (-not (Test-Path -LiteralPath $npx)) {
  Write-Host "Không tìm thấy Node portable: $nodeDir"
  exit 1
}

New-Item -ItemType Directory -Force -Path $runtime | Out-Null
$env:PATH = "$nodeDir;$env:PATH"

if (Test-Path -LiteralPath $llmEnv) {
  . $llmEnv
  if ($env:AGENTSHIRE_LLM_BASE_URL) {
    Write-Host "Da nap cau hinh LLM: $($env:AGENTSHIRE_LLM_BASE_URL) / $($env:AGENTSHIRE_LLM_MODEL)"
  }
}

$gatewayAlreadyRunning = (Test-PortListening -Port 55210) -and (Test-PortListening -Port 55211)

if ($gatewayAlreadyRunning) {
  Write-Host "Gateway đang chạy sẵn."
} else {
  Write-Host "Đang bật OpenClaw Gateway + Agentshire..."
  Remove-Item -LiteralPath $gatewayOut, $gatewayErr -ErrorAction SilentlyContinue

  $gatewayExe = $npx
  $gatewayArgs = @("openclaw@2026.3.13", "gateway", "--allow-unconfigured")
  if (Test-Path -LiteralPath $openclawLocal) {
    $gatewayExe = $openclawLocal
    $gatewayArgs = @("gateway", "--allow-unconfigured")
    Write-Host "Dùng OpenClaw local."
  } elseif (Test-Path -LiteralPath $openclawCached) {
    $gatewayExe = $openclawCached
    $gatewayArgs = @("gateway", "--allow-unconfigured")
    Write-Host "Dùng OpenClaw đã cache."
  } else {
    Write-Host "Chưa có OpenClaw cache, dùng npx nên lần này có thể lâu hơn."
  }

  Start-Process `
    -FilePath $gatewayExe `
    -ArgumentList $gatewayArgs `
    -WorkingDirectory $agentshire `
    -WindowStyle Hidden `
    -RedirectStandardOutput $gatewayOut `
    -RedirectStandardError $gatewayErr | Out-Null

  $httpReady = Wait-Port -Port 55210 -TimeoutSeconds 90
  $wsReady = Wait-Port -Port 55211 -TimeoutSeconds 30

  if (-not ($httpReady -and $wsReady)) {
    Write-Host "Gateway chưa bật được. Xem log:"
    Write-Host $gatewayOut
    Write-Host $gatewayErr
    exit 1
  }
}

Write-Host "Đang mở game bằng Chromium local..."
PowerShell -ExecutionPolicy Bypass -File $openBrowserScript

Write-Host ""
Write-Host "Game đã mở."
Write-Host "Khi chơi xong, chạy Stop_Game.bat hoặc Stop_Game.ps1 để tắt cả browser và Gateway."
