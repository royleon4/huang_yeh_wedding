# 婚禮照片網站｜部署與維運說明

這份說明是寫給**網站擁有者、Replit 發布者與事故排查者**。

> 日常內容管理請看 [`ADMIN_GUIDE.md`](ADMIN_GUIDE.md)。  
> 程式架構與 API 請看 [`artifacts/memories-album/README.md`](artifacts/memories-album/README.md)。  
> Dependency security 修復前請看 [`docs/security-remediation-readiness-2026-08-04.md`](docs/security-remediation-readiness-2026-08-04.md)。  
> 2026-08-02 SCA 請看 [`docs/software-composition-analysis-2026-08-02.md`](docs/software-composition-analysis-2026-08-02.md)。  
> Production → Development database 備份、覆蓋與還原請看 [`docs/memories/production-to-development-database-runbook.md`](docs/memories/production-to-development-database-runbook.md)。

## 先記住七件事

1. **不要把 Secret、Drive folder ID、OAuth 憑證或私人 token 寫進 GitHub。**
2. **不要用 `drizzle-kit push` 管理 Memories tables。**
3. **Publish plan 出現 DROP 時先取消。**
4. **不要直接從 Google Drive 刪除網站照片。**
5. **Production healthcheck 使用 `/Memories/api/health`。**
6. **發布成功不等於瀏覽器畫面一定正常，仍要做實際頁面檢查。**
7. **日期型 SCA 只代表它掃描的 commit；package 或 lockfile 改變後必須重新掃描。**

## 1. Production 必要條件

Replit Published App 必須有：

```text
DATABASE_URL
MEMORIES_DRIVE_PHOTOS_FOLDER_ID
MEMORIES_ADMIN_TOKEN
```

並且必須連接 **Replit Google Drive Integration**。

### Secret 的用途

- `DATABASE_URL`：PostgreSQL 連線
- `MEMORIES_DRIVE_PHOTOS_FOLDER_ID`：婚禮照片根資料夾
- `MEMORIES_ADMIN_TOKEN`：管理員登入密碼來源

### 不可以提交的內容

不要把以下內容放入 README、issue、聊天截圖、`.replit`、前端 bundle、SCA artifact 或一般 source file：

- 真實管理密碼
- `DATABASE_URL`
- Google OAuth token
- Drive folder ID
- 私人批次管理 token
- resumable session URI
- connector 原始回應

## 2. Google Drive 權限

連接的 Google 帳號至少要能讀寫婚禮照片根資料夾。

應確認它也能讀寫：

```text
00 未分類
訪客上傳
生活照
系統縮圖
```

若原圖可讀、縮圖卻一直失敗，特別檢查 `系統縮圖` 的權限。

### 常見 Drive 錯誤

#### `DRIVE_AUTHORIZATION_REQUIRED`

通常代表：

- Integration 已失效或需要重新授權
- 連到錯的 Google 帳號
- 帳號沒有資料夾編輯權限
- 只能讀原圖，不能寫縮圖

#### `DRIVE_RETRYABLE`

通常代表：

- 429 節流
- Google Drive 或 connector 的 5xx
- 上游逾時或暫時不可用

先等待再重試；若反覆發生，再檢查 connector、配額與資料夾權限。

## 3. Healthcheck 與 readiness

Production healthcheck 應使用：

```text
/Memories/api/health
```

這是輕量 liveness endpoint，不需要先完成完整 Drive 或 PostgreSQL 初始化。

不要把以下頁面當 healthcheck：

- `/Memories/admin`
- `/Memories/admin/login`
- `/memories`
- 需要登入或可能 redirect 的頁面

### Healthcheck 正常但畫面壞掉

`/Memories/api/health` 回 200 只代表 server 能回應。

它不能證明：

- React 已成功執行
- transform 後的 JavaScript 沒有 runtime error
- 所有相簿、標籤、留言與流程都能打開
- Drive 原圖與縮圖都能讀取
- Word 匯入內容沒有寬度溢出

因此每次發布後仍要做瀏覽器 smoke check。

## 4. 發布前檢查

在可執行完整 workspace 的環境中，至少確認：

```bash
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run build
pnpm --filter @workspace/memories-album test
pnpm --filter @workspace/memories-album run test:layout-browser
pnpm --filter @workspace/memories-album build
```

需要真實 Drive 驗證時才執行：

```bash
pnpm --filter @workspace/memories-album test:drive-live
```

`test:drive-live` 只能對安全測試資料夾執行，不要拿 production 婚禮根資料夾做破壞性測試。

