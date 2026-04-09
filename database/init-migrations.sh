#!/bin/sh
# ============================================
# 🚀 Auto-run Database Migrations
# ============================================
# This script runs automatically when postgres container starts
# It will execute all pending migrations from /docker-entrypoint-initdb.d/
# ============================================

set -e

echo "=========================================="
echo "🔍 Checking for pending migrations..."
echo "=========================================="

# Wait for PostgreSQL to be ready
until pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"; do
  echo "⏳ Waiting for PostgreSQL to be ready..."
  sleep 2
done

echo "✅ PostgreSQL is ready!"
echo ""

# Tạo bảng schema_migrations nếu chưa có
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      migration_name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP DEFAULT NOW(),
      execution_time_ms INTEGER,
      status VARCHAR(50) DEFAULT 'SUCCESS'
  );
EOSQL

echo "✅ Schema migrations table ready"
echo ""

# Run all migration files
MIGRATION_DIR="/docker-entrypoint-initdb.d/migrations"

if [ -d "$MIGRATION_DIR" ]; then
    for migration_file in "$MIGRATION_DIR"/*.sql; do
        if [ -f "$migration_file" ]; then
            migration_name=$(basename "$migration_file" .sql)
            
            # Check if migration already executed
            already_executed=$(psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -t -c \
                "SELECT COUNT(*) FROM schema_migrations WHERE migration_name = '$migration_name';")
            
            if [ "$already_executed" -eq 0 ]; then
                echo "🚀 Running migration: $migration_name"
                start_time=$(date +%s%3N)
                
                if psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$migration_file"; then
                    end_time=$(date +%s%3N)
                    execution_time=$((end_time - start_time))
                    
                    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
                        INSERT INTO schema_migrations (migration_name, executed_at, execution_time_ms, status)
                        VALUES ('$migration_name', NOW(), $execution_time, 'SUCCESS');
EOSQL
                    echo "✅ Migration completed: $migration_name ($execution_time ms)"
                else
                    echo "❌ Migration failed: $migration_name"
                    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
                        INSERT INTO schema_migrations (migration_name, executed_at, status)
                        VALUES ('$migration_name', NOW(), 'FAILED')
                        ON CONFLICT (migration_name) DO UPDATE SET status = 'FAILED';
EOSQL
                fi
            else
                echo "⏭️  Skipping (already executed): $migration_name"
            fi
        fi
    done
else
    echo "⚠️  No migrations directory found: $MIGRATION_DIR"
fi

echo ""
echo "=========================================="
echo "✅ Migration check completed"
echo "=========================================="
