# eagle-tasks · EagleAI 團隊地圖

像 draw.io 一樣可以無限拖曳、縮放的白板，一眼看到 EagleAI 現在在做什麼、誰負責。資料存在 Google Sheet，透過 Apps Script 讀寫。

```
EagleAI 團隊
 ├─ 客戶 / 產品線（框）     例：福懋建設、PMS 工程管理、現場巡檢與 AI
 │   ├─ 專案（卡片）       狀態、對外窗口、切入建議、下一步、進度條
 │   │   └─ 任務            狀態、負責人、截止日、優先度
 └─ 成員                   職稱、專長（找他談什麼）、聯絡方式
```

## 老闆怎麼用

| 情境 | 操作 |
| --- | --- |
| 客戶提到某件事，要知道從哪切入 | 上方搜尋框（⌘K 或 `/`）輸入公司名、產業或需求關鍵字 → 選結果 → 畫面飛過去，右側顯示**切入指南**：該找誰、可以聊哪些專案、每個專案的「切入建議」 |
| 想知道某人手上有什麼 | 點下方成員列的人 → 只亮他相關的框與任務；點兩下看他的詳細資料 |
| 看全貌 | 縮小畫面，卡片會自動簡化成只剩名稱（語意縮放） |

畫布操作：拖曳空白處或按住空白鍵拖曳可以平移；滾輪或觸控板也能平移；⌘/Ctrl＋滾輪或觸控板捏合可以縮放；`Shift+1` 全部顯示；拖曳框的標題可以搬動位置，位置會存回 Sheet。

## 開發

```bash
# .npmrc 已設定 @duckdev45 → GitHub Packages，需要能讀 eagle-component 的 token
pnpm install
cp .env.example .env.local   # 填 VITE_GAS_URL / VITE_GAS_TOKEN；留空就是 Demo 模式
pnpm dev
```

- **Demo 模式**（`VITE_GAS_URL` 留空）：資料存在瀏覽器 localStorage，附範例資料，可以從「新增 → 重設 Demo 資料」還原。
- **Google Sheet 模式**：讀寫 Apps Script Web App。每 60 秒自動重新整理一次，寫入是先更新畫面再同步，失敗時會跳通知並重新載入。

## Google Sheet / Apps Script 設定

1. 開一份 Google Sheet → **擴充功能 → Apps Script**，把 `gas/Code.gs` 整份貼上。
2. **專案設定 → 指令碼屬性**新增 `API_TOKEN`，值要和 `.env.local` 的 `VITE_GAS_TOKEN` 一樣。
3. 在編輯器執行一次 `setup()`（授權並建立 `domains / projects / tasks / members` 四個分頁），再執行 `seedTeam()` 寫入團隊目前的成員與專案。分頁已經有資料時 `seedTeam()` 會拒絕執行；要整個清掉重寫請用 `resetToSeed()`（網頁上的修改會全部消失）。
4. **部署 → 新增部署 → 網頁應用程式**：執行身分選「我」，誰可以存取選「**任何人**」。如果選「網域內使用者」，跨網域 fetch 會被導到登入頁，前端就讀不到資料。
5. 之後改了 `Code.gs`：**管理部署 → 編輯 → 新版本**，網址不會變。

> ⚠️ `VITE_GAS_TOKEN` 會被打包進前端 JS，所以它只是「防止路人亂寫」，不算真正的權限控管。拿到網頁的人都看得到資料。如果之後要限制只有公司帳號能看，比較好的做法是改用 Apps Script `HtmlService` 直接提供頁面，搭配「網域內使用者」部署。

### 資料欄位

| 分頁 | 欄位 |
| --- | --- |
| `domains` | id, name, kind (`client`/`sector`/`internal`), keywords, description, clientContact, leadId, color (`teal`/`violet`/`accent`/`info`/`primary`/`neutral`), x, y, order |
| `projects` | id, domainId, name, status (`planning`/`active`/`paused`/`done`), ownerId, summary, **pitch（切入建議）**, nextStep, tags, dueDate, link, order |
| `tasks` | id, projectId, title, assigneeId, status (`todo`/`doing`/`review`/`done`), priority (`high`/`mid`/`low`), dueDate, note, order |
| `members` | id, name, title, expertise, email, phone, line, order |

每個分頁都另外有 `updatedAt`（自動填）。可以直接在 Sheet 上編輯，欄位順序也可以調整，程式是依照標題列對應欄位；`id`、日期、電話這些欄位已經設成純文字，避免被 Sheets 自動轉型。

### 種子資料

成員、客戶／產品線、專案、任務的初始資料只寫在 `seed/build_seed.py`。改完執行：

```bash
python3 seed/build_seed.py
```

它會同時更新 `src/data/seed.ts`（Demo 模式用）和 `gas/Code.gs` 裡的 `SEED` 區塊，再把 `Code.gs` 貼回 Apps Script。

## 部署前端（Vercel）

```
瀏覽器 ──▶ Vercel CDN ──▶ api/board.ts ──▶ Apps Script ──▶ Google Sheet
            快取 60 秒，過期先回舊資料、背景更新
```

Apps Script 每次呼叫要 4～5 秒，冷啟動 30 秒以上，所以正式環境不讓瀏覽器直接打它：

- `GET /api/board`：資料在 Vercel CDN 快取 60 秒，過期後先回舊的、背景再向 Apps Script 更新，任何人（含無痕、第一次打開）都是秒開。
- `POST /api/board`：寫入時由伺服器端補上 token 轉給 Apps Script，token 不會出現在前端 JS。
- 剛寫入的 2 分鐘內，前端改讀 `?fresh=1`（不經快取），自己的修改不會被舊資料蓋回去；其他人最多晚 1 分鐘看到。
- 瀏覽器另外會記住上次看到的資料，下次打開先顯示，再背景同步（左上角顯示「同步中…」）。

Vercel → Settings → Environment Variables：

| Key | 值 |
| --- | --- |
| `VITE_PROXY` | `1` |
| `GAS_URL` | Apps Script 網址（…/exec） |
| `GAS_TOKEN` | 指令碼屬性 `API_TOKEN` 的值 |
| `NPM_RC` | `@duckdev45:registry=https://npm.pkg.github.com/` 換行 `//npm.pkg.github.com/:_authToken=<GitHub PAT，read:packages>` |

改完環境變數要 Redeploy。舊的 `VITE_GAS_URL`、`VITE_GAS_TOKEN` 在 Vercel 上要刪掉，不然 token 還是會被打包進前端。

本機 `pnpm dev` 不會跑 `api/`，所以本機用 `.env.local` 的 `VITE_GAS_URL` 直連 Apps Script；要在本機測代理可以用 `vercel dev`。

## 設計系統

UI 使用 `@duckdev45/eagle-component`。`src/styles/eagle-theme.css` 是從 eagle-component 的 `globals.css` 複製過來的 `@theme` 與字級 `@utility`，讓本專案自己的 Tailwind class（`bg-surface-raised`、`zh-body-xs`…）也能使用 Eagle 的 token。套件升級、token 有變動時要重新複製一次。

兩個繞過套件行為的地方（都有在程式裡加註解）：

- `main.tsx`：`<IconProvider>` 會把 Phosphor 的 context 整個換成只有 `{ weight }`，導致預設的 `size: '1em'` 不見，不在 Eagle 元件裡的 icon 會被撐滿容器。這裡多包一層 `IconContext` 把預設值補回來。
- `index.css`：`@duckdev45/eagle-component/styles` 要放在 `tailwindcss` **之前** import，否則套件裡的 `.hidden` 會蓋掉本專案的 `xl:flex` 這類 responsive class。
