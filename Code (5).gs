/**
 * COMMUNITY HEALTH INTELLIGENCE - Google Apps Script API
 * 1) วางโค้ดนี้ใน Code.gs
 * 2) Run setupSystem() หนึ่งครั้ง และอนุญาตสิทธิ์
 * 3) สร้าง/เลือก Google Sheet แล้วนำ Spreadsheet ID ไปใส่ใน SHEET_ID
 * 4) Deploy > New deployment > Web app > Execute as: Me > Who has access: Anyone
 * 5) คัดลอก URL /exec ไปใส่ใน GAS_URL ของ index.html
 *
 * setupSystem() สร้างรหัสผ่านเริ่มต้นแบบสุ่มและแสดงใน execution log
 * เปลี่ยนรหัสผ่านได้ด้วย changeAdminPassword() ซึ่งจะสร้างรหัสใหม่แบบสุ่ม
 */
const SHEET_ID = "17Oxw03fn-A8JcGbwaLTp7zDmpAns37eIpFJ-8xbLQlQ";
const ADMIN_USERNAME = "admin";
const SESSION_TTL_SECONDS = 21600; // 6 ชั่วโมง
const MODULES = ["map","genogram","organization","resources","calendar","history","people","survey"];
const HEADERS = ["id","module","title","village","payload","createdAt","updatedAt","createdBy"];

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({
    ok:true,
    service:"Community Health Intelligence API",
    version:"1.0",
    message:"API is running. Send POST JSON requests."
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const action = String(body.action || "");
    let result;
    if (action === "login") result = login_(body.username, body.password);
    else {
      requireSession_(body.token);
      switch (action) {
        case "ping": result = {ok:true}; break;
        case "dashboard": result = dashboard_(); break;
        case "list": result = listRecords_(body.module, body.village); break;
        case "create": result = createRecord_(body.module, body.record || {}); break;
        case "update": result = updateRecord_(body.module, body.id, body.record || {}); break;
        case "delete": result = deleteRecord_(body.module, body.id); break;
        default: throw new Error("ไม่รู้จักคำสั่ง API");
      }
    }
    return json_({ok:true, ...result});
  } catch (err) {
    return json_({ok:false, message:String(err && err.message ? err.message : err)});
  }
}

function setupSystem() {
  const props = PropertiesService.getScriptProperties();
  if (!SHEET_ID || SHEET_ID.indexOf("PASTE_YOUR") === 0) {
    throw new Error("กรุณากำหนด SHEET_ID ใน Code.gs ก่อนรัน setupSystem()");
  }
  props.setProperty("SPREADSHEET_ID", SHEET_ID);
  const ss = getSpreadsheet_();
  MODULES.forEach(function(module) {
    let sh = ss.getSheetByName(module);
    if (!sh) sh = ss.insertSheet(module);
    if (sh.getLastRow() === 0) sh.getRange(1,1,1,HEADERS.length).setValues([HEADERS]);
    sh.setFrozenRows(1);
    sh.getRange(1,1,1,HEADERS.length).setFontWeight("bold").setBackground("#dff3e7");
  });
  if (!props.getProperty("ADMIN_USER")) {
    props.setProperty("ADMIN_USER", ADMIN_USERNAME);
  }
  if (!props.getProperty("ADMIN_HASH")) {
    const initialPassword = Utilities.getUuid() + Utilities.getUuid().slice(0,8);
    props.setProperty("ADMIN_HASH", hash_(initialPassword));
    Logger.log("Initial admin password (save it securely): " + initialPassword);
  }
  Logger.log("Setup completed.");
}

function changeAdminPassword(newPassword) {
  const password = newPassword ? String(newPassword) : Utilities.getUuid() + Utilities.getUuid().slice(0,8);
  if (password.length < 12) {
    throw new Error("รหัสผ่านใหม่ต้องมีอย่างน้อย 12 ตัวอักษร");
  }
  PropertiesService.getScriptProperties().setProperty("ADMIN_HASH", hash_(password));
  Logger.log("Admin password changed. Save this password securely: " + password);
}

