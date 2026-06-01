param(
    [string]$DatabaseName = $(if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "ems_thermal_lstm" }),
    [string]$DatabaseUser = $(if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "ems_user" })
)

$ErrorActionPreference = "Stop"
$rootDir = Split-Path -Parent $PSScriptRoot
$seedFile = "$rootDir/backend-go/migrations/006_seed_initial_data.sql"

Push-Location $rootDir

try {
    Get-Content -Raw $seedFile |
        docker compose exec -T postgres psql -U $DatabaseUser -d $DatabaseName -v ON_ERROR_STOP=1

    if ($LASTEXITCODE -ne 0) {
        throw "Seed failed."
    }
}
finally {
    Pop-Location
}
