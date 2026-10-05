/**
 * EagleAI Team Map — Google Apps Script backend
 * ------------------------------------------------------------
 * Google Sheet = 資料庫，一個分頁一種資料：domains / projects / tasks / members
 * 第一列是欄位名稱（程式會自動建立），之後每列一筆。
 *
 * 部署：
 *   1. 在 Google Sheet → 擴充功能 → Apps Script，貼上本檔
 *   2. 專案設定 → 指令碼屬性 → 新增 API_TOKEN = <自訂一串亂數>
 *      （前端 .env.local 的 VITE_GAS_TOKEN 要填一樣的值）
 *   3. 執行一次 setup()（授權 + 建立分頁與欄位）
 *      要放入團隊資料就再執行 seedTeam()（分頁已有資料時改用 resetToSeed()，會清空重寫）
 *   4. 部署 → 新增部署 → 網頁應用程式
 *        執行身分：我
 *        誰可以存取：任何人   ← 必須是「任何人」，前端跨網域 fetch 才拿得到資料
 *   5. 之後改程式：部署 → 管理部署 → 編輯 → 版本選「新版本」（網址不變）
 *
 * API：
 *   GET  ?action=list&token=…                          → { ok, data: { domains, projects, tasks, members } }
 *   POST {"action":"upsert","sheet":"tasks","record":{…},"token":"…"}
 *   POST {"action":"delete","sheet":"tasks","id":"t-1","token":"…"}
 *   POST {"action":"batch","ops":[{action,sheet,record|id}…],"token":"…"}
 *   前端以 Content-Type: text/plain 送 POST，避免 CORS preflight。
 */

var SCHEMA = {
  domains: ['id', 'name', 'kind', 'keywords', 'description', 'clientContact', 'leadId', 'color', 'x', 'y', 'order', 'updatedAt'],
  projects: ['id', 'domainId', 'name', 'status', 'priority', 'ownerId', 'summary', 'pitch', 'nextStep', 'tags', 'dueDate', 'link', 'order', 'updatedAt'],
  tasks: ['id', 'projectId', 'title', 'assigneeId', 'status', 'priority', 'dueDate', 'note', 'order', 'updatedAt'],
  members: ['id', 'name', 'title', 'expertise', 'email', 'phone', 'line', 'order', 'updatedAt'],
};

// Text columns that must never be auto-converted by Sheets (dates → Date objects,
// "0912…" → number). Forced to plain text format on setup.
var TEXT_COLUMNS = ['id', 'dueDate', 'phone', 'line', 'updatedAt', 'domainId', 'projectId', 'ownerId', 'assigneeId', 'leadId'];

// ─── HTTP entry points ───────────────────────────────────────

function doGet(e) {
  return handle_(function () {
    var p = (e && e.parameter) || {};
    checkToken_(p.token);
    var action = p.action || 'list';
    if (action === 'list') return { data: readAll_() };
    if (action === 'ping') return { pong: new Date().toISOString() };
    throw new Error('Unknown action: ' + action);
  });
}

function doPost(e) {
  return handle_(function () {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    checkToken_(body.token);
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      if (body.action === 'upsert') return { record: upsert_(body.sheet, body.record) };
      if (body.action === 'delete') {
        remove_(body.sheet, body.id);
        return {};
      }
      if (body.action === 'batch') {
        (body.ops || []).forEach(function (op) {
          if (op.action === 'upsert') upsert_(op.sheet, op.record);
          else if (op.action === 'delete') remove_(op.sheet, op.id);
          else throw new Error('Unknown batch op: ' + op.action);
        });
        return { count: (body.ops || []).length };
      }
      throw new Error('Unknown action: ' + body.action);
    } finally {
      lock.releaseLock();
    }
  });
}

