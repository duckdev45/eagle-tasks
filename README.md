# eagle-tasks · EagleAI 團隊地圖

像 draw.io 一樣可以無限拖曳、縮放的白板，一眼看到 EagleAI 現在在做什麼、誰負責。資料存在 Google Sheet，透過 Apps Script 讀寫。

```
EagleAI 團隊
 ├─ 客戶 / 產品線（框）     例：福懋建設、PMS 工程管理、現場巡檢與 AI
 │   ├─ 專案（卡片）       狀態、P0/P1/P2、複雜度、對外窗口、切入建議、下一步、進度條
 │   │   └─ 任務            狀態、負責人、截止日、優先度、預估人天、不確定性、卡住原因、前置任務
 └─ 成員                   職稱、專長（找他談什麼）、聯絡方式
```

## 老闆怎麼用

| 情境 | 操作 |
| --- | --- |
| 客戶提到某件事，要知道從哪切入 | 上方搜尋框（⌘K 或 `/`）輸入公司名、產業或需求關鍵字 → 選結果 → 畫面飛過去，右側顯示**切入指南**：該找誰、可以聊哪些專案、每個專案的「切入建議」 |
| 想知道某人手上有什麼 | 點下方成員列的人 → 只亮他相關的框與任務；點兩下看他的詳細資料 |
| 看全貌 | 縮小畫面，卡片會自動簡化成只剩名稱（語意縮放） |
| 只看最重要／最急的 | 左上「只看 P0」「緊急」篩選。緊急是自動判斷：逾期、高優先且 3 天內到期；「待確認」超過 3 天沒動會標成停滯 |
| 專案什麼時候做得完、誰卡住誰 | 右上切到「**路徑**」 |
| 誰太忙、哪裡卡關、哪個專案危險 | 右上切到「**總覽**」 |

右上的切換鈕有三個畫面（選擇會記在瀏覽器）：

- **地圖**：白板本體。
- **路徑**：泳道圖，一列一個人，橫軸是工作天。依前置關係＋「每個人一次只做一件事」自動排程，越在要徑上的任務越先排；橘色粗框是要徑（這串任何一件晚一天，專案就晚一天）。可以選要看哪些專案、切換「預估／保守（含緩衝）」、調整專注度（專案佔一天的比例，預設 0.7）。「之後」階段的任務不算進專案完成日。
- **總覽**：每人剩餘工作量（以兩週 10 人天為參考線）、卡關清單（卡最久的在最上面）、專案風險矩陣（複雜度 × 不確定性）、專案進度（已完成 vs 剩餘人天）、估算準確度（實際 ÷ 預估）。

任務的開始、完成、卡關時間（`startedAt`／`doneAt`／`blockedAt`）在狀態或卡住原因改變時自動寫入，不用手填。緩衝依不確定性計算：低 +10%、中 +30%、高 +50%，沒填以中計算。

畫布操作：拖曳空白處或按住空白鍵拖曳可以平移；滾輪或觸控板也能平移；⌘/Ctrl＋滾輪或觸控板捏合可以縮放；`Shift+1` 全部顯示。框固定排成一列，拖曳框的標題可以換順序，順序（`order`）會存回 Sheet。

## 開發

```bash
# .npmrc 已設定 @duckdev45 → GitHub Packages，需要能讀 eagle-component 的 token
pnpm install
cp .env.example .env.local   # 填 VITE_GAS_URL / VITE_GAS_TOKEN；留空就是 Demo 模式
pnpm dev
```

- **Demo 模式**（`VITE_GAS_URL` 留空）：資料存在瀏覽器 localStorage，附範例資料，可以從「新增 → 重設 Demo 資料」還原。
- **Google Sheet 模式**：讀寫 Apps Script Web App。每 60 秒自動重新整理一次，寫入是先更新畫面再同步，失敗時會跳通知並重新載入。

檢查：`pnpm typecheck`；畫布排版邏輯有一支自我檢查 `node src/canvas/layout.check.ts`。

## Google Sheet / Apps Script 設定

1. 開一份 Google Sheet → **擴充功能 → Apps Script**，把 `gas/Code.gs` 整份貼上。
2. **專案設定 → 指令碼屬性**新增 `API_TOKEN`，值要和 `.env.local` 的 `VITE_GAS_TOKEN` 一樣。
3. 在編輯器執行一次 `setup()`（授權並建立 `domains / projects / tasks / members` 四個分頁），再執行 `seedTeam()` 寫入團隊目前的成員與專案。分頁已經有資料時 `seedTeam()` 會拒絕執行；要整個清掉重寫請用 `resetToSeed()`（網頁上的修改會全部消失）。
4. **部署 → 新增部署 → 網頁應用程式**：執行身分選「我」，誰可以存取選「**任何人**」。如果選「網域內使用者」，跨網域 fetch 會被導到登入頁，前端就讀不到資料。
5. 之後改了 `Code.gs`：**管理部署 → 編輯 → 新版本**，網址不會變。

