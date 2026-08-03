# Memories 分層測試策略

最後更新：2026-08-03（Asia/Taipei）

本專案採用 Test Impact Analysis（測試影響分析）與 Selective Test Execution（選擇性測試執行）。目標不是刪除測試，而是把測試放到正確的開發階段。

## PR 狀態與測試層級

### Draft PR：Fast CI

開發中的 PR 應保持 Draft。每次 push 由 `Standalone Memories Fast CI`：

1. 讀取 PR base 與 head 的 `git diff --name-only`。
2. 由 `artifacts/memories-album/scripts/select-tests.mjs` 判斷影響範圍。
3. 只執行受影響的 Node 測試。
4. 只有版面相關變更才執行對應 Chrome 測試。
5. 只有 build、runtime、Vite 或 workspace 等高風險變更才提前 build。
6. 新 push 會取消同一 PR 尚未完成的舊 Fast CI。

文件變更不安裝 dependencies，也不執行功能測試。

### Ready for review：Full CI

功能完成後把 PR 標記為 Ready for review。`Standalone Memories Full CI` 會執行：

1. 全部 Node 單元與 API 測試。
2. 導覽與留言兩個 Chrome 版面測試。
3. Production build。
4. Production server health smoke test。

Ready 狀態下若再次 push，Full CI 會重新執行，舊的執行會被取消。若要繼續大量開發，先把 PR 轉回 Draft。

### Merge 到 main

合併到 `main` 後，Full CI 再執行一次，驗證實際主分支 commit。

### Legacy boundary

`Memories legacy boundary` 在每個 PR 都執行，並使用 concurrency 取消過期執行。它保護舊婚禮網站與舊照片 API，不受 Fast／Full 分層影響。

## 影響選擇規則

目前選擇器支援以下主要群組：

| 變更 | Fast CI |
| --- | --- |
| 留言前台、後台、API、repository、排序 | 留言相關 Node 測試 |
| 留言前台或 CSS | 留言測試 + Guestbook Chrome |
| 底部導覽、流程輪盤、內容定位 | 導覽相關 Node 測試 + Navigation Chrome |
| migration／持久層 | migration 與 PostgreSQL 相關測試 |
| Vite、runtime、app、build、package、lockfile、CI | 全部 Node 測試 + 全部 Chrome + build |
| 未知 client 變更 | 安全回退：全部 Node 測試 + 全部 Chrome |
| 未知 executable 變更 | 安全回退：全部 Node 測試 |
| 只有 Markdown／文字文件 | 不跑 executable tests |

選擇器無法找到對應測試時，會回退到完整 Node 測試，不會靜默跳過。

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
  artifacts/memories-album/src/client/MessageAlbum.jsx
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
2. 在 `select-tests.mjs` 加入功能檔案 pattern。
3. 將相關測試檔 pattern 加入 `TEST_GROUPS`。
4. 判斷是否需要 Chrome 測試。
5. 在 `test/test-selection.test.mjs` 加入選擇器回歸測試。
6. 無法明確分類時，保留 full fallback。

不要因為 Fast CI 而移除 Full CI 測試。Fast CI 是縮短開發回饋時間；Ready 與 main 仍是完整品質閘門。
