# Standalone Memories｜Developer and Maintainer Guide

> **Status:** Current  
> **Product:** Phase 1 complete；Phase 2.1 browser／In-App validation active  
> **Reviewed:** 2026-08-05T10:31:00+08:00 (Asia/Taipei)  
> **Baseline:** `21dc25543de6dd2bfa7e9019a2a9244c8a2ef186`

本文件是修改、除錯、重構、測試與發佈 Standalone Memories 的維護入口。

相關文件：

- [`README.md`](README.md)：精簡 repository 入口
- [`DOCUMENTATION.md`](DOCUMENTATION.md)：完整文件索引與 lifecycle
- [`artifacts/memories-album/README.md`](artifacts/memories-album/README.md)：產品/API/storage contract
- [`docs/site-handbook/`](docs/site-handbook/README.md)：從零架站與多雲部署
- [`OPERATIONS_GUIDE.md`](OPERATIONS_GUIDE.md)：Replit/Drive/migration/incident
- [`docs/memories/testing-strategy.md`](docs/memories/testing-strategy.md)：Impact CI
- [`docs/memories/phase-2-device-validation-2026-08-05.md`](docs/memories/phase-2-device-validation-2026-08-05.md)：automated 與真機 evidence matrix
- [`docs/code-health-audit-2026-07.md`](docs/code-health-audit-2026-07.md)：架構技術債

## 1. Current architecture

| Surface | Package | Route／Port | Data |
| --- | --- | --- | --- |
| Wedding Invitation | `@workspace/wedding-invitation` | `/` · `19315` | Legacy application |
| Standalone Memories | `@workspace/memories-album` | `/Memories/*` · `19316` | PostgreSQL + Google Drive |
| Legacy API | `@workspace/api-server` | `/api/*` · `8080` | Legacy PostgreSQL/Object Storage |
| Mockup Sandbox | `@workspace/mockup-sandbox` | `/__mockup` · `8081` | Development preview |

Ordinary Memories changes must not modify：

```text
artifacts/wedding-invitation/**
artifacts/api-server/src/routes/photos.ts
```

`Memories legacy boundary` workflow protects these paths. A required legacy change needs explicit owner approval、narrow scope 與 legacy regression evidence。

## 2. Source of truth

當 code、文件、issue、prototype、scan report 不一致：

1. Current `main` code、migration、package manifest、lockfile。
2. Final production tests 與 browser evidence。
3. `DOCUMENTATION.md` 中 Current 文件。
4. Latest merged PR 與 CI。
5. Dated evidence 只代表其 commit/date。
6. Historical、Research、Issues、舊對話只作背景。

## 3. Data ownership

| Data | Canonical owner |
| --- | --- |
| Original photos／image attachments | Google Drive |
| Generated WebP thumbnails | Google Drive `系統縮圖` |
| Album、label、process、visibility、author、capture time | PostgreSQL |
| Guestbook messages | PostgreSQL |
| Upload batch、token hash、content hash、resumable state | PostgreSQL |
| Video、rich content、pinned/featured settings、site settings | PostgreSQL |
| Admin secret | `MEMORIES_ADMIN_TOKEN` in Replit Secret |

Browser 只能取得 opaque Memories IDs 與 controlled media routes。不得暴露 Drive ID、folder ID、connector response、credential、token hash 或 database URL。

## 4. Current product contracts

- 中文為預設，English routes 在 `/Memories/en/*`。
- Public route 使用 stable identity，不依 display order。
- 每個非 guest album 可有 album-scoped labels；generated all-album label 在第一位。
- Wedding process title 可覆蓋 public label text。
- Guest album 使用 all visitors、latest 與 uploader-name labels。
- Featured photos 必須隨 active album／label context 重算。
- Message album 顯示 guestbook；admin accordion 預設收合並延遲載入。
- Rich-content import 只支援 Word 相關格式；general attachment 只接受圖片。
- Upload 使用 `(batchId, clientUploadId)` durable identity、bounded concurrency 與 retry。
- Permanent delete 目前沒有 trash/restore。
- Migration 目前延伸到 `016_explicit_guest_album_membership.sql`。

## 5. Repository map

