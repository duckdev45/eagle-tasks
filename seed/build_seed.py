"""Single source of truth for the team-map seed data.
Generates src/data/seed.ts (Demo mode) and the SEED block inside gas/Code.gs."""
import json, re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
NOW = '2026-10-05T00:00:00.000Z'

# Owners below come from `git log --numstat` over the last 180 days of each
# local clone (lines changed per person per feature folder); "程式碼：" lines in
# the summaries quote those shares so the boss can see who actually wrote what.

members = [
    dict(id='m-lee',   name='Lee',   title='BE 後端',  expertise='NestJS / PostgreSQL 後端：PMS 日報、品管 QAQC、分層數量表、LINE 通道後端、巡檢報告 Web、HRMS'),
    dict(id='m-duck',  name='duck',  title='FE 前端',  expertise='EagleWorks ERP、EagleAI Field App、LINE LIFF 前端、PMS 後台與分層數量表元件、官網、設計系統', email='duck@eagleai.tw'),
    dict(id='m-jared', name='Jared', title='UI/UX',    expertise='PMS 日報與請款看板前端、巡檢看板、平面圖對應、eagle-component、行銷 Landing'),
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
         summary='重構 fu-mao.com.tw：前端視覺、SEO、住戶會員頁、線上報修與客服後台；現行後台 winshop、住戶與報修追蹤在 monday。（本機沒有這個 repo，任務依需求整理）',
         pitch='建商官網＋住戶服務一條龍：住戶登入看保固、線上報修、進度追蹤，客服後台派工與滿意度回訪。福懋是第一個實績，可以包裝成套裝給其他建商。',
         nextStep='向福懋提案新版官網視覺（多版色系）', tags='官網, SEO, 報修, 住戶會員, 客服後台, winshop, monday'),
    dict(id='p-qms', domainId='d-fumao', name='QMS 廠商系統（後台＋廠商 App）', status='paused', priority='P2', ownerId='m-duck',
         summary='福懋的廠商／品質管理：Web 後台（付款明細、PDF）與廠商 App（派工、位置、照片裁切）。程式碼：前端 duck 58%、Lee 41%；App duck 100%。最後更新 2026-08-25。',
         pitch='協力廠商派工、拍照回報與付款明細在同一套系統，已在福懋使用。',
         nextStep='', tags='QMS, 廠商, App, 付款, fumao/qms'),
    dict(id='p-waterproof', domainId='d-fumao', name='防水點位（gw_fumao）', status='paused', priority='P2', ownerId='m-lee',
         summary='防水檢查點位與照片抽屜。程式碼：Lee 97%。最後更新 2026-06-12。',
         pitch='', nextStep='', tags='防水, 點位, fumao/gw'),
    dict(id='p-fms', domainId='d-fumao', name='FMS（fms_fullstack）', status='paused', priority='P2', ownerId='m-duck',
         summary='2026-05 建立的全端專案骨架，之後沒有更新。程式碼：前端 duck、後端 Lee。用途待補。',
         pitch='', nextStep='', tags='FMS, fumao/fms'),

    # ── PMS ──
    dict(id='p-pms', domainId='d-pms', name='PMS 核心：工務日報與後台', status='active', priority='P1', ownerId='m-jared',
         summary='營建工地業務規則與資料核心（NestJS + PostgreSQL / Next.js）。程式碼：日報前端 Jared 64%、duck 34%；日報後端 Lee 91%；後台 admin duck 70%；主檔、登入、LINE 模組 Lee。',
         pitch='工地主任每天填日報、拍照、記出工，工務主管一個畫面看所有工地；日報會自動整理成 PPT。最容易切入的第一步。',
         nextStep='日報後台：填報狀態看板、出工趨勢、Excel 匯出', tags='PMS, 日報, 出工, 點工, 後台'),
    dict(id='p-line', domainId='d-pms', name='PMS LINE Bot（LIFF）', status='active', priority='P1', ownerId='m-lee',
         summary='PMS 的 LINE 通道：webhook、推播、LIFF 格子任務與 QAQC 查驗；業務資料都在 PMS。程式碼：後端 Lee 96–100%；LIFF 前端 duck 66%、Jared 19%、Lee 13%。',
         pitch='工班與品管不裝 App、不記帳號，在 LINE 收卡片就能回報、查驗、整改。最容易單賣的入口，按綁定人數或工地數收月費。',
         nextStep='', tags='LINE, LIFF, 推播, 工班, QAQC'),

    # ── 現場巡檢與 AI ──
    dict(id='p-frapp', domainId='d-field', name='EagleAI Field App', status='active', priority='P1', ownerId='m-duck',
         summary='iOS / Android 巡檢 App（Expo）：離線拍照、標註、組報告、裝置上產 PDF，資料走 PMS 後端。程式碼：duck 99%。目前版本 1.0.4。',
         pitch='巡檢人員離線也能拍照記缺失，現場就產出 PDF 報告，回辦公室不用再整理。',
         nextStep='報告編號同步、專案可見範圍', tags='App, 巡檢, 離線, PDF, iOS, Android'),
    dict(id='p-frweb', domainId='d-field', name='EagleAI Field Web（請款 ABCD 包）', status='active', priority='P0', ownerId='m-lee',
         summary='桌面看板（pms-field-report-web）：A 請款包、B 品管包、現場報告收成卡片；現場照片 → 分層數量表 → 本期數量 → 請款驗證證明。程式碼：看板 board Jared 85%；現場報告 Lee 97%；工地資料夾 Jared 78%；QAQC Lee 100%；分層數量表後端 Lee 100%、PMS 前端元件 duck 99%。',
         pitch='工項 × 樓層的每一格都有現場照片，本期數量才算得出來，直接對應請款金額，最好開價；辦公室一個看板看所有工地的待請款、待查驗與缺失改善，廠商免登入就能回覆。',
         nextStep='看板篩選與工地切換整理', tags='請款, 估驗, 分層數量表, 請款證明, 品管, 複驗, 看板, 現場報告, 缺失, 廠商回覆'),
    dict(id='p-vision', domainId='d-field', name='工種辨識（eagle-vision）', status='active', priority='P1', ownerId='m-duck',
         summary='工地照片自動分類工種，與 PMS 日報照片串接；專家複核後回訓模型。（本機沒有這個 repo）',
         pitch='工地每天上百張照片自動歸到工種，品管只要複核 AI 不確定的那幾張；複核結果會回頭訓練模型，越用越準。',
         nextStep='獨立的複核佇列頁（可在照片上標記）', tags='AI, 影像辨識, 工種, 照片, 日報'),

    # ── EagleWorks ──
    dict(id='p-erp', domainId='d-erp', name='內部 ERP 重構', status='active', priority='P1', ownerId='m-duck',
         summary='EagleWorks：Java 21 / Spring Boot 模組化單體 + PostgreSQL（多租戶），React / Vite 前端。程式碼：duck 100%（合約、採購、財務、簽核模組）；人資在 sandbox 原型由 Lee 開發。',
         pitch='營造業專用 ERP：估驗計價送進電子簽核，核准後直接成為傳票草稿。客單最大、導入最重，適合在現場端（PMS）跑順之後接；也可以先只上電子簽核與估驗計價。',
         nextStep='簽呈：版本化簽核表單上線', tags='EagleWorks, ERP, 簽核, 採購, 合約, 估驗, 財務, 人資'),

    # ── 品牌與官網 ──
    dict(id='p-site', domainId='d-brand', name='EagleAI 官網（gw_eagle）', status='active', priority='P2', ownerId='m-duck',
         summary='Next.js 15 官網：多語系、聯絡表單、App 下載連結與 JSON-LD。程式碼：duck 100%。',
         pitch='', nextStep='', tags='官網, SEO, 多語系'),
    dict(id='p-landing', domainId='d-brand', name='Eagle AI Landing（行銷頁）', status='paused', priority='P2', ownerId='m-jared',
         summary='行銷網站（Next.js static export，Cloudflare Workers）：Hub、請款、訊息通道、團隊頁。程式碼：Jared 100%。最後更新 2026-08-05。',
         pitch='', nextStep='', tags='Landing, 行銷, Cloudflare'),

    # ── 內部平台與實驗 ──
    dict(id='p-ds', domainId='d-platform', name='eagle-component 設計系統', status='active', priority='P2', ownerId='m-jared',
         summary='所有 EagleAI web 專案共用的元件庫與 token（Storybook）。程式碼：Jared 49%、duck 45%。',
         pitch='', nextStep='', tags='設計系統, 元件庫, Storybook'),
    dict(id='p-sandbox', domainId='d-platform', name='sandbox-fullstack 原型實驗場', status='active', priority='P2', ownerId='m-duck',
         summary='全端起始樣板，也是新功能原型的地方。程式碼：duck 59%、Jared 32%、Lee 8%。',
         pitch='', nextStep='', tags='sandbox, 原型, 樣板'),
    dict(id='p-map', domainId='d-platform', name='團隊地圖（eagle-tasks，本頁）', status='active', priority='P2', ownerId='m-duck',
         summary='團隊專案 overview 與負責人地圖，資料存在 Google Sheet。', pitch='', nextStep='', tags='內部工具'),
]
for i, p in enumerate(projects, 1):
    p.setdefault('dueDate', ''); p.setdefault('link', ''); p['order'] = i

