"""Single source of truth for the team-map seed data.
Generates src/data/seed.ts (Demo mode) and the SEED block inside gas/Code.gs."""
import json, re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
NOW = '2026-11-23T00:00:00.000Z'

# 2026-10-05 初版：owners 來自各 repo 本機 clone 的 `git log --numstat`（近 180 天）。
# 2026-11-23 更新：改以 GitLab 為準（eagle-ai、fumao、ccoe-673568862956、JaredSong1），
# 讀各 repo 預設分支的程式碼與 10/05 之後的 commit／MR。eagle-vision 不在 GitLab，維持原樣。

members = [
    dict(id='m-lee',   name='Lee',   title='BE 後端',  expertise='NestJS / PostgreSQL 後端：PMS 日報、品管 QAQC、分層數量表、LINE 通道後端、巡檢報告 Web；EKS 平台、Terraform、Argo CD、CI/CD、資安合規'),
    dict(id='m-duck',  name='duck',  title='FE 前端',  expertise='EagleWorks ERP、EagleAI Field App、LINE LIFF 前端、PMS 後台與分層數量表元件、官網、設計系統', email='duck@eagleai.tw'),
    dict(id='m-jared', name='Jared', title='UI/UX',    expertise='PMS 日報與請款看板前端、巡檢看板、Field 巡檢 PWA、平面圖對應、EagleWorks 畫面、eagle-component、行銷 Landing'),
    dict(id='m-wes',   name='Wes',   title='',         expertise=''),
]

domains = [
    dict(id='d-fumao', name='福懋建設', kind='client', color='teal', leadId='m-duck',
         clientContact='福懋 資訊室',
         keywords='福懋, 建設, 建商, 官網, 網站, SEO, 報修, 保固, 住戶, 會員, 客服, 售後服務, QMS, 廠商, 防水',
         description='EagleAI 第一個客戶：官網重構＋住戶服務、QMS 廠商系統、防水點位工具。'),
    dict(id='d-pms', name='PMS 工程管理', kind='sector', color='accent', leadId='m-jared',
         clientContact='',
         keywords='營造, 工地, 工程, PMS, 日報, 出工, 點工, 請款, 估驗, 分層數量表, 請款證明, 品管, 查驗, 完工回報, LINE, LIFF, 工班, 協力廠商',
         description='營建工地的業務核心：工務日報、分層數量表請款、品管查驗；工班用 LINE 回報，不用裝 App。'),
    dict(id='d-field', name='現場巡檢與 AI', kind='sector', color='info', leadId='m-duck',
         clientContact='',
         keywords='巡檢, 現場報告, 監造, 驗屋, 缺失, 改善, 照片, App, 離線, PDF, AI, 影像辨識, 工種',
         description='現場人員用 App 離線拍照組報告、桌面 Web 看板追缺失，AI 自動辨識照片工種。'),
    dict(id='d-erp', name='EagleWorks 內部 ERP', kind='internal', color='violet', leadId='m-duck',
         clientContact='',
         keywords='ERP, EagleWorks, AWM, UOF, 簽呈, 簽核, 電子簽核, 工務, 採購, 請購, 發包, 合約, 估驗, 財務, 傳票, 會計, 人資, HR, 組織, 招募',
         description='取代舊 AWM 與 UOF 的營造業 ERP：請購、詢比議價、發包、工地簽收、估驗計價一路串到財務傳票，內建電子簽核。'),
    dict(id='d-brand', name='品牌與官網', kind='internal', color='primary', leadId='m-jared',
         clientContact='',
         keywords='官網, 行銷, Landing, 品牌, SEO, eagleai.tw, 介紹, 下載',
         description='EagleAI 對外的網站與行銷頁。'),
    dict(id='d-platform', name='內部平台與實驗', kind='internal', color='neutral', leadId='m-duck',
         clientContact='',
         keywords='設計系統, 元件庫, eagle-component, sandbox, 原型, 實驗, 內部工具, 預算, 合約產生器',
         description='團隊共用的元件庫、全端樣板與新功能原型。'),
]
for i, d in enumerate(domains, 1):
    d.update(x=None, y=None, order=i)

