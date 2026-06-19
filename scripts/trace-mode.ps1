param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet("normal", "debug")]
    [string]$Mode,

    [int]$DebugMinutes = 15
)

$root = Split-Path $PSScriptRoot -Parent
$composeFile = Join-Path $root "docker-compose.yml"
$dir = Join-Path $root "monitoring\otel-collector"
$active = Join-Path $dir "otel-collector-config.yaml"
$source = Join-Path $dir "otel-collector-config.$Mode.yaml"

if (-not (Test-Path $source)) {
    Write-Error "Config not found: $source"
    exit 1
}

Copy-Item $source $active -Force
docker compose -f $composeFile restart otel-collector

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to restart otel-collector"
    exit 1
}

Write-Host ""
Write-Host "Trace mode: $Mode" -ForegroundColor Green
if ($Mode -eq "normal") {
    Write-Host "  - errors: 100%"
    Write-Host "  - slow (>1000ms): 100%"
    Write-Host "  - normal traffic: 5%"
} else {
    Write-Host "  - all traces: 100%"
    if ($DebugMinutes -gt 0) {
        Write-Host "  - auto-revert to normal in $DebugMinutes minute(s)"
    }
}
Write-Host ""

Start-Sleep -Seconds 2
docker logs otel-collector --tail 8

if ($Mode -eq "debug" -and $DebugMinutes -gt 0) {
    $revertScript = Join-Path $env:TEMP "trace-mode-revert.ps1"
    @"
`$root = '$root'
`$composeFile = Join-Path `$root 'docker-compose.yml'
`$dir = Join-Path `$root 'monitoring\otel-collector'
Copy-Item (Join-Path `$dir 'otel-collector-config.normal.yaml') (Join-Path `$dir 'otel-collector-config.yaml') -Force
docker compose -f `$composeFile restart otel-collector
Write-Host 'Trace mode reverted to: normal' -ForegroundColor Yellow
"@ | Set-Content $revertScript -Encoding UTF8

    Start-Process powershell -WindowStyle Hidden -ArgumentList @(
        "-NoProfile",
        "-Command",
        "Start-Sleep -Seconds $($DebugMinutes * 60); & '$revertScript'"
    )
}