T = []
def task(pid, title, who, status='todo', prio='mid', note=''):
    T.append(dict(projectId=pid, title=title, assigneeId=who, status=status, priority=prio, note=note))

# 福懋官網重構
task('p-web', '新版官網視覺提案（多版色系）', 'm-jared', 'doing', 'high')
task('p-web', '前台頁面切版與 SEO', 'm-duck', 'doing', 'high')
task('p-web', '住戶會員頁（登入後：保固、報修紀錄）', 'm-duck', 'todo', 'high')
task('p-web', '線上報修服務', 'm-duck', 'todo', 'high')
task('p-web', '客服後台（報修派工、進度追蹤、滿意度電訪）', 'm-lee', 'todo', 'mid')
task('p-web', 'winshop 後台 / monday 住戶與報修資料整合', 'm-lee', 'todo', 'mid')
task('p-web', '未來客服／報修 App 規劃', 'm-duck', 'todo', 'low')
task('p-web', '套裝化：多租戶給其他建商、產品命名', 'm-duck', 'todo', 'low', '命名要和 EagleAI Field、EagleWorks 一致')
# QMS / 防水 / FMS
task('p-qms', 'QMS 後台：付款明細、PDF 版面', 'm-duck', 'done', 'mid', '最後更新 2026-08-25')
task('p-qms', '廠商 App（EagleAi 1.0.2）', 'm-duck', 'done', 'mid', '最後更新 2026-07-17')
task('p-waterproof', '防水點位資料與照片抽屜', 'm-lee', 'done', 'low')
task('p-fms', '確認 FMS 用途與後續', '', 'todo', 'low')

