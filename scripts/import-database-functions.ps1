# ============================================
# Run Database Migrations
# ============================================
# Purpose: Chạy tất cả migration files vào PostgreSQL container
# Usage: .\scripts\run-migrations.ps1
# ============================================

param(
    [string]$ContainerName = "strapi_postgres",
    [string]$DatabaseName = "testing_strapi_2",
    [string]$Username = "postgres",
    [string]$MigrationsDir = ".\database\postgres-functions-procedures",
    [switch]$Force,
    [switch]$Rollback
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "DATABASE MIGRATIONS RUNNER" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Kiểm tra Docker container có đang chạy không
Write-Host "Checking Docker container..." -ForegroundColor Yellow
$containerStatus = docker ps --filter "name=$ContainerName" --format "{{.Status}}"

if (-not $containerStatus) {
    Write-Host "[ERROR] Container '$ContainerName' is not running!" -ForegroundColor Red
    Write-Host "   Start it with: docker-compose up -d postgres" -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] Container is running: $containerStatus" -ForegroundColor Green
Write-Host ""

# Kiểm tra thư mục migrations
if (-not (Test-Path $MigrationsDir)) {
    Write-Host "[ERROR] Migrations directory not found: $MigrationsDir" -ForegroundColor Red
    exit 1
}

# Lấy danh sách migration files (*.sql)
$migrationFiles = Get-ChildItem -Path $MigrationsDir -Filter "*.sql" | Sort-Object Name

if ($migrationFiles.Count -eq 0) {
    Write-Host "[WARNING] No migration files found in: $MigrationsDir" -ForegroundColor Yellow
    exit 0
}

Write-Host "Found $($migrationFiles.Count) migration file(s):" -ForegroundColor Cyan
foreach ($file in $migrationFiles) {
    Write-Host "   - $($file.Name)" -ForegroundColor Gray
}
Write-Host ""

# Tạo bảng schema_migrations nếu chưa có
Write-Host "Ensuring schema_migrations table exists..." -ForegroundColor Yellow
$createTableSQL = @"
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) NOT NULL UNIQUE,
    executed_at TIMESTAMP DEFAULT NOW(),
    execution_time_ms INTEGER,
    status VARCHAR(50) DEFAULT 'SUCCESS'
);
"@

docker exec -i $ContainerName psql -U $Username -d $DatabaseName -c $createTableSQL 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Schema migrations table ready" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Failed to create schema_migrations table" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Run migrations
$successCount = 0
$skippedCount = 0
$failedCount = 0

foreach ($file in $migrationFiles) {
    $migrationName = $file.BaseName
    
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
    Write-Host "Processing: $migrationName" -ForegroundColor Cyan
    
    # Kiểm tra migration đã chạy chưa
    if (-not $Force) {
        $checkSQL = "SELECT COUNT(*) FROM schema_migrations WHERE migration_name = '$migrationName';"
        $result = docker exec -i $ContainerName psql -U $Username -d $DatabaseName -t -c $checkSQL 2>&1
        
        if ($result -match '\s*1\s*') {
            Write-Host "[SKIPPED] Already executed" -ForegroundColor Yellow
            $skippedCount++
            continue
        }
    }
    
    # Đọc nội dung SQL file
    $sqlContent = Get-Content $file.FullName -Raw -Encoding UTF8
    
    # Thực thi migration
    Write-Host "Executing migration..." -ForegroundColor Yellow
    $startTime = Get-Date
    
    try {
        $output = $sqlContent | docker exec -i $ContainerName psql -U $Username -d $DatabaseName 2>&1
        $endTime = Get-Date
        $executionTime = [int](($endTime - $startTime).TotalMilliseconds)
        
        if ($LASTEXITCODE -eq 0) {
            # Log successful migration
            $logSQL = @"
INSERT INTO schema_migrations (migration_name, executed_at, execution_time_ms, status)
VALUES ('$migrationName', NOW(), $executionTime, 'SUCCESS')
ON CONFLICT (migration_name) DO UPDATE
SET executed_at = NOW(), execution_time_ms = $executionTime, status = 'SUCCESS';
"@
            docker exec -i $ContainerName psql -U $Username -d $DatabaseName -c $logSQL 2>&1 | Out-Null
            
            Write-Host "[SUCCESS] ($executionTime ms)" -ForegroundColor Green
            $successCount++
        } else {
            throw "Migration failed with exit code: $LASTEXITCODE"
        }
    } catch {
        Write-Host "[FAILED] $($_.Exception.Message)" -ForegroundColor Red
        if ($output) {
            Write-Host "   Output: $output" -ForegroundColor Red
        }
        $failedCount++
        
        # Log failed migration
        $logSQL = @"
INSERT INTO schema_migrations (migration_name, executed_at, status)
VALUES ('$migrationName', NOW(), 'FAILED')
ON CONFLICT (migration_name) DO UPDATE
SET executed_at = NOW(), status = 'FAILED';
"@
        docker exec -i $ContainerName psql -U $Username -d $DatabaseName -c $logSQL 2>&1 | Out-Null
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "MIGRATION SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "[OK] Success:  $successCount" -ForegroundColor Green
Write-Host "[SKIP] Skipped:  $skippedCount" -ForegroundColor Yellow
Write-Host "[FAIL] Failed:   $failedCount" -ForegroundColor Red
Write-Host "Total:    $($migrationFiles.Count)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Exit code
if ($failedCount -gt 0) {
    exit 1
} else {
    exit 0
}
