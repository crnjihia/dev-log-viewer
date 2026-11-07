# path: scripts/profile_benchmarks.ps1
<#
.SYNOPSIS
    Automated Performance Profiling Script for Dev Log Viewer (logcore).
.DESCRIPTION
    Builds release binaries, generates realistic test log datasets (Kenyan fintech / Africa's Talking payloads),
    and measures:
      1. Time to First Paint (< 1000ms SLA target)
      2. Parallel indexing throughput (MB/s) and bounded memory consumption
      3. Linear-time regex search throughput (MB/s)
      4. Structured JSON query throughput (MB/s)
    Optionally executes hyperfine benchmark suites and collects peak WorkingSet memory metrics.
.PARAMETER OutputDir
    Directory where test datasets and reports will be saved. Default: ".\target\bench-data"
.PARAMETER Sizes
    Array of dataset sizes to profile. Allowed: "100MB", "1GB", "5GB", "20GB". Default: @("100MB", "1GB")
.PARAMETER SkipGeneration
    Skip dataset generation if target log files already exist.
.PARAMETER RunHyperfine
    Run statistical benchmarking with hyperfine if available on system PATH.
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\scripts\profile_benchmarks.ps1 -Sizes @("100MB", "1GB")
#>

[CmdletBinding()]
param(
    [string]$OutputDir = ".\target\bench-data",
    [string[]]$Sizes = @("100MB", "1GB"),
    [switch]$SkipGeneration,
    [switch]$RunHyperfine
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "  Dev Log Viewer Performance Profiling Suite (PowerShell)" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan

# 1. Verify and compile binaries
Write-Host "`n[1/4] Compiling binaries (loggen & bench_harness)..." -ForegroundColor Yellow
$BuildRelease = $true
try {
    cargo build --release --bin bench_harness --bin loggen
    if ($LASTEXITCODE -ne 0) {
        $BuildRelease = $false
    }
} catch {
    $BuildRelease = $false
}

if (-not $BuildRelease) {
    Write-Warning "Release build did not complete. Falling back to debug profile..."
    cargo build --bin bench_harness --bin loggen
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to build binaries."
        exit 1
    }
}

$ProfileDir = if ($BuildRelease -and (Test-Path ".\target\release\bench_harness.exe") -and (Test-Path ".\target\release\loggen.exe")) { "release" } else { "debug" }
$LoggenExe = ".\target\$ProfileDir\loggen.exe"
$BenchHarnessExe = ".\target\$ProfileDir\bench_harness.exe"
Write-Host "Active binary profile: target\$ProfileDir" -ForegroundColor Green

# 2. Ensure output directory
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
}

$HasHyperfine = $false
if ($RunHyperfine) {
    $HyperfineCmd = Get-Command "hyperfine" -ErrorAction SilentlyContinue
    if ($null -ne $HyperfineCmd) {
        $HasHyperfine = $true
        Write-Host "Hyperfine detected at: $($HyperfineCmd.Source)" -ForegroundColor Green
    } else {
        Write-Warning "hyperfine was requested but not found in PATH. Skipping hyperfine runs."
    }
}

# 3. Process each requested dataset size
$Results = @()

