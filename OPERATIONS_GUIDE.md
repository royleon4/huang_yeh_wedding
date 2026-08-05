# 婚禮照片網站｜部署與維運說明

> **適用環境：** Current Replit production  
> **Reviewed：** 2026-08-05T10:31:00+08:00  
> **Baseline：** `21dc25543de6dd2bfa7e9019a2a9244c8a2ef186`

其他環境部署請讀 [`docs/site-handbook/deployments/`](docs/site-handbook/deployments/README.md)。

## 先記住

1. Secret、Database URL、OAuth、Drive ID、private token 不進 GitHub／browser／一般 logs。
2. Memories production schema 不使用 `drizzle-kit push`。
3. Publish plan 出現 unexpected DROP 就停止。
4. 不直接從 Google Drive 手動刪網站原圖。
5. Liveness 使用 `/Memories/api/health`。
6. Automated Playwright 已存在，但 representative In-App profile 不等於真機 evidence。
7. Package／lockfile 改變後，舊 SCA 只能視為 dated evidence。

## 1. Replit Production 必要條件

Published App Secrets：

```text
DATABASE_URL
MEMORIES_DRIVE_PHOTOS_FOLDER_ID
MEMORIES_ADMIN_TOKEN
```

並連接 Replit Google Drive Integration。

Workspace Secrets 不應被假設會自動成為 Published App Secrets；每次發佈前在 deployment settings 確認。

Current `.replit`：

| Artifact | Port | Route |
| --- | ---: | --- |
| Wedding Invitation | 19315 | `/` |
| Memories | 19316 | `/Memories/*` |
| Legacy API | 8080 | `/api/*` |
| Mockup Sandbox | 8081 | `/__mockup` |

Current deployment target：Autoscale。

完整 Replit 步驟：[`docs/site-handbook/deployments/replit.md`](docs/site-handbook/deployments/replit.md)

## 2. Google Drive

連接 account 必須可讀寫：

```text
婚禮 root
00 未分類
訪客上傳
生活照
系統縮圖
```

| Error | 代表 | 優先處理 |
| --- | --- | --- |
| `DRIVE_AUTHORIZATION_REQUIRED` | 401/403、account/scope/folder permission | reconnect、確認 account/editor access |
| `DRIVE_RETRYABLE` | 429、5xx、timeout | bounded retry、quota/provider status |

Background summary：

```text
attempted
createdOrAttached
failureCount
failureCodes
```

`completed` 只代表 job 到達結尾，不代表全部成功。

## 3. Health 與 Browser

Liveness：

```text
/Memories/api/health
```

Health 200 不證明：

- React render 成功；
- transform 後 JS 沒有 runtime error；
- Albums／labels／guestbook 可操作；
- Drive media 可讀；
- Word content 無 overflow。

每次發佈後仍需 browser smoke。

## 4. 發佈前驗證

```bash
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run build
pnpm --filter @workspace/memories-album test
pnpm --filter @workspace/memories-album run test:layout-browser
pnpm --filter @workspace/memories-album build
```

UI／Playwright 路徑還會觸發 `.github/workflows/memories-cross-browser.yml`：

- Chromium desktop/mobile
- Firefox desktop
- WebKit desktop/mobile
- Samsung Internet representative
- WeChat Android/iOS representative
- LINE Android/iOS representative
- Facebook Android/iOS representative
- Instagram Android/iOS representative

失敗保存 screenshot、trace、video、HTML report。

真機 evidence matrix：[`docs/memories/phase-2-device-validation-2026-08-05.md`](docs/memories/phase-2-device-validation-2026-08-05.md)

## 5. Migration

位置：

```text
artifacts/memories-album/db
```

Current latest：

```text
016_explicit_guest_album_membership.sql
```

規則：

- 新增下一個 numbered SQL。
- 不改已套用 migration。
- Runner 保存 filename/checksum。
- Advisory lock 防多 instance 同時 migrate。
- Migration 成功後才啟動 production listener。
- Unexpected `DROP TABLE`、`DROP COLUMN`、constraint removal → 停止。

Production → Development copy/rollback：[`docs/memories/production-to-development-database-runbook.md`](docs/memories/production-to-development-database-runbook.md)

## 6. 安全發佈流程

1. 確認 `main` candidate commit。
2. Required CI green。
3. Database backup/PITR healthy。
4. Review migration／Publish plan。
5. Confirm Published App Secrets。
6. Confirm Drive Integration/account/folder permissions。
7. 記錄 last-known-good deployment revision。
8. 發佈。
9. Health check。
10. Browser smoke。
11. 觀察 logs／errors 30–60 分鐘。
12. 完成或 rollback。

## 7. 發佈後 Smoke

### Public

- [ ] `/Memories/`
- [ ] `/Memories/en/`
- [ ] Album switch／active album repeat click
- [ ] Labels／processes
- [ ] Guestbook load、sort、modal
- [ ] Featured photos 不跨 context
- [ ] Bottom navigation 貼可視範圍底部
- [ ] Back／Forward／refresh
- [ ] Thumbnail／original／viewer
- [ ] Word content/table/image 不 overflow
- [ ] Upload dialog 顯示正確限制

### Admin

