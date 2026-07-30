$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$agentshire = Join-Path $root "Agentshire"
$runtime = Join-Path $root ".runtime"
$toolsDir = Join-Path $root ".tools"
$nodeVersion = "24.18.0"
$nodeDir = Join-Path $toolsDir "node-v$nodeVersion-win-x64"
$nodeExe = Join-Path $nodeDir "node.exe"
$npm = Join-Path $nodeDir "npm.cmd"
$openclawVersion = "2026.3.13"
$openclawDir = Join-Path $toolsDir "openclaw-$openclawVersion"
$openclawCmd = Join-Path $openclawDir "node_modules\.bin\openclaw.cmd"
$openBrowserScript = Join-Path $root "Open_Agentshire_Browser.ps1"
$gatewayOut = Join-Path $runtime "openclaw-gateway.out.log"
$gatewayErr = Join-Path $runtime "openclaw-gateway.err.log"
$llmEnv = Join-Path $root "LLM_Env.ps1"

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
  Write-Host "Khong tim thay thu muc Agentshire: $agentshire"
  exit 1
}

New-Item -ItemType Directory -Force -Path $runtime | Out-Null
New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null

if (-not ((Test-Path -LiteralPath $nodeExe) -and (Test-Path -LiteralPath $npm))) {
  $systemNode = Get-Command node.exe -ErrorAction SilentlyContinue
  $systemNpm = Get-Command npm.cmd -ErrorAction SilentlyContinue
  $systemNodeOk = $false

  if ($systemNode -and $systemNpm) {
    try {
      $systemNodeMajor = [int]((& $systemNode.Source --version).TrimStart("v").Split(".")[0])
      $systemNodeOk = $systemNodeMajor -ge 22
    } catch {
      $systemNodeOk = $false
    }
  }

  if ($systemNodeOk) {
    $nodeExe = $systemNode.Source
    $npm = $systemNpm.Source
    $nodeDir = Split-Path -Parent $nodeExe
    Write-Host "Dung Node.js da cai tren may."
  } else {
    $nodeArchive = Join-Path $runtime "node-v$nodeVersion-win-x64.zip"
    $nodeUrl = "https://nodejs.org/dist/v$nodeVersion/node-v$nodeVersion-win-x64.zip"
    Write-Host "Lan dau: dang tai Node.js portable $nodeVersion..."
    try {
      Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeArchive -UseBasicParsing
      Expand-Archive -LiteralPath $nodeArchive -DestinationPath $toolsDir -Force
      Remove-Item -LiteralPath $nodeArchive -Force -ErrorAction SilentlyContinue
    } catch {
      Write-Host "Khong tai duoc Node.js. Kiem tra ket noi mang roi chay lai Start_Game.bat."
      Write-Host $_.Exception.Message
      exit 1
    }
  }
}

$env:PATH = "$nodeDir;$env:PATH"

if (Test-Path -LiteralPath $llmEnv) {
  . $llmEnv
  if ($env:AGENTSHIRE_LLM_BASE_URL) {
    Write-Host "Da nap cau hinh LLM: $($env:AGENTSHIRE_LLM_BASE_URL) / $($env:AGENTSHIRE_LLM_MODEL)"
  }
}

if (-not (Test-Path -LiteralPath (Join-Path $agentshire "node_modules\ws\package.json"))) {
  Write-Host "Lan dau: dang cai thu vien Agentshire..."
  & $npm ci --omit=dev --no-audit --no-fund --prefix $agentshire
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Cai thu vien Agentshire that bai. Kiem tra mang roi chay lai Start_Game.bat."
    exit 1
  }
}

if (-not (Test-Path -LiteralPath $openclawCmd)) {
  Write-Host "Lan dau: dang cai OpenClaw $openclawVersion..."
  & $npm install --prefix $openclawDir --no-save --no-audit --no-fund "openclaw@$openclawVersion"
  if (($LASTEXITCODE -ne 0) -or (-not (Test-Path -LiteralPath $openclawCmd))) {
    Write-Host "Cai OpenClaw that bai. Kiem tra mang roi chay lai Start_Game.bat."
    exit 1
  }
}

$pluginRegistered = $false
$openclawConfig = Join-Path $env:USERPROFILE ".openclaw\openclaw.json"
if (Test-Path -LiteralPath $openclawConfig) {
  try {
    $config = Get-Content -LiteralPath $openclawConfig -Raw | ConvertFrom-Json
    $loadPaths = @($config.plugins.load.paths)
    $entryEnabled = $config.plugins.entries.agentshire.enabled
    $pluginRegistered = ($entryEnabled -eq $true) -and
      ($loadPaths | Where-Object {
        [IO.Path]::GetFullPath($_) -eq [IO.Path]::GetFullPath($agentshire)
      })
  } catch {
    $pluginRegistered = $false
  }
}

if (-not $pluginRegistered) {
  Write-Host "Lan dau: dang dang ky plugin Agentshire..."
  & $openclawCmd plugins install --link $agentshire
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Dang ky plugin Agentshire that bai. Xem thong bao phia tren."
    exit 1
  }
}

$gatewayAlreadyRunning = (Test-PortListening -Port 55210) -and (Test-PortListening -Port 55211)

if ($gatewayAlreadyRunning) {
  Write-Host "Gateway dang chay san."
} else {
  Write-Host "Dang bat OpenClaw Gateway + Agentshire..."
  Remove-Item -LiteralPath $gatewayOut, $gatewayErr -ErrorAction SilentlyContinue

  Start-Process `
    -FilePath $openclawCmd `
    -ArgumentList @("gateway", "--allow-unconfigured") `
    -WorkingDirectory $agentshire `
    -WindowStyle Hidden `
    -RedirectStandardOutput $gatewayOut `
    -RedirectStandardError $gatewayErr | Out-Null

  $httpReady = Wait-Port -Port 55210 -TimeoutSeconds 90
  $wsReady = Wait-Port -Port 55211 -TimeoutSeconds 30

  if (-not ($httpReady -and $wsReady)) {
    Write-Host "Gateway chua bat duoc. Xem log:"
    Write-Host $gatewayOut
    Write-Host $gatewayErr
    exit 1
  }
}

Write-Host "Dang mo game bang browser rieng..."
PowerShell -ExecutionPolicy Bypass -File $openBrowserScript

Write-Host ""
Write-Host "Game da mo."
Write-Host "Khi choi xong, chay Stop_Game.bat de tat browser va Gateway."
