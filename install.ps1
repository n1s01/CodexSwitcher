#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$repo = "n1s01/CodexSwitcher"
$tmp = Join-Path $env:TEMP "codexswitcher-install"
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

Write-Host "==> CodexSwitcher installer" -ForegroundColor Cyan

$arch = if ([Environment]::Is64BitOperatingSystem) { "x64" } else { "x86" }
Write-Host "    Arch: $arch"

if ($arch -eq "x86") {
    Write-Host "32-bit Windows is not supported. Please use a 64-bit system." -ForegroundColor Red
    exit 1
}

Write-Host "--> Fetching latest release info..." -ForegroundColor Cyan
try {
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/latest" -Method Get
} catch {
    Write-Host "Failed to fetch release info: $_" -ForegroundColor Red
    exit 1
}

$tag = $release.tag_name
$suffix = "_${arch}-setup.exe"
$asset = $release.assets | Where-Object { $_.name -like "*$suffix" } | Select-Object -First 1

if (-not $asset) {
    $suffix = "_${arch}_en-US.msi"
    $asset = $release.assets | Where-Object { $_.name -like "*$suffix" } | Select-Object -First 1
}

if (-not $asset) {
    Write-Host "No matching installer found. Available assets:" -ForegroundColor Red
    $release.assets | ForEach-Object { Write-Host "  $($_.name)" }
    exit 1
}

$assetName = $asset.name
$assetUrl = $asset.browser_download_url

Write-Host "--> Latest: $tag -> $assetName" -ForegroundColor Cyan
Write-Host "--> Downloading $assetName ..." -ForegroundColor Cyan

$installerPath = Join-Path $tmp $assetName
Invoke-WebRequest -Uri $assetUrl -OutFile $installerPath

Write-Host "--> Running installer..." -ForegroundColor Cyan
Start-Process -FilePath $installerPath -Wait -ArgumentList "/S"

Write-Host "Installed." -ForegroundColor Green

Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
