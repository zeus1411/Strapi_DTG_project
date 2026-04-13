# 🎯 WORKFLOW SUMMARY - Đã Hiểu Chưa?

## ✅ ĐÃ HOÀN THÀNH

1. ✅ Export từ local DB thành công
2. ✅ Tạo migration file chuẩn: `002_category_functions.sql`
3. ✅ Sẵn sàng chạy migration vào container

---

## 📖 TRẢ LỜI CÂU HỎI CỦA BẠN

### Q1: "Export truy cập vào đâu?"

```
Local Computer (127.0.0.1:5432)
       ↓
   pgAdmin4 Database: testing_strapi_2
       ↓
   [export-database-functions.ps1]
       ↓
   File: database/migrations/xxx_exported_functions.sql
```

**Giải thích**: 
- Script `export-database-functions.ps1` connect vào **LOCAL PostgreSQL** (127.0.0.1)
- Database: `testing_strapi_2` (database bạn đang dùng trong pgAdmin4)
- Lấy tất cả functions/procedures và export ra file `.sql`

---

### Q2: "Khi phát sinh function mới thì dùng export script?"

**Trả lời**: CÓ **2 CÁCH**, tùy tình huống:

#### 🔹 CÁCH 1: Export từ Local DB (LẦN ĐẦU hoặc MỚI VÀO PROJECT)

```powershell
# Khi nào dùng:
# - Lần đầu setup project
# - Bạn có sẵn functions trong local DB
# - Import hàng loạt functions

# Bước 1: Export
.\scripts\export-database-functions.ps1

# Bước 2: Cleanup file exported (xóa ký tự lỗi, format)
# Bước 3: Rename thành 00X_descriptive_name.sql
# Bước 4: Run migration
.\scripts\import-database-functions.ps1
```

#### 🔹 CÁCH 2: Viết Migration Trực Tiếp (HÀNG NGÀY)

```powershell
# Khi nào dùng:
# - Thêm function mới trong quá trình phát triển
# - Sửa function hiện có
# - Working daily với team

# Bước 1: Tạo file migration mới (MANUAL)
# database/migrations/003_user_statistics.sql

# Bước 2: Viết SQL (MANUAL - copy từ pgAdmin hoặc viết mới)

# Bước 3: Run migration
.\scripts\import-database-functions.ps1

# Bước 4: Commit
git add database/migrations/003_user_statistics.sql
git commit -m "feat: add user statistics"
```

**RECOMMENDED**: Dùng **CÁCH 2** cho daily work vì:
- ✅ Kiểm soát tốt hơn
- ✅ Không cần cleanup file exported
- ✅ Version control rõ ràng

---

### Q3: "File import-database-functions.ps1 dùng để làm gì?"

**Trả lời**: 

```
database/migrations/
    ├── 001_initial_functions_procedures.sql
    ├── 002_category_functions.sql
    └── 003_xxx.sql
         ↓
   [import-database-functions.ps1]  ← SCRIPT NÀY
         ↓
   Docker Container: strapi_postgres
         ↓
   Database: strapi (trong container)
```

**Chức năng**:
1. Đọc **TẤT CẢ** file `.sql` trong `database/migrations/`
2. Check xem migration nào đã chạy (bảng `schema_migrations`)
3. Chạy những migration **CHƯA execute**
4. Log kết quả vào `schema_migrations` table

**Khi nào dùng**:
- ✅ Sau khi tạo migration file mới
- ✅ Khi cần re-run migrations (với flag `-Force`)
- ✅ Manual trigger migration (không chờ container restart)

---

### Q4: "Container start thì auto migration?"

**Trả lời**: ✅ **ĐÚNG!**

```
docker-compose up -d
      ↓
Container: strapi_postgres starts
      ↓
Auto-run: /docker-entrypoint-initdb.d/00-init-migrations.sh
      ↓
Script reads: /docker-entrypoint-initdb.d/migrations/*.sql
      ↓
Execute pending migrations
      ↓
✅ Done!
```

**Cơ chế**:
- File `database/init-migrations.sh` được mount vào container
- PostgreSQL Docker image tự động chạy scripts trong `/docker-entrypoint-initdb.d/`
- Script check `schema_migrations` table
- Chỉ chạy migrations **CHƯA execute**

**Điều kiện**: Container phải **restart** để trigger

---

### Q5: "Migration dựa vào file OPTIMIZED_PROCEDURES_TABLE_VERSION?"

**Trả lời**: ❌ **KHÔNG!**

```
❌ KHÔNG SỬ DỤNG:
   database/OPTIMIZED_PROCEDURES_TABLE_VERSION.sql  ← File cũ, legacy

✅ SỬ DỤNG:
   database/migrations/
      ├── 001_initial_functions_procedures.sql     ← Migration 1
      ├── 002_category_functions.sql               ← Migration 2
      └── 003_xxx.sql                              ← Migration 3...
```

**Giải thích**:
- File `OPTIMIZED_PROCEDURES_TABLE_VERSION.sql` là file **CŨ**, không phải migration
- Hệ thống migration **CHỈ ĐỌC** thư mục `database/migrations/`
- Tất cả file `.sql` trong migrations folder sẽ được execute theo **thứ tự alphabet**