- [ ] `/Memories/admin/login`
- [ ] General
- [ ] Albums／labels
- [ ] Photos／filters／bulk actions
- [ ] Categories／process content
- [ ] Guestbook accordion 預設收合、展開後才 load
- [ ] One safe save（條件允許時）

### Runtime

- [ ] No unexpected 5xx
- [ ] No browser pageerror/error boundary
- [ ] No repeated process restart
- [ ] DB connection healthy
- [ ] No Drive auth batch failure
- [ ] Thumbnail backlog stable

## 8. Admin Login

Route：

```text
/Memories/admin/login
```

Secret：

```text
MEMORIES_ADMIN_TOKEN
```

成功登入建立約 30 分鐘 signed HttpOnly、Secure、SameSite=Strict cookie，Path `/Memories/admin`。

登入後跳回 public：

- session expired；
- secret changed/missing；
- proxy 未正確標示 HTTPS；
- cookie 未建立；
- 使用舊 route。

不要改成 localStorage password/session。

## 9. 照片與縮圖

縮圖空白依序檢查：

1. Original 是否存在。
2. Drive account 可否 read original。
3. `系統縮圖` 可否 write。
4. Sharp decode/output 是否成功。
5. PostgreSQL photo/thumbnail reference。
6. Cache 是否保留舊 404。
7. Refresh tool 是否選對 album/process。

重新整理原始照片工具會：

1. 清 generated thumbnails。
2. Rescan originals。
3. Queue derivative rebuild。

不要連續重複按；等目前工作完成。

## 10. Delete

完整 permanent delete 使用：

- Admin permanent delete；或
- Uploader private management page。

手動刪 Drive original 不會完整清理：

- PostgreSQL photo row；
- Album/label/process relations；
- Thumbnail；
- Pinned references。

Current delete 沒有 trash/restore。

## 11. Production → Development Database

只能使用專用 runbook：

[`docs/memories/production-to-development-database-runbook.md`](docs/memories/production-to-development-database-runbook.md)

原則：

- 先 backup Development；
- Production 只作 read-only `pg_dump`；
- Target 只能是 Development；
- Restore 後跑 migration；
- 驗證 DB、health、Drive、browser；
- 可還原原 Development；
- 不保留 production credential/dump 在 workspace。

不得反向用於 Development → Production。

## 12. Dependency Security

2026-08-02 SCA 是 dated evidence，不是 current lockfile verdict。

Dependency remediation 前：

1. Frozen install current `main`。
2. 重新產生 dependency tree、SBOM、pnpm audit、OSV、license。
3. 分 production runtime／build／codegen／preview exposure。
4. Small parent-package batch。
5. Full tests／Playwright／build。
6. Post-change SCA tied to final commit。
7. Deploy observation／rollback。

不要盲用：

```text
pnpm audit fix --force
```

Runbook：[`docs/security-remediation-readiness-2026-08-04.md`](docs/security-remediation-readiness-2026-08-04.md)

## 13. Incident Triage

| 現象 | 優先方向 |
| --- | --- |
| Server/health fail | migration、env、port、startup log |
| Health green but blank | browser pageerror、console、transform、assets |
| All thumbnails fail | Drive Integration/account/folder permission |
| Some files fail | individual original、metadata、Sharp |
| Admin exits | session/cookie/proxy/secret |
| Save success but public stale | public settings/bootstrap/cache |
| Original uploaded, classification missing | repair relation；不要重傳 |
| Featured photos leak | album/label context/seed/paging |
| Guestbook positioning wrong | shared navigation/masonry anchor |
| Word content overflow | document node/table/image CSS |
| In-App bottom nav wrong | visual viewport/fixed containing block/safe area |
| Native package crash | Node/OS/architecture/build artifact |

詳細排錯：[`docs/site-handbook/reference/troubleshooting.md`](docs/site-handbook/reference/troubleshooting.md)

## 14. Rollback

1. 記錄 bad revision／first error time。
2. 停止 risky writes（若需要）。
3. 確認 previous revision schema-compatible。
4. Replit deployment history 切回 known-good，或 redeploy known-good commit。
5. 驗證 health、public、admin、Drive。
6. 保存 bad revision logs/evidence。
7. 若 schema 不相容，使用 forward fix。

Rollback 不刪 migration history。

## 15. Multi-cloud

Current media implementation 使用 Replit-specific `@replit/connectors-sdk` Google Drive Integration。

部署至 On-premise、Google Cloud、AWS、Azure、OCI 或 Kubernetes 前，必須：

- production container；
- Google Drive API 或 object-storage adapter；
- provider Secret Manager/runtime identity；
- managed/self-hosted PostgreSQL；
- explicit migration job；
- background worker/scheduler；
- logs/metrics/alerts；
- backup/restore。

完整文件：[`docs/site-handbook/deployments/`](docs/site-handbook/deployments/README.md)

## 16. 最小事故處理順序

1. 記錄 first real error、timestamp、revision。
2. 分 server／DB／Drive／browser／native dependency／data。
3. 保存 evidence。
4. 未知原因時停止重複 upload/delete。
5. 只修 proven root cause。
6. Run relevant tests/build/Playwright。
7. Deploy and re-verify。
8. 更新 runbook。
