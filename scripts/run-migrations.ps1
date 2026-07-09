param(
    [string]$DatabaseUrl = $env:DATABASE_URL
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
    throw "DATABASE_URL is required."
}

$rootDir = Split-Path -Parent $PSScriptRoot
$migrations = Get-ChildItem -Path "$rootDir/backend-go/migrations" -Filter "*.sql" |
    Sort-Object Name

foreach ($migration in $migrations) {
    Write-Host "Applying $($migration.Name)"
    & psql -v ON_ERROR_STOP=1 -f $migration.FullName $DatabaseUrl

    if ($LASTEXITCODE -ne 0) {
        throw "Migration failed: $($migration.Name)"
    }
}
