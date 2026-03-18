# marriage-web (GitHub Pages + Supabase)

這是一個可部署到 GitHub Pages 的婚禮 RSVP 靜態網站，表單資料寫入 Supabase。

## 1) Supabase 設定

在 Supabase `SQL Editor` 執行：

- `supabase/schema.sql`

確保你已在專案中啟用：

- `Data API`
- `RLS`（可搭配 automatic RLS）

## 2) 前端設定

編輯 `assets/config.js`：

- `SUPABASE_URL`: 你的專案 URL
- `SUPABASE_ANON_KEY`: 你的 anon public key
- `TABLE_NAME`: 預設 `rsvp_submissions`
- `COOLDOWN_MS`: 送出冷卻時間（毫秒）

## 3) 本機測試

可用任一靜態伺服器啟動，例如：

```bash
python3 -m http.server 8080
```

然後開啟：`http://localhost:8080`

## 4) 部署 GitHub Pages

1. 將專案推到 GitHub（例如 `main` branch）
2. 到 repo `Settings > Pages`
3. `Source` 選 `Deploy from a branch`
4. 選 `main` + `/ (root)`
5. 等待部署完成

## 安全注意

- 前端可公開 `anon key`，這是 Supabase 預期用法。
- 絕對不要把 `service_role` key 放在前端。
- 權限安全依賴 RLS policy；請不要省略 `schema.sql` 的政策設定。
