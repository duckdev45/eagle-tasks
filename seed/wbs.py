"""P0 專案的完整工作分解（WBS），2026-10-05 初版。

每一列：(代號, 階段, 任務, 負責人, 預估人天, 不確定性, 前置代號, 舊任務標題關鍵字)
- 預估是 PM 粗估，**請負責人校正**。
- 「舊任務標題關鍵字」用來把 Sheet 裡原本的同名任務接過來（保留它的狀態與 id），
  沒對到的才新增。
"""

LEE, DUCK, JARED = 'm-lee', 'm-duck', 'm-jared'

WEB = [  # 福懋建設官網重構（p-web）
    ('W01', '需求', '啟動會議：確認範圍、驗收窗口、上線時程', DUCK, 0.5, 'low', [], None),
    ('W02', '需求', '現行網站盤點：頁面、內容、SEO 排名與舊網址清單', JARED, 2, 'low', ['W01'], None),
    ('W03', '需求', '取得 winshop／monday 的資料樣本與存取方式（API 或匯出）', LEE, 2, 'high', ['W01'], None),
    ('W04', '需求', '定義住戶與報修流程：報修單狀態、派工、滿意度電訪', LEE, 2, 'mid', ['W03'], None),
    ('W05', '設計', '新版視覺提案（多版色系），客戶選定一版', JARED, 3, 'mid', ['W01'], '視覺'),
    ('W06', '設計', '資訊架構與 sitemap', JARED, 1, 'low', ['W02'], None),
    ('W07', '設計', '前台頁面設計稿（首頁、建案、品牌、聯絡）', JARED, 5, 'mid', ['W05', 'W06'], None),
    ('W08', '設計', '會員與報修流程畫面設計', JARED, 3, 'mid', ['W04', 'W05'], None),
    ('W09', '設計', '客服後台畫面設計', JARED, 2, 'mid', ['W04'], None),
    ('W10', '架構', '技術架構與部署環境（主機、CI、網域）', DUCK, 2, 'low', ['W01'], None),
    ('W11', '架構', '住戶登入方案（身分綁定戶別、OTP）', LEE, 3, 'high', ['W04'], None),
    ('W12', '架構', '資料庫與 API 設計（住戶、戶別、保固、報修單）', LEE, 3, 'mid', ['W04'], None),
    ('W13', '開發', '前台頁面切版與內容管理', DUCK, 6, 'mid', ['W07', 'W10'], '前台'),
    ('W14', '開發', 'SEO：meta、結構化資料、sitemap、301 轉址表', DUCK, 2, 'low', ['W02', 'W13'], None),
    ('W15', '開發', '會員頁：登入、我的戶別、保固資訊', DUCK, 4, 'mid', ['W08', 'W11', 'W12'], '會員'),
    ('W16', '開發', '線上報修：填單、照片上傳、進度追蹤', DUCK, 5, 'mid', ['W08', 'W12'], '報修服務'),
    ('W17', '開發', '住戶與報修 API 實作', LEE, 6, 'mid', ['W12'], None),
    ('W18', '開發', '客服後台：派工、狀態更新、滿意度電訪紀錄', LEE, 6, 'mid', ['W09', 'W17'], '客服後台'),
    ('W19', '開發', 'winshop／monday 資料匯入與同步', LEE, 5, 'high', ['W03', 'W17'], 'winshop'),
    ('W20', '開發', '報修受理與進度通知（簡訊／Email／LINE）', LEE, 2, 'mid', ['W17'], None),
    ('W21', '上線', '內容搬遷與客戶校稿', JARED, 3, 'mid', ['W13'], None),
    ('W22', '上線', '整合測試與客戶驗收（UAT）', DUCK, 4, 'mid', ['W14', 'W15', 'W16', 'W18', 'W19', 'W20', 'W21'], None),
    ('W23', '上線', '正式上線：DNS 切換、301、GA／Search Console', DUCK, 1, 'low', ['W22'], None),
    ('W24', '上線', '上線後兩週觀察與修正', DUCK, 3, 'mid', ['W23'], None),
    ('W25', '之後', '客服／報修 App 規劃', DUCK, 2, 'high', ['W24'], 'App'),
    ('W26', '之後', '套裝化：多租戶給其他建商、產品命名', DUCK, 3, 'high', ['W24'], '套裝化'),
]

