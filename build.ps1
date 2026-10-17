param (
    [switch]$KeepKey = $false
)

$ErrorActionPreference = "Stop"

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "  Google Photos Tim Tools - Release Builder" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

$rootDir = $PSScriptRoot
$distDir = Join-Path $rootDir "dist"
$tempDir = Join-Path $distDir "build_temp"

# 1. Read manifest.json
$manifestPath = Join-Path $rootDir "manifest.json"
if (-not (Test-Path $manifestPath)) {
    Write-Error "manifest.json not found in $rootDir"
}

$manifestContent = Get-Content $manifestPath -Raw | ConvertFrom-Json
$version = $manifestContent.version
Write-Host "[1/5] Read manifest (Version: v$version)..." -ForegroundColor Green

# 2. Prepare dist directories
if (Test-Path $tempDir) {
    Remove-Item $tempDir -Recurse -Force
}
if (-not (Test-Path $distDir)) {
    New-Item -ItemType Directory -Path $distDir -Force | Out-Null
}
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

Write-Host "[2/5] Copying extension files to clean build folder..." -ForegroundColor Green

# Copy src/ directory
Copy-Item (Join-Path $rootDir "src") -Destination (Join-Path $tempDir "src") -Recurse -Force

# Copy assets/icons/
$targetIconsDir = Join-Path $tempDir "assets\icons"
New-Item -ItemType Directory -Path $targetIconsDir -Force | Out-Null
Copy-Item (Join-Path $rootDir "assets\icons\*") -Destination $targetIconsDir -Force

# Copy assets/logo/ (only PNG icons, omit PSD and other formats)
$targetLogoDir = Join-Path $tempDir "assets\logo"
New-Item -ItemType Directory -Path $targetLogoDir -Force | Out-Null
Get-ChildItem (Join-Path $rootDir "assets\logo") -Filter "*.png" | ForEach-Object {
    Copy-Item $_.FullName -Destination $targetLogoDir -Force
}

# 3. Process manifest.json (strip 'key' unless -KeepKey is explicitly passed)
Write-Host "[3/5] Processing manifest.json..." -ForegroundColor Green
$targetManifest = Get-Content $manifestPath -Raw | ConvertFrom-Json

if (-not $KeepKey -and ($targetManifest.PSObject.Properties['key'])) {
    $targetManifest.PSObject.Properties.Remove('key')
    Write-Host "      Removed 'key' field for clean Chrome Web Store submission." -ForegroundColor Yellow
}

$processedManifestPath = Join-Path $tempDir "manifest.json"
$targetManifest | ConvertTo-Json -Depth 10 | Set-Content $processedManifestPath -Encoding UTF8

# 4. Create ZIP package
$zipFileName = "GooglePhotos-TimTools-v$version.zip"
$zipFilePath = Join-Path $distDir $zipFileName

if (Test-Path $zipFilePath) {
    Remove-Item $zipFilePath -Force
}

Write-Host "[4/5] Packing into ZIP archive: $zipFileName..." -ForegroundColor Green

# Use Compress-Archive
Compress-Archive -Path "$tempDir\*" -DestinationPath $zipFilePath -CompressionLevel Optimal

# Cleanup temporary build folder
Remove-Item $tempDir -Recurse -Force

# 5. Output Summary
$zipSizeKb = [math]::Round(((Get-Item $zipFilePath).Length / 1KB), 2)
Write-Host "[5/5] Success! Archive created at:" -ForegroundColor Cyan
Write-Host "      $zipFilePath ($zipSizeKb KB)" -ForegroundColor White
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "Ready for Chrome Web Store Developer Dashboard!" -ForegroundColor Green
Write-Host "Store description: ChromeWebStore_Description.txt" -ForegroundColor Gray
Write-Host "Promo images:      assets\promo-materials\" -ForegroundColor Gray