projects = [
    # ── 福懋建設 ──
    dict(id='p-web', domainId='d-fumao', name='福懋建設官網重構', status='active', priority='P0', ownerId='m-duck',
         summary='fu-mao.com.tw 官網與住戶服務平台（gw-fumao：Next.js 16 官網＋NestJS 服務 API＋服務工作台 /ops）。2026-10-28 官網上線；線上報修（含照片影片）、預約賞屋、案件看板與派工、住戶名冊、客服週報表 Excel、301 轉址、SEO 都已完成。剩住戶註冊與戶別綁定、維修人員手機派工、S3／SES 實環境驗證。程式碼：duck 212／216 個 commit、約 35 萬行；Lee 4 個（CI 設定、相依套件）。',
         pitch='建商官網＋住戶服務一條龍：住戶登入看保固、線上報修、進度追蹤，客服後台派工與滿意度回訪。福懋是第一個實績，可以包裝成套裝給其他建商。',
         nextStep='住戶註冊與戶別綁定；網站內容匯入 dev／qas／prd', tags='官網, SEO, 報修, 住戶會員, 客服後台, 服務工作台, 預約賞屋, gw-fumao'),
    dict(id='p-qms', domainId='d-fumao', name='QMS 廠商系統（後台＋廠商 App）', status='active', priority='P2', ownerId='m-duck',
         summary='福懋的廠商／品質管理。2026-11 qms_backend、qms_frontend 合併成 fumao/qms/fullstack/qms；10/31 起部分唯讀，「查驗系統」「維護程式」已移到 Field Web。duck 在做銷售預算改為依工程別結構；是第一個搬上 EKS 的系統（dev 11/23，prd 最快 12/12）。廠商 App（qms_app）2026-07 後沒更新。程式碼（10/05 後）：Lee 26、duck 11 個 commit。',
         pitch='協力廠商派工、拍照回報與付款明細在同一套系統，已在福懋使用。',
         nextStep='搬上 EKS：dev → qas → prd（最快 12/12）', tags='QMS, 廠商, App, 付款, 銷售預算, 唯讀, fumao/qms'),
    dict(id='p-waterproof', domainId='d-fumao', name='防水點位（waterproof_fumao）', status='active', priority='P2', ownerId='m-lee',
         summary='防水檢查點位與照片抽屜，含 3D 點位顯示。2026-11 repo 改名 waterproof_fumao 並重新動工：duck 加專案版面與路由、塔樓標示與材料處理腳本；Lee 把 QMS 查詢改走 server 端。會隨 gw 系列搬上 EKS。程式碼（10/05 後）：duck 8、Lee 7 個 commit。',
         pitch='', nextStep='', tags='防水, 點位, 3D, fumao/gw'),
    dict(id='p-fms', domainId='d-fumao', name='FMS（fms_fullstack）', status='done', priority='P2', ownerId='m-duck',
         summary='2026-05 建立的全端專案骨架，之後沒有更新。2026-11-02 決定退場，不搬上 EKS；GitLab 的 eagle-ai/fms 已排程刪除（2026-11-11）。',
         pitch='', nextStep='', tags='FMS, fumao/fms'),

    # ── PMS ──
    dict(id='p-pms', domainId='d-pms', name='PMS 核心：工務日報與後台', status='active', priority='P1', ownerId='m-jared',
         summary='營建工地業務規則與資料核心（NestJS + PostgreSQL / Next.js）。10/05 後：Jared 做手機與平板版面（RWD），Lee 加機電主任角色、分層數量表請款匯入自主檢查照片。12 月底前搬上 EKS（PMS 家族，prd 約 1/9）。程式碼：日報前端 Jared 64%、duck 34%；日報後端 Lee 91%；後台 admin duck 70%；主檔、登入、LINE 模組 Lee；10/05 後 Lee 48、Jared 16、duck 8 個 commit。',
         pitch='工地主任每天填日報、拍照、記出工，工務主管一個畫面看所有工地；日報會自動整理成 PPT。最容易切入的第一步。',
         nextStep='日報後台：填報狀態看板、出工趨勢、Excel 匯出', tags='PMS, 日報, 出工, 點工, 後台'),
    dict(id='p-line', domainId='d-pms', name='PMS LINE Bot（LIFF）', status='active', priority='P1', ownerId='m-lee',
         summary='PMS 的 LINE 通道：webhook、推播、LIFF 格子任務與 QAQC 查驗；業務資料都在 PMS。10/05 後 Lee 加了 QAQC 草稿保存、照片圈選標註、近期照片重用、5 種 QAQC 通知卡（LINE 契約 v5.20）。程式碼：後端 Lee 96–100%；LIFF 前端 duck 66%、Jared 19%、Lee 13%；10/05 後 Lee 33 個 commit。',
         pitch='工班與品管不裝 App、不記帳號，在 LINE 收卡片就能回報、查驗、整改。最容易單賣的入口，按綁定人數或工地數收月費。',
         nextStep='', tags='LINE, LIFF, 推播, 工班, QAQC'),

    # ── 現場巡檢與 AI ──
    dict(id='p-frapp', domainId='d-field', name='EagleAI Field App（App＋PWA）', status='active', priority='P1', ownerId='m-duck',
         summary='巡檢 App 家族。① iOS／Android App（pms-field-report-app，Expo）：離線拍照、標註、組報告、裝置上產 PDF，資料走 PMS 後端；10/05 後加了共享專案邀請、專案抬頭與 PDF。duck 99%。② 巡檢 PWA（JaredSong1/eagle-field-report，Cloudflare Worker）：本機優先、可安裝，拍照＋語音／文字＋標註 → 報告 → PDF；在試 Camera v2、Annotate v2。Jared 100%（10/05 後 107 個 commit）。',
         pitch='巡檢人員離線也能拍照記缺失，現場就產出 PDF 報告，回辦公室不用再整理。',
         nextStep='PWA Camera v2／Annotate v2 從 lab 版轉正式', tags='App, PWA, 巡檢, 離線, PDF, iOS, Android, Cloudflare'),
    dict(id='p-frweb', domainId='d-field', name='EagleAI Field Web（請款 ABCD 包）', status='active', priority='P0', ownerId='m-lee',
         summary='桌面看板（pms-field-report-web）：A 請款包、B 品管包、現場報告收成卡片；現場照片 → 分層數量表 → 本期數量 → 請款驗證證明。2026-10 起承接 QMS 的「查驗系統」「維護程式」，加了維護模式、共享專案。程式碼：看板 board Jared 85%；現場報告 Lee 97%；工地資料夾 Jared 78%；QAQC Lee 100%；分層數量表後端 Lee 100%、PMS 前端元件 duck 99%；10/05 後 Jared 87、Lee 46 個 commit。',
         pitch='工項 × 樓層的每一格都有現場照片，本期數量才算得出來，直接對應請款金額，最好開價；辦公室一個看板看所有工地的待請款、待查驗與缺失改善，廠商免登入就能回覆。',
         nextStep='看板篩選與工地切換整理', tags='請款, 估驗, 分層數量表, 請款證明, 品管, 複驗, 看板, 現場報告, 缺失, 廠商回覆'),
    dict(id='p-vision', domainId='d-field', name='工種辨識（eagle-vision）', status='active', priority='P1', ownerId='m-duck',
         summary='工地照片自動分類工種，與 PMS 日報照片串接；專家複核後回訓模型。（本機沒有這個 repo）',
         pitch='工地每天上百張照片自動歸到工種，品管只要複核 AI 不確定的那幾張；複核結果會回頭訓練模型，越用越準。',
         nextStep='獨立的複核佇列頁（可在照片上標記）', tags='AI, 影像辨識, 工種, 照片, 日報'),

    # ── EagleWorks ──
    dict(id='p-erp', domainId='d-erp', name='內部 ERP 重構', status='active', priority='P1', ownerId='m-duck',
         summary='EagleWorks：Java 21 / Spring Boot 模組化單體 + PostgreSQL（多租戶），React / Vite 前端，repo 在 eagle-ai/sandbox/sandbox-erp（舊的 eagle-ai/erp、eagle-ai/hrms 已排程刪除）。10/05 後：duck 做簽核（UOF 流程圖、子流程、表單與流程設計器、簽呈、內聯單、備忘錄），Jared 翻新畫面（外框、表格、請購單）。程式碼：duck 37、Jared 37 個 commit；先不搬 EKS。',
         pitch='營造業專用 ERP：估驗計價送進電子簽核，核准後直接成為傳票草稿。客單最大、導入最重，適合在現場端（PMS）跑順之後接；也可以先只上電子簽核與估驗計價。',
         nextStep='簽呈：版本化簽核表單上線', tags='EagleWorks, ERP, 簽核, 採購, 合約, 估驗, 財務, 人資'),

    # ── 品牌與官網 ──
    dict(id='p-site', domainId='d-brand', name='EagleAI 官網（gw_eagleai）', status='active', priority='P2', ownerId='m-duck',
         summary='eagleai.tw/gw 官網（fumao/gw/gw_eagleai）：Next.js 16、next-intl 多語系、聯絡表單、App 下載連結與 JSON-LD。已跑在公司 EKS 平台（dev／qas／prd），聯絡信改走 SES。程式碼：duck 為主；10/05 後 Lee 7 個 commit（部署）。',
         pitch='', nextStep='', tags='官網, SEO, 多語系'),
    dict(id='p-landing', domainId='d-brand', name='Eagle AI Landing（行銷頁）', status='paused', priority='P2', ownerId='m-jared',
         summary='行銷網站（Next.js static export，Cloudflare Workers）：Hub、請款、訊息通道、團隊頁。程式碼：Jared 100%。最後更新 2026-08-05。',
         pitch='', nextStep='', tags='Landing, 行銷, Cloudflare'),

    # ── 內部平台與實驗 ──
    dict(id='p-ds', domainId='d-platform', name='eagle-component 設計系統', status='active', priority='P2', ownerId='m-jared',
         summary='所有 EagleAI web 專案共用的元件庫與 token（Storybook）。程式碼：Jared 49%、duck 45%。',
         pitch='', nextStep='', tags='設計系統, 元件庫, Storybook'),
    dict(id='p-sandbox', domainId='d-platform', name='sandbox-fullstack 原型實驗場', status='active', priority='P2', ownerId='m-duck',
         summary='全端起始樣板，也是新功能原型的地方。10/05 後：建築師公會 10/14 demo（Field App demo 畫面）、Field Report Web 教學頁、PMS 工作流程專案頁。程式碼：duck 59%、Jared 32%、Lee 8%；10/05 後 Lee 31、Jared 14 個 commit。',
         pitch='', nextStep='', tags='sandbox, 原型, 樣板, demo'),
    dict(id='p-infra', domainId='d-platform', name='EKS 平台遷移與資安合規', status='active', priority='P1', ownerId='m-lee',
         summary='把各產品從舊 EC2 搬到單一 EKS 叢集（Terragrunt 管 AWS、Argo CD 讀 platform/gitops 部署、共用 ci-templates、Grafana），並依計畫做 ISO 27001／SOC 2 合規。按系統推進：① qms（prd 最快 12/12）② PMS 家族（pms、line-bot、common-cronjob、field-report-web，prd 約 1/9）③ gw 系列（約 1/16）；sandbox-erp 先不搬，fms 退場。完工 1/22：prd 在新環境、舊環境拆除、長期金鑰刪除。Lee 一人執行（10/05 後約 400 個 commit）。',
         pitch='', nextStep='qms dev 搬遷（11/23）→ qas → prd', tags='EKS, AWS, Terraform, Terragrunt, Argo CD, CI/CD, ISO 27001, SOC 2, 資安', dueDate='2027-01-22'),
    dict(id='p-map', domainId='d-platform', name='團隊地圖（eagle-tasks，本頁）', status='active', priority='P2', ownerId='m-duck',
         summary='團隊專案 overview 與負責人地圖，資料存在 Google Sheet。', pitch='', nextStep='', tags='內部工具'),
]
for i, p in enumerate(projects, 1):
    p.setdefault('dueDate', ''); p.setdefault('link', ''); p['order'] = i