| Path | Responsibility |
| --- | --- |
| `artifacts/memories-album/src/client` | Public/Admin React、route/model、feature UI |
| `artifacts/memories-album/src/server` | HTTP handlers、repositories、Drive、uploads、messages、thumbnails |
| `artifacts/memories-album/src/app.mjs` | Production route/server composition |
| `artifacts/memories-album/vite.routes.config.js` | Production transform order/router |
| `artifacts/memories-album/*-ui-transform.mjs` | High-risk exact-string transforms |
| `artifacts/memories-album/db` | Immutable migrations |
| `artifacts/memories-album/test` | Node/API/source-contract tests |
| `artifacts/memories-album/e2e` | Production Playwright specs |
| `artifacts/memories-album/playwright.config.mjs` | Cross-browser/In-App profiles |
| `artifacts/memories-album/scripts/select-tests.mjs` | Test Impact Analysis |
| `.github/workflows/memories-fast-ci.yml` | Draft PR fast validation |
| `.github/workflows/memories-ci.yml` | Ready PR + full `main` integration |
| `.github/workflows/memories-cross-browser.yml` | Playwright production cross-browser gate |
| `.github/workflows/memories-legacy-boundary.yml` | Legacy boundary |

## 6. Local commands

Requirements：Node.js 24、pnpm 10.x。

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run build
```

Memories：

```bash
pnpm --filter @workspace/memories-album dev
pnpm --filter @workspace/memories-album test
pnpm --filter @workspace/memories-album run test:impact
pnpm --filter @workspace/memories-album run test:layout-browser
pnpm --filter @workspace/memories-album build
pnpm --filter @workspace/memories-album start
pnpm --filter @workspace/memories-album db:migrate
pnpm --filter @workspace/memories-album test:drive-live
```

Live Drive test 只能對 owner-approved test folder 執行，不能用 production wedding root 做破壞性測試。

## 7. Safe change workflow

1. 從最新 `main` 建 branch。
2. 定義最小 product/architecture/security contract。
3. 檢查是否碰 legacy、route、setting、migration、storage、dependency、transform。
4. 先建立最低層可證明行為的 test。
5. 實作最小變更。
6. 使用 impact selector，但 cross-cutting change 跑 full validation。
7. Build production bundle。
8. UI/transform change 跑 Playwright production gate。
9. 需要時做真機 evidence。
10. 同 PR 更新文件。
11. Required checks 通過後 merge。

## 8. Change-impact rules

### Route／navigation

檢查：

- direct route、refresh、Back/Forward；
- Chinese/English；
- opened photo route；
- invalid album/label fallback；
- async content positioning；
- message vs photo album type；
- bottom navigation visual viewport。

### Album／label／featured photos

保留：

- label belongs to album；
- generated all-label first；
- guest virtual labels；
- process title override；
- pagination/filter persistence；
- no featured-photo leakage between contexts。

### Settings

Setting 可能同時影響：default、normalizer、repository、public/admin API、bootstrap、draft/save、UI、test、docs。這仍是 Shotgun Surgery 風險；新工作優先建立 central registry，不再擴散獨立 key chain。

### Upload／document import

保留：

- durable upload identity；
- content-based duplicate handling；
- bounded concurrency/fair retry；
- resumable recovery；
- token hash/fragment privacy；
- original-before-thumbnail；
- Word-only import；
- image-only attachments；
- browser-width containment。

Admin upload classification 仍以 follow-up PATCH 完成，屬暫時限制，不是理想 architecture。

### Google Drive／media

保留 physical/logical split：

- Guest originals 留在 `訪客上傳`，logical classification 可不同。
- Thumbnails 留在 `系統縮圖`。
- Provider IDs server-side only。
- 手動刪 Drive original 不是完整 application delete。

其他雲端部署需要 Google Drive API 或 object-storage adapter。詳細見 [`docs/site-handbook/11-portability.md`](docs/site-handbook/11-portability.md)。

### Migration

- 新增 numbered SQL；不改已套用檔。
- 優先 additive expand/contract。
- 保留 checksum/advisory lock。
- Publish plan 有 unexpected DROP 就停止。
- 不使用 `drizzle-kit push` 管理 Memories production tables。

### Vite transform／build dependency

Exact-string transforms 仍是最大 production-only regression risk：

- 確認 `vite.routes.config.js` 順序。
- 測完整 transform chain。
- Production build。
- Playwright Chromium/Firefox/WebKit/In-App profiles。
- Fail on pageerror、console error、Error Boundary、blank screen、overflow。
- 每次 direct React composition 完成後立即刪對應 transform。

### Dependency／lockfile

- Frozen install。
- Current-lockfile SCA/SBOM。
- 小批 parent dependency update。
- 不盲用 `pnpm audit fix --force`。
- Full typecheck/build/Node/Playwright。
- Post-change SCA tied to final commit。

## 9. Testing model

| Stage | Validation |
| --- | --- |
| Draft PR | Impact-selected Fast CI |
| Ready PR | Formal impact-selected CI + safety fallback |
| Documentation-only | Skip executable install/tests；legacy boundary still runs |
| `main` push | Full Node + focused Chrome + production build + health smoke |
| UI/Playwright paths | Cross-browser production Playwright gate |

Cross-browser workflow covers：

- Chromium desktop/mobile；
- Firefox desktop；
- WebKit desktop/mobile；
- Samsung Internet representative；
- WeChat、LINE、Facebook、Instagram Android/iOS representative profiles。

這是 required automated production-browser coverage，但不是 physical-device proof。真機 matrix 見 [`docs/memories/phase-2-device-validation-2026-08-05.md`](docs/memories/phase-2-device-validation-2026-08-05.md)。

## 10. Production configuration

Required：

```text
DATABASE_URL
MEMORIES_DRIVE_PHOTOS_FOLDER_ID
MEMORIES_ADMIN_TOKEN
```

Published App 還需 Replit Google Drive Integration。

不提交／不記 log：

- database URL；
- Secret／OAuth；
- Drive folder/file ID；
- resumable session URI；
- raw private token；
- signed URL query；
- image bytes/provider raw response。

## 11. Release／rollback

Before release：

- Required CI green。
- Migration/backup reviewed。
- Secrets/Drive Integration present。
- Candidate commit/revision recorded。
- Documentation current。
- Physical-device residual risks recorded。

After release：

1. `/Memories/api/health`。
2. Chinese/English routes。
3. Albums、labels、processes、guestbook。
4. Featured photos context。
5. Thumbnail/original/viewer。
6. Admin login/all tabs。
7. Word content width。
8. Safe save/upload where appropriate。
9. Logs/metrics observation。

Rollback 是 code/revision rollback，不是刪 migration history。Previous code 必須能理解 current schema；否則 forward fix。

## 12. Incident first response

1. 記錄第一個 error、timestamp、environment、revision。
2. 分類：startup、migration、DB、Drive auth、Drive transient、browser、native dependency、individual data。
3. 保存 evidence。
4. 未知原因時停止重複 upload/delete。
5. 只修 proven root cause。
6. Run relevant tests/build/browser gate。
7. Deploy and re-verify。
8. 更新 diagnostic/runbook。

## 13. Documentation responsibilities

| Change | Update |
| --- | --- |
| Guest behavior | `EASY_USER_GUIDE.md` |
| Admin behavior | `ADMIN_GUIDE.md` |
| Replit/incident | `OPERATIONS_GUIDE.md` |
| Repository summary | `README.md` |
| API/storage/product contract | Memories technical README |
| Test/CI | `docs/memories/testing-strategy.md` |
| Multi-cloud/portable architecture | `docs/site-handbook/` |
| Route | logical-routes doc |
| Security/dependency | SCA/remediation docs |
| New specialist doc | `DOCUMENTATION.md` |

## 14. Definition of done

- [ ] Correct behavior at intended layer
- [ ] Stable routes and data ownership preserved
- [ ] Tests prove behavior
- [ ] Production build succeeds
- [ ] Playwright covers browser-sensitive change
- [ ] Physical-device evidence or accepted risk recorded
- [ ] Migration/legacy boundary safe
- [ ] Secrets/provider IDs server-side
- [ ] Current documentation updated
- [ ] Deferred risks stated, not implied solved