function handle_(fn) {
  var out;
  try {
    var result = fn() || {};
    result.ok = true;
    out = result;
  } catch (err) {
    out = { ok: false, error: String((err && err.message) || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function checkToken_(token) {
  var expected = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
  if (expected && token !== expected) throw new Error('Unauthorized');
}

// ─── Sheet helpers ───────────────────────────────────────────

function sheet_(name) {
  if (!SCHEMA[name]) throw new Error('Unknown sheet: ' + name);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, SCHEMA[name].length).setValues([SCHEMA[name]]).setFontWeight('bold');
    sh.setFrozenRows(1);
    formatTextColumns_(sh, SCHEMA[name]);
  }
  return sh;
}

function formatTextColumns_(sh, headers) {
  headers.forEach(function (h, i) {
    if (TEXT_COLUMNS.indexOf(h) >= 0) sh.getRange(1, i + 1, sh.getMaxRows(), 1).setNumberFormat('@');
  });
}

/** Headers as they actually are in the sheet — columns can be reordered or added by hand. */
function headers_(sh, name) {
  var lastCol = sh.getLastColumn();
  var headers = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
  // Add any schema column that's missing (e.g. after an app update).
  var missing = SCHEMA[name].filter(function (h) {
    return headers.indexOf(h) < 0;
  });
  if (missing.length) {
    sh.getRange(1, headers.length + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');
    headers = headers.concat(missing);
  }
  return headers;
}

function readSheet_(name) {
  var sh = sheet_(name);
  var headers = headers_(sh, name);
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  var values = sh.getRange(2, 1, lastRow - 1, headers.length).getValues();
  var tz = Session.getScriptTimeZone();
  return values
    .filter(function (row) {
      return row[0] !== '' && row[0] != null;
    })
    .map(function (row) {
      var obj = {};
      headers.forEach(function (h, i) {
        var v = row[i];
        if (v instanceof Date) v = Utilities.formatDate(v, tz, h === 'updatedAt' ? "yyyy-MM-dd'T'HH:mm:ss" : 'yyyy-MM-dd');
        obj[h] = v;
      });
      return obj;
    });
}

function readAll_() {
  var out = {};
  Object.keys(SCHEMA).forEach(function (name) {
    out[name] = readSheet_(name);
  });
  return out;
}

function findRow_(sh, id) {
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return -1;
  var ids = sh.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return -1;
}

function upsert_(name, record) {
  if (!record || !record.id) throw new Error('record.id is required');
  var sh = sheet_(name);
  var headers = headers_(sh, name);
  record.updatedAt = new Date().toISOString();
  var rowIdx = findRow_(sh, record.id);
  var current = rowIdx > 0 ? sh.getRange(rowIdx, 1, 1, headers.length).getValues()[0] : [];
  var row = headers.map(function (h, i) {
    if (Object.prototype.hasOwnProperty.call(record, h)) {
      var v = record[h];
      return v == null ? '' : v;
    }
    return current[i] == null ? '' : current[i]; // keep columns the client didn't send
  });
  if (rowIdx > 0) sh.getRange(rowIdx, 1, 1, headers.length).setValues([row]);
  else sh.appendRow(row);
  return record;
}

function remove_(name, id) {
  var sh = sheet_(name);
  var rowIdx = findRow_(sh, id);
  if (rowIdx > 0) sh.deleteRow(rowIdx);
}

// ─── One-off utilities (run from the editor) ─────────────────

/** 建立四個分頁與欄位。第一次部署前執行一次。 */
function setup() {
  Object.keys(SCHEMA).forEach(function (name) {
    var sh = sheet_(name);
    headers_(sh, name);
    formatTextColumns_(sh, SCHEMA[name]);
  });
  var sheet1 = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('工作表1') ||
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sheet1');
  if (sheet1 && sheet1.getLastRow() === 0 && SpreadsheetApp.getActiveSpreadsheet().getSheets().length > 1) {
    SpreadsheetApp.getActiveSpreadsheet().deleteSheet(sheet1);
  }
}

/**
 * 寫入團隊資料（成員、客戶／產品線、專案、任務）。
 * 只在四個分頁都是空的時候才會寫入，避免蓋掉已經在網頁上改過的資料。
 */
function seedTeam() {
  setup();
  var filled = Object.keys(SCHEMA).filter(function (name) {
    return readSheet_(name).length > 0;
  });
  if (filled.length) {
    throw new Error('這些分頁已有資料：' + filled.join(', ') + '。要整個重來請改跑 resetToSeed()。');
  }
  writeSeed_();
}

/**
 * ⚠️ 清空四個分頁的所有資料列（保留標題列），再寫入 SEED。
 * 網頁上做過的修改都會消失，執行前先確認。
 */
function resetToSeed() {
  setup();
  Object.keys(SCHEMA).forEach(function (name) {
    var sh = sheet_(name);
    if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
  });
  writeSeed_();
}

/** One setValues per sheet — much faster than upserting row by row. */
function writeSeed_() {
  var now = new Date().toISOString();
  Object.keys(SCHEMA).forEach(function (name) {
    var rows = SEED[name] || [];
    if (!rows.length) return;
    var sh = sheet_(name);
    var headers = headers_(sh, name);
    var values = rows.map(function (r) {
      return headers.map(function (h) {
        if (h === 'updatedAt') return now;
        var v = r[h];
        return v == null ? '' : v;
      });
    });
    sh.getRange(sh.getLastRow() + 1, 1, values.length, headers.length).setValues(values);
  });
}

/**
 * 2026-10-05 一次性調整（保留你在網頁上改過的資料，不會清空）：
 *  1. projects 分頁加 priority 欄，沒填的依預設給 P0／P1／P2
 *  2. 「請款 ABCD 包」併進「EagleAI Field Web」：任務搬過去、標籤合併、刪除原專案
 * 可以重複執行，第二次起不會再改動。
 */
function migrate_20261005() {
  setup();
  var DEFAULT_PRIORITY = {
    'p-web': 'P0', 'p-frweb': 'P0',
    'p-qms': 'P2', 'p-waterproof': 'P2', 'p-fms': 'P2', 'p-site': 'P2', 'p-landing': 'P2',
    'p-ds': 'P2', 'p-sandbox': 'P2', 'p-map': 'P2',
  };
  var projects = readSheet_('projects');
  projects.forEach(function (p) {
    if (!p.priority) upsert_('projects', { id: p.id, priority: DEFAULT_PRIORITY[p.id] || 'P1' });
  });

  var pay = projects.filter(function (p) {
    return p.id === 'p-pay' || (/請款/.test(p.name) && /ABCD/i.test(p.name));
  })[0];
  var web = projects.filter(function (p) {
    return p.id === 'p-frweb' || /Field Web/i.test(p.name);
  })[0];
  if (!pay || !web || pay.id === web.id) {
    Logger.log('找不到要合併的專案（可能已經合併過）。');
    return;
  }

  var tasks = readSheet_('tasks');
  var maxOrder = tasks.filter(function (t) { return t.projectId === web.id; })
    .reduce(function (m, t) { return Math.max(m, Number(t.order) || 0); }, 0);
  var RENAME = {
    'A 包': 'A 包：請款包（分層數量表、照片核對、請款證明）',
    'B 包': 'B 包：品管包（完工回報、複驗報告）',
  };
  var moved = 0;
  tasks.filter(function (t) { return t.projectId === pay.id; })
    .sort(function (a, b) { return (Number(a.order) || 0) - (Number(b.order) || 0); })
    .forEach(function (t) {
      maxOrder += 1;
      var rec = { id: t.id, projectId: web.id, order: maxOrder };
      if (RENAME[String(t.title).trim()]) rec.title = RENAME[String(t.title).trim()];
      upsert_('tasks', rec);
      moved++;
    });

  var tags = String(web.tags || '').split(/[,，]/).concat(String(pay.tags || '').split(/[,，]/))
    .map(function (x) { return x.trim(); }).filter(Boolean);
  var uniq = tags.filter(function (x, i) { return tags.indexOf(x) === i; });
  var patch = { id: web.id, tags: uniq.join(', '), priority: 'P0' };
  if (!/請款/.test(String(web.summary))) {
    patch.summary = String(web.summary || '') + (web.summary ? '\n' : '') +
      '含請款 ABCD 包：現場照片 → 分層數量表 → 本期數量 → 請款驗證證明。';
  }
  if (!String(web.pitch)) patch.pitch = pay.pitch;
  upsert_('projects', patch);
  remove_('projects', pay.id);
  Logger.log('已合併：搬移 ' + moved + ' 個任務到「' + web.name + '」，刪除「' + pay.name + '」。');
}

// ── SEED (GENERATED by seed/build_seed.py — do not hand-edit) ──
var SEED = {
  "members": [
    {
      "id": "m-lee",
      "name": "Lee",
      "title": "BE 後端",
      "expertise": "NestJS / PostgreSQL 後端：PMS 日報、品管 QAQC、分層數量表、LINE 通道後端、巡檢報告 Web、HRMS",
      "email": "",
      "phone": "",
      "line": "",
      "order": 1
    },
    {
      "id": "m-duck",
      "name": "duck",
      "title": "FE 前端",
      "expertise": "EagleWorks ERP、EagleAI Field App、LINE LIFF 前端、PMS 後台與分層數量表元件、官網、設計系統",
      "email": "duck@eagleai.tw",
      "phone": "",
      "line": "",
      "order": 2
    },
    {
      "id": "m-jared",
      "name": "Jared",
      "title": "UI/UX",
      "expertise": "PMS 日報與請款看板前端、巡檢看板、平面圖對應、eagle-component、行銷 Landing",
      "email": "",
      "phone": "",
      "line": "",
      "order": 3
    },
    {
      "id": "m-wes",
      "name": "Wes",
      "title": "",
      "expertise": "",
      "email": "",
      "phone": "",
      "line": "",
      "order": 4
    }
  ],
  "domains": [
    {
      "id": "d-fumao",
      "name": "福懋建設",
      "kind": "client",
      "keywords": "福懋, 建設, 建商, 官網, 網站, SEO, 報修, 保固, 住戶, 會員, 客服, 售後服務, QMS, 廠商, 防水",
      "description": "EagleAI 第一個客戶：官網重構＋住戶服務、QMS 廠商系統、防水點位工具。",
      "clientContact": "福懋 資訊室",
      "leadId": "m-duck",
      "color": "teal",
      "x": null,
      "y": null,
      "order": 1
    },
    {
      "id": "d-pms",
      "name": "PMS 工程管理",
      "kind": "sector",
      "keywords": "營造, 工地, 工程, PMS, 日報, 出工, 點工, 請款, 估驗, 分層數量表, 請款證明, 品管, 查驗, 完工回報, LINE, LIFF, 工班, 協力廠商",
      "description": "營建工地的業務核心：工務日報、分層數量表請款、品管查驗；工班用 LINE 回報，不用裝 App。",
      "clientContact": "",
      "leadId": "m-jared",
      "color": "accent",
      "x": null,
      "y": null,
      "order": 2
    },
    {
      "id": "d-field",
      "name": "現場巡檢與 AI",
      "kind": "sector",
      "keywords": "巡檢, 現場報告, 監造, 驗屋, 缺失, 改善, 照片, App, 離線, PDF, AI, 影像辨識, 工種",
      "description": "現場人員用 App 離線拍照組報告、桌面 Web 看板追缺失，AI 自動辨識照片工種。",
      "clientContact": "",
      "leadId": "m-duck",
      "color": "info",
      "x": null,
      "y": null,
      "order": 3
    },
    {
      "id": "d-erp",
      "name": "EagleWorks 內部 ERP",
      "kind": "internal",
      "keywords": "ERP, EagleWorks, AWM, UOF, 簽呈, 簽核, 電子簽核, 工務, 採購, 請購, 發包, 合約, 估驗, 財務, 傳票, 會計, 人資, HR, 組織, 招募",
      "description": "取代舊 AWM 與 UOF 的營造業 ERP：請購、詢比議價、發包、工地簽收、估驗計價一路串到財務傳票，內建電子簽核。",
      "clientContact": "",
      "leadId": "m-duck",
      "color": "violet",
      "x": null,
      "y": null,
      "order": 4
    },
    {
      "id": "d-brand",
      "name": "品牌與官網",
      "kind": "internal",
      "keywords": "官網, 行銷, Landing, 品牌, SEO, eagleai.tw, 介紹, 下載",
      "description": "EagleAI 對外的網站與行銷頁。",
      "clientContact": "",
      "leadId": "m-jared",
      "color": "primary",
      "x": null,
      "y": null,
      "order": 5
    },
    {
      "id": "d-platform",
      "name": "內部平台與實驗",
      "kind": "internal",
      "keywords": "設計系統, 元件庫, eagle-component, sandbox, 原型, 實驗, 內部工具, 預算, 合約產生器",
      "description": "團隊共用的元件庫、全端樣板與新功能原型。",
      "clientContact": "",
      "leadId": "m-duck",
      "color": "neutral",
      "x": null,
      "y": null,
      "order": 6
    }
  ],
  "projects": [
    {
      "id": "p-web",
      "domainId": "d-fumao",
      "name": "福懋建設官網重構",
      "status": "active",
      "priority": "P0",
      "ownerId": "m-duck",
      "summary": "重構 fu-mao.com.tw：前端視覺、SEO、住戶會員頁、線上報修與客服後台；現行後台 winshop、住戶與報修追蹤在 monday。（本機沒有這個 repo，任務依需求整理）",
      "pitch": "建商官網＋住戶服務一條龍：住戶登入看保固、線上報修、進度追蹤，客服後台派工與滿意度回訪。福懋是第一個實績，可以包裝成套裝給其他建商。",
      "nextStep": "向福懋提案新版官網視覺（多版色系）",
      "tags": "官網, SEO, 報修, 住戶會員, 客服後台, winshop, monday",
      "dueDate": "",
      "link": "",
      "order": 1
    },
    {
      "id": "p-qms",
      "domainId": "d-fumao",
      "name": "QMS 廠商系統（後台＋廠商 App）",
      "status": "paused",
      "priority": "P2",
      "ownerId": "m-duck",
      "summary": "福懋的廠商／品質管理：Web 後台（付款明細、PDF）與廠商 App（派工、位置、照片裁切）。程式碼：前端 duck 58%、Lee 41%；App duck 100%。最後更新 2026-08-25。",
      "pitch": "協力廠商派工、拍照回報與付款明細在同一套系統，已在福懋使用。",
      "nextStep": "",
      "tags": "QMS, 廠商, App, 付款, fumao/qms",
      "dueDate": "",
      "link": "",
      "order": 2
    },
    {
      "id": "p-waterproof",
      "domainId": "d-fumao",
      "name": "防水點位（gw_fumao）",
      "status": "paused",
      "priority": "P2",
      "ownerId": "m-lee",
      "summary": "防水檢查點位與照片抽屜。程式碼：Lee 97%。最後更新 2026-06-12。",
      "pitch": "",
      "nextStep": "",
      "tags": "防水, 點位, fumao/gw",
      "dueDate": "",
      "link": "",
      "order": 3
    },
    {
      "id": "p-fms",
      "domainId": "d-fumao",
      "name": "FMS（fms_fullstack）",
      "status": "paused",
      "priority": "P2",
      "ownerId": "m-duck",
      "summary": "2026-05 建立的全端專案骨架，之後沒有更新。程式碼：前端 duck、後端 Lee。用途待補。",
      "pitch": "",
      "nextStep": "",
      "tags": "FMS, fumao/fms",
      "dueDate": "",
      "link": "",
      "order": 4
    },
    {
      "id": "p-pms",
      "domainId": "d-pms",
      "name": "PMS 核心：工務日報與後台",
      "status": "active",
      "priority": "P1",
      "ownerId": "m-jared",
      "summary": "營建工地業務規則與資料核心（NestJS + PostgreSQL / Next.js）。程式碼：日報前端 Jared 64%、duck 34%；日報後端 Lee 91%；後台 admin duck 70%；主檔、登入、LINE 模組 Lee。",
      "pitch": "工地主任每天填日報、拍照、記出工，工務主管一個畫面看所有工地；日報會自動整理成 PPT。最容易切入的第一步。",
      "nextStep": "日報後台：填報狀態看板、出工趨勢、Excel 匯出",
      "tags": "PMS, 日報, 出工, 點工, 後台",
      "dueDate": "",
      "link": "",
      "order": 5
    },
    {
      "id": "p-line",
      "domainId": "d-pms",
      "name": "PMS LINE Bot（LIFF）",
      "status": "active",
      "priority": "P1",
      "ownerId": "m-lee",
      "summary": "PMS 的 LINE 通道：webhook、推播、LIFF 格子任務與 QAQC 查驗；業務資料都在 PMS。程式碼：後端 Lee 96–100%；LIFF 前端 duck 66%、Jared 19%、Lee 13%。",
      "pitch": "工班與品管不裝 App、不記帳號，在 LINE 收卡片就能回報、查驗、整改。最容易單賣的入口，按綁定人數或工地數收月費。",
      "nextStep": "",
      "tags": "LINE, LIFF, 推播, 工班, QAQC",
      "dueDate": "",
      "link": "",
      "order": 6
    },
    {
      "id": "p-frapp",
      "domainId": "d-field",
      "name": "EagleAI Field App",
      "status": "active",
      "priority": "P1",
      "ownerId": "m-duck",
      "summary": "iOS / Android 巡檢 App（Expo）：離線拍照、標註、組報告、裝置上產 PDF，資料走 PMS 後端。程式碼：duck 99%。目前版本 1.0.4。",
      "pitch": "巡檢人員離線也能拍照記缺失，現場就產出 PDF 報告，回辦公室不用再整理。",
      "nextStep": "報告編號同步、專案可見範圍",
      "tags": "App, 巡檢, 離線, PDF, iOS, Android",
      "dueDate": "",
      "link": "",
      "order": 7
    },
    {
      "id": "p-frweb",
      "domainId": "d-field",
      "name": "EagleAI Field Web（請款 ABCD 包）",
      "status": "active",
      "priority": "P0",
      "ownerId": "m-lee",
      "summary": "桌面看板（pms-field-report-web）：A 請款包、B 品管包、現場報告收成卡片；現場照片 → 分層數量表 → 本期數量 → 請款驗證證明。程式碼：看板 board Jared 85%；現場報告 Lee 97%；工地資料夾 Jared 78%；QAQC Lee 100%；分層數量表後端 Lee 100%、PMS 前端元件 duck 99%。",
      "pitch": "工項 × 樓層的每一格都有現場照片，本期數量才算得出來，直接對應請款金額，最好開價；辦公室一個看板看所有工地的待請款、待查驗與缺失改善，廠商免登入就能回覆。",
      "nextStep": "看板篩選與工地切換整理",
      "tags": "請款, 估驗, 分層數量表, 請款證明, 品管, 複驗, 看板, 現場報告, 缺失, 廠商回覆",
      "dueDate": "",
      "link": "",
      "order": 8
    },
    {
      "id": "p-vision",
      "domainId": "d-field",
      "name": "工種辨識（eagle-vision）",
      "status": "active",
      "priority": "P1",
      "ownerId": "m-duck",
      "summary": "工地照片自動分類工種，與 PMS 日報照片串接；專家複核後回訓模型。（本機沒有這個 repo）",
      "pitch": "工地每天上百張照片自動歸到工種，品管只要複核 AI 不確定的那幾張；複核結果會回頭訓練模型，越用越準。",
      "nextStep": "獨立的複核佇列頁（可在照片上標記）",
      "tags": "AI, 影像辨識, 工種, 照片, 日報",
      "dueDate": "",
      "link": "",
      "order": 9
    },
    {
      "id": "p-erp",
      "domainId": "d-erp",
      "name": "內部 ERP 重構",
      "status": "active",
      "priority": "P1",
      "ownerId": "m-duck",
      "summary": "EagleWorks：Java 21 / Spring Boot 模組化單體 + PostgreSQL（多租戶），React / Vite 前端。程式碼：duck 100%（合約、採購、財務、簽核模組）；人資在 sandbox 原型由 Lee 開發。",
      "pitch": "營造業專用 ERP：估驗計價送進電子簽核，核准後直接成為傳票草稿。客單最大、導入最重，適合在現場端（PMS）跑順之後接；也可以先只上電子簽核與估驗計價。",
      "nextStep": "簽呈：版本化簽核表單上線",
      "tags": "EagleWorks, ERP, 簽核, 採購, 合約, 估驗, 財務, 人資",
      "dueDate": "",
      "link": "",
      "order": 10
    },
    {
      "id": "p-site",
      "domainId": "d-brand",
      "name": "EagleAI 官網（gw_eagle）",
      "status": "active",
      "priority": "P2",
      "ownerId": "m-duck",
      "summary": "Next.js 15 官網：多語系、聯絡表單、App 下載連結與 JSON-LD。程式碼：duck 100%。",
      "pitch": "",
      "nextStep": "",
      "tags": "官網, SEO, 多語系",
      "dueDate": "",
      "link": "",
      "order": 11
    },
    {
      "id": "p-landing",
      "domainId": "d-brand",
      "name": "Eagle AI Landing（行銷頁）",
      "status": "paused",
      "priority": "P2",
      "ownerId": "m-jared",
      "summary": "行銷網站（Next.js static export，Cloudflare Workers）：Hub、請款、訊息通道、團隊頁。程式碼：Jared 100%。最後更新 2026-08-05。",
      "pitch": "",
      "nextStep": "",
      "tags": "Landing, 行銷, Cloudflare",
      "dueDate": "",
      "link": "",
      "order": 12
    },
    {
      "id": "p-ds",
      "domainId": "d-platform",
      "name": "eagle-component 設計系統",
      "status": "active",
      "priority": "P2",
      "ownerId": "m-jared",
      "summary": "所有 EagleAI web 專案共用的元件庫與 token（Storybook）。程式碼：Jared 49%、duck 45%。",
      "pitch": "",
      "nextStep": "",
      "tags": "設計系統, 元件庫, Storybook",
      "dueDate": "",
      "link": "",
      "order": 13
    },
    {
      "id": "p-sandbox",
      "domainId": "d-platform",
      "name": "sandbox-fullstack 原型實驗場",
      "status": "active",
      "priority": "P2",
      "ownerId": "m-duck",
      "summary": "全端起始樣板，也是新功能原型的地方。程式碼：duck 59%、Jared 32%、Lee 8%。",
      "pitch": "",
      "nextStep": "",
      "tags": "sandbox, 原型, 樣板",
      "dueDate": "",
      "link": "",
      "order": 14
    },
    {
      "id": "p-map",
      "domainId": "d-platform",
      "name": "團隊地圖（eagle-tasks，本頁）",
      "status": "active",
      "priority": "P2",
      "ownerId": "m-duck",
      "summary": "團隊專案 overview 與負責人地圖，資料存在 Google Sheet。",
      "pitch": "",
      "nextStep": "",
      "tags": "內部工具",
      "dueDate": "",
      "link": "",
      "order": 15
    }
  ],
  "tasks": [
    {
      "id": "t-01",
      "projectId": "p-web",
      "title": "新版官網視覺提案（多版色系）",
      "assigneeId": "m-jared",
      "status": "doing",
      "priority": "high",
      "dueDate": "",
      "note": "",
      "order": 1
    },
    {
      "id": "t-02",
      "projectId": "p-web",
      "title": "前台頁面切版與 SEO",
      "assigneeId": "m-duck",
      "status": "doing",
      "priority": "high",
      "dueDate": "",
      "note": "",
      "order": 2
    },
    {
      "id": "t-03",
      "projectId": "p-web",
      "title": "住戶會員頁（登入後：保固、報修紀錄）",
      "assigneeId": "m-duck",
      "status": "todo",
      "priority": "high",
      "dueDate": "",
      "note": "",
      "order": 3
    },
    {
      "id": "t-04",
      "projectId": "p-web",
      "title": "線上報修服務",
      "assigneeId": "m-duck",
      "status": "todo",
      "priority": "high",
      "dueDate": "",
      "note": "",
      "order": 4
    },
    {
      "id": "t-05",
      "projectId": "p-web",
      "title": "客服後台（報修派工、進度追蹤、滿意度電訪）",
      "assigneeId": "m-lee",
      "status": "todo",
      "priority": "mid",
      "dueDate": "",
      "note": "",
      "order": 5
    },
    {
      "id": "t-06",
      "projectId": "p-web",
      "title": "winshop 後台 / monday 住戶與報修資料整合",
      "assigneeId": "m-lee",
      "status": "todo",
      "priority": "mid",
      "dueDate": "",
      "note": "",
      "order": 6
    },
    {
      "id": "t-07",
      "projectId": "p-web",
      "title": "未來客服／報修 App 規劃",
      "assigneeId": "m-duck",
      "status": "todo",
      "priority": "low",
      "dueDate": "",
      "note": "",
      "order": 7
    },
    {
      "id": "t-08",
      "projectId": "p-web",
      "title": "套裝化：多租戶給其他建商、產品命名",
      "assigneeId": "m-duck",
      "status": "todo",
      "priority": "low",
      "dueDate": "",
      "note": "命名要和 EagleAI Field、EagleWorks 一致",
      "order": 8
    },
    {
      "id": "t-09",
      "projectId": "p-qms",
      "title": "QMS 後台：付款明細、PDF 版面",
      "assigneeId": "m-duck",
      "status": "done",
      "priority": "mid",
      "dueDate": "",
      "note": "最後更新 2026-08-25",
      "order": 9
    },
    {
      "id": "t-10",
      "projectId": "p-qms",
      "title": "廠商 App（EagleAi 1.0.2）",
      "assigneeId": "m-duck",
      "status": "done",
      "priority": "mid",
      "dueDate": "",
      "note": "最後更新 2026-07-17",
      "order": 10
    },
    {
      "id": "t-11",
      "projectId": "p-waterproof",
      "title": "防水點位資料與照片抽屜",
      "assigneeId": "m-lee",
      "status": "done",
      "priority": "low",
      "dueDate": "",
      "note": "",
      "order": 11
    },
    {
      "id": "t-12",
      "projectId": "p-fms",
      "title": "確認 FMS 用途與後續",
      "assigneeId": "",
      "status": "todo",
      "priority": "low",
      "dueDate": "",
      "note": "",
      "order": 12
    },
    {
      "id": "t-13",
      "projectId": "p-pms",
      "title": "日報前端：今日填報、交辦事項、雜工出工",
      "assigneeId": "m-jared",
      "status": "doing",
      "priority": "high",
      "dueDate": "",
      "note": "frontend/src/features/daily-report",
      "order": 13
    },
    {
      "id": "t-14",
      "projectId": "p-pms",
      "title": "日報後端 API 與期別審核",
      "assigneeId": "m-lee",
      "status": "doing",
      "priority": "high",
      "dueDate": "",
      "note": "server/src/modules/daily-report",
      "order": 14
    },
    {
      "id": "t-15",
      "projectId": "p-pms",
      "title": "出工快照同步（workforce）",
      "assigneeId": "m-lee",
      "status": "done",
      "priority": "mid",
      "dueDate": "",
      "note": "",
      "order": 15
    },
    {
      "id": "t-16",
      "projectId": "p-pms",
      "title": "系統後台 admin、工地範圍權限",
      "assigneeId": "m-duck",
      "status": "doing",
      "priority": "mid",
      "dueDate": "",
      "note": "frontend/src/features/admin",
      "order": 16
    },
    {
      "id": "t-17",
      "projectId": "p-pms",
      "title": "主檔與帳號登入（base-data / auth）",
      "assigneeId": "m-lee",
      "status": "done",
      "priority": "mid",
      "dueDate": "",
      "note": "",
      "order": 17
    },
    {
      "id": "t-18",
      "projectId": "p-pms",
      "title": "日報後台：填報狀態看板、出工趨勢、Excel 匯出",
      "assigneeId": "",
      "status": "todo",
      "priority": "mid",
      "dueDate": "",
      "note": "server/docs/backlog.md #7",
      "order": 18
    },
    {
      "id": "t-19",
      "projectId": "p-pms",
      "title": "修正：account.email 改名後無法登入／LINE 綁定",
      "assigneeId": "m-lee",
      "status": "todo",
      "priority": "high",
      "dueDate": "",
      "note": "server/docs/backlog.md #8，優先序最高",
      "order": 19
    },
    {
      "id": "t-20",
      "projectId": "p-line",
      "title": "LINE webhook、推播與 BFF 後端",
      "assigneeId": "m-lee",
      "status": "done",
      "priority": "mid",
      "dueDate": "",
      "note": "",
      "order": 20
    },
    {
      "id": "t-21",
      "projectId": "p-line",
      "title": "LIFF 格子任務（拍照、提交、採認）",
      "assigneeId": "m-duck",
      "status": "done",
      "priority": "mid",
      "dueDate": "",
      "note": "frontend/src/features/liff duck 66%",
      "order": 21
    },
    {
      "id": "t-22",
      "projectId": "p-line",
      "title": "LIFF QAQC 建單與查驗照片",
      "assigneeId": "m-lee",
      "status": "doing",
      "priority": "high",
      "dueDate": "",
      "note": "",
      "order": 22
    },
    {
      "id": "t-23",
      "projectId": "p-line",
      "title": "舊版 eagle-line（Cloudflare Worker 原型）",
      "assigneeId": "m-jared",
      "status": "done",
      "priority": "low",
      "dueDate": "",
      "note": "2026-07 後停更，功能已移到 pms-line-bot",
      "order": 23
    },
    {
      "id": "t-24",
      "projectId": "p-frapp",
      "title": "現場巡檢拍照、標註、觀察紀錄",
      "assigneeId": "m-duck",
      "status": "done",
      "priority": "mid",
      "dueDate": "",
      "note": "",
      "order": 24
    },
    {
      "id": "t-25",
      "projectId": "p-frapp",
      "title": "報告組稿與裝置產 PDF",
      "assigneeId": "m-duck",
      "status": "done",
      "priority": "mid",
      "dueDate": "",
      "note": "",
      "order": 25
    },
    {
      "id": "t-26",
      "projectId": "p-frapp",
      "title": "報告編號同步、專案可見範圍",
      "assigneeId": "m-duck",
      "status": "doing",
      "priority": "high",
      "dueDate": "",
      "note": "",
      "order": 26
    },
    {
      "id": "t-27",
      "projectId": "p-frapp",
      "title": "教學影片與帳號轉移",
      "assigneeId": "m-duck",
      "status": "done",
      "priority": "low",
      "dueDate": "",
      "note": "",
      "order": 27
    },
    {
      "id": "t-28",
      "projectId": "p-frweb",
      "title": "A 包：請款包（分層數量表、照片核對、請款證明）",
      "assigneeId": "m-jared",
      "status": "doing",
      "priority": "high",
      "dueDate": "",
      "note": "看板 A 卡、features/board Jared 85%",
      "order": 28
    },
    {
      "id": "t-29",
      "projectId": "p-frweb",
      "title": "B 包：品管包（完工回報、複驗報告）",
      "assigneeId": "m-lee",
      "status": "doing",
      "priority": "high",
      "dueDate": "",
      "note": "看板 B 卡、QAQC 任務報告 Lee 100%",
      "order": 29
    },
    {
      "id": "t-30",
      "projectId": "p-frweb",
      "title": "C 包",
      "assigneeId": "",
      "status": "todo",
      "priority": "mid",
      "dueDate": "",
      "note": "內容與負責人待補",
      "order": 30
    },
    {
      "id": "t-31",
      "projectId": "p-frweb",
      "title": "D 包",
      "assigneeId": "",
      "status": "todo",
      "priority": "mid",
      "dueDate": "",
      "note": "內容與負責人待補",
      "order": 31
    },
    {
      "id": "t-32",
      "projectId": "p-frweb",
      "title": "現場報告列表與 A4 報告",
      "assigneeId": "m-lee",
      "status": "doing",
      "priority": "mid",
      "dueDate": "",
      "note": "features/field-report Lee 97%",
      "order": 32
    },
    {
      "id": "t-33",
      "projectId": "p-frweb",
      "title": "工地資料夾 2（Excel 式表格）",
      "assigneeId": "m-jared",
      "status": "doing",
      "priority": "mid",
      "dueDate": "",
      "note": "巡檢 Web Jared 78%；PMS 版 site-folder duck 88%",
      "order": 33
    },
    {
      "id": "t-34",
      "projectId": "p-frweb",
      "title": "平面圖對應（plan-mapping）",
      "assigneeId": "m-jared",
      "status": "doing",
      "priority": "mid",
      "dueDate": "",
      "note": "與 PMS 共用，Jared 70–100%",
      "order": 34
    },
    {
      "id": "t-35",
      "projectId": "p-frweb",
      "title": "分層數量表元件（floor-matrix）",
      "assigneeId": "m-duck",
      "status": "done",
      "priority": "mid",
      "dueDate": "",
      "note": "PMS 前端 floor-matrix，duck 99%",
      "order": 35
    },
    {
      "id": "t-36",
      "projectId": "p-vision",
      "title": "複核佇列頁（照片上標記）",
      "assigneeId": "m-duck",
      "status": "todo",
      "priority": "high",
      "dueDate": "",
      "note": "",
      "order": 36
    },
    {
      "id": "t-37",
      "projectId": "p-vision",
      "title": "專家回饋 → 回訓 API",
      "assigneeId": "m-duck",
      "status": "todo",
      "priority": "mid",
      "dueDate": "",
      "note": "",
      "order": 37
    },
    {
      "id": "t-38",
      "projectId": "p-vision",
      "title": "與 PMS 日報照片串接",
      "assigneeId": "m-duck",
      "status": "todo",
      "priority": "mid",
      "dueDate": "",
      "note": "",
      "order": 38
    },
    {
      "id": "t-39",
      "projectId": "p-erp",
      "title": "簽呈：電子簽核（版本化表單、簽核流程、一般申請）",
      "assigneeId": "m-duck",
      "status": "doing",
      "priority": "high",
      "dueDate": "",
      "note": "modules/platform-approval",
      "order": 39
    },
    {
      "id": "t-40",
      "projectId": "p-erp",
      "title": "工務：請購 → 採購案 → 詢比議價 → 發包合約",
      "assigneeId": "m-duck",
      "status": "doing",
      "priority": "high",
      "dueDate": "",
      "note": "modules/contract、features/procurement",
      "order": 40
    },
    {
      "id": "t-41",
      "projectId": "p-erp",
      "title": "財務：估驗計價、付款申請 → 傳票，舊帳唯讀查詢",
      "assigneeId": "m-duck",
      "status": "doing",
      "priority": "mid",
      "dueDate": "",
      "note": "modules/finance、construction-finance",
      "order": 41
    },
    {
      "id": "t-42",
      "projectId": "p-erp",
      "title": "人資：組織圖、招募、職缺管理",
      "assigneeId": "m-lee",
      "status": "doing",
      "priority": "mid",
      "dueDate": "",
      "note": "目前在 sandbox-fullstack features/hrms；hrms repo 剛建立",
      "order": 42
    },
    {
      "id": "t-43",
      "projectId": "p-erp",
      "title": "UOF / gcmis 舊資料與附件搬遷",
      "assigneeId": "m-duck",
      "status": "doing",
      "priority": "mid",
      "dueDate": "",
      "note": "",
      "order": 43
    },
    {
      "id": "t-44",
      "projectId": "p-site",
      "title": "多語系、聯絡表單、App 下載連結與 JSON-LD",
      "assigneeId": "m-duck",
      "status": "done",
      "priority": "mid",
      "dueDate": "",
      "note": "",
      "order": 44
    },
    {
      "id": "t-45",
      "projectId": "p-landing",
      "title": "Hub、請款、訊息通道、團隊頁文案",
      "assigneeId": "m-jared",
      "status": "done",
      "priority": "low",
      "dueDate": "",
      "note": "",
      "order": 45
    },
    {
      "id": "t-46",
      "projectId": "p-ds",
      "title": "Storybook 文件與元件",
      "assigneeId": "m-jared",
      "status": "doing",
      "priority": "mid",
      "dueDate": "",
      "note": "src/stories Jared 51%、duck 44%",
      "order": 46
    },
    {
      "id": "t-47",
      "projectId": "p-ds",
      "title": "FloorMatrix 元件",
      "assigneeId": "m-duck",
      "status": "done",
      "priority": "mid",
      "dueDate": "",
      "note": "",
      "order": 47
    },
    {
      "id": "t-48",
      "projectId": "p-ds",
      "title": "BarChart 元件",
      "assigneeId": "m-jared",
      "status": "done",
      "priority": "low",
      "dueDate": "",
      "note": "",
      "order": 48
    },
    {
      "id": "t-49",
      "projectId": "p-sandbox",
      "title": "eagle-daily 日報原型",
      "assigneeId": "m-duck",
      "status": "done",
      "priority": "mid",
      "dueDate": "",
      "note": "",
      "order": 49
    },
    {
      "id": "t-50",
      "projectId": "p-sandbox",
      "title": "line-feedback 現場回饋",
      "assigneeId": "m-jared",
      "status": "done",
      "priority": "mid",
      "dueDate": "",
      "note": "",
      "order": 50
    },
    {
      "id": "t-51",
      "projectId": "p-sandbox",
      "title": "project-graph 產品圖譜",
      "assigneeId": "m-duck",
      "status": "doing",
      "priority": "mid",
      "dueDate": "",
      "note": "",
      "order": 51
    },
    {
      "id": "t-52",
      "projectId": "p-sandbox",
      "title": "budget-ab 預算比較與廠商評分",
      "assigneeId": "m-duck",
      "status": "doing",
      "priority": "mid",
      "dueDate": "",
      "note": "",
      "order": 52
    },
    {
      "id": "t-53",
      "projectId": "p-sandbox",
      "title": "合約產生器 / work-docs",
      "assigneeId": "m-duck",
      "status": "doing",
      "priority": "mid",
      "dueDate": "",
      "note": "",
      "order": 53
    },
    {
      "id": "t-54",
      "projectId": "p-sandbox",
      "title": "trade-reader",
      "assigneeId": "m-jared",
      "status": "done",
      "priority": "low",
      "dueDate": "",
      "note": "",
      "order": 54
    },
    {
      "id": "t-55",
      "projectId": "p-map",
      "title": "建立 Google Sheet 與 Apps Script",
      "assigneeId": "m-duck",
      "status": "done",
      "priority": "mid",
      "dueDate": "",
      "note": "",
      "order": 55
    }
  ]
};
// ── /SEED ──