# ── 複雜度（2026-11-23 依 GitLab 各 repo 預設分支重新統計；沒有 repo 的依需求範圍估計）──
# 1 很小 · 2 小 · 3 中 · 4 大 · 5 極大
# 看的面向：程式規模（非空白行，不含樣式與 SQL）、畫面數、API 數、資料表數、串接的外部服務／系統、權限角色數。
# 行數算法和 10/05 版不同（這次含設定檔、以預設分支為準），數字不能和舊版直接比。
COMPLEXITY = {
    'p-pms': (5, '極大：約 18.6 萬行程式、22 個畫面、約 210 支 API、約 90 張資料表；串 LINE、Apple／Google 登入、AWS S3、PPT／Excel 產出；多種工地角色權限（含機電主任），是其他產品共用的核心後端。'),
    'p-erp': (5, '極大：約 22 萬行程式（Java 後端＋React 前端）、12 個後端模組、約 220 支 API、約 90 張資料表；要取代 AWM 與 UOF、搬舊資料、內建電子簽核與多公司資料隔離，牽涉財務帳務。'),
    'p-frweb': (4, '大：約 9.9 萬行程式、28 個畫面；本身沒有後端，全部靠 PMS 的 API；請款金額與品管判定的規則多，又承接了 QMS 的查驗與維護功能。'),
    'p-web': (4, '大：約 8.3 萬行程式、28 個畫面、87 支 API、22 張資料表；官網＋服務 API＋服務工作台三塊，串 S3、SES、Turnstile，照片影片背景轉檔，3 種員工角色加住戶登入。'),
    'p-qms': (4, '大：約 8.8 萬行程式、31 個畫面、約 140 支 API、約 60 張資料表（前後端合併後首次完整計入）；付款明細、PDF 報表、銷售預算。已部分唯讀、功能陸續移出，實際要再投入的量不大。'),
    'p-vision': (4, '大（依需求估計，程式碼不在 GitLab）：影像辨識模型、專家複核頁、回訓流程，再加上和 PMS 日報照片串接。'),
    'p-infra': (4, '大：Terragrunt 約 9 千行、gitops 約 8 千行設定；EKS、Argo CD、RDS、SES、Route 53、Grafana，6 個服務要按系統逐一搬三個環境，還有 ISO／SOC 2 合規，只有一個人做。'),
    'p-line': (3, '中：約 3.3 萬行程式、LIFF 畫面、34 支 API；自己不存資料，串 LINE 官方帳號與 LIFF，業務資料都轉給 PMS。'),
    'p-frapp': (3, '中：App 約 1.4 萬行、16 個畫面（iOS／Android 雙平台上架、離線拍照與本機資料庫、手機產 PDF）；PWA 約 1.6 萬行、21 個畫面（本機優先、Cloudflare）。'),
    'p-ds': (3, '中：約 2.4 萬行程式的共用元件庫；改一個元件會影響所有產品，需要同時顧好相容性。'),
    'p-sandbox': (3, '中：程式約 15 萬行、43 個畫面，但是許多彼此獨立的小原型與 demo，單一原型都不大。'),
    'p-waterproof': (2, '小：約 1.3 萬行程式、4 個畫面，含 3D 點位顯示與材料處理腳本。'),
    'p-site': (2, '小：約 1.1 萬行程式、7 個頁面的官網，多語系與聯絡表單。'),
    'p-map': (2, '小：約 5 千行程式的單頁工具，資料存在 Google Sheet。'),
    'p-landing': (1, '很小：約 6 千行程式的靜態行銷網站，沒有後端。'),
    'p-fms': (1, '很小：只有約 4 千行的專案骨架，已決定退場。'),
}
for p in projects:
    lvl, note = COMPLEXITY.get(p['id'], (0, ''))
    p['complexity'] = lvl
    p['complexityNote'] = note