function login_(username, password) {
  const props = PropertiesService.getScriptProperties();
  const savedUser = props.getProperty("ADMIN_USER") || ADMIN_USERNAME;
  const savedHash = props.getProperty("ADMIN_HASH");
  if (!savedHash) throw new Error("บัญชีผู้ดูแลยังไม่ได้ตั้งค่า กรุณาให้ผู้ดูแลรัน setupSystem()");
  if (String(username || "") !== savedUser || hash_(String(password || "")) !== savedHash) {
    throw new Error("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
  }
  const token = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put("session_" + token, savedUser, SESSION_TTL_SECONDS);
  return {token:token, username:savedUser, expiresIn:SESSION_TTL_SECONDS};
}

function requireSession_(token) {
  if (!token || !CacheService.getScriptCache().get("session_" + token)) {
    throw new Error("Session หมดอายุหรือไม่มีสิทธิ์ กรุณาเข้าสู่ระบบใหม่");
  }
}

function dashboard_() {
  const counts = {};
  let total = 0, recent = [];
  MODULES.forEach(function(module) {
    const records = readModule_(module);
    counts[module] = records.length;
    total += records.length;
    records.slice(-3).forEach(function(r) {
      recent.push({module:module, title:r.title || r.name || module, updatedAt:r.updatedAt});
    });
  });
  recent.sort(function(a,b){ return String(b.updatedAt).localeCompare(String(a.updatedAt)); });
  return {counts:counts, total:total, recent:recent.slice(0,8)};
}

function listRecords_(module, village) {
  validateModule_(module);
  let records = readModule_(module);
  if (village) records = records.filter(function(r){return String(r.village || "") === String(village);});
  return {records:records};
}

function createRecord_(module, record) {
  validateModule_(module);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = getSheet_(module);
    const now = new Date().toISOString();
    const id = Utilities.getUuid();
    const title = String(record.title || record.name || record.householdId || "รายการใหม่").slice(0,250);
    const village = String(record.village || "");
    sh.appendRow([id,module,title,village,JSON.stringify(record),now,now,ADMIN_USERNAME]);
    return {id:id, record:record};
  } finally { lock.releaseLock(); }
}

function updateRecord_(module, id, record) {
  validateModule_(module);
  if (!id) throw new Error("ไม่พบรหัสรายการ");
  const sh = getSheet_(module), values = sh.getDataRange().getValues();
  for (let i=1;i<values.length;i++) {
    if (String(values[i][0]) === String(id)) {
      const old = safeParse_(values[i][4]);
      const merged = Object.assign({}, old, record);
      sh.getRange(i+1,3,1,6).setValues([[
        String(merged.title || merged.name || "รายการ").slice(0,250),
        String(merged.village || ""),
        JSON.stringify(merged),
        values[i][5],
        new Date().toISOString(),
        ADMIN_USERNAME
      ]]);
      return {record:merged};
    }
  }
  throw new Error("ไม่พบรายการที่ต้องการแก้ไข");
}

function deleteRecord_(module, id) {
  validateModule_(module);
  if (!id) throw new Error("ไม่พบรหัสรายการ");
  const sh = getSheet_(module), values = sh.getDataRange().getValues();
  for (let i=1;i<values.length;i++) {
    if (String(values[i][0]) === String(id)) {
      sh.deleteRow(i+1);
      return {deleted:true};
    }
  }
  throw new Error("ไม่พบรายการที่ต้องการลบ");
}

function readModule_(module) {
  const sh = getSheet_(module), last = sh.getLastRow();
  if (last < 2) return [];
  const values = sh.getRange(2,1,last-1,HEADERS.length).getValues();
  return values.map(function(row) {
    const obj = safeParse_(row[4]);
    obj.id = String(row[0]);
    obj.module = String(row[1]);
    obj.title = obj.title || String(row[2] || "");
    obj.village = obj.village || String(row[3] || "");
    obj.createdAt = String(row[5] || "");
    obj.updatedAt = String(row[6] || "");
    return obj;
  }).reverse();
}

function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID") || SHEET_ID;
  if (!id || id.indexOf("PASTE_YOUR") === 0) throw new Error("กรุณากำหนด SHEET_ID ใน Code.gs แล้วรัน setupSystem()");
  return SpreadsheetApp.openById(id);
}
function getSheet_(module) {
  const ss = getSpreadsheet_();
  let sh = ss.getSheetByName(module);
  if (!sh) {
    sh = ss.insertSheet(module);
    sh.getRange(1,1,1,HEADERS.length).setValues([HEADERS]);
    sh.setFrozenRows(1);
  }
  return sh;
}
function validateModule_(module) {
  if (MODULES.indexOf(String(module)) === -1) throw new Error("ชื่อเครื่องมือไม่ถูกต้อง");
}
function safeParse_(value) {
  try { return JSON.parse(String(value || "{}")); } catch(e) { return {}; }
}
function hash_(value) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8);
  return bytes.map(function(b){return ("0" + ((b + 256) % 256).toString(16)).slice(-2);}).join("");
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}