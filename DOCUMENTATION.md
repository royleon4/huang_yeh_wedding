# 文件導覽與狀態說明

這一頁回答兩個問題：

1. **我是哪一種使用者，應該讀哪一份？**
2. **這份文件是在說現在的網站，還是以前的計畫？**

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

### 開發者

依序閱讀：

1. [`README.md`](README.md)
2. [`artifacts/memories-album/README.md`](artifacts/memories-album/README.md)
3. [`artifacts/memories-album/docs/logical-routes.md`](artifacts/memories-album/docs/logical-routes.md)
4. [`docs/memories/architecture-boundary.md`](docs/memories/architecture-boundary.md)
5. 與正在修改功能直接相關的專題文件

### 重構或長期維護者

除了開發者文件，再看：

- [`docs/code-health-audit-2026-07.md`](docs/code-health-audit-2026-07.md)
- [`docs/memories/legacy-protection.md`](docs/memories/legacy-protection.md)
- 完整 production transform chain 的相關測試

## 目前有效的文件

### 使用者與操作

| 文件 | 主要讀者 | 狀態 |
| --- | --- | --- |
| [`EASY_USER_GUIDE.md`](EASY_USER_GUIDE.md) | 親友、賓客、上傳者 | 現行 |
| [`ADMIN_GUIDE.md`](ADMIN_GUIDE.md) | 管理員、內容編輯者 | 現行 |
| [`OPERATIONS_GUIDE.md`](OPERATIONS_GUIDE.md) | 擁有者、部署與維運者 | 現行 |
| [`README.md`](README.md) | 所有人 | 現行入口 |

### 技術與架構

| 文件 | 主題 | 狀態 |
| --- | --- | --- |
| [`artifacts/memories-album/README.md`](artifacts/memories-album/README.md) | Memories 完整技術概覽 | 現行 |
| [`artifacts/memories-album/docs/logical-routes.md`](artifacts/memories-album/docs/logical-routes.md) | 穩定身分網址與遷移路由 | 現行 |
| [`artifacts/memories-album/docs/site-style-wheel-and-viewer.md`](artifacts/memories-album/docs/site-style-wheel-and-viewer.md) | 首頁樣式、輪盤循環、底部導覽與照片檢視器 | 現行 |
| [`docs/memories/architecture-boundary.md`](docs/memories/architecture-boundary.md) | Memories 與 legacy 邊界 | 現行 |
| [`docs/memories/storage-drive.md`](docs/memories/storage-drive.md) | Google Drive 儲存責任 | 現行 |
| [`docs/memories/drive-process-sync.md`](docs/memories/drive-process-sync.md) | 流程資料夾同步 | 現行 |
| [`docs/memories/legacy-protection.md`](docs/memories/legacy-protection.md) | 舊邀請網站保護規則 | 現行 |
| [`docs/code-health-audit-2026-07.md`](docs/code-health-audit-2026-07.md) | 技術債與重構順序 | 現行稽核，日期型文件 |

## 歷史、規格與研究文件怎麼看

Repository、GitHub Issues、舊對話匯出與設計草稿中，可能仍看得到下列內容：

- 原型只把資料存在目前瀏覽器
- `/admin/login` 或 `SECRET_TOKEN`
- `groupN/subgroupN` 作為主要網址
- 七天垃圾桶與可復原刪除
- Amazon Rekognition、人物分類或自拍找照片
- 一次最多固定 10 張或固定 30 張

這些內容可能是**原型、舊規格、未完成計畫或已被新實作取代的決策**，不能單獨用來判斷目前網站。

目前應以以下順序判斷事實：

1. `main` 分支目前程式與測試
2. 本頁列為「現行」的文件
3. 最近已合併 PR 的驗證結果
4. GitHub Issue、研究文件與舊對話，只作為背景或未來需求

## 目前已明確決定的行為

- 管理入口是 `/Memories/admin/login`。
- 管理 secret 是 `MEMORIES_ADMIN_TOKEN`。
- 公開相簿使用穩定身分網址；舊 ordinal 網址只作遷移入口。
- 訪客與管理員每次選取上限可以分別設定為 1～100；預設是 10 與 30。
- 永久刪除目前不能復原，沒有七天垃圾桶。
- 人物分類與自拍找照片尚未實作。
- Google Drive 原圖不應直接手動刪除；應使用管理後台或私人管理頁完成整體清理。

## 文件維護規則

每次新增或改變使用者可見功能時：

1. 更新對應角色指南。
2. 更新 root README 的功能摘要或文件入口。
3. 若涉及 API、設定、資料責任或 migration，再更新技術 README。
4. 若新增專題文件，加入本頁索引。
5. 若舊文件被取代，在檔案開頭標示 `Historical`、`Superseded` 或移到明確的 archive 區域。
6. 不在文件中放 secret、OAuth 憑證、私人 token、Drive folder ID 或真實管理密碼。
7. 文件只能描述已實作並經驗證的行為；未完成項目必須明確標示為未來工作。

## 快速判斷

- **我要操作網站**：讀角色指南。
- **我要部署或救網站**：讀維運指南。
- **我要改程式**：讀技術 README 與對應專題文件。
- **我要知道以前為什麼這樣設計**：再去看 Issues、稽核、研究與歷史文件。