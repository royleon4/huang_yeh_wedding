# 文件導覽、狀態與維護規則

> **最後完整審查：** 2026-08-01T19:33:00+08:00（Asia/Taipei）  
> **審查基準：** `main` commit `4fb33f0655eca557c6755066bce8083b0f15c7df`  
> **產品狀態：** Standalone Memories Product Phase 1 complete

這一頁回答三個問題：

1. **我是哪一種使用者，應該讀哪一份？**
2. **這份文件是在說目前網站、歷史設計、診斷紀錄，還是未來研究？**
3. **開發者改完功能後，要更新哪些文件？**

完整審查紀錄見 [`docs/documentation-audit-2026-08-01.md`](docs/documentation-audit-2026-08-01.md)。

## Phase 名稱不要混用

本 repository 曾有兩組都叫「Phase 1」的內容：

- **Product Phase 1：已完成。** 指公開照片館、訪客上傳、私人管理、管理後台、Drive／PostgreSQL 儲存與部署基線。
- **Architecture hardening／code-health risk containment：尚未完成。** 指 Playwright、移除 exact-string transforms、settings registry、domain services 等工程工作。

目前交接與後續順序見 [`docs/phase-1-closeout-2026-08-01.md`](docs/phase-1-closeout-2026-08-01.md)。

## 依角色選文件

### 親友／賓客

先看 [`EASY_USER_GUIDE.md`](EASY_USER_GUIDE.md)。

適合：

- 只想看照片的人
- 想切換中文／英文的人
- 想上傳照片的人
- 已經上傳、需要管理自己那一批照片的人
- 不熟悉電腦或手機操作的人

### 網站管理員／內容編輯者

先看 [`ADMIN_GUIDE.md`](ADMIN_GUIDE.md)。

適合：

- 修改首頁首圖、標題、配色或網站圖示
- 修改公開文字
- 管理相簿、流程、影片、文章與附件
- 管理訪客姓名標籤
- 上傳、分類、隱藏或永久刪除照片
- 重新掃描 Drive 或重建縮圖

### 網站擁有者／部署維運者

先看 [`OPERATIONS_GUIDE.md`](OPERATIONS_GUIDE.md)。

適合：

- 設定 Replit Secrets 與 Google Drive Integration
- 發布新版本
- 檢查 migration 與 health endpoint
- 處理 Drive 權限、縮圖、啟動或部署問題
- 判斷哪些資料可以從後台刪除、哪些不能直接在 Drive 操作
- 依 [`docs/memories/production-to-development-database-runbook.md`](docs/memories/production-to-development-database-runbook.md) 備份 Development、以 Production 覆蓋 Development，或還原原本 Development

### 開發者／維護者

依序閱讀：

1. [`README.md`](README.md)
2. [`MAINTAINER_GUIDE.md`](MAINTAINER_GUIDE.md)
3. [`artifacts/memories-album/README.md`](artifacts/memories-album/README.md)
4. [`artifacts/memories-album/test/README.md`](artifacts/memories-album/test/README.md)
5. 與正在修改功能直接相關的專題文件

### 重構或長期開發者

再看：

- [`docs/code-health-audit-2026-07.md`](docs/code-health-audit-2026-07.md)
- [`docs/phase-1-closeout-2026-08-01.md`](docs/phase-1-closeout-2026-08-01.md)
- [`docs/memories/legacy-protection.md`](docs/memories/legacy-protection.md)
- 完整 production transform chain 的相關測試與 `vite.routes.config.js`

## 文件狀態定義

| 狀態 | 意義 |
| --- | --- |
| Current | 描述目前 `main` 的行為或必要操作 |
| Historical | 保留早期設計與決策背景，不是目前 contract |
| Superseded | 已被其他文件或實作取代 |
| Research | 可行性與探索，不能視為已批准功能 |
| Diagnostic | 特定事故或故障類型的證據與處理方式 |
| Internal | 給 agent／維護者的短期記憶，不能取代正式文件 |

## 目前有效的文件

### 使用者與操作

