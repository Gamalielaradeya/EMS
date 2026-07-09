param(
    [string]$DatabaseUrl = $env:DATABASE_URL
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
    throw "DATABASE_URL is required."
}

$rootDir = Split-Path -Parent $PSScriptRoot
$seedFile = "$rootDir/backend-go/migrations/006_seed_initial_data.sql"

& psql -v ON_ERROR_STOP=1 -f $seedFile $DatabaseUrl

if ($LASTEXITCODE -ne 0) {
    throw "Seed failed."
}
