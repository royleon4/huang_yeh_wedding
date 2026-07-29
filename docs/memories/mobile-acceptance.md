# Memories 手機驗收矩陣

此文件區分自動化可證明的 UI 契約與必須在正式環境取得的實機證據。「所有手機」不是可驗證的有限集合；Phase 1 的目標是覆蓋主要 viewport、iOS Safari、Android Chrome、鍵盤、安全區、橫向、大字體與弱網路。

## 已由 Node 測試與程式契約覆蓋

以下項目目前由 pure-helper、API behavior 與 source-contract 測試覆蓋；
它們證明實作存在，但**不是**真實 browser layout、focus 或裝置驗收：

- dialog Tab／Shift+Tab 循環、Escape、背景 inert 與焦點還原共用同一個 hook。
- lightbox 縮放為 1×–5×，拖曳位移受可見範圍限制。
- 320px 版型的箭頭疊在圖片上，不占用左右欄寬。
- modal 使用 `100dvh` 與 `env(safe-area-inset-*)`，z-index 高於底部導覽。
- 大分類與流程每次只請求 12 筆，使用 opaque cursor 載入下一頁。
- 480／960 WebP `srcset` 由 API 產生實際不同尺寸。
- 選圖超過 30 張會明確告知忽略數量；上傳前可預覽及移除單張。
- `online`／`offline` 事件會切換狀態，重新連線會重取目前頁面。
- 首屏前四張不是 lazy load，第一張設為高優先。

## 尚缺 browser-level 自動化

在 #48、#50 或 #13 關閉前，需以 Playwright 或等效真實瀏覽器 runner
補齊下列自動化，不能以 source regex 取代：

- 320×568、360×800、375×667、390×844、412×915、430×932、
  844×390、932×430 八個 viewport；
- 水平 overflow、safe area、dialog focus trap、background inert、scroll
  restore、Escape、鍵盤順序與 accessible names；
- offline、重新連線、stale cursor request、partial-page retry；
- upload 軟體鍵盤、30 張 queue、long filename 與 200% 文字。

## 手機效能預算（待正式量測）

| 指標 | Phase 1 目標 | 狀態 |
|---|---:|---|
| 首次照片 JSON | 最多 12 筆 | Node API contract 已驗證 |
| 手機卡片衍生圖 | 480／960 WebP | Node image contract 已驗證 |
| LCP（正式環境、模擬 Fast 4G） | ≤ 2.5 秒 | 待 browser 量測 |
| CLS | ≤ 0.1 | 待 browser 量測 |
| 初始照片傳輸量 | ≤ 1.5 MB | 待正式照片集量測 |
| 連續三頁 | 無重複、缺頁或 stale-filter 污染 | Node merge/request guard 已驗證；待 browser 驗證 |

## 正式環境實機矩陣

| 裝置／瀏覽器 | Viewport／情境 | 必驗項目 | 證據 |
|---|---|---|---|
| iPhone SE / Safari | 320×568、直向 | 無水平溢出、modal 可捲、lightbox 箭頭、底部按鈕 | 截圖＋操作錄影 |
| iPhone 13/14 / Safari | 390×844、瀏海安全區 | 上下 safe area、動態網址列、上傳 modal | 截圖＋操作錄影 |
| iPhone / Safari | 橫向、軟鍵盤 | 姓名欄可見、按鈕不被鍵盤遮住、旋轉不丟狀態 | 操作錄影 |
| Pixel / Chrome | 360×800 | 底部導覽、檔案選擇、返回鍵、弱網路重試 | 操作錄影 |
| Galaxy / Chrome | 412×915 | 200% 文字、長檔名、30 張清單 | 截圖＋操作錄影 |
| iPad / Safari | 768×1024、分割畫面 | responsive grid、dialog focus、橫直切換 | 截圖 |

## 每台裝置的操作腳本

1. 直接開啟並重新整理 `/Memories/`，確認 canonical route 與首屏。
2. 切換婚禮流程、訪客上傳、生活照；連續載入至少三頁。
3. 開啟第一張及最後一張照片，測試前後箭頭、滑動、雙指縮放、拖曳、錯誤重試與關閉。
4. 開啟上傳視窗，喚起鍵盤，選擇超過 30 張，移除中間一張，再上傳至少三張。
5. 在上傳中切換飛航模式再恢復，確認狀態與重試不重複建立 Drive 檔案。
6. 使用私人連結查看批次、撤回一張，確認公開相簿立即隱藏。
7. 管理員登入、關閉相簿、重新開放、移至垃圾桶及還原。
8. 將系統文字放大到 200%，再切換橫向；確認主要操作仍可到達且觸控目標至少 44px。
9. 使用鍵盤或外接鍵盤巡覽所有 dialog，確認焦點不會跑到背景。

## 完成標準

- 每個矩陣列都有裝置、OS、瀏覽器版本、時間與證據連結。
- 沒有 P0／P1 問題；P2 必須有 owner、ticket 與發布決策。
- iOS Safari 與 Android Chrome 至少各一台實機，不可以只用 DevTools 模擬取代。
- Memories 手機與效能證據貼回 Issues #48、#50、#13；視覺比較貼回
  #26。#19 只追蹤 legacy 相片牆的 list、upload、preview、lightbox 與部署
  regression 證據。只有相應證據完成後才可關閉。
