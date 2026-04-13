# ============================================
# Export Database Functions & Procedures
# ============================================
# Purpose: Export all functions and procedures từ local PostgreSQL
#          để tạo migration files cho Docker container
# Usage: .\scripts\export-database-functions.ps1
# ============================================

param(
    [string]$DatabaseName = "testing_strapi_2",
    [string]$Username = "postgres",
    [string]$DatabaseHost = "127.0.0.1",
    [string]$Port = "5432",
    [string]$OutputDir = ".\database\postgres-functions-procedures"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "EXPORT DATABASE FUNCTIONS & PROCEDURES" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Kiểm tra pg_dump có tồn tại không
$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
if (-not $pgDump) {
    Write-Host "[ERROR] pg_dump not found!" -ForegroundColor Red
    Write-Host "   Please install PostgreSQL client tools" -ForegroundColor Yellow
    Write-Host "   Or add PostgreSQL bin folder to PATH" -ForegroundColor Yellow
    exit 1
}

# Tạo thư mục output nếu chưa có
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
    Write-Host "[OK] Created output directory: $OutputDir" -ForegroundColor Green
}

# Generate migration filename với timestamp
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$outputFile = Join-Path $OutputDir "${timestamp}_exported_functions.sql"

Write-Host "Database Info:" -ForegroundColor Yellow
Write-Host "   Host: $DatabaseHost" -ForegroundColor Gray
Write-Host "   Port: $Port" -ForegroundColor Gray
Write-Host "   Database: $DatabaseName" -ForegroundColor Gray
Write-Host "   Username: $Username" -ForegroundColor Gray
Write-Host ""

Write-Host "Exporting functions and procedures..." -ForegroundColor Yellow

# Export chỉ functions và procedures
# --schema-only: chỉ lấy schema, không lấy data
# --section=pre-data: bỏ qua post-data (indexes, constraints)
# --no-owner: không export owner information
# --no-acl: không export privileges
$env:PGPASSWORD = "123456"  # Thay bằng password của bạn

try {
    # Export functions và procedures
    & pg_dump -h $DatabaseHost -p $Port -U $Username -d $DatabaseName `
        --schema-only `
        --no-owner `
        --no-acl `
        --section=pre-data `
        --section=post-data `
        | Select-String -Pattern "CREATE (FUNCTION|PROCEDURE)" -Context 0,50 `
        | Out-File -FilePath $outputFile -Encoding UTF8

    Write-Host "[SUCCESS] Export completed successfully!" -ForegroundColor Green
    Write-Host "Output file: $outputFile" -ForegroundColor Cyan
    Write-Host ""

    # Hiển thị summary
    $content = Get-Content $outputFile -Raw
    $functionCount = ([regex]::Matches($content, "CREATE FUNCTION")).Count
    $procedureCount = ([regex]::Matches($content, "CREATE PROCEDURE")).Count

    Write-Host "Summary:" -ForegroundColor Yellow
    Write-Host "   Functions: $functionCount" -ForegroundColor Green
    Write-Host "   Procedures: $procedureCount" -ForegroundColor Green
    Write-Host ""

    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "   1. Review file: $outputFile" -ForegroundColor White
    Write-Host "   2. Create proper migration file in database/migrations/" -ForegroundColor White
    Write-Host "   3. Run migration: .\scripts\run-migrations.ps1" -ForegroundColor White
    Write-Host ""

} catch {
    Write-Host "[ERROR] Failed to export database" -ForegroundColor Red
    Write-Host "   $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    # Clear password từ environment
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "EXPORT COMPLETED" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