T = []
def task(pid, title, who, status='todo', prio='mid', note='', id=None, due=''):
    # id：2026-11-23 起新增的任務給固定 id（t-n…），才不會擠動舊任務的自動編號 t-01…
    T.append(dict(projectId=pid, title=title, assigneeId=who, status=status, priority=prio, note=note, _id=id, dueDate=due))

N = '2026-11-23 依 GitLab 補登'

# 福懋官網重構
# QMS / 防水 / FMS
task('p-qms', 'QMS 後台：付款明細、PDF 版面', 'm-duck', 'done', 'mid', '最後更新 2026-08-25')
task('p-qms', '廠商 App（EagleAi 1.0.2）', 'm-duck', 'done', 'mid', '最後更新 2026-07-17')
task('p-waterproof', '防水點位資料與照片抽屜', 'm-lee', 'done', 'low')
task('p-fms', '確認 FMS 用途與後續', '', 'done', 'low', '2026-11-02 決定退場')
task('p-qms', 'qms_backend、qms_frontend 合併成單一 repo', 'm-lee', 'done', 'mid', N, id='t-n01')
task('p-qms', '唯讀模式與下線公告（查驗、維護功能移到 Field Web）', 'm-lee', 'done', 'mid', N, id='t-n02')
task('p-qms', '銷售預算改為依工程別結構（含遷移前檢查）', 'm-duck', 'done', 'mid', N, id='t-n03')
task('p-waterproof', 'QMS 查詢改走 server 端（拿掉寫死的 token）', 'm-lee', 'done', 'mid', N, id='t-n04')
task('p-waterproof', '專案版面與路由、塔樓標示與材料處理腳本', 'm-duck', 'done', 'mid', '11/20 上 prd；' + N, id='t-n05')

