param(
    [string]$DatabaseName = $(if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "ems_thermal_lstm" }),
    [string]$DatabaseUser = $(if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "ems_user" })
)

$ErrorActionPreference = "Stop"
$rootDir = Split-Path -Parent $PSScriptRoot
$migrations = Get-ChildItem -Path "$rootDir/backend-go/migrations" -Filter "*.sql" |
    Sort-Object Name

Push-Location $rootDir

try {
    foreach ($migration in $migrations) {
        Write-Host "Applying $($migration.Name)"
        Get-Content -Raw $migration.FullName |
            docker compose exec -T postgres psql -U $DatabaseUser -d $DatabaseName -v ON_ERROR_STOP=1

        if ($LASTEXITCODE -ne 0) {
            throw "Migration failed: $($migration.Name)"
        }
    }
}
finally {
    Pop-Location
}