| 文件 | 主要讀者 | 狀態 |
| --- | --- | --- |
| [`EASY_USER_GUIDE.md`](EASY_USER_GUIDE.md) | 親友、賓客、上傳者 | Current |
| [`ADMIN_GUIDE.md`](ADMIN_GUIDE.md) | 管理員、內容編輯者 | Current |
| [`OPERATIONS_GUIDE.md`](OPERATIONS_GUIDE.md) | 擁有者、部署與維運者 | Current |
| [`docs/memories/production-to-development-database-runbook.md`](docs/memories/production-to-development-database-runbook.md) | Database copy／rollback operator | Current verified runbook |
| [`README.md`](README.md) | 所有人 | Current repository entry |

### 開發、維護與交接

| 文件 | 主題 | 狀態 |
| --- | --- | --- |
| [`MAINTAINER_GUIDE.md`](MAINTAINER_GUIDE.md) | 開發流程、change impact、測試、migration、release 與事故處理 | Current |
| [`docs/phase-1-closeout-2026-08-01.md`](docs/phase-1-closeout-2026-08-01.md) | Product Phase 1 交接、限制與後續工作 | Current dated handoff |
| [`docs/memories/content-navigation-achievement-2026-08-02.md`](docs/memories/content-navigation-achievement-2026-08-02.md) | 子分類內容定位重構、驗證與實際驗收紀錄 | Current dated achievement |
| [`docs/documentation-audit-2026-08-01.md`](docs/documentation-audit-2026-08-01.md) | 本次文件盤點與修正紀錄 | Current dated audit |
| [`replit.md`](replit.md) | Replit workspace 與 artifact context | Current |
| [`artifacts/memories-album/README.md`](artifacts/memories-album/README.md) | Memories 完整技術概覽 | Current |
| [`artifacts/memories-album/test/README.md`](artifacts/memories-album/test/README.md) | 測試層級、fixture 與 validation conventions | Current |
| [`docs/code-health-audit-2026-07.md`](docs/code-health-audit-2026-07.md) | 技術債與重構順序 | Current dated audit |

### 路由、架構、儲存與功能 contract

| 文件 | 主題 | 狀態 |
| --- | --- | --- |
| [`artifacts/memories-album/docs/logical-routes.md`](artifacts/memories-album/docs/logical-routes.md) | 穩定身分網址與遷移路由 | Current |
| [`docs/memories/admin-route.md`](docs/memories/admin-route.md) | 管理員路由與 cookie boundary | Current |
| [`docs/memories/architecture-boundary.md`](docs/memories/architecture-boundary.md) | Memories 與 legacy 邊界 | Current |
| [`docs/memories/storage-drive.md`](docs/memories/storage-drive.md) | Google Drive 與 PostgreSQL 資料責任 | Current |
| [`docs/memories/drive-process-sync.md`](docs/memories/drive-process-sync.md) | 流程資料夾同步與 write-through | Current |
| [`docs/memories/legacy-protection.md`](docs/memories/legacy-protection.md) | 舊邀請網站保護規則 | Current |
| [`artifacts/memories-album/docs/site-style-wheel-and-viewer.md`](artifacts/memories-album/docs/site-style-wheel-and-viewer.md) | 首頁樣式、網站圖示、輪盤、導覽與照片檢視器 | Current |

### 診斷、歷史與研究

| 文件 | 用途 | 狀態 |
| --- | --- | --- |
| [`artifacts/memories-album/docs/drive-chunk-diagnostic.md`](artifacts/memories-album/docs/drive-chunk-diagnostic.md) | 403／stale resumable session 診斷 | Diagnostic |
| [`docs/memories/visual-baseline.md`](docs/memories/visual-baseline.md) | 早期視覺方向與 prototype requirement | Historical／partly superseded |
| [`docs/memories/compreface-feasibility.md`](docs/memories/compreface-feasibility.md) | 未來人物／自拍搜尋的 CompreFace 可行性 | Research／not approved |

### Internal agent memory