# PMS 核心
task('p-pms', '日報前端：今日填報、交辦事項、雜工出工', 'm-jared', 'done', 'high', 'frontend/src/features/daily-report')
task('p-pms', '日報後端 API 與期別審核', 'm-lee', 'done', 'high', 'server/src/modules/daily-report')
task('p-pms', '出工快照同步（workforce）', 'm-lee', 'done', 'mid')
task('p-pms', '系統後台 admin、工地範圍權限', 'm-duck', 'done', 'mid', 'frontend/src/features/admin')
task('p-pms', '主檔與帳號登入（base-data / auth）', 'm-lee', 'done', 'mid')
task('p-pms', '日報後台：填報狀態看板、出工趨勢、Excel 匯出', '', 'todo', 'mid', 'server/docs/backlog.md #7')
task('p-pms', '修正：account.email 改名後無法登入／LINE 綁定', 'm-lee', 'todo', 'high', 'server/docs/backlog.md #8，優先序最高')
task('p-pms', '手機與平板版面（RWD）', 'm-jared', 'done', 'mid', N, id='t-n06')
task('p-pms', '機電主任角色與工地角色選擇', 'm-lee', 'done', 'mid', N, id='t-n07')
task('p-pms', '分層數量表請款匯入自主檢查照片', 'm-lee', 'done', 'mid', N, id='t-n08')
# LINE Bot
task('p-line', 'LINE webhook、推播與 BFF 後端', 'm-lee', 'done', 'mid')
task('p-line', 'LIFF 格子任務（拍照、提交、採認）', 'm-duck', 'done', 'mid', 'floor-matrix 格子流程：Jared 58%、duck 26%、Lee 16%（2026-11-23 依 git 歷史）')
task('p-line', 'LIFF QAQC 建單與查驗照片', 'm-lee', 'done', 'high')
task('p-line', '舊版 eagle-line（Cloudflare Worker 原型）', 'm-jared', 'done', 'low', '2026-07 後停更，功能已移到 pms-line-bot')
task('p-line', 'LIFF QAQC 草稿保存、照片標註、近期照片重用', 'm-lee', 'done', 'mid', N, id='t-n09')