FIELD = [  # EagleAI Field Web（請款 ABCD 包，p-frweb）
    ('F01', '釐清', '定義 C 包、D 包的範圍與驗收標準', JARED, 1, 'high', [], None),
    ('F02', 'A 請款包', '請款證明「簽發快照」後端上線（plan-20260922-1）', LEE, 3, 'mid', [], None),
    ('F03', 'A 請款包', '前端請款證明改讀簽發快照', JARED, 1, 'low', ['F02'], None),
    ('F04', 'A 請款包', 'PMS 前端請款證明同步採認人／採認時間', JARED, 1, 'low', [], None),
    ('F05', 'A 請款包', '工地資料夾 Excel 匯入精靈收尾驗證', JARED, 1, 'low', [], '工地資料夾'),
    ('F06', 'B 品管包', '一任務一張卡＋任務報告 驗收', LEE, 1, 'low', [], 'QAQC'),
    ('F07', 'B 品管包', 'PMS 前端品管確認包改用任務報告（task-report）', JARED, 3, 'mid', ['F06'], None),
    ('F08', 'B 品管包', '後端下架舊品管報告 API', LEE, 1, 'low', ['F07'], None),
    ('F09', '現場報告', '建案／首登／報告三組端點接線（拿掉假資料）', LEE, 4, 'mid', [], '現場報告'),
    ('F10', '現場報告', '後端補缺口：缺失改善、草稿組稿、事務所、圖說、廠商回覆', LEE, 8, 'high', [], None),
    ('F11', '現場報告', '前端接上補齊的 API', LEE, 5, 'mid', ['F09', 'F10'], None),
    ('F12', 'C／D 包', 'C 包開發（範圍依 F01）', '', 5, 'high', ['F01'], 'C 包'),
    ('F13', 'C／D 包', 'D 包開發（範圍依 F01）', '', 5, 'high', ['F01'], 'D 包'),
    ('F14', '上線', '部署設定：nginx、PMS CORS 白名單、Google 登入來源', LEE, 1, 'low', [], None),
    ('F15', '上線', 'QAS 整合測試（看板 A／B／現場報告＋C／D）', JARED, 3, 'mid', ['F03', 'F04', 'F05', 'F08', 'F11', 'F12', 'F13', 'F14'], None),
    ('F16', '上線', 'PRD 上線＋工地主任／工務處教育訓練', JARED, 2, 'mid', ['F15'], None),
    ('F17', '上線', '上線後兩週觀察與修正', LEE, 3, 'mid', ['F16'], None),
]