PR commit 會依實際 diff 執行 Test Impact Analysis。推送到 `main` 與手動 dispatch 仍會跑完整 Node、focused Chrome、production build 與 health smoke。完整規則見 [`docs/memories/testing-strategy.md`](docs/memories/testing-strategy.md)。

## 5. Migration 安全

Memories migration 位於：

```text
artifacts/memories-album/db
```

目前編號延伸到：

```text
016_explicit_guest_album_membership.sql
```

最近新增的資料模型包括：

- `014_guestbook_messages.sql`
- `015_album_scoped_labels.sql`
- `016_explicit_guest_album_membership.sql`

Migration runner 會：

- 依序套用尚未記錄的 SQL
- 保存檔名與 SHA-256 checksum
- 拒絕修改已經套用的 migration
- 使用 PostgreSQL advisory lock
- migration 成功後才啟動 production listener

### 絕對不要做

```text
drizzle-kit push
```

也不要修改已經在 production 套用過的編號 SQL。

### Production → Development database 覆蓋

需要以 Production 資料重新建立 Development 測試環境時，必須使用已實際演練的專用手冊：

[`docs/memories/production-to-development-database-runbook.md`](docs/memories/production-to-development-database-runbook.md)

該流程要求：

- 先備份 Development；
- Production 只執行唯讀 `pg_dump`；
- 目標只能是 Development `DATABASE_URL`；
- 覆蓋後執行 `db:migrate`；
- 完成 database、health、Drive 與瀏覽器驗收；
- 支援還原原本 Development；
- 不把 Production credential 或 dump 長期留在 workspace。

不得把該流程反向用於 Development → Production。

### Publish plan 出現 DROP

看到以下任一項時先取消：

- `DROP TABLE`
- `DROP COLUMN`
- 移除既有 constraint
- 用 development data 覆蓋 production

先確認 migration 檔、production schema 與 Publish plan，再重新發布。

## 6. Dependency security 與 SCA

2026-08-02 曾完成一次 repository-wide SCA，包含 CycloneDX SBOM、pnpm audit、OSV、license、deprecated 與 outdated inventory。

該結果是**日期型證據**，不是目前 `main` 的精確 release verdict。之後 `artifacts/memories-album/package.json` 與 `pnpm-lock.yaml` 已改變，包括 Word 匯入依賴，因此開始修復前必須重新掃描。

修復前：

1. 暫停其他 package／lockfile 變更。
2. 記錄 current `main` 與 production commit。
3. 確認 PostgreSQL 備份責任與 Drive Integration 權限。
4. 用 frozen lockfile 產生新的 dependency tree、SBOM、pnpm audit 與 OSV evidence。
5. 依 production runtime、build、codegen、preview exposure 分類。
6. 小批更新 parent dependency，不要一次更新全部套件。
7. 每批完成後重新測試、部署觀察並重掃。

禁止把下列命令當成無審查修復方案：

```text
pnpm audit fix --force
```

完整流程見 [`docs/security-remediation-readiness-2026-08-04.md`](docs/security-remediation-readiness-2026-08-04.md)。

## 7. 安全發布流程

1. 確認 GitHub `main` 是要發布的版本。
2. 確認 required CI 通過。
3. 確認 Replit Secrets 與 Drive Integration 仍存在。
4. 檢查 Publish plan，拒絕意外 DROP。
5. Dependency 變更時，確認 post-change SBOM／SCA 與候選 commit 一致。
6. 記錄最後一個已知正常的 deployment commit。
7. 發布。
8. 開啟 `/Memories/api/health`。
9. 用真實瀏覽器開啟 `/Memories/`。
10. 切換中文與 English。
11. 開啟照片相簿、標籤、婚禮流程與留言簿。
12. 開啟一張照片，測試「查看原圖」與關閉。
13. 打開 `/Memories/admin/login`，登入後巡覽四個管理分頁。
14. 只在安全情況下做一筆小型上傳或設定保存測試。

## 8. 發布後瀏覽器檢查

至少檢查：

- 首頁首圖、標題與配色正確
- 語言切換器仍在首頁標題區且可操作
- 底部導覽在手機寬度沒有遮住內容
- 相簿、流程、相簿標籤與訪客姓名標籤可切換
- 「全部{相簿名}」位於非訪客相簿標籤第一順位
- 流程中英文標題能覆蓋對應 public label
- 每相簿精選照片不會留在其他相簿或標籤
- 留言簿載入後定位到內容頂部，排序與開啟留言正常
- 瀏覽器上一頁／下一頁能恢復選擇
- 照片縮圖會載入
- 「載入更多回憶」可用
- 全螢幕照片可以關閉
- 「查看原圖」在新分頁開啟
- Word 匯入內容與圖片附件不超出可視寬度
- 上傳入口顯示目前張數限制與說明
- 管理後台沒有跳回前台或出現未處理錯誤