# Field App
task('p-frapp', '現場巡檢拍照、標註、觀察紀錄', 'm-duck', 'done', 'mid')
task('p-frapp', '報告組稿與裝置產 PDF', 'm-duck', 'done', 'mid')
task('p-frapp', '報告編號同步、專案可見範圍', 'm-duck', 'done', 'high')
task('p-frapp', '教學影片與帳號轉移', 'm-duck', 'done', 'low')
task('p-frapp', '共享專案：邀請成員、同步專案設定', 'm-duck', 'done', 'mid', N, id='t-n10')
task('p-frapp', '專案抬頭與可靠的報告 PDF 匯出', 'm-duck', 'done', 'mid', N, id='t-n11')
task('p-frapp', '巡檢 PWA（eagle-field-report）：本機優先、報告與 PDF', 'm-jared', 'done', 'mid', 'JaredSong1/eagle-field-report；' + N, id='t-n12')
task('p-frapp', '巡檢 PWA Camera v2／Annotate v2（lab 版）', 'm-jared', 'doing', 'mid', N, id='t-n13')
# EagleAI Field Web（請款 ABCD 包）— WBS 在 seed/wbs.py，這裡只補 WBS 以外的
task('p-frweb', '承接 QMS 查驗系統與維護程式', 'm-lee', 'done', 'mid', N, id='t-n14')
task('p-frweb', '維護模式開關與維護畫面', 'm-lee', 'done', 'low', N, id='t-n15')
task('p-frweb', '共享專案：成員報告、受邀工地標籤', 'm-lee', 'done', 'mid', N, id='t-n16')
# eagle-vision
task('p-vision', '複核佇列頁（照片上標記）', 'm-duck', 'todo', 'high')
task('p-vision', '專家回饋 → 回訓 API', 'm-duck', 'todo', 'mid')
task('p-vision', '與 PMS 日報照片串接', 'm-duck', 'todo', 'mid')

# ERP

# 品牌
task('p-site', '多語系、聯絡表單、App 下載連結與 JSON-LD', 'm-duck', 'done', 'mid')
task('p-site', '搬上 EKS（dev／qas／prd），聯絡信改走 SES', 'm-lee', 'done', 'mid', '11/19 prd 切到新平台；' + N, id='t-n17')
task('p-landing', 'Hub、請款、訊息通道、團隊頁文案', 'm-jared', 'done', 'low')