# PMS 核心
task('p-pms', '日報前端：今日填報、交辦事項、雜工出工', 'm-jared', 'doing', 'high', 'frontend/src/features/daily-report')
task('p-pms', '日報後端 API 與期別審核', 'm-lee', 'doing', 'high', 'server/src/modules/daily-report')
task('p-pms', '出工快照同步（workforce）', 'm-lee', 'done', 'mid')
task('p-pms', '系統後台 admin、工地範圍權限', 'm-duck', 'doing', 'mid', 'frontend/src/features/admin')
task('p-pms', '主檔與帳號登入（base-data / auth）', 'm-lee', 'done', 'mid')
task('p-pms', '日報後台：填報狀態看板、出工趨勢、Excel 匯出', '', 'todo', 'mid', 'server/docs/backlog.md #7')
task('p-pms', '修正：account.email 改名後無法登入／LINE 綁定', 'm-lee', 'todo', 'high', 'server/docs/backlog.md #8，優先序最高')
# LINE Bot
task('p-line', 'LINE webhook、推播與 BFF 後端', 'm-lee', 'done', 'mid')
task('p-line', 'LIFF 格子任務（拍照、提交、採認）', 'm-duck', 'done', 'mid', 'frontend/src/features/liff duck 66%')
task('p-line', 'LIFF QAQC 建單與查驗照片', 'm-lee', 'doing', 'high')
task('p-line', '舊版 eagle-line（Cloudflare Worker 原型）', 'm-jared', 'done', 'low', '2026-07 後停更，功能已移到 pms-line-bot')

