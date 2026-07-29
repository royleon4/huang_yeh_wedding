# Memories Phase 1 上線驗收

## 自動檢查

從 repo root 執行：

```bash
pnpm --filter @workspace/memories-album test
pnpm --filter @workspace/memories-album build
```

必須確認 migration `001`–`008` 均存在，production migration preflight 只套用 pending 檔案，且 legacy 邊界 CI 通過。

## Replit Production smoke test

1. 連線 Replit Google Drive Integration。
2. 確認 `DATABASE_URL`、`MEMORIES_DRIVE_PHOTOS_FOLDER_ID`、`MEMORIES_ADMIN_TOKEN` 為 Production Secrets。
3. Publish／Restart 後確認：
   - `GET /Memories/api/health` 回 200（liveness）。
   - `GET /Memories/api/ready` 回 200（Database＋Drive readiness）。
   - `/Memories/`、`/memories/` redirect、直接 refresh 與靜態 assets 正常。
4. 執行 `pnpm --filter @workspace/memories-album test:drive-live`：
   - 建立測試檔。
   - 讀回並比對內容。
   - 刪除測試檔。
   - 確認 Drive 沒有殘留。
5. 暫時中斷 Drive Integration，再重新連線；等待 bounded backoff 後 `/ready` 必須自行恢復，不可要求 Restart。
6. 上傳三張照片並驗證：
   - PostgreSQL 只保存 Drive ID 與必要 metadata。
   - 480／960 縮圖及受控原圖端點正常。
   - 公開回應沒有 Drive ID、guest 姓名或 EXIF/GPS。
7. 私人連結可查看自己的批次、撤回自己的照片、旋轉 token；舊 token 立即失效。
8. 管理員可關閉／重開相簿、管理批次與流程；raw password 不存在 sessionStorage。
9. 將照片移至垃圾桶，確認公開／私人查詢立即隱藏；七天內還原保留批次與流程關聯。
10. 以測試資料或可控時鐘驗證到期 cleanup：
    - 先刪縮圖，再刪原圖。
    - Drive 404 視為成功。
    - 暫時失敗保留 job 與 file ID，下一輪可恢復。

## 安全檢查

- HTML 與 API 具有 CSP、Referrer-Policy、Permissions-Policy、X-Frame-Options、COOP/CORP 與 HSTS。
- 管理 cookie 為 `HttpOnly; Secure; SameSite=Strict`，30 分鐘到期。
- 管理登入、管理 API、建立批次與照片上傳均有 rate limit。
- 公開 guest 照片不顯示 uploader name；姓名只供私人批次與管理用途。
- 公開媒體由 `PublicMediaService` 清除 metadata 後輸出。
- Repo、Replit 設定與瀏覽器 bundle 均無管理密碼、Drive folder ID 或 Google token。

## 手機與視覺

依 [`mobile-acceptance.md`](./mobile-acceptance.md) 完成 iOS／Android 實機矩陣，並依 [`visual-baseline.md`](./visual-baseline.md) 附 before／after 與主要 viewport 截圖。

## 發布與回滾

- 發布前記錄 `main` commit、migration 清單與 Drive root。
- migration 為 additive；不要以刪表作為應急回滾。
- 若新 UI 有問題，可回滾應用 commit；已進垃圾桶的資料與 cleanup jobs 必須保留。
- 若 Drive／DB not ready，關閉相簿並保留管理存取，修復依賴後等待 runtime 自行恢復。
- 完整證據貼到 Issues #13、#19、#26，再由 owner 決定 Phase 1 go／no-go。
