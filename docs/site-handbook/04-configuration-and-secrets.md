# 04｜環境設定與 Secret 管理

## 1. 設定分層

| 層級 | 範例 | 是否可提交 |
| --- | --- | --- |
| Public config | language defaults、feature flags | 可以，但不可含 credential |
| Environment config | `PORT`、base path、log level | 可以放 template，不放 production value |
| Secret | database URL、admin token、OAuth credential | 不可提交 |
| Runtime identity | service account／IAM role | 不放長期 private key，優先 workload identity |
| User-managed content | site copy、colors、album settings | 存 PostgreSQL，不存 source code |

## 2. Current required variables

| Variable | 用途 | 敏感度 | 驗證 |
| --- | --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string | High | startup + migration + query |
| `MEMORIES_DRIVE_PHOTOS_FOLDER_ID` | Current Google Drive root | Sensitive identifier | Drive read/write smoke |
| `MEMORIES_ADMIN_TOKEN` | Admin login secret | High | login rate limit + cookie |
| `PORT` | Runtime listening port | Low | provider healthcheck |
| `MEMORIES_BASE_PATH` | `/Memories` base path | Low | direct route + asset paths |

Optional runtime variables may control sync interval、thumbnail batch、trust proxy、migration behavior。以 `.env.example` 與 current code 為 source of truth。

## 3. Secret 產生

Admin token 至少使用 32 random bytes：

```bash
openssl rand -base64 48
```

不要使用：

- 婚禮日期；
- 姓名；
- repository name；
- 重複使用的個人密碼；
- 短 token；
- 寫在 GitHub issue 的值。

## 4. Environment matrix

| Setting | Development | Staging | Production |
| --- | --- | --- | --- |
| Database | Local／dev DB | Isolated staging DB | Managed production DB |
| Media root | Mock／dev folder | Staging bucket/folder | Wedding production root |
| Admin token | Dev-only | Staging-only | Production-only |
| Domain | localhost | staging subdomain | custom production domain |
| Logs | verbose, no secrets | structured | structured + alerting |
| Backup | optional seed | scheduled | scheduled + tested restore |

不同環境不得共用：

- `DATABASE_URL`
- media folder/bucket
- admin token
- private management token
- OAuth credential
- encryption key

## 5. Secret injection patterns

### Replit

使用 Published App Secrets。Workspace Secrets 與 Published App Secrets 可能是不同儲存範圍，發佈前要在 deployment settings 確認。

### Container platforms

```mermaid
flowchart LR
  SM[Secret Manager] --> ID[Runtime identity]
  ID --> Container[Application container]
  Container --> DB[(PostgreSQL)]
  Container --> Media[(Media store)]
```

優先順序：

1. Managed identity／workload identity 直接讀 provider service。
2. Secret Manager reference 注入 environment。
3. Secret volume。
4. 最後才是手動 environment value。

不要把 secret bake 進 image layer：

```dockerfile
# 錯誤
ENV DATABASE_URL=postgresql://...
COPY .env.production /app/.env
```

## 6. Database URL

常見格式：

```text
postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=verify-full
```

注意：

- URL encode 特殊字元。
- Production 使用 TLS。
- Serverless container 可能需要 connection pooling。
- 不把完整 URL 寫入 log。
- Rotate password 後，重新啟動使用 environment injection 的 container。

## 7. Proxy 與 cookie

Admin session 使用 secure HttpOnly cookie。經 reverse proxy 時需要：

- 正確傳遞 `X-Forwarded-Proto`；
- 只信任自己的 proxy；
- Production 使用 HTTPS；
- cookie path 保持 `/Memories/admin`；
- 不把 admin session 存 localStorage。

## 8. Config validation

在 server startup 建立 schema：

```js
const required = [
  "DATABASE_URL",
  "MEMORIES_ADMIN_TOKEN",
  "MEMORIES_DRIVE_PHOTOS_FOLDER_ID",
];

for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required configuration: ${key}`);
}
```

正式實作應：

- 不在 error 中輸出 value；
- 區分 missing、invalid、provider unavailable；
- health endpoint 不必初始化所有 dependency；
- readiness endpoint 才檢查 DB/media。

## 9. Rotation procedure

### Admin token

1. 產生新 token。
2. 更新 Secret Manager。
3. Deploy new revision／restart service。
4. 驗證新登入。
5. 驗證舊 session 是否依設計失效或自然過期。
6. 記錄 rotation date，不記 value。

### Database credential

1. 建立新 DB user/password。
2. 授予最小權限。
3. 更新 secret。
4. Deploy new revision。
5. 驗證 migration/read/write。
6. 撤銷舊 credential。

### Provider credential

優先使用短期 token、managed identity 或 service account impersonation。若不得不用 key file：

- 加密儲存；
- 限制 scope；
- 定期 rotate；
- 不共享個人 credential；
- 立即撤銷外洩 key。

## 10. Secret leak response

1. 立即 rotate/revoke。
2. 保存 audit evidence。
3. 搜尋 Git history、Actions logs、deployment logs、browser bundle。
4. 若曾 commit，僅刪目前檔案不足；需視風險清理 history。
5. 檢查 DB、media、admin access logs。
6. 更新 incident document。
7. 增加 automated secret scanning。

## 11. Checklist

- [ ] `.env*` 已加入 `.gitignore`
- [ ] `.env.example` 只有名稱與說明
- [ ] Production secrets 存 provider secret manager
- [ ] Runtime identity 採 least privilege
- [ ] Logs 不輸出 raw token/provider response
- [ ] Secret rotation 有程序
- [ ] Development 與 Production 不共用資料
- [ ] TLS 與 proxy headers 正確
- [ ] Admin cookie 為 HttpOnly、Secure、SameSite
