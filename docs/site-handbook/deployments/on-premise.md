# On-premise／VPS 部署

> **相容性：** 需要 container 化，並完成 Google Drive API 或 S3-compatible media adapter。  
> **推薦 topology：** Caddy/Nginx + Memories container + PostgreSQL + MinIO。  
> **維運責任：** TLS、patching、firewall、backup、monitoring 全由自己承擔。

## 1. 架構

```mermaid
flowchart TB
  Internet --> Firewall[Firewall 80/443 only]
  Firewall --> Caddy[Caddy / Nginx]
  Caddy --> App[Memories container]
  App --> PG[(PostgreSQL)]
  App --> MinIO[(MinIO private bucket)]
  App --> Logs[Vector/Promtail/System logs]
  Backup[Backup host/object store] <-- PG
  Backup <-- MinIO
```

## 2. 最低主機規格

初始小型站參考：

| Resource | Development/low traffic | Production starting point |
| --- | ---: | ---: |
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| OS disk | 30 GB | 50 GB |
| Media disk | 依原圖容量 | 至少原圖預估 × 2–3 |
| Network | 100 Mbps | 依上傳/下載峰值 |

Sharp 解碼大圖會有瞬間 memory peak。容量需由實際照片大小、同時 upload 數與 thumbnail worker concurrency 校準。

## 3. OS hardening

以 Debian/Ubuntu 為例：

```bash
sudo apt update && sudo apt full-upgrade -y
sudo apt install -y git curl ca-certificates jq ufw fail2ban docker.io docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
```

Firewall：

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

PostgreSQL、MinIO admin port 不對 public Internet 開放。

## 4. DNS

建立：

```text
A     wedding.example.com  → SERVER_PUBLIC_IP
AAAA  wedding.example.com  → SERVER_IPV6（若使用）
```

等待解析：

```bash
dig +short wedding.example.com
```

## 5. Container image

在 CI build/push 到 private registry，或在 server build：

```bash
docker build -t wedding-memories:$(git rev-parse --short HEAD) .
```

Production 建議由 CI 產生 immutable digest，不在 server 直接 build unreviewed source。

## 6. Docker Compose

以下是 portable target 範例；需要 repository 有 production Dockerfile 與 MinIO/S3 adapter：

```yaml
services:
  app:
    image: ghcr.io/OWNER/wedding-memories@sha256:REPLACE
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 8080
      MEMORIES_BASE_PATH: /Memories
      DATABASE_URL: ${DATABASE_URL}
      MEMORIES_ADMIN_TOKEN: ${MEMORIES_ADMIN_TOKEN}
      MEDIA_PROVIDER: s3
      MEDIA_ENDPOINT: http://minio:9000
      MEDIA_BUCKET_OR_ROOT: wedding-prod
      MEDIA_FORCE_PATH_STYLE: "true"
    depends_on:
      postgres:
        condition: service_healthy
      minio:
        condition: service_started
    networks: [frontend, backend]

  postgres:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: memories
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: memories
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U memories -d memories"]
      interval: 5s
      timeout: 3s
      retries: 30
    networks: [backend]

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    restart: unless-stopped
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    volumes:
      - minio_data:/data
    networks: [backend]

  caddy:
    image: caddy:2
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on: [app]
    networks: [frontend]

networks:
  frontend:
  backend:
    internal: true

volumes:
  postgres_data:
  minio_data:
  caddy_data:
  caddy_config:
```

不要使用 floating `latest` 作正式 app image。MinIO image 也應 pin tested release。

## 7. Caddy

```caddyfile
wedding.example.com {
  encode zstd gzip

  reverse_proxy app:8080 {
    header_up X-Forwarded-Proto {scheme}
    header_up X-Forwarded-Host {host}
  }

  header {
    X-Content-Type-Options nosniff
    Referrer-Policy strict-origin-when-cross-origin
  }

  log {
    output stdout
    format json
  }
}
```

若 invitation、Memories、legacy API 分開 container：

```caddyfile
handle_path /Memories/* {
  reverse_proxy memories:8080
}
handle_path /api/* {
  reverse_proxy legacy-api:8080
}
handle {
  reverse_proxy invitation:8080
}
```

先確認 app 是否需要保留 `/Memories` prefix；不要錯誤 strip canonical base path。

## 8. Secrets

建立 root-only file：

```bash
sudo install -m 600 /dev/null /opt/wedding/.env
sudoedit /opt/wedding/.env
```

內容不進 Git：

```dotenv
POSTGRES_PASSWORD=...
DATABASE_URL=postgresql://memories:...@postgres:5432/memories
MEMORIES_ADMIN_TOKEN=...
MINIO_ROOT_USER=...
MINIO_ROOT_PASSWORD=...
```

更成熟方案：SOPS + age、Vault、Docker secrets 或 systemd credentials。

## 9. Database migration

Deploy 前執行 one-off container：

```bash
docker compose run --rm app \
  node dist/scripts/migrate.mjs
```

若 current image 的 migration command 路徑不同，以 package `db:migrate` build contract 為準。Migration 成功後才更新 app service。

## 10. MinIO 初始化

使用 `mc`：

```bash
mc alias set local http://127.0.0.1:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
mc mb local/wedding-prod
mc version enable local/wedding-prod
```

建立 runtime user，只授予指定 bucket/prefix read/write/delete。不要讓 app 使用 root credential。

## 11. 啟動

```bash
cd /opt/wedding
docker compose pull
docker compose up -d
docker compose ps
curl --fail https://wedding.example.com/Memories/api/health
```

## 12. Logs 與 monitoring

```bash
docker compose logs -f app
docker stats
```

正式建議：

- node_exporter／Prometheus；
- Grafana；
- Loki/Promtail 或 Vector；
- uptime probe；
- disk/SMART alert；
- PostgreSQL metrics；
- MinIO metrics；
- certificate expiry alert。

## 13. Backup

Database：

```bash
docker compose exec -T postgres \
  pg_dump -U memories -d memories -Fc \
  > "backup/memories-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

Media：

```bash
mc mirror --overwrite local/wedding-prod backup/wedding-prod
```

Backup 必須送到另一台主機／不同 storage account。只放同一顆 disk 不算 disaster recovery。

## 14. Update 與 rollback

Update：

```bash
docker compose pull app
docker compose run --rm app <migration-command>
docker compose up -d app
```

Rollback：

1. 修改 image digest 回 last-known-good。
2. 確認 migration compatibility。
3. `docker compose up -d app`。
4. 驗證 health/public/admin/media。

## 15. Security checklist

- [ ] SSH key only；disable password/root login
- [ ] 80/443 only public
- [ ] PostgreSQL/MinIO internal network
- [ ] TLS automatic renewal
- [ ] Containers patched and pinned
- [ ] App non-root where possible
- [ ] Secrets mode 600／secret manager
- [ ] Versioned media bucket
- [ ] Off-host backups
- [ ] Restore drill
- [ ] Monitoring and alerts
