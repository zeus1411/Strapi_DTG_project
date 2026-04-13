# 🚀 Quick Start Guide

## Tóm tắt nhanh cho người bận rộn

### ✅ Câu trả lời cho 3 câu hỏi của bạn:

1. **Import functions vào container?** 
   → Dùng migration system (tự động)

2. **Volume có an toàn không?** 
   → ✅ CÓ! Bạn đã config đúng rồi

3. **Mỗi lần có function mới phải backup?** 
   → ❌ KHÔNG! Chỉ cần tạo migration file

---

## 📋 Cheat Sheet - Các lệnh thường dùng

### Lần đầu setup (one-time)

```powershell
# 1. Export functions từ local DB (nếu có sẵn)
.\scripts\export-database-functions.ps1

# 2. Review file export, đổi tên thành 001_xxx.sql

# 3. Start containers (migrations tự động chạy)
docker-compose up -d

# ✅ Done!
```

### Thêm function/procedure mới (daily workflow)

```powershell
# 1. Tạo file migration mới
# File: database/migrations/002_new_feature.sql

# 2. Run migration
.\scripts\import-database-functions.ps1

# 3. Test
docker exec -it strapi_postgres psql -U strapi -d strapi
\df  # List functions

# 4. Commit
git add database/migrations/002_new_feature.sql
git commit -m "feat: add new feature"

# ✅ Done!
```

### Đồng đội pull code (team workflow)

```powershell
# 1. Pull code
git pull

# 2. Restart container
docker-compose restart postgres

# ✅ Done! Migrations tự động chạy
```

### Check status

```powershell
# Xem migrations đã chạy
docker exec -it strapi_postgres psql -U strapi -d strapi -c \
  "SELECT * FROM schema_migrations;"

# Xem functions hiện có
docker exec -it strapi_postgres psql -U strapi -d strapi -c "\df"

# Xem volumes
docker volume ls | grep postgres_data
```

### Emergency commands

```powershell
# Re-run tất cả migrations
.\scripts\import-database-functions.ps1 -Force

# Xem logs
docker logs strapi_postgres

# Connect vào database
docker exec -it strapi_postgres psql -U strapi -d strapi

# Backup database (cẩn thận!)
docker exec strapi_postgres pg_dump -U strapi -d strapi > backup.sql

# Restore database (cẩn thận!)
docker exec -i strapi_postgres psql -U strapi -d strapi < backup.sql
```

---

## 🎯 Key Points

| Vấn đề | Giải pháp | Trạng thái |
|--------|-----------|------------|
| Import functions | Migration system | ✅ Đã setup |
| Data safety | Named volume | ✅ Đã đúng |
| Version control | Git + migrations | ✅ Đã setup |
| Auto-run | init-migrations.sh | ✅ Đã setup |
| Team workflow | Pull + restart | ✅ Đã setup |

---

## ⚠️ Lưu ý quan trọng

### Data KHÔNG mất khi:
- `docker-compose down` ✅
- `docker rm -f strapi_postgres` ✅
- `docker-compose restart` ✅
- Rebuild image ✅

### Data MẤT khi:
- `docker-compose down -v` ❌
- `docker volume rm postgres_data` ❌

### Best practices:
- ✅ Luôn test migration trên local trước
- ✅ Commit migration file vào Git
- ✅ Đặt tên file theo convention: `001_description.sql`
- ✅ Không commit file export thô
- ✅ Review migration trước khi merge

---

## 📚 Đọc thêm

- Chi tiết đầy đủ: [DATABASE_MIGRATION_GUIDE.md](DATABASE_MIGRATION_GUIDE.md)
- Migration template: `database/migrations/00X_template.sql`
- Troubleshooting: Xem section Troubleshooting trong guide chính

---

## 🆘 Need Help?

```powershell
# Check migration status
docker exec -it strapi_postgres psql -U strapi -d strapi -c \
  "SELECT migration_name, executed_at, status FROM schema_migrations ORDER BY executed_at DESC;"

# Re-run specific migration
docker exec -it strapi_postgres psql -U strapi -d strapi -c \
  "DELETE FROM schema_migrations WHERE migration_name = '001_xxx';"
.\scripts\import-database-functions.ps1

# Check logs
docker logs strapi_postgres --tail 50
```

---

**🎉 Chúc mừng! Bạn đã có một hệ thống migration chuẩn chỉnh!**
