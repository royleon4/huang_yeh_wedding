# 03｜從 Clone 到本機啟動

## 1. Clone 與版本確認

```bash
git clone https://github.com/royleon4/huang_yeh_wedding.git
cd huang_yeh_wedding
git status
git log -1 --oneline
node --version
pnpm --version
```

要求：

```text
Node.js 24
pnpm 10.x
```

## 2. 安裝依賴

一般開發：

```bash
pnpm install
```

重現 CI／release：

```bash
pnpm install --frozen-lockfile
```

Repository 啟用了 npm package 最低發布年齡防護。新版本尚未滿足 `minimumReleaseAge` 時，先確認是否真的需要，不能直接關閉整體防護。

## 3. 建立本機設定

查看 names-only template：

```bash
cat artifacts/memories-album/.env.example
```

建立本機檔案：

```bash
cp artifacts/memories-album/.env.example artifacts/memories-album/.env.local
```

`.env.local` 不得提交 Git。

最低設定：

```dotenv
DATABASE_URL=postgresql://memories:change-me@127.0.0.1:5432/memories
MEMORIES_ADMIN_TOKEN=replace-with-long-random-value
MEMORIES_DRIVE_PHOTOS_FOLDER_ID=development-only-folder-id
PORT=19316
MEMORIES_BASE_PATH=/Memories
```

在非 Replit 環境中，Google Drive Integration 不存在。請使用 mock、portable media adapter 或只執行不需 live Drive 的功能。

## 4. 啟動本機 PostgreSQL

### Docker Compose 快速模式

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: memories
      POSTGRES_PASSWORD: change-me
      POSTGRES_DB: memories
    ports:
      - "5432:5432"
    volumes:
      - memories_pg:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U memories -d memories"]
      interval: 5s
      timeout: 3s
      retries: 20

volumes:
  memories_pg:
```

啟動：

```bash
docker compose up -d postgres
docker compose ps
psql "$DATABASE_URL" -c 'select now();'
```

### 已安裝 PostgreSQL

```bash
sudo -u postgres createuser --pwprompt memories
sudo -u postgres createdb --owner memories memories
psql "$DATABASE_URL" -c 'select current_database(), current_user;'
```

## 5. 執行 migration

```bash
pnpm --filter @workspace/memories-album db:migrate
```

驗證 migration 紀錄：

```bash
psql "$DATABASE_URL" -c '\dt'
```

原則：

- 只新增下一個 numbered SQL。
- 不修改已套用 migration。
- 不使用 `drizzle-kit push` 管理 Memories production tables。
- 失敗時先保存錯誤，不要刪 migration history。

## 6. 啟動 Standalone Memories

```bash
PORT=19316 \
MEMORIES_BASE_PATH=/Memories \
pnpm --filter @workspace/memories-album dev
```

瀏覽：

```text
http://localhost:19316/Memories/
http://localhost:19316/Memories/admin/login
http://localhost:19316/Memories/api/health
```

若 Vite dev server 使用 `/` preview route，仍應測 canonical `/Memories/*` production route。

## 7. 啟動其他 artifacts

```bash
pnpm --filter @workspace/wedding-invitation dev
pnpm --filter @workspace/api-server dev
pnpm --filter @workspace/mockup-sandbox dev
```

預設 port：

| Artifact | Port | Route |
| --- | ---: | --- |
| Wedding invitation | 19315 | `/` |
| Memories | 19316 | `/Memories/*` |
| Legacy API | 8080 | `/api/*` |
| Mockup sandbox | 8081 | `/__mockup` |

## 8. 開發前檢查

```bash
pnpm run typecheck
pnpm --filter @workspace/memories-album test
pnpm --filter @workspace/memories-album run test:layout-browser
pnpm --filter @workspace/memories-album build
```

跨瀏覽器 production gate 依 workflow 安裝 pinned Playwright runner，再以 production build 執行 Chromium、Firefox、WebKit 與 In-App Browser representative profiles。

## 9. Production build

```bash
pnpm --filter @workspace/memories-album build
PORT=19316 pnpm --filter @workspace/memories-album start
```

另一個 terminal：

```bash
curl --fail http://127.0.0.1:19316/Memories/api/health
```

必須再用 browser 打開 public 與 admin routes，因為 health 200 不能證明 React bundle 沒有 runtime error。

## 10. 常見本機問題

| 問題 | 優先檢查 |
| --- | --- |
| `Use pnpm instead` | 使用 pnpm，不要 npm/yarn |
| Native package install 失敗 | OS/architecture、workspace overrides、Node 版本 |
| `ECONNREFUSED 5432` | PostgreSQL container／firewall／DATABASE_URL |
| Migration checksum mismatch | 是否修改已套用 SQL；停止並還原檔案 |
| Drive authorization | 本機沒有 Replit Integration；使用 mock／adapter |
| `/Memories/` 404 | base path、router、production build route |
| Browser blank page | console、pageerror、transform output |
| Admin 回 public | session cookie、secret、Path、HTTPS／Secure behavior |

## 11. 建議開發循環

```mermaid
flowchart LR
  A[建立 branch] --> B[寫最小行為測試]
  B --> C[實作]
  C --> D[Impact tests]
  D --> E[Production build]
  E --> F[Browser validation]
  F --> G[更新文件]
  G --> H[PR / CI / Merge]
```

## 12. 清理本機環境

停止 container：

```bash
docker compose down
```

刪除本機 database volume：

```bash
docker compose down -v
```

`-v` 會永久刪除本機資料，只能在確定不需要時使用。