**已經在用的 Sheet 要升級到新欄位**（不會清空資料，都可以重複執行），貼上新版 `Code.gs` 後依序執行：

| 函式 | 做什麼 |
| --- | --- |
| `migrate_20261005()` | `projects` 加 `priority` 欄並給預設值；「請款 ABCD 包」併進「EagleAI Field Web」 |
| `migrate_20261005_complexity()` | `projects` 加 `complexity`、`complexityNote` 兩欄並填入評估 |
| `migrate_20261005_wbs()` | 把 P0 兩案＋內部 ERP 的完整工作分解寫進 `tasks`：接手同名舊任務（保留狀態與負責人）、補新任務、填前置關係；負責人校正過的預估不會被蓋掉，對不上的舊任務排到最後 |
| `migrate_20261123()` | 依 GitLab 實際狀況更新：專案的名稱、狀態、摘要、複雜度、下一步、標籤改成 SEED 版本（切入建議、優先度、負責人、順序不動）；新增「EKS 平台遷移與資安合規」；補新任務；福懋官網 WBS 補 W27～W33；各任務依程式碼證據推進狀態，福懋官網的負責人依 git 歷史改派。任務狀態只會往前推，不會倒退 |

> ⚠️ `VITE_GAS_TOKEN` 會被打包進前端 JS，所以它只是「防止路人亂寫」，不算真正的權限控管。拿到網頁的人都看得到資料。如果之後要限制只有公司帳號能看，比較好的做法是改用 Apps Script `HtmlService` 直接提供頁面，搭配「網域內使用者」部署。

### 資料欄位

| 分頁 | 欄位 |
| --- | --- |
| `domains` | id, name, kind (`client`/`sector`/`internal`), keywords, description, clientContact, leadId, color (`teal`/`violet`/`accent`/`info`/`primary`/`neutral`), x, y（舊的自由排版，已不使用，拖曳後會清空）, order（框的左右順序） |
| `projects` | id, domainId, name, status (`planning`/`active`/`paused`/`done`), priority (`P0` 對客戶有承諾或影響收款／`P1` 產品線主功能／`P2` 實驗、內部、暫停), complexity（1 很小…5 極大，0 未評估）, complexityNote, ownerId, summary, **pitch（切入建議）**, nextStep, tags, dueDate, link, order |
| `tasks` | id, projectId, title, assigneeId, status (`todo`/`doing`/`review`/`done`), priority (`high`/`mid`/`low`), dueDate, note, estimateDays（預估人天，不含緩衝；0 未估）, uncertainty (`low`/`mid`/`high`/空白), blockedReason（有填就算卡關）, deps（前置任務 id，逗號分隔）, blockedAt, startedAt, doneAt（自動填）, order |
| `members` | id, name, title, expertise, email, phone, line, order |

每個分頁都另外有 `updatedAt`（自動填）。可以直接在 Sheet 上編輯，欄位順序也可以調整，程式是依照標題列對應欄位；`id`、日期、電話這些欄位已經設成純文字，避免被 Sheets 自動轉型。

### 種子資料

成員、客戶／產品線、專案、專案複雜度、一般任務的初始資料寫在 `seed/build_seed.py`（2026-11-23 依 GitLab 各 repo 的預設分支與近期 commit 更新；`eagle-vision` 不在 GitLab，維持原樣）；P0 兩案（福懋官網 `p-web`、EagleAI Field Web `p-frweb`）和內部 ERP（`p-erp`）的工作分解寫在 `seed/wbs.py`（代號 W／F／E，含階段、負責人、預估、不確定性、前置）。改完執行：

```bash
python3 seed/build_seed.py   # 產生種子
python3 seed/wbs.py          # （選用）印出各案總工作量、含緩衝工時與要徑
```

`build_seed.py` 會同時更新 `src/data/seed.ts`（Demo 模式用）和 `gas/Code.gs` 裡的 `SEED`、`WBS` 兩個區塊，再把 `Code.gs` 貼回 Apps Script。`wbs.py` 裡前置任務必須排在後面任務之前，不然會 assert 失敗。WBS 的預估是 PM 粗估，請負責人自己校正。

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