# 平台
task('p-ds', 'Storybook 文件與元件', 'm-jared', 'doing', 'mid', 'src/stories Jared 約 70%（本機 clone 只到 2026-09-08）')
task('p-ds', 'FloorMatrix 元件', 'm-duck', 'done', 'mid')
task('p-ds', 'BarChart 元件', 'm-jared', 'done', 'low')
task('p-sandbox', 'eagle-daily 日報原型', 'm-duck', 'done', 'mid')
task('p-sandbox', 'line-feedback 現場回饋', 'm-jared', 'done', 'mid')
task('p-sandbox', 'project-graph 產品圖譜', 'm-duck', 'done', 'mid')
task('p-sandbox', 'budget-ab 預算比較與廠商評分', 'm-duck', 'done', 'mid')
task('p-sandbox', '合約產生器 / work-docs', 'm-duck', 'done', 'mid')
task('p-sandbox', 'trade-reader', 'm-jared', 'done', 'low')
task('p-sandbox', '建築師公會 10/14 demo（Field App demo 畫面）', 'm-lee', 'done', 'mid', N, id='t-n18')
task('p-sandbox', 'Field Report Web 教學頁、PMS 工作流程專案頁', 'm-lee', 'done', 'low', N, id='t-n19')
task('p-erp', 'EagleWorks 畫面翻新：外框、表格、請購單', 'm-jared', 'done', 'mid', N, id='t-n20')
# EKS 平台遷移（aws_terragrunt docs/eks-migration-schedule-2026.md v5.3）
task('p-infra', '平台建置：EKS、Argo CD、Ingress、兩台 RDS、Grafana', 'm-lee', 'done', 'high', N, id='t-n21')
task('p-infra', '共用 CI 範本（ci-templates）與 platform/demo 驗收', 'm-lee', 'done', 'mid', N, id='t-n22')
task('p-infra', 'common-cronjob：集中管理排程呼叫', 'm-lee', 'doing', 'mid', N, id='t-n23')
task('p-infra', 'qms 搬遷：dev 11/23 → qas → prd', 'm-lee', 'doing', 'high', 'SYS2；prd 最快 12/12，來不及 12/19，再不行 1/9', id='t-n24', due='2026-12-12')
task('p-infra', 'sandbox-fullstack dev 搬遷', 'm-lee', 'doing', 'mid', 'SBX-01；排在 qms 之後、PMS 家族之前', id='t-n25')
task('p-infra', 'PMS 家族搬遷：pms、line-bot、common-cronjob、field-report-web', 'm-lee', 'doing', 'high', 'SYS1；dev runbook、gitops 草稿已備，dev 預計 11/25，prd 約 1/9', id='t-n26', due='2027-01-09')
task('p-infra', 'gw 系列搬遷：gw-fumao、gw_eagleai、waterproof', 'm-lee', 'doing', 'mid', 'gw_eagleai 11/19 prd 已上平台；gw-fumao 只有 AWS 前置，waterproof 準備中', id='t-n27', due='2027-01-16')
task('p-infra', '拆除舊 EC2 環境、刪除長期金鑰', 'm-lee', 'doing', 'mid', '11/16 已刪部分 CI 與 S3 金鑰；舊 EC2、RDS 仍在，完工定義的一部分', id='t-n28', due='2027-01-22')
task('p-infra', 'ISO 27001／SOC 2 合規', 'm-lee', 'doing', 'mid', 'docs/pms-compliance-plan-2026.md；驗證機構與會計師由主管選定', id='t-n29')
task('p-map', '建立 Google Sheet 與 Apps Script', 'm-duck', 'done', 'mid')

tasks = []
# P0 專案用完整 WBS（seed/wbs.py），其餘專案用上面的 task() 清單。
from wbs import PLANS, to_tasks
WBS_TASKS = [t for pid, rows in PLANS.items() for t in to_tasks(pid, rows)]
auto = 0
for i, t in enumerate(T, 1):
    if not t['_id']: auto += 1
    # 預估天數、不確定性要由負責人自己填，種子資料不代填。
    t.update(id=t.pop('_id') or f't-{auto:02d}', estimateDays=0, uncertainty='', blockedReason='', blockedAt='', startedAt='', doneAt='', order=i)
    tasks.append(t)
tasks += [{k: v for k, v in t.items() if k != 'legacy'} for t in WBS_TASKS]

