param(
    [Parameter(Position = 0)]
    [ValidateSet("start", "stop", "status")]
    [string]$Action = "status",

    [switch]$TroubleCycle
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $root ".runtime"
$logsDir = Join-Path $runtimeDir "logs"
$statePath = Join-Path $runtimeDir "services.json"

function Read-State {
    if (-not (Test-Path -LiteralPath $statePath)) {
        return @()
    }
    $items = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    return @($items)
}

function Write-State([array]$Items) {
    New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
    $Items | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $statePath -Encoding UTF8
}

function Get-LiveProcess($Item) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($Item.pid)" -ErrorAction SilentlyContinue
    if (-not $process -or $process.CommandLine -notlike "*$($Item.marker)*") {
        return $null
    }
    return $process
}

function Stop-ProcessTree([int]$ProcessId) {
    $children = Get-CimInstance Win32_Process -Filter "ParentProcessId = $ProcessId" -ErrorAction SilentlyContinue
    foreach ($child in $children) {
        Stop-ProcessTree -ProcessId $child.ProcessId
    }
    Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
}

function Show-Status {
    $state = Read-State
    if ($state.Count -eq 0) {
        Write-Output "No managed development services."
        return
    }
    foreach ($item in $state) {
        $running = $null -ne (Get-LiveProcess $item)
        [PSCustomObject]@{
            Service = $item.name
            Status = if ($running) { "running" } else { "stopped" }
            PID = $item.pid
            Log = $item.log
        }
    }
}

function Wait-Backend {
    for ($attempt = 1; $attempt -le 20; $attempt++) {
        try {
            $response = Invoke-RestMethod -Uri "http://127.0.0.1:8081/api/v1/health" -TimeoutSec 2
            if ($response.data.database -eq "connected") {
                return
            }
        } catch {
            Start-Sleep -Milliseconds 500
        }
    }
    throw "Backend did not become healthy within 10 seconds."
}

function Start-Services {
    $live = @(Read-State | Where-Object { $null -ne (Get-LiveProcess $_) })
    if ($live.Count -gt 0) {
        Write-Output "Managed services are already running. Use status or stop first."
        Show-Status
        return
    }

    New-Item -ItemType Directory -Force -Path $logsDir | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $root "bin") | Out-Null
    $stamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $records = @()

    Push-Location (Join-Path $root "backend-go")
    try {
        & go build -o (Join-Path $root "bin\ems-backend.exe") ./cmd/server
        if ($LASTEXITCODE -ne 0) {
            throw "Backend build failed."
        }
    } finally {
        Pop-Location
    }

    $backendLog = Join-Path $logsDir "backend-$stamp"
    $backend = Start-Process `
        -FilePath (Join-Path $root "bin\ems-backend.exe") `
        -WorkingDirectory (Join-Path $root "backend-go") `
        -WindowStyle Hidden `
        -RedirectStandardOutput "$backendLog.out.log" `
        -RedirectStandardError "$backendLog.err.log" `
        -PassThru
    $records += [PSCustomObject]@{
        name = "backend"
        pid = $backend.Id
        marker = "ems-backend.exe"
        log = "$backendLog.err.log"
    }
    Write-State $records
    Wait-Backend

    $mlPython = Join-Path $root "ml-worker\.venv\Scripts\python.exe"
    if (-not (Test-Path -LiteralPath $mlPython)) {
        throw "ML Worker virtualenv is missing: $mlPython"
    }
    $inferLog = Join-Path $logsDir "infer-loop-$stamp"
    $infer = Start-Process `
        -FilePath $mlPython `
        -ArgumentList @("-u", "-m", "ml_worker.cli", "infer-loop") `
        -WorkingDirectory (Join-Path $root "ml-worker") `
        -WindowStyle Hidden `
        -RedirectStandardOutput "$inferLog.out.log" `
        -RedirectStandardError "$inferLog.err.log" `
        -PassThru
    $records += [PSCustomObject]@{
        name = "infer-loop"
        pid = $infer.Id
        marker = "ml_worker.cli infer-loop"
        log = "$inferLog.out.log"
    }

    $gatewayEnv = Get-Content (Join-Path $root "backend-go\.env") |
        Where-Object { $_ -match "^GATEWAY_TOKEN=" } |
        Select-Object -First 1
    if (-not $gatewayEnv) {
        throw "GATEWAY_TOKEN is missing from backend-go/.env"
    }
    $oldGatewayToken = $env:GATEWAY_TOKEN
    $oldBackendURL = $env:BACKEND_BASE_URL
    $oldPythonPath = $env:PYTHONPATH
    try {
        $env:GATEWAY_TOKEN = ($gatewayEnv -split "=", 2)[1].Trim()
        $env:BACKEND_BASE_URL = "http://127.0.0.1:8081/api/v1"
        $env:PYTHONPATH = Join-Path $root "gateway-rpi\src"
        $arguments = @(
            "-u", "-m", "gateway.cli", "simulate",
            "--config", "config.example.yaml",
            "--scenario", "random-smooth",
            "--duration", "forever",
            "--interval", "10"
        )
        if ($TroubleCycle) {
            $arguments += @(
                "--drop-sensor", "alternate",
                "--drop-after", "60s",
                "--drop-for", "330s",
                "--recover-for", "120s"
            )
        }
        $simulatorLog = Join-Path $logsDir "simulator-$stamp"
        $simulator = Start-Process `
            -FilePath "python" `
            -ArgumentList $arguments `
            -WorkingDirectory (Join-Path $root "gateway-rpi") `
            -WindowStyle Hidden `
            -RedirectStandardOutput "$simulatorLog.out.log" `
            -RedirectStandardError "$simulatorLog.err.log" `
            -PassThru
        $records += [PSCustomObject]@{
            name = "simulator"
            pid = $simulator.Id
            marker = "gateway.cli simulate"
            log = "$simulatorLog.out.log"
        }
    } finally {
        $env:GATEWAY_TOKEN = $oldGatewayToken
        $env:BACKEND_BASE_URL = $oldBackendURL
        $env:PYTHONPATH = $oldPythonPath
    }

    Write-State $records
    Start-Sleep -Seconds 2
    Show-Status
}

function Stop-Services {
    $state = Read-State
    $reversed = @($state)
    [array]::Reverse($reversed)
    foreach ($item in $reversed) {
        $process = Get-LiveProcess $item
        if ($process) {
            Stop-ProcessTree -ProcessId $process.ProcessId
        }
    }
    if (Test-Path -LiteralPath $statePath) {
        Remove-Item -LiteralPath $statePath
    }
    Write-Output "Managed development services stopped."
}

switch ($Action) {
    "start" { Start-Services }
    "stop" { Stop-Services }
    "status" { Show-Status }
}