ERP = [  # 內部 ERP 重構（p-erp）— 依 eagle-works docs/plans 的批次與待決題拆，M1＝MVP 上線（ACM 仍是正式帳）
    ('E01', '決策', '定 M1 範圍與上線門檻（Go／No-Go 清單，含期初對帳到元）', DUCK, 1, 'mid', [], None),
    ('E02', '決策', '財務待決題拍板：期初粒度、演練或正式、主檔正本（Q11–Q13，與財管部）', DUCK, 2, 'high', ['E01'], None),
    ('E03', '決策', '付款票據範圍拍板：票據、支票套印、並行期誰登（Q7、Q15，與出納）', DUCK, 1, 'high', ['E01'], None),
    ('E04', '決策', '核決權限表定案：金額級距、誰核（X11，與管理部）', DUCK, 2, 'high', ['E01'], None),
    ('E05', '決策', '人資範圍與放哪：併入 EagleWorks 共用簽核與組織，或獨立 hrms', LEE, 1, 'mid', ['E01'], None),
    ('E06', '簽核', '簽核第 5 期：只開簽核的端到端驗收、工務簽核回歸、啟動檢查', DUCK, 3, 'mid', [], '簽呈'),
    ('E07', '簽核', '簽呈、內聯單、備忘錄給管理部試跑並修正', DUCK, 3, 'mid', ['E06', 'E04'], None),
    ('E08', '簽核', '決策、表單定義、子流程三頁接真後端（X6，先依 UOF 寫規格）', DUCK, 5, 'high', ['E06'], None),
    ('E09', '工務', '工務拆模組（批次 2）：預算、合約、驗收、計價各管各的表', DUCK, 8, 'mid', [], '工務'),
    ('E10', '工務', '沒買簽核也能閉環（批次 3）：送出即生效、construction-workflow', DUCK, 5, 'mid', ['E09'], None),
    ('E11', '工務', '估驗計價送出／確認，確認後才進待製票', DUCK, 4, 'mid', ['E10'], None),
    ('E12', '工務', '舊資料覆核：子約待確認約 40 筆、33 組付款條件（X8、X9）', '', 3, 'high', [], None),
    ('E13', '財務', '取得 ACM17「轉出檔案」樣本傳票檔（X1，要本人帶財務上機）', DUCK, 0.5, 'high', [], None),
    ('E14', '財務', '傳票 CSV 匯出批次＋已匯出狀態（F4）', DUCK, 4, 'mid', ['E13'], None),
    ('E15', '財務', '期初餘額與期初對帳（F3）', DUCK, 6, 'high', ['E02'], '財務'),
    ('E16', '財務', '舊帳歷史資料載入（F5）', DUCK, 3, 'mid', ['E02'], None),
    ('E17', '財務', '票據主檔與狀態機（F6）', DUCK, 5, 'high', ['E03'], None),
    ('E18', '財務', '銀行帳戶與支票簿、支票套印（F7、US9）', DUCK, 4, 'mid', ['E03', 'E17'], None),
    ('E19', '財務', '財務外部匯入：範本、整批檢核、全有或全無（批次 5）', DUCK, 5, 'mid', ['E14'], None),
    ('E20', '財務', '工地科目設定人工補齊（X7，財管部覆核後財務補）', '', 3, 'high', [], None),
    ('E21', '搬遷', 'UOF／gcmis 簽核單與歷程對照、匯入', DUCK, 5, 'mid', [], 'UOF'),
    ('E22', '搬遷', 'UOF 附件搬遷：.ebc 原檔轉出、掛回簽核單', DUCK, 5, 'high', ['E21'], None),
    ('E23', '搬遷', '搬遷對帳：筆數、金額、抽樣與舊畫面比對', DUCK, 2, 'mid', ['E22', 'E16'], None),
    ('E24', '人資', '人資資料模型與 API：員工、組織、職級', LEE, 5, 'mid', ['E05'], '人資'),
    ('E25', '人資', '人事表單接簽核：到職、轉正、調動、職級、離職', LEE, 5, 'mid', ['E24', 'E06'], None),
    ('E26', '人資', '招募與職缺管理', LEE, 4, 'mid', ['E24'], None),
    ('E27', '人資', '前端從 sandbox 原型搬進正式專案、接真 API', JARED, 5, 'mid', ['E24'], None),
    ('E28', '人資', '績效考核', LEE, 4, 'high', ['E25'], None),
    ('E29', '人資', '人事與組織舊資料匯入', LEE, 3, 'high', ['E24', 'E21'], None),
    ('E30', '上線', '組合驗收（批次 6）：八種開通組合、停用＝唯讀、開通管理', DUCK, 6, 'mid', ['E07', 'E11', 'E19'], None),
    ('E31', '上線', '正式環境：DEV／PRD edge nginx、CI、深連結驗證（X2）', DUCK, 3, 'mid', [], None),
    ('E32', '上線', '期初對帳演練到元，財管部簽認', DUCK, 3, 'high', ['E15', 'E16', 'E20'], None),
    ('E33', '上線', '操作手冊與教育訓練（簽核、工務、財務、人資）', JARED, 3, 'mid', ['E30', 'E27'], None),
    ('E34', '上線', 'M1 上線（Go／No-Go 會議）', DUCK, 1, 'mid',
     ['E30', 'E31', 'E32', 'E23', 'E33', 'E12', 'E14', 'E18', 'E08', 'E25', 'E26', 'E28', 'E29'], None),
    ('E35', '上線', '上線後兩週觀察與修正', DUCK, 3, 'mid', ['E34'], None),
    ('E36', '之後', 'V2：正式帳本（過帳、期別鎖、月結）', DUCK, 20, 'high', ['E35'], None),
    ('E37', '之後', 'V2：發票稅務、應付應收、出納，停用 ACM', DUCK, 15, 'high', ['E36'], None),
]