**Thứ tự execute**: 001 → 002 → 003 → ...

---

## 🚀 CÁC BƯỚC TIẾP THEO (BÂY GIỜ)

### Bước 1: Xóa file export thô (không cần nữa)

```powershell
# File này đã cleanup thành 002_category_functions.sql
Remove-Item "database\migrations\20260115_154554_exported_functions.sql"
```

### Bước 2: Start/Restart Docker containers

```powershell
# Nếu container chưa chạy
docker-compose up -d

# Nếu container đang chạy (cần restart để trigger migration)
docker-compose restart postgres
```

### Bước 3: Hoặc Run migration manually

```powershell
# Chạy migrations ngay lập tức (không cần restart)
.\scripts\import-database-functions.ps1
```

### Bước 4: Verify migrations đã chạy

```powershell
# Check migration status
docker exec -it strapi_postgres psql -U strapi -d strapi -c "SELECT * FROM schema_migrations ORDER BY executed_at;"

# Check functions exist
docker exec -it strapi_postgres psql -U strapi -d strapi -c "\df"

# Test function
docker exec -it strapi_postgres psql -U strapi -d strapi -c "SELECT * FROM get_category_report();"
```

### Bước 5: Commit to Git

```powershell
git add database/migrations/002_category_functions.sql
git commit -m "feat: add category functions and procedures"
git push
```

---

## 🎓 WORKFLOW TỔNG KẾT

### Workflow Hàng Ngày (Thêm Function Mới)

```
1. Viết SQL trong pgAdmin4 (local) và test
          ↓
2. Copy SQL vào file migration mới
   database/migrations/003_new_feature.sql
          ↓
3. Run migration vào container
   .\scripts\import-database-functions.ps1
          ↓
4. Test function trong container
   docker exec ... psql ... -c "SELECT ..."
          ↓
5. Commit to Git
   git add, git commit, git push
          ↓
6. Đồng đội pull code
          ↓
7. Đồng đội restart container
   docker-compose restart postgres
          ↓
8. ✅ Migration tự động chạy
          ↓
9. ✅ Đồng đội có function mới
```

---

## 📊 SO SÁNH 2 CÁCH

| Tiêu chí | Export Script | Viết Trực Tiếp |
|----------|--------------|----------------|
| **Tốc độ** | Nhanh (auto) | Chậm (manual) |
| **Kiểm soát** | Thấp | Cao |
| **Cleanup** | Cần | Không cần |
| **Use case** | Lần đầu, bulk import | Daily work |
| **Recommended** | ❌ Chỉ khi cần | ✅ Preferred |

---

## ⚠️ LƯU Ý QUAN TRỌNG

### 1. File OPTIMIZED_PROCEDURES_TABLE_VERSION.sql

```powershell
# File này LÀ GÌ?
# - File SQL cũ, legacy
# - Không phải migration file
# - Có thể XÓA hoặc giữ làm backup

# Nên làm gì?
# Option 1: Xóa (vì đã có migrations)
Remove-Item database\OPTIMIZED_PROCEDURES_TABLE_VERSION.sql

# Option 2: Rename làm backup
Rename-Item database\OPTIMIZED_PROCEDURES_TABLE_VERSION.sql database\BACKUP_old_procedures.sql
```

### 2. Naming Convention

```
✅ GOOD:
001_initial_functions_procedures.sql
002_category_functions.sql
003_user_statistics.sql

❌ BAD:
new_function.sql
fix.sql
20260115_154554_exported_functions.sql  ← Raw export, cần cleanup
```

### 3. Migration Files Rules

```
✅ DO:
- Luôn có DROP IF EXISTS
- Luôn có GRANT permissions
- Luôn có header comments
- Test trước khi commit

❌ DON'T:
- Commit raw export files
- Skip DROP IF EXISTS
- Chỉnh sửa migration đã commit
- Xóa migration đã chạy
```

---

## 🆘 TROUBLESHOOTING

### Migration không chạy?

```powershell
# Check container logs
docker logs strapi_postgres

# Check migration status
docker exec -it strapi_postgres psql -U strapi -d strapi -c "SELECT * FROM schema_migrations;"

# Force re-run
.\scripts\import-database-functions.ps1 -Force
```

### Function không tồn tại?

```powershell
# List all functions
docker exec -it strapi_postgres psql -U strapi -d strapi -c "\df"

# Check specific function
docker exec -it strapi_postgres psql -U strapi -d strapi -c "\df get_category_report"
```

---

## ✅ CHECKLIST

- [ ] Đã hiểu export script lấy data từ đâu (local DB)
- [ ] Đã hiểu import script đẩy data vào đâu (container)
- [ ] Đã hiểu auto-migration khi container start
- [ ] Đã hiểu 2 workflow (export vs viết trực tiếp)
- [ ] Đã xóa file export thô
- [ ] Đã run migration vào container
- [ ] Đã verify functions exist
- [ ] Đã commit migration files to Git

---

**🎉 BÂY GIỜ BẠN ĐÃ HIỂU RỒI CHỨ?**

Nếu còn thắc mắc gì, cứ hỏi tiếp nhé! 🚀
