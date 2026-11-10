# VESPER - Native PostgreSQL setup for Windows
# ASCII-only PowerShell script. No Docker required.
# Run from the project folder in an elevated PowerShell window.

$ErrorActionPreference = "Stop"
$script:PsqlPath = $null

function Quote-SqlIdentifier {
    param([string]$Value)
    return '"' + $Value.Replace('"', '""') + '"'
}

function Quote-SqlLiteral {
    param([string]$Value)
    return "'" + $Value.Replace("'", "''") + "'"
}

function Invoke-Psql {
    param([string[]]$Arguments)

    & $script:PsqlPath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "psql failed with exit code $LASTEXITCODE"
    }
}

$oldPgPassword = $env:PGPASSWORD
$adminPassword = $null
$dbPassword = $null
$securePassword = $null
$ptr = [IntPtr]::Zero

try {
    Write-Host ""
    Write-Host "=== VESPER POSTGRESQL SETUP (NO DOCKER) ===" -ForegroundColor Cyan

    # Read DATABASE_URL from server\.env
    $envFile = Join-Path $PSScriptRoot "server\.env"
    if (!(Test-Path -LiteralPath $envFile)) {
        throw "server\.env was not found. Run: npm run setup"
    }

    $envText = Get-Content -LiteralPath $envFile -Raw -Encoding UTF8
    $dbUrl = $null

    foreach ($line in ($envText -split "`r?`n")) {
        if ($line -match '^\s*DATABASE_URL\s*=\s*(.*?)\s*$') {
            $dbUrl = $Matches[1].Trim()
            if (($dbUrl.StartsWith('"') -and $dbUrl.EndsWith('"')) -or
                ($dbUrl.StartsWith("'") -and $dbUrl.EndsWith("'"))) {
                $dbUrl = $dbUrl.Substring(1, $dbUrl.Length - 2)
            }
            break
        }
    }

    if ([string]::IsNullOrWhiteSpace($dbUrl)) {
        throw "DATABASE_URL was not found in server\.env"
    }

    $uri = [System.Uri]$dbUrl
    $userInfo = $uri.UserInfo.Split(":", 2)
    if ($userInfo.Count -ne 2) {
        throw "DATABASE_URL must contain username and password"
    }

    $dbUser = [System.Uri]::UnescapeDataString($userInfo[0])
    $dbPassword = [System.Uri]::UnescapeDataString($userInfo[1])
    $dbName = [System.Uri]::UnescapeDataString($uri.AbsolutePath.TrimStart("/"))
    $dbHost = $uri.Host
    $dbPort = $uri.Port

    if ([string]::IsNullOrWhiteSpace($dbUser) -or
        [string]::IsNullOrWhiteSpace($dbPassword) -or
        [string]::IsNullOrWhiteSpace($dbName)) {
        throw "DATABASE_URL has an empty username, password, or database name"
    }

    Write-Host ("Database: " + $dbName)
    Write-Host ("Application user: " + $dbUser)
    Write-Host ("Server: " + $dbHost + ":" + $dbPort)

    # Find and start the PostgreSQL Windows service.
    Write-Host "[1/5] Finding PostgreSQL Windows service..."
    $services = @(Get-Service | Where-Object { $_.Name -like "postgresql*" })
    if ($services.Count -eq 0) {
        throw "No PostgreSQL Windows service was found. Install PostgreSQL first."
    }

    $service = $services | Where-Object { $_.Status -eq "Running" } | Select-Object -First 1
    if ($null -eq $service) {
        $service = $services | Select-Object -First 1
        Start-Service -Name $service.Name
        Start-Sleep -Seconds 3
        $service.Refresh()
        if ($service.Status -ne "Running") {
            throw "Could not start PostgreSQL service: $($service.Name)"
        }
    }
    Write-Host ("Service running: " + $service.Name) -ForegroundColor Green

    # Find psql.exe.
    Write-Host "[2/5] Finding psql.exe..."
    $psqlCommand = Get-Command psql.exe -ErrorAction SilentlyContinue
    if ($psqlCommand) {
        $script:PsqlPath = $psqlCommand.Source
    }
    else {
        $pgRoot = Join-Path $env:ProgramFiles "PostgreSQL"
        $versions = @(Get-ChildItem -LiteralPath $pgRoot -Directory -ErrorAction SilentlyContinue |
            Sort-Object Name -Descending)

        foreach ($version in $versions) {
            $candidate = Join-Path $version.FullName "bin\psql.exe"
            if (Test-Path -LiteralPath $candidate) {
                $script:PsqlPath = $candidate
                break
            }
        }
    }

    if (!$script:PsqlPath) {
        throw "psql.exe was not found. Install PostgreSQL Command Line Tools."
    }
    Write-Host ("Using: " + $script:PsqlPath) -ForegroundColor Green

    # Ask for the PostgreSQL administrator password.
    Write-Host "[3/5] Connecting as PostgreSQL administrator..."
    $securePassword = Read-Host "Enter the password for PostgreSQL user 'postgres'" -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $adminPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    $env:PGPASSWORD = $adminPassword

    Invoke-Psql -Arguments @(
        "-X", "-h", $dbHost, "-p", "$dbPort",
        "-U", "postgres", "-d", "postgres", "-w",
        "-c", "SELECT version();"
    )

    # Create or update the application role. SQL values are escaped before insertion.
    Write-Host "[4/5] Creating or updating application role..."
    $userIdent = Quote-SqlIdentifier $dbUser
    $userLiteral = Quote-SqlLiteral $dbUser
    $passwordLiteral = Quote-SqlLiteral $dbPassword

    if ($dbUser -eq "postgres") {
        $roleSql = "ALTER ROLE $userIdent WITH LOGIN PASSWORD $passwordLiteral;"
    }
    else {
        $roleSql = "DO `$vesper`$ BEGIN " +
            "IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $userLiteral) THEN " +
            "ALTER ROLE $userIdent WITH LOGIN PASSWORD $passwordLiteral; " +
            "ELSE CREATE ROLE $userIdent LOGIN PASSWORD $passwordLiteral; " +
            "END IF; END `$vesper`$;"
    }

    Invoke-Psql -Arguments @(
        "-X", "-h", $dbHost, "-p", "$dbPort",
        "-U", "postgres", "-d", "postgres", "-w",
        "-c", $roleSql
    )

    # Create the database if missing. CREATE DATABASE must run outside a DO block.
    Write-Host "[5/5] Creating database and checking application login..."
    $dbIdent = Quote-SqlIdentifier $dbName
    $dbLiteral = Quote-SqlLiteral $dbName

    $dbExists = & $script:PsqlPath -X -h $dbHost -p "$dbPort" `
        -U postgres -d postgres -w -tA `
        -c "SELECT 1 FROM pg_database WHERE datname = $dbLiteral"

    if ($LASTEXITCODE -ne 0) {
        throw "Could not check whether the database exists"
    }

    if (($dbExists -join "").Trim() -ne "1") {
        Invoke-Psql -Arguments @(
            "-X", "-h", $dbHost, "-p", "$dbPort",
            "-U", "postgres", "-d", "postgres", "-w",
            "-c", "CREATE DATABASE $dbIdent OWNER $userIdent;"
        )
    }
    else {
        Write-Host "Database already exists."
        Invoke-Psql -Arguments @(
            "-X", "-h", $dbHost, "-p", "$dbPort",
            "-U", "postgres", "-d", "postgres", "-w",
            "-c", "ALTER DATABASE $dbIdent OWNER TO $userIdent;"
        )
    }

    # Verify that the exact credentials from DATABASE_URL work.
    $env:PGPASSWORD = $dbPassword
    Invoke-Psql -Arguments @(
        "-X", "-h", $dbHost, "-p", "$dbPort",
        "-U", $dbUser, "-d", $dbName, "-w",
        "-c", "SELECT current_database(), current_user;"
    )

    Write-Host ""
    Write-Host "SUCCESS: PostgreSQL is ready for Vesper." -ForegroundColor Green
    Write-Host "Next commands:"
    Write-Host "  npm run db:validate"
    Write-Host "  npm run db:init"
    Write-Host "  npm run create-admin"
    Write-Host "  npm run dev"
}
catch {
    Write-Host ""
    Write-Host ("ERROR: " + $_.Exception.Message) -ForegroundColor Red
    exit 1
}
finally {
    if ($null -ne $oldPgPassword) {
        $env:PGPASSWORD = $oldPgPassword
    }
    else {
        Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    }

    if ($ptr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }

    $adminPassword = $null
    $dbPassword = $null
}
