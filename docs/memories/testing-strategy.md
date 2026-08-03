# Memories 分層測試策略

最後更新：2026-08-04（Asia/Taipei）

本專案採用 Test Impact Analysis（測試影響分析）與 Selective Test Execution（選擇性測試執行）。目標不是刪除測試，而是讓每次 commit 優先驗證實際受影響的程式碼，同時保留無法判定與主分支整合時的完整安全網。

## PR 狀態與測試層級

### Draft PR：Fast CI

開發中的 PR 應保持 Draft。每次 push 只由 `Standalone Memories Fast CI` 執行：

1. 讀取 PR base 與 head 的 `git diff --name-only`。
2. 由 `artifacts/memories-album/scripts/select-tests.mjs` 判斷影響範圍。
3. 優先只執行直接或間接受影響的 Node 測試。
4. 只有對應版面相關變更才執行 Guestbook、Navigation 或全部 focused Chrome 測試。
5. 只有 production transform、build、runtime、Vite、workspace 或其他高風險變更才 build。
6. 新 push 會取消同一 PR 尚未完成的舊 Fast CI。

Fast CI 的 job 僅在 PR 仍為 Draft 時執行。PR 已 Ready 時，即使 GitHub 事件同時觸發 Fast workflow，該 job 也會跳過，避免和 Ready workflow 重複跑相同測試。

文件變更不安裝 dependencies，也不執行功能測試。

### Ready for review：影響範圍 CI

功能完成後把 PR 標記為 Ready for review。`Standalone Memories Full CI` 保留原本的正式 check 名稱，但對 PR commit 改採相同的影響分析：

1. 找到與變更模組直接 import、間接 import 或在 source-contract 測試中被引用的測試。
2. 加上留言、導覽、migration 等既有功能群組測試。
3. 只在實際影響版面時跑對應 Chrome 測試。
4. 只在 build surface 受影響時執行 production build 與 server health smoke test。
5. 無法證明任何相關測試時，回退完整 Node 測試；不會靜默略過未知 executable change。

因此 Ready PR 再次 push 時，不再固定執行全部 Node、兩組 Chrome、build 與 smoke。它仍比 Draft 更接近正式品質閘門，但測試範圍由實際 diff 決定。

### Merge 到 main

合併到 `main` 後，`Standalone Memories Full CI` 固定執行完整整合驗證：

1. 全部 Node 單元與 API 測試。
2. 全部 focused Chrome layout 測試。
3. Production build。
4. Production server health smoke test。

`workflow_dispatch` 也使用同一完整模式。這是選擇性 PR 測試之外的最終安全網。

### Legacy boundary

`Memories legacy boundary` 在每個 PR 都執行，並使用 concurrency 取消過期執行。它保護舊婚禮網站與舊照片 API，不受 Fast／Ready 分層影響。

## 影響選擇方式

選擇器依序使用以下證據：

1. **直接修改的測試檔**：該測試本身必須執行。
2. **ES module dependency graph**：測試直接或經其他模組 import 到變更檔時，視為相關測試。
3. **Source reference**：測試使用 `readFile` 或 source-contract 方式引用變更檔名／路徑時，視為相關測試。
4. **檔名語意**：變更檔與測試檔具有足夠的功能 token 關聯時，加入候選。
5. **既有功能群組**：留言、導覽、migration 仍保留明確群組，以涵蓋跨模組 contract。
6. **安全回退**：無法證明任何測試關聯的 executable change 才執行完整測試。

## 主要規則

| 變更 | PR commit 驗證 |
| --- | --- |
| 直接修改 `.test.mjs` | 只跑該測試，加上其他變更所需測試 |
| 一般 client/server 模組 | 依 import graph、source reference 與檔名關聯選測試 |
| 留言前台、後台、API、repository、排序 | 留言相關 Node 測試；視覺檔再加 Guestbook Chrome |
| 底部導覽、流程輪盤、內容定位、route | 導覽相關 Node 測試；視覺檔再加 Navigation Chrome |
| migration／持久層 | migration 與 PostgreSQL 相關測試 |
| production `*-ui-transform.mjs` | 相關 Node 測試 + production build；不因此強制全部 Node 測試 |
| runtime、入口、Vite route config、package、lockfile、CI workflow | 全部 Node + 全部 Chrome + build |
| 無法對應的 executable change | 安全回退完整 Node 測試；client 視覺面再加 Chrome |
| 只有 Markdown／文字文件 | 不跑 executable tests |
| push 到 `main`／手動 dispatch | 固定完整 Node + 全部 Chrome + build + smoke |

## 為什麼仍保留完整回退

選擇性測試只能在「能證明關聯」時縮小範圍。下列情況仍視為跨領域風險：

- application/runtime 入口
- Vite route transform chain 的總配置
- package 或 workspace dependency
- lockfile
- build scripts
- CI workflow 自身
- 新增但沒有任何現有測試引用或可辨識功能名稱的 executable file

這些變更若錯誤分類，可能讓整個應用無法啟動，因此不能只憑檔名猜測。

## 本機命令

查看上一個 commit 的測試影響：

```bash
pnpm --filter @workspace/memories-album run test:impact
```

比較指定 refs：

```bash
node artifacts/memories-album/scripts/select-tests.mjs origin/main HEAD
```

直接模擬檔案：

```bash
node artifacts/memories-album/scripts/select-tests.mjs --files \
  artifacts/memories-album/src/client/guest-featured-photos.mjs
```

只跑留言 Chrome：

```bash
pnpm --filter @workspace/memories-album run test:layout-guestbook
```

只跑導覽 Chrome：

```bash
pnpm --filter @workspace/memories-album run test:layout-navigation
```

跑全部 Chrome：

```bash
pnpm --filter @workspace/memories-album run test:layout-browser
```

跑完整 Node 測試：

```bash
pnpm --filter @workspace/memories-album run test
```

## 維護選擇器

新增功能時：

1. 建立或確認對應測試檔。
2. 優先讓測試直接 import 被測模組；選擇器會自動建立反向 dependency graph。
3. Source-contract 測試應保留明確檔名或相對路徑，讓選擇器可辨識引用。
4. 只有真正跨模組的產品領域才新增 `TEST_GROUPS` pattern。
5. 判斷是否需要 Guestbook、Navigation 或全部 Chrome 測試。
6. 在 `test/test-selection.test.mjs` 加入選擇器回歸測試。
7. 無法明確分類時，保留 full fallback，不得把未知檔案改成無測試。

選擇性 PR 測試不能取代 `main` 的完整整合驗證。若發現漏測，應補 dependency/reference mapping 或功能群組，而不是長期把所有 PR commit 恢復成完整測試。