CI 現在有 focused Chrome layout checks，但仍沒有 required Playwright production-browser gate，所以這一步不能省略。

## 9. 管理員登入問題

目前登入頁：

```text
/Memories/admin/login
```

使用的 Secret：

```text
MEMORIES_ADMIN_TOKEN
```

成功登入後建立約 30 分鐘的 HMAC-signed HttpOnly cookie。

### 登入後又回到前台

可能原因：

- session 已過期
- cookie 沒有成功建立或送回
- 使用了舊路徑
- production secret 遺失或改變

先重新開啟登入頁；不要把密碼改成寫死在瀏覽器或 source code。

## 10. 照片與縮圖問題

### 某些縮圖空白

依序檢查：

1. 原圖是否仍在 Drive
2. `系統縮圖` 是否可讀寫
3. 背景同步 log 是否有 authorization 或 retryable 錯誤
4. PostgreSQL photo row 是否仍存在
5. 後台的重新整理工具是否選對相簿／流程

### 背景同步顯示 completed with failures

`completed` 只代表背景工作跑到結尾，不代表每一張都成功。

應查看：

- attempted
- createdOrAttached
- failureCount
- failureCodes

若整批都同一個 authorization code，優先處理帳號或資料夾權限，不要把每張照片當成獨立壞檔。

## 11. 不要直接從 Drive 刪原圖

手動刪除 Drive 原圖，不會自動完整清理 PostgreSQL、相簿／流程關聯、縮圖與置頂引用。

需要刪除時使用：

- 管理後台的永久刪除
- 上傳者的私人管理頁

目前永久刪除沒有垃圾桶或復原流程。

## 12. 重新掃描與重建縮圖

後台的「重新整理原始照片」是維護工具，可以：

1. 清除系統產生的縮圖
2. 重新掃描 Drive 原圖
3. 排入縮圖重建

操作前：

- 確認選對相簿或流程
- 確認 Drive 權限正常
- 不要連續重複按
- 等待目前工作完成

它不是一般查看照片時需要使用的按鈕。

## 13. 常見事故判斷

| 現象 | 優先方向 |
| --- | --- |
| Health 失敗、server 未啟動 | migration、環境變數、port、server log |
| Health 正常但整頁空白 | 瀏覽器 console、`pageerror`、production transform output |
| 所有縮圖都失敗 | Drive Integration 或資料夾權限 |
| 少數照片壞掉 | 個別檔案、原圖、metadata 或 thumbnail row |
| 管理後台突然離開 | session 過期或 cookie 問題 |
| 設定存了但前台不變 | 儲存結果、重新整理、public settings/bootstrap |
| 上傳原圖成功但分類失敗 | 找到照片後補上相簿／流程，不要重複上傳 |
| 精選照片出現在其他相簿 | active album／label context、seed reset、paging state |
| 留言簿載入後位置錯誤 | shared content navigation 與 masonry anchor restoration |
| Word 匯入內容溢出 | document node、preview width、table/image CSS |
| 舊網址被改寫 | 正常的穩定身分網址遷移 |
| Native module 更新後無法啟動 | Sharp/esbuild 安裝、build artifact、deployment platform compatibility |

## 14. 已知維運限制

- CI 尚未跑 required Playwright 完整 production React interaction flow。
- 日期型 SCA 尚未重新對 current lockfile 執行。
- 直接刪 Drive 不會自動完成 DB cleanup。
- 刪除是立即永久刪除。
- 人物分類與自拍找照片尚未實作。
- 管理員上傳後的分類仍由前端 follow-up PATCH 完成，尚非單一原子 command。
- 多個 Vite exact-string transforms 仍是 production-only regression 的主要風險。

## 最小事故處理順序

1. 先記錄第一個真正錯誤，不要先改程式。
2. 分清楚是 server、database、Drive、browser runtime、dependency/native module 還是資料問題。
3. 只修已證明的根因。
4. 執行對應測試與 production build。
5. Dependency 問題要保存 pre/post SBOM 與 SCA evidence。
6. 發布後用真實瀏覽器重新驗證。
7. 將新發現補進對應文件，避免下一次重複猜測。