# Field App
task('p-frapp', '現場巡檢拍照、標註、觀察紀錄', 'm-duck', 'done', 'mid')
task('p-frapp', '報告組稿與裝置產 PDF', 'm-duck', 'done', 'mid')
task('p-frapp', '報告編號同步、專案可見範圍', 'm-duck', 'doing', 'high')
task('p-frapp', '教學影片與帳號轉移', 'm-duck', 'done', 'low')
# EagleAI Field Web（請款 ABCD 包）
task('p-frweb', 'A 包：請款包（分層數量表、照片核對、請款證明）', 'm-jared', 'doing', 'high', '看板 A 卡、features/board Jared 85%')
task('p-frweb', 'B 包：品管包（完工回報、複驗報告）', 'm-lee', 'doing', 'high', '看板 B 卡、QAQC 任務報告 Lee 100%')
task('p-frweb', 'C 包', '', 'todo', 'mid', '內容與負責人待補')
task('p-frweb', 'D 包', '', 'todo', 'mid', '內容與負責人待補')
task('p-frweb', '現場報告列表與 A4 報告', 'm-lee', 'doing', 'mid', 'features/field-report Lee 97%')
task('p-frweb', '工地資料夾 2（Excel 式表格）', 'm-jared', 'doing', 'mid', '巡檢 Web Jared 78%；PMS 版 site-folder duck 88%')
task('p-frweb', '平面圖對應（plan-mapping）', 'm-jared', 'doing', 'mid', '與 PMS 共用，Jared 70–100%')
task('p-frweb', '分層數量表元件（floor-matrix）', 'm-duck', 'done', 'mid', 'PMS 前端 floor-matrix，duck 99%')
# eagle-vision
task('p-vision', '複核佇列頁（照片上標記）', 'm-duck', 'todo', 'high')
task('p-vision', '專家回饋 → 回訓 API', 'm-duck', 'todo', 'mid')
task('p-vision', '與 PMS 日報照片串接', 'm-duck', 'todo', 'mid')

# ERP
task('p-erp', '簽呈：電子簽核（版本化表單、簽核流程、一般申請）', 'm-duck', 'doing', 'high', 'modules/platform-approval')
task('p-erp', '工務：請購 → 採購案 → 詢比議價 → 發包合約', 'm-duck', 'doing', 'high', 'modules/contract、features/procurement')
task('p-erp', '財務：估驗計價、付款申請 → 傳票，舊帳唯讀查詢', 'm-duck', 'doing', 'mid', 'modules/finance、construction-finance')
task('p-erp', '人資：組織圖、招募、職缺管理', 'm-lee', 'doing', 'mid', '目前在 sandbox-fullstack features/hrms；hrms repo 剛建立')
task('p-erp', 'UOF / gcmis 舊資料與附件搬遷', 'm-duck', 'doing', 'mid')

# 品牌
task('p-site', '多語系、聯絡表單、App 下載連結與 JSON-LD', 'm-duck', 'done', 'mid')
task('p-landing', 'Hub、請款、訊息通道、團隊頁文案', 'm-jared', 'done', 'low')

# 平台
task('p-ds', 'Storybook 文件與元件', 'm-jared', 'doing', 'mid', 'src/stories Jared 51%、duck 44%')
task('p-ds', 'FloorMatrix 元件', 'm-duck', 'done', 'mid')
task('p-ds', 'BarChart 元件', 'm-jared', 'done', 'low')
task('p-sandbox', 'eagle-daily 日報原型', 'm-duck', 'done', 'mid')
task('p-sandbox', 'line-feedback 現場回饋', 'm-jared', 'done', 'mid')
task('p-sandbox', 'project-graph 產品圖譜', 'm-duck', 'doing', 'mid')
task('p-sandbox', 'budget-ab 預算比較與廠商評分', 'm-duck', 'doing', 'mid')
task('p-sandbox', '合約產生器 / work-docs', 'm-duck', 'doing', 'mid')
task('p-sandbox', 'trade-reader', 'm-jared', 'done', 'low')
task('p-map', '建立 Google Sheet 與 Apps Script', 'm-duck', 'done', 'mid')

tasks = []
for i, t in enumerate(T, 1):
    t.update(id=f't-{i:02d}', dueDate='', order=i)
    tasks.append(t)

def full(rows, cols):
    out = []
    for r in rows:
        o = {c: r.get(c, '') for c in cols}
        out.append(o)
    return out

COLS = {
    'members': ['id', 'name', 'title', 'expertise', 'email', 'phone', 'line', 'order'],
    'domains': ['id', 'name', 'kind', 'keywords', 'description', 'clientContact', 'leadId', 'color', 'x', 'y', 'order'],
    'projects': ['id', 'domainId', 'name', 'status', 'priority', 'ownerId', 'summary', 'pitch', 'nextStep', 'tags', 'dueDate', 'link', 'order'],
    'tasks': ['id', 'projectId', 'title', 'assigneeId', 'status', 'priority', 'dueDate', 'note', 'order'],
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
(ROOT / 'gas/Code.gs').write_text(gs, encoding='utf-8')
print('members', len(members), 'domains', len(domains), 'projects', len(projects), 'tasks', len(tasks))