# 一開始就知道在等外部的任務：新建時帶入「卡住原因」（解決後清空即可）。
BLOCKED = {
    'E12': '等工管部・發包課逐筆確認子約，財務／發包課依紙本確認 33 組付款條件',
    'E13': '要 duck 帶財務在舊系統執行 ACM17「轉出檔案」，只能本人上機',
    'E20': '等財管部覆核 site_ledgers_review 清單',
}

PLANS = {'p-web': WEB, 'p-frweb': FIELD, 'p-erp': ERP}


def check_order(rows):
    seen = set()
    for r in rows:
        missing = [d for d in r[6] if d not in seen]
        assert not missing, f'{r[0]} 的前置 {missing} 要排在它前面'
        seen.add(r[0])


def critical_path(rows):
    """Classic CPM on estimates (no resource levelling) up to launch — the
    「之後」phase is excluded. Returns (length, [codes])."""
    rows = [r for r in rows if r[1] != '之後']
    est = {r[0]: r[4] for r in rows}
    deps = {r[0]: r[6] for r in rows}
    finish, prev = {}, {}
    for code in [r[0] for r in rows]:  # rows are already topologically ordered
        start = max((finish[d] for d in deps[code]), default=0)
        prev[code] = max(deps[code], key=lambda d: finish[d]) if deps[code] else None
        finish[code] = start + est[code]
    end = max(finish, key=finish.get)
    path = []
    while end:
        path.append(end)
        end = prev[end]
    return max(finish.values()), list(reversed(path))


def to_tasks(project_id, rows):
    """Rows → task dicts in the Sheet schema (ids are stable: t-W05 …)."""
    check_order(rows)
    _, crit = critical_path(rows)
    out = []
    for i, (code, phase, title, who, days, unc, deps, legacy) in enumerate(rows, 1):
        note = f'階段：{phase}'
        out.append(dict(
            id=f't-{code}', projectId=project_id, title=f'{code} {title}', assigneeId=who,
            status='todo', priority='high' if code in crit else ('low' if phase == '之後' else 'mid'),
            dueDate='', note=note, estimateDays=days, uncertainty=unc,
            blockedReason=BLOCKED.get(code, ''), deps=','.join(f't-{d}' for d in deps), blockedAt='', startedAt='', doneAt='', order=i,
            legacy=legacy or '',
        ))
    return out


if __name__ == '__main__':
    from collections import defaultdict
    buf = {'low': 0.1, 'mid': 0.3, 'high': 0.5}
    for pid, rows in PLANS.items():
        length, path = critical_path(rows)
        total = sum(r[4] for r in rows)
        buffered = sum(r[4] * (1 + buf[r[5]]) for r in rows)
        per = defaultdict(float)
        for r in rows:
            per[r[3] or '未指派'] += r[4]
        print(pid, f'總工作量 {total} 人天（含緩衝 {buffered:.1f}）', f'要徑 {length} 天:', ' → '.join(path))
        print('   ', dict(per))
