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


# ── 複雜度（2026-10-05 依各 repo 程式碼統計；沒有 repo 的依需求範圍估計）────────
# 1 很小 · 2 小 · 3 中 · 4 大 · 5 極大
# 看的面向：程式規模（行數）、畫面數、API 數、資料表數、串接的外部服務／系統、權限角色數。
COMPLEXITY = {
    'p-pms': (5, '極大：約 11 萬行程式、29 個畫面、138 支 API、57 張資料表；串 LINE、Apple／Google 登入、AWS S3、PPT／Excel 產出；9 種角色權限，是其他產品共用的核心後端。'),
    'p-erp': (5, '極大：約 7.4 萬行程式、43 個畫面、143 支 API、90 張資料表；要取代 AWM 與 UOF、搬舊資料、內建電子簽核與多公司資料隔離，牽涉財務帳務。'),
    'p-frweb': (4, '大：約 4.1 萬行程式、24 個畫面、6 種角色；本身沒有後端，全部靠 PMS 的 API；請款金額與品管判定的規則多（約 39 條業務邏輯）。'),
    'p-web': (4, '大（依需求估計，尚無程式碼）：前台與 SEO、住戶登入會員頁、線上報修、客服後台，還要接 winshop 與 monday 的既有資料；之後要做報修 App 與多租戶。'),
    'p-vision': (4, '大（依需求估計，本機沒有程式碼）：影像辨識模型、專家複核頁、回訓流程，再加上和 PMS 日報照片串接。'),
    'p-line': (3, '中：約 1.7 萬行程式、20 個 LINE 畫面、25 支 API；自己不存資料，串 LINE 官方帳號與 LIFF，業務資料都轉給 PMS。'),
    'p-frapp': (3, '中：約 2.5 萬行程式、15 個畫面；iOS／Android 雙平台上架、離線拍照與本機資料庫、手機上直接產 PDF，資料走 PMS。'),
    'p-qms': (3, '中：後台約 5.7 萬行程式、31 個頁面，加上廠商 App 約 7 千行；付款明細與 PDF 報表。（後端不在本機，未計入）'),
    'p-ds': (3, '中：約 2.4 萬行程式的共用元件庫；改一個元件會影響所有產品，需要同時顧好相容性。'),
    'p-sandbox': (3, '中：程式約 12.8 萬行，但是許多彼此獨立的小原型（日報、預算比較、合約產生器、人資等），單一原型都不大。'),
    'p-site': (2, '小：約 1 萬行程式、7 個頁面的官網，多語系與聯絡表單。'),
    'p-waterproof': (2, '小：約 3 千行程式、2 個頁面，含 3D 點位顯示。'),
    'p-map': (2, '小：約 5 千行程式的單頁工具，資料存在 Google Sheet。'),
    'p-landing': (1, '很小：約 6 千行程式的靜態行銷網站，沒有後端。'),
    'p-fms': (1, '很小：只有約 4 千行的專案骨架，5 月後沒有更新。'),
}
for p in projects:
    lvl, note = COMPLEXITY.get(p['id'], (0, ''))
    p['complexity'] = lvl
    p['complexityNote'] = note

T = []
def task(pid, title, who, status='todo', prio='mid', note=''):
    T.append(dict(projectId=pid, title=title, assigneeId=who, status=status, priority=prio, note=note))

# 福懋官網重構
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
# eagle-vision
task('p-vision', '複核佇列頁（照片上標記）', 'm-duck', 'todo', 'high')
task('p-vision', '專家回饋 → 回訓 API', 'm-duck', 'todo', 'mid')
task('p-vision', '與 PMS 日報照片串接', 'm-duck', 'todo', 'mid')

# ERP

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
# P0 專案用完整 WBS（seed/wbs.py），其餘專案用上面的 task() 清單。
from wbs import PLANS, to_tasks
WBS_TASKS = [t for pid, rows in PLANS.items() for t in to_tasks(pid, rows)]
for i, t in enumerate(T, 1):
    # 預估天數、不確定性要由負責人自己填，種子資料不代填。
    t.update(id=f't-{i:02d}', dueDate='', estimateDays=0, uncertainty='', blockedReason='', blockedAt='', startedAt='', doneAt='', order=i)
    tasks.append(t)
tasks += [{k: v for k, v in t.items() if k != 'legacy'} for t in WBS_TASKS]

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
(ROOT / 'gas/Code.gs').write_text(gs, encoding='utf-8')
print('members', len(members), 'domains', len(domains), 'projects', len(projects), 'tasks', len(tasks))
