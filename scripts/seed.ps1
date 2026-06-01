param(
    [string]$DatabaseUrl = $env:DATABASE_URL
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
    throw "DATABASE_URL is required."
}

$rootDir = Split-Path -Parent $PSScriptRoot
$seedFile = "$rootDir/backend-go/migrations/006_seed_initial_data.sql"

& psql $DatabaseUrl -v ON_ERROR_STOP=1 -f $seedFile

if ($LASTEXITCODE -ne 0) {
    throw "Seed failed."
}