| 文件 | 用途 | 狀態 |
| --- | --- | --- |
| [`.agents/memory/MEMORY.md`](.agents/memory/MEMORY.md) | Internal memory index | Internal |
| [`.agents/memory/memories-project-overview.md`](.agents/memory/memories-project-overview.md) | 短版現況與正式文件入口 | Internal |
| [`.agents/memory/csp-dev-preamble.md`](.agents/memory/csp-dev-preamble.md) | Vite dev CSP 診斷 | Internal diagnostic |
| [`.agents/memory/admin-token-envvar.md`](.agents/memory/admin-token-envvar.md) | `MEMORIES_ADMIN_TOKEN` 規則 | Internal diagnostic |

`.agents/skills/**` 是第三方或通用 skill reference，不屬於本專案事實文件，不能用來判斷目前網站功能。

## 歷史、規格與研究文件怎麼看

Repository、GitHub Issues、舊對話匯出與設計草稿中，可能仍看得到：

- 原型只把資料存在目前瀏覽器
- `/admin/login` 或 `SECRET_TOKEN`
- `groupN/subgroupN` 作為主要網址
- 固定十二個 bundled 流程
- 訪客照片永遠不能分類到婚禮流程
- 七天垃圾桶與可復原刪除
- Amazon Rekognition、CompreFace、人物分類或自拍找照片
- 一次最多固定 10 張或固定 30 張

這些內容可能是原型、歷史規格、未完成計畫或已被新實作取代的決策，不能單獨用來判斷目前網站。

## 目前事實的判斷順序

1. `main` 分支目前程式、migration 與最終 production tests
2. 本頁列為 Current 的文件
3. 最近已合併 PR 的驗證結果
4. Diagnostic 文件只用於對應故障
5. Historical、Research、Issues 與舊對話只作背景或未來需求

## 目前已明確決定的行為

- 管理入口是 `/Memories/admin/login`。
- 管理 secret 是 `MEMORIES_ADMIN_TOKEN`。
- 公開相簿使用穩定身分網址；舊 ordinal 網址只作遷移入口。
- 訪客與管理員每次選取上限可以分別設定為 1～100；預設是 10 與 30。
- 永久刪除目前不能復原，沒有七天垃圾桶。
- 人物分類與自拍找照片尚未實作，也沒有已批准的 provider。
- Google Drive 原圖不應直接手動刪除；應使用管理後台或私人管理頁完成整體清理。
- CI 尚未以 Playwright 證明完整 production browser render。
- exact-string Vite transforms 仍是主要維護風險。

## 文件維護規則

每次新增或改變使用者可見功能時：

1. 更新對應角色指南。
2. 更新 root README 的功能摘要或文件入口。
3. 若涉及 API、設定、資料責任、migration、route 或 security，更新對應技術文件。
4. 若改變開發或 release 流程，更新 `MAINTAINER_GUIDE.md`。
5. 若新增專題文件，加入本頁索引並標示 lifecycle。
6. 若舊文件被取代，在檔案開頭標示 Historical、Superseded、Research 或 Diagnostic。
7. 不在文件中放 secret、OAuth 憑證、私人 token、Drive folder ID、session URI 或真實管理密碼。
8. 文件只能把已實作並經驗證的行為描述為 Current；未完成項目必須明確標示為未來工作。
9. 日期型交接或稽核使用 ISO 8601 並包含 timezone。
10. Product phase closeout 後，每個重大 architecture milestone 都應更新 closeout／roadmap 狀態。

## 快速判斷

- **我要操作網站**：讀角色指南。
- **我要部署或救網站**：讀維運指南。
- **我要把 Production database 覆蓋到 Development，或還原原本 Development**：讀 [`docs/memories/production-to-development-database-runbook.md`](docs/memories/production-to-development-database-runbook.md)。
- **我要改程式**：讀 Maintainer Guide、技術 README 與對應專題文件。
- **我要知道 Phase 1 留下什麼與下一步**：讀 Phase 1 closeout。
- **我要知道以前為什麼這樣設計**：再看 Historical、Research、Issues 與日期型 audit。
