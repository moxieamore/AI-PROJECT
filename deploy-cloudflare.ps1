# Study Resource Organizer - Cloudflare Pages + D1 deployment helper
# Run from PowerShell after extracting this project ZIP. Does not use TinyFish.
$ErrorActionPreference = 'Stop'
$ProjectName = 'study-resource-organizer'
$DatabaseName = 'study-resource-organizer-db'
$ConfigPath = Join-Path $PSScriptRoot 'wrangler.jsonc'
$SchemaPath = Join-Path $PSScriptRoot 'schema.sql'
$OutputDir = Join-Path $PSScriptRoot 'public'

function Invoke-Wrangler {
    param([Parameter(Mandatory=$true)][string[]]$Arguments)
    & npx wrangler @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Wrangler failed: npx wrangler $($Arguments -join ' ')" }
}

Write-Host "`n=== Study Resource Organizer: Cloudflare deployment ===" -ForegroundColor Cyan
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js LTS is required. Install it, then rerun this script.' }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'npm was not found. Reinstall Node.js LTS with npm enabled.' }
if (-not (Test-Path $ConfigPath) -or -not (Test-Path $SchemaPath) -or -not (Test-Path $OutputDir)) { throw 'Extract the complete ZIP and run this script from the project folder.' }

Push-Location $PSScriptRoot
try {
    Write-Host "`n[1/6] Installing project dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) { throw 'npm install failed.' }

    Write-Host "`n[2/6] Checking Cloudflare login..." -ForegroundColor Yellow
    & npx wrangler whoami
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'A browser will open for Cloudflare sign-in. Never paste your password or API token into chat.' -ForegroundColor Yellow
        Invoke-Wrangler @('login')
        Invoke-Wrangler @('whoami')
    }

    Write-Host "`n[3/6] Existing D1 databases:" -ForegroundColor Yellow
    & npx wrangler d1 list
    if ($LASTEXITCODE -ne 0) { throw 'Could not list D1 databases. Check Cloudflare permissions.' }
    $DatabaseId = Read-Host "Paste the existing ID for '$DatabaseName', or press Enter to create it"
    if ([string]::IsNullOrWhiteSpace($DatabaseId)) {
        $createOutput = & npx wrangler d1 create $DatabaseName 2>&1
        $createOutput | ForEach-Object { Write-Host $_ }
        if ($LASTEXITCODE -ne 0) { throw "D1 creation failed. If it already exists, rerun and paste its ID from 'wrangler d1 list'." }
        $createText = $createOutput | Out-String
        $idMatch = [regex]::Match($createText, 'database_id\s*=\s*"?([0-9a-fA-F-]{20,})"?')
        if (-not $idMatch.Success) { $idMatch = [regex]::Match($createText, '"database_id"\s*:\s*"([0-9a-fA-F-]{20,})"') }
        if (-not $idMatch.Success) { throw "Database may have been created, but ID wasn't parsed. Rerun and paste it from 'wrangler d1 list'." }
        $DatabaseId = $idMatch.Groups[1].Value
    }
    if ($DatabaseId -notmatch '^[0-9a-fA-F-]{20,}$') { throw 'Database ID format looks invalid. Rerun and paste the ID shown by Wrangler.' }

    $Config = Get-Content -Raw $ConfigPath | ConvertFrom-Json
    $Config.d1_databases[0].database_name = $DatabaseName
    $Config.d1_databases[0].database_id = $DatabaseId
    $Config | ConvertTo-Json -Depth 20 | Set-Content -Path $ConfigPath -Encoding utf8

    Write-Host "`n[4/6] Applying schema and starter rows to REMOTE D1..." -ForegroundColor Yellow
    Write-Host 'This script does not drop tables or delete existing records.'
    Invoke-Wrangler @('d1','execute',$DatabaseName,'--remote','--file',$SchemaPath)

    Write-Host "`n[5/6] Checking Pages projects..." -ForegroundColor Yellow
    $projectList = & npx wrangler pages project list 2>&1
    $projectList | ForEach-Object { Write-Host $_ }
    if ($LASTEXITCODE -ne 0) { throw 'Could not list Pages projects.' }
    if (($projectList | Out-String) -notmatch [regex]::Escape($ProjectName)) {
        Invoke-Wrangler @('pages','project','create',$ProjectName,'--production-branch','main')
    } else { Write-Host "Reusing existing Pages project '$ProjectName'." -ForegroundColor Green }

    Write-Host "`n[6/6] Deploying Pages assets and Functions..." -ForegroundColor Yellow
    $deployOutput = & npx wrangler pages deploy $OutputDir --project-name $ProjectName --branch main --config $ConfigPath 2>&1
    $deployOutput | ForEach-Object { Write-Host $_ }
    if ($LASTEXITCODE -ne 0) { throw 'Deployment failed. Review the Wrangler error above.' }
    $deployText = $deployOutput | Out-String
    $urlMatch = [regex]::Match($deployText, 'https://[A-Za-z0-9.-]+\.pages\.dev')
    if ($urlMatch.Success) {
        $SiteUrl = $urlMatch.Value.TrimEnd('/')
        foreach ($Path in @('/api/health','/api/resources')) {
            try {
                $Response = Invoke-WebRequest -Uri ($SiteUrl + $Path) -Method Get -TimeoutSec 30
                Write-Host "$Path -> HTTP $($Response.StatusCode)" -ForegroundColor Green
                Write-Host $Response.Content
            } catch { Write-Warning "Could not verify $Path automatically: $($_.Exception.Message)" }
        }
        Write-Host "`nSite URL: $SiteUrl" -ForegroundColor Cyan
    } else { Write-Host 'Deployment command completed. Use the *.pages.dev URL shown above to test /api/health and /api/resources.' -ForegroundColor Green }
    Write-Host "`nSecurity: this demo has no authentication; do not store private institutional data until access control is added." -ForegroundColor Yellow
} finally { Pop-Location }