# 依 git 歷史改成實際做的人（seed/doers.py）。WBS 也要改，Code.gs 的 WBS 區塊才會一致。
from doers import DOERS
assert set(DOERS) <= {t['id'] for t in tasks}, sorted(set(DOERS) - {t['id'] for t in tasks})
for t in tasks + WBS_TASKS:
    if t['id'] in DOERS:
        t['assigneeId'] = DOERS[t['id']][0]
DOER_ROWS = [dict(id=t['id'], projectId=t['projectId'], title=t['title'], assigneeId=t['assigneeId'], share=DOERS[t['id']][1])
             for t in tasks if t['id'] in DOERS]

def full(rows, cols):
    out = []
    for r in rows:
        o = {c: r.get(c, '') for c in cols}
        out.append(o)
    return out

COLS = {
    'members': ['id', 'name', 'title', 'expertise', 'email', 'phone', 'line', 'order'],
    'domains': ['id', 'name', 'kind', 'keywords', 'description', 'clientContact', 'leadId', 'color', 'x', 'y', 'order'],
    'projects': ['id', 'domainId', 'name', 'status', 'priority', 'complexity', 'complexityNote', 'ownerId', 'summary', 'pitch', 'nextStep', 'tags', 'dueDate', 'link', 'order'],
    'tasks': ['id', 'projectId', 'title', 'assigneeId', 'status', 'priority', 'dueDate', 'note',
              'estimateDays', 'uncertainty', 'blockedReason', 'deps', 'blockedAt', 'startedAt', 'doneAt', 'order'],
}
for i, mm in enumerate(members, 1): mm['order'] = i
seed = {
    'members': full(members, COLS['members']),
    'domains': full(domains, COLS['domains']),
    'projects': full(projects, COLS['projects']),
    'tasks': full(tasks, COLS['tasks']),
}

# ── src/data/seed.ts ──
ts_seed = {k: [dict(r, updatedAt=NOW) for r in v] for k, v in seed.items()}
ts = ("import type { Board } from '../types';\n\n"
      "// GENERATED by seed/build_seed.py — edit that file, then run `python3 seed/build_seed.py`.\n"
      "// Used in Demo mode (no VITE_GAS_URL). The same data is embedded in gas/Code.gs\n"
      "// for `seedTeam()` / `resetToSeed()`.\n\n"
      "export const SEED: Board = " + json.dumps(ts_seed, ensure_ascii=False, indent=2) + ";\n")
ts = ts.replace(': null', ': null')
(ROOT / 'src/data/seed.ts').write_text(ts, encoding='utf-8')

# ── gas/Code.gs SEED block ──
gs = (ROOT / 'gas/Code.gs').read_text(encoding='utf-8')
block = ("// ── SEED (GENERATED by seed/build_seed.py — do not hand-edit) ──\n"
         "var SEED = " + json.dumps(seed, ensure_ascii=False, indent=2) + ";\n"
         "// ── /SEED ──")
pat = re.compile(r"// ── SEED \(GENERATED.*?// ── /SEED ──", re.S)
if not pat.search(gs):
    raise SystemExit('SEED markers not found in gas/Code.gs')
gs = pat.sub(lambda _: block, gs)
wbs_block = ("// ── WBS (GENERATED by seed/build_seed.py from seed/wbs.py — do not hand-edit) ──\n"
             "var WBS = " + json.dumps(WBS_TASKS, ensure_ascii=False, indent=1) + ";\n"
             "// ── /WBS ──")
wpat = re.compile(r"// ── WBS \(GENERATED.*?// ── /WBS ──", re.S)
if not wpat.search(gs):
    raise SystemExit('WBS markers not found in gas/Code.gs')
gs = wpat.sub(lambda _: wbs_block, gs)
doers_block = ("// ── DOERS (GENERATED by seed/build_seed.py from seed/doers.py — do not hand-edit) ──\n"
               "var DOERS = " + json.dumps(DOER_ROWS, ensure_ascii=False, indent=1) + ";\n"
               "// ── /DOERS ──")
dpat = re.compile(r"// ── DOERS \(GENERATED.*?// ── /DOERS ──", re.S)
if not dpat.search(gs):
    raise SystemExit('DOERS markers not found in gas/Code.gs')
gs = dpat.sub(lambda _: doers_block, gs)
(ROOT / 'gas/Code.gs').write_text(gs, encoding='utf-8')
print('members', len(members), 'domains', len(domains), 'projects', len(projects), 'tasks', len(tasks))