foreach ($size in $Sizes) {
    Write-Host "`n-------------------------------------------------------" -ForegroundColor Cyan
    Write-Host "Benchmarking Dataset Size: $size" -ForegroundColor Cyan
    Write-Host "-------------------------------------------------------" -ForegroundColor Cyan

    $LogFile = Join-Path $OutputDir "bench_${size}.log"

    # Dataset generation
    if (-not (Test-Path $LogFile) -or (-not $SkipGeneration)) {
        Write-Host "Generating $size mixed test log at $LogFile..." -ForegroundColor Yellow
        $genStart = [System.Diagnostics.Stopwatch]::StartNew()
        & $LoggenExe --size $size --format mixed --output $LogFile
        $genStart.Stop()
        Write-Host ("Generation completed in {0:N2}s" -f $genStart.Elapsed.TotalSeconds) -ForegroundColor Green
    } else {
        Write-Host "Found existing dataset at $LogFile. Skipping generation." -ForegroundColor Gray
    }

    $FileItem = Get-Item $LogFile
    $FileSizeMb = [Math]::Round($FileItem.Length / 1MB, 2)
    Write-Host "File verified: $($FileItem.FullName) ($FileSizeMb MB)" -ForegroundColor Gray

    # Run bench_harness in JSON mode to collect exact machine numbers
    Write-Host "Executing bench_harness profiling runs..." -ForegroundColor Yellow
    $harnessOutputJson = & $BenchHarnessExe --file $LogFile --action all --json | Out-String
    
    $benchMetrics = $null
    try {
        $benchMetrics = $harnessOutputJson | ConvertFrom-Json
    } catch {
        Write-Warning "Could not parse JSON output from bench_harness. Raw output:"
        Write-Host $harnessOutputJson
    }

    # Run bench_harness in human-readable mode for terminal feedback
    & $BenchHarnessExe --file $LogFile --action all

    # Measure WorkingSet memory with Get-Process
    $proc = Start-Process -FilePath $BenchHarnessExe -ArgumentList "--file `"$LogFile`" --action index" -PassThru -NoNewWindow
    $peakWs = 0
    while (-not $proc.HasExited) {
        try {
            $proc.Refresh()
            if ($proc.WorkingSet64 -gt $peakWs) {
                $peakWs = $proc.WorkingSet64
            }
        } catch {}
        Start-Sleep -Milliseconds 10
    }
    $peakWsMb = [Math]::Round($peakWs / 1MB, 2)
    Write-Host ("Peak Process WorkingSet during indexation: {0:N2} MB" -f $peakWsMb) -ForegroundColor Magenta

    # Optional Hyperfine statistical timing
    $hfFirstPaint = "N/A"
    $hfIndex = "N/A"
    if ($HasHyperfine) {
        Write-Host "`nRunning Hyperfine statistical benchmark for First Paint..." -ForegroundColor Yellow
        & hyperfine --warmup 2 --runs 5 "$BenchHarnessExe --file `"$LogFile`" --action first-paint"
        
        Write-Host "`nRunning Hyperfine statistical benchmark for Indexing..." -ForegroundColor Yellow
        & hyperfine --warmup 1 --runs 3 "$BenchHarnessExe --file `"$LogFile`" --action index"
    }

    if ($null -ne $benchMetrics) {
        $Results += [PSCustomObject]@{
            Size                = $size
            FileSizeBytes       = $benchMetrics.size_bytes
            FileSizeMB          = $benchMetrics.size_mb
            TotalLines          = $benchMetrics.total_lines
            FirstPaintMs        = [Math]::Round($benchMetrics.first_paint_ms, 3)
            FirstPaintSLA       = if ($benchMetrics.first_paint_ms -lt 1000.0) { "PASS (<1s)" } else { "FAIL" }
            IndexTimeS          = [Math]::Round($benchMetrics.index_time_s, 3)
            IndexThroughputMBs  = [Math]::Round($benchMetrics.index_throughput_mb_s, 2)
            SparseIndexHeapMB   = [Math]::Round($benchMetrics.index_heap_bytes / 1MB, 3)
            PeakWorkingSetMB    = $peakWsMb
            RegexThroughputMBs  = [Math]::Round($benchMetrics.regex_throughput_mb_s, 2)
            JsonThroughputMBs   = [Math]::Round($benchMetrics.json_throughput_mb_s, 2)
        }
    }
}

# 4. Generate Output Report
Write-Host "`n=======================================================" -ForegroundColor Cyan
Write-Host "           BENCHMARK EXECUTION SUMMARY" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan

if ($Results.Count -gt 0) {
    $Results | Format-Table -AutoSize -Property Size, FileSizeMB, TotalLines, FirstPaintMs, FirstPaintSLA, IndexThroughputMBs, SparseIndexHeapMB, PeakWorkingSetMB, RegexThroughputMBs, JsonThroughputMBs

    $ReportPath = Join-Path $OutputDir "benchmark_run_latest.json"
    $Results | ConvertTo-Json -Depth 4 | Set-Content -Path $ReportPath -Encoding utf8
    Write-Host "Raw JSON metrics written to: $ReportPath" -ForegroundColor Green
}

Write-Host "`nProfiling run completed successfully." -ForegroundColor Green

