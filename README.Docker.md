# Docker Setup cho Strapi

## Các file đã tạo

1. **Dockerfile** - Docker image cho Strapi backend
2. **docker-compose.yml** - Orchestration cho backend và PostgreSQL database
3. **.env.example** - Template cho biến môi trường
4. **.dockerignore** - Loại trừ file không cần thiết

## Cách sử dụng

### 1. Chuẩn bị môi trường

Tạo file `.env` từ `.env.example`:

```bash
cp .env.example .env
```

**QUAN TRỌNG:** Thay đổi các giá trị secret trong file `.env`:

```bash
# Generate secrets (chạy lệnh này để tạo secret ngẫu nhiên)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 2. Build và chạy containers

```bash
# Build và start tất cả services
docker-compose up -d --build

# Xem logs
docker-compose logs -f

# Xem logs của service cụ thể
docker-compose logs -f strapi
docker-compose logs -f postgres
```

### 3. Truy cập ứng dụng

- **Strapi Admin:** http://localhost:1337/admin
- **Strapi API:** http://localhost:1337/api

### 4. Quản lý containers

```bash
# Dừng containers
docker-compose down

# Dừng và xóa volumes (XÓA DỮ LIỆU DATABASE!)
docker-compose down -v

# Restart services
docker-compose restart

# Xem trạng thái
docker-compose ps

# Chạy lại build nếu có thay đổi code
docker-compose up -d --build strapi
```

### 5. Database Management

```bash
# Truy cập PostgreSQL shell
docker exec -it strapi_postgres psql -U strapi -d strapi

# Backup database
docker exec strapi_postgres pg_dump -U strapi strapi > backup.sql

# Restore database
docker exec -i strapi_postgres psql -U strapi strapi < backup.sql
```

### 6. Debug và Development

Để chạy ở development mode:

```bash
# Sửa trong docker-compose.yml hoặc .env
NODE_ENV=development

# Hoặc override command
docker-compose run --rm strapi npm run dev
```

## Cấu trúc volumes

- `postgres_data`: Lưu trữ dữ liệu PostgreSQL (persistent)
- `./public/uploads`: Lưu trữ file upload của Strapi
- `./data`: Lưu trữ data files

## Môi trường Production

Khi deploy production:

1. ✅ Thay đổi tất cả secrets trong `.env`
2. ✅ Set `NODE_ENV=production`
3. ✅ Sử dụng strong passwords cho database
4. ✅ Enable SSL nếu cần thiết
5. ✅ Configure reverse proxy (Nginx/Caddy)
6. ✅ Setup backup strategy cho database
7. ✅ Monitor logs và resources

## Troubleshooting

### Container không start

```bash
# Xem logs chi tiết
docker-compose logs

# Xóa container và rebuild
docker-compose down
docker-compose up -d --build
```

### Database connection failed

```bash
# Check postgres đã sẵn sàng chưa
docker-compose exec postgres pg_isready

# Restart postgres
docker-compose restart postgres
```

### Port đã được sử dụng

Thay đổi port trong `.env`:

```
PORT=3000
DATABASE_PORT=5433
```

## Network và Security

- Tất cả services trong cùng network `strapi_network`
- Database chỉ accessible trong Docker network (trừ khi expose port)
- Strapi accessible từ bên ngoài qua port 1337

## Tối ưu hóa

### Giảm image size

Dockerfile đã tối ưu sử dụng:
- Alpine Linux (lightweight)
- Multi-stage build potential
- Only production dependencies

### Performance

```yaml
# Trong docker-compose.yml, có thể thêm:
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 2G
    reservations:
      memory: 1G
```
