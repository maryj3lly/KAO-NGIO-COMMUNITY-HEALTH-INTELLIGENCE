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
const MODULES = ["map","genogram","organization","resources","calendar","history","people","survey","healthSurvey"];
const HEADERS = ["id","module","title","village","payload","createdAt","updatedAt","createdBy"];
const DISPLAY_HEADERS = ["รหัสรายการ","โมดูล","ชื่อรายการ","หมู่บ้าน","ข้อมูลดิบ (JSON)","สร้างเมื่อ","แก้ไขเมื่อ","ผู้บันทึก"];
const MODULE_FIELDS = {
  map:["address","members","lat","lng","diseases","diseaseOther","detail"],
  genogram:["householdId","name","sex","age","generation","spouseId","spouseStatus","fatherId","motherId","focusPerson","healthStatus","diseases","detail"],
  organization:["type","role","parentId","detail"],
  resources:["type","location","detail"],
  calendar:["month","type","detail"],
  history:["year","detail"],
  people:["role","birth","detail","timeline"],
  survey:["houseCode","familyName","headId"],
  healthSurvey:[
    "householdCode","surveyorCode","householdType","householdTypeOther","memberCount","maleCount","femaleCount","otherGenderCount",
    "dwellingType","dwellingTypeOther","housingTenure","housingTenureOther","monthlyIncome","incomeSources","incomeSourceOther","hasDebt","debtAmount",
    "drinkingWaterSource","drinkingWaterOther","householdWaterSource","householdWaterOther","waterQuality","waterContainers","waterTankCount","waterJarCount","waterBasinCount","waterOtherContainer","waterOtherContainerCount",
    "insideCleanliness","outsideCleanliness","toiletCondition","wasteDisposal","wasteDisposalOther","wasteSorting","foodStorage","handwashingFacilities",
    "foodFrequencyVegetables","foodFrequencyFruit","foodFrequencySweetDrinks","foodFrequencySaltyFood","foodFrequencyProcessedFood",
    "pregnancyInHousehold","pregnancyCount","prenatalCare","childrenUnderFive","childCountUnderFive","childVaccination","childGrowth","breastfeedingSixMonths","childDevelopment",
    "firstProvider","serviceDistance","transport","hasAccessProblem","accessProblems","desiredServices","mainHealthConcern","healthServiceSuggestions"
  ]
};
const SURVEY_MEMBER_FIELDS = ["nationalId","name","birthDate","sex","age","maritalStatus","occupation","homeStatus","education","familyPlanning","healthcare","healthConditions","moveType","moveDate"];
const HEALTH_SURVEY_MEMBER_FIELDS = [
  "memberCode","sex","age","relationship","maritalStatus","education","occupation","healthcare","healthConditions","healthConditionOther",
  "receivingTreatment","medicationUse","recentIllness","hospitalizedRecently","disability","stressLevel","weightKg","heightCm","waistCm",
  "diabetesScreening","bloodGlucose","bloodPressureScreening","bloodPressure","cancerScreening","smokingStatus","cigarettesPerDay",
  "alcoholUse","exerciseFrequency","dailyFruitVeg","annualCheckup","memberHealthNotes"
];
const FIELD_LABELS = {
  address:"ที่อยู่โดยย่อ",members:"จำนวนสมาชิก",lat:"ละติจูด",lng:"ลองจิจูด",diseases:"โรค/ภาวะสุขภาพ",diseaseOther:"โรค/ภาวะอื่น",
  householdId:"ครัวเรือน",name:"ชื่อ/รหัสเรียก",sex:"เพศ",age:"อายุ",generation:"รุ่น",spouseId:"คู่สมรส",spouseStatus:"สถานะคู่สมรส",
  fatherId:"บิดา",motherId:"มารดา",focusPerson:"บุคคลหลัก",healthStatus:"สถานะสุขภาพ",type:"ประเภท",role:"บทบาท",parentId:"ผู้ปกครอง/องค์กรแม่",
  location:"สถานที่",month:"เดือน/ช่วงเวลา",year:"ปี/ช่วงเวลา",birth:"ปีเกิด",detail:"รายละเอียด/หมายเหตุ",timeline:"ไทม์ไลน์",
  houseCode:"รหัสบ้าน",familyName:"ครอบครัวที่",headId:"เลขประจำตัวหัวหน้าครอบครัว",nationalId:"เลขประจำตัวประชาชน",birthDate:"วันเดือนปีเกิด",
  maritalStatus:"สถานภาพสมรส",occupation:"อาชีพ",homeStatus:"สถานะในบ้าน",education:"การศึกษา",familyPlanning:"การวางแผนครอบครัว",
  healthcare:"สิทธิด้านการรักษาพยาบาล",healthConditions:"โรคประจำตัว/ความพิการ",moveType:"ย้ายเข้า/ย้ายออก",moveDate:"วันเดือนปีที่ย้าย",
  householdCode:"รหัสครัวเรือน",surveyorCode:"รหัสผู้สำรวจ",householdType:"ลักษณะครัวเรือน",householdTypeOther:"ลักษณะครัวเรือนอื่น",
  memberCount:"จำนวนสมาชิกทั้งหมด",maleCount:"สมาชิกเพศชาย",femaleCount:"สมาชิกเพศหญิง",otherGenderCount:"สมาชิกเพศอื่น/ไม่ระบุ",
  dwellingType:"ประเภทที่อยู่อาศัย",dwellingTypeOther:"ประเภทที่อยู่อาศัยอื่น",housingTenure:"การถือครองที่อยู่อาศัย",housingTenureOther:"การถือครองอื่น",
  monthlyIncome:"รายได้ครัวเรือนต่อเดือน",incomeSources:"แหล่งรายได้",incomeSourceOther:"แหล่งรายได้อื่น",hasDebt:"มีหนี้สิน",debtAmount:"จำนวนหนี้สินโดยประมาณ",
  drinkingWaterSource:"แหล่งน้ำดื่ม",drinkingWaterOther:"แหล่งน้ำดื่มอื่น",householdWaterSource:"แหล่งน้ำใช้",householdWaterOther:"แหล่งน้ำใช้อื่น",
  waterQuality:"คุณภาพน้ำ",waterContainers:"วิธีเก็บสำรองน้ำ",waterTankCount:"จำนวนถังเก็บน้ำ",waterJarCount:"จำนวนโอ่ง/ตุ่ม",waterBasinCount:"จำนวนภาชนะ/กะละมัง",waterOtherContainer:"ภาชนะเก็บน้ำอื่น",waterOtherContainerCount:"จำนวนภาชนะอื่น",
  insideCleanliness:"ความสะอาดภายในบ้าน",outsideCleanliness:"ความสะอาดบริเวณบ้าน",toiletCondition:"สภาพส้วม/ห้องน้ำ",wasteDisposal:"วิธีกำจัดขยะ",
  wasteDisposalOther:"วิธีกำจัดขยะอื่น",wasteSorting:"การคัดแยกขยะ",foodStorage:"การเก็บรักษาอาหาร",handwashingFacilities:"จุดล้างมือพร้อมสบู่",
  foodFrequencyVegetables:"ความถี่บริโภคผัก",foodFrequencyFruit:"ความถี่บริโภคผลไม้",foodFrequencySweetDrinks:"ความถี่บริโภคเครื่องดื่มหวาน",
  foodFrequencySaltyFood:"ความถี่บริโภคอาหารเค็ม",foodFrequencyProcessedFood:"ความถี่บริโภคอาหารแปรรูป/หมักดอง",
  pregnancyInHousehold:"มีสมาชิกตั้งครรภ์",pregnancyCount:"จำนวนผู้ตั้งครรภ์",prenatalCare:"การฝากครรภ์/รับบริการตามนัด",
  childrenUnderFive:"มีเด็กอายุต่ำกว่า 5 ปี",childCountUnderFive:"จำนวนเด็กอายุต่ำกว่า 5 ปี",childVaccination:"การได้รับวัคซีนตามเกณฑ์",
  childGrowth:"การติดตามการเจริญเติบโต",breastfeedingSixMonths:"การได้รับนมแม่อย่างเดียว 6 เดือน",childDevelopment:"การคัดกรองพัฒนาการเด็ก",
  firstProvider:"สถานบริการสุขภาพที่ใช้ก่อน",serviceDistance:"ระยะทางถึงสถานบริการ",transport:"การเดินทางไปสถานบริการ",
  hasAccessProblem:"มีปัญหาในการเข้าถึงบริการ",accessProblems:"ปัญหาการเข้าถึงบริการ",desiredServices:"บริการสุขภาพที่ต้องการ",
  mainHealthConcern:"ปัญหาสุขภาพสำคัญ",healthServiceSuggestions:"ข้อเสนอแนะต่อบริการสุขภาพ",memberCode:"รหัสสมาชิก",
  relationship:"ความสัมพันธ์กับหัวหน้าครัวเรือน",healthConditionOther:"โรค/ภาวะอื่น",receivingTreatment:"การรักษาโรคประจำตัว",
  medicationUse:"การใช้ยา/การรักษาต่อเนื่อง",recentIllness:"การเจ็บป่วยในช่วงที่ผ่านมา",hospitalizedRecently:"การรักษาในโรงพยาบาล",
  disability:"ความพิการ/ข้อจำกัด",stressLevel:"ระดับความเครียด",weightKg:"น้ำหนัก (กิโลกรัม)",heightCm:"ส่วนสูง (เซนติเมตร)",
  waistCm:"รอบเอว (เซนติเมตร)",diabetesScreening:"ผลคัดกรองเบาหวาน",bloodGlucose:"ระดับน้ำตาลในเลือด",
  bloodPressureScreening:"ผลคัดกรองความดันโลหิต",bloodPressure:"ค่าความดันโลหิต",cancerScreening:"ประวัติ/ผลคัดกรองมะเร็ง",
  smokingStatus:"การสูบบุหรี่",cigarettesPerDay:"จำนวนบุหรี่ต่อวัน",alcoholUse:"การดื่มเครื่องดื่มแอลกอฮอล์",
  exerciseFrequency:"ความถี่การออกกำลังกาย",dailyFruitVeg:"รับประทานผัก/ผลไม้ทุกวัน",annualCheckup:"ตรวจสุขภาพประจำปี",memberHealthNotes:"หมายเหตุสุขภาพสมาชิก"
};

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
    syncReadableSheet_(module);
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

function setupReadableSheets() {
  MODULES.forEach(function(module){syncReadableSheet_(module);});
  Logger.log("Readable columns updated for all module sheets.");
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
    if (module === "map") assertUniqueHouseholdCode_(sh, record.title, "");
    const now = new Date().toISOString();
    const id = Utilities.getUuid();
    const title = String(record.title || record.name || record.householdId || "รายการใหม่").slice(0,250);
    const village = String(record.village || "");
    sh.appendRow([id,module,title,village,JSON.stringify(record),now,now,ADMIN_USERNAME]);
    syncReadableSheet_(module);
    return {id:id, record:record};
  } finally { lock.releaseLock(); }
}

function updateRecord_(module, id, record) {
  validateModule_(module);
  if (!id) throw new Error("ไม่พบรหัสรายการ");
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = getSheet_(module), values = sh.getDataRange().getValues();
    for (let i=1;i<values.length;i++) {
      if (String(values[i][0]) === String(id)) {
        const old = safeParse_(values[i][4]);
        const merged = Object.assign({}, old, record);
        if (module === "map") assertUniqueHouseholdCode_(sh, merged.title, id);
        sh.getRange(i+1,3,1,6).setValues([[
          String(merged.title || merged.name || "รายการ").slice(0,250),
          String(merged.village || ""),
          JSON.stringify(merged),
          values[i][5],
          new Date().toISOString(),
          ADMIN_USERNAME
        ]]);
        syncReadableSheet_(module);
        return {record:merged};
      }
    }
    throw new Error("ไม่พบรายการที่ต้องการแก้ไข");
  } finally {
    lock.releaseLock();
  }
}

function assertUniqueHouseholdCode_(sheet, code, excludeId) {
  const normalizedCode = String(code || "").trim().slice(0,250).toLowerCase();
  if (!normalizedCode) throw new Error("กรุณาระบุรหัสครัวเรือน");
  const rows = sheet.getDataRange().getValues();
  for (let i=1;i<rows.length;i++) {
    if (excludeId && String(rows[i][0]) === String(excludeId)) continue;
    if (String(rows[i][2] || "").trim().toLowerCase() === normalizedCode) {
      throw new Error("รหัสครัวเรือนนี้มีอยู่แล้ว กรุณาตรวจสอบรายการเดิมก่อนบันทึก");
    }
  }
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
function syncReadableSheet_(module) {
  const sh = getSheet_(module);
  const lastRow = sh.getLastRow();
  const rows = lastRow > 1 ? sh.getRange(2,1,lastRow-1,HEADERS.length).getValues() : [];
  const records = rows.map(function(row){
    const record = safeParse_(row[4]);
    return record && typeof record === "object" && !Array.isArray(record) ? record : {};
  });
  const columns = readableColumns_(module, records);
  const columnCount = HEADERS.length + columns.length;
  if (sh.getMaxColumns() < columnCount) sh.insertColumnsAfter(sh.getMaxColumns(), columnCount - sh.getMaxColumns());
  sh.getRange(1,1,1,HEADERS.length).setValues([DISPLAY_HEADERS]);
  if (columns.length) {
    sh.getRange(1,HEADERS.length+1,1,columns.length).setValues([columns.map(function(column){return column.label;})]);
    if (records.length) {
      sh.getRange(2,HEADERS.length+1,records.length,columns.length).setValues(records.map(function(record){
        return columns.map(function(column){return readableValue_(record,column.key);});
      }));
    }
  }
  sh.setFrozenRows(1);
  sh.setFrozenColumns(4);
  sh.setRowHeight(1,40);
  sh.getRange(1,1,1,columnCount).setFontWeight("bold").setBackground("#dff3e7").setWrap(true);
  sh.setColumnWidth(1,150);
  sh.setColumnWidth(2,90);
  sh.setColumnWidth(3,180);
  sh.setColumnWidth(4,100);
  sh.hideColumns(5);
  sh.setColumnWidth(6,160);
  sh.setColumnWidth(7,160);
  sh.setColumnWidth(8,120);
  columns.forEach(function(column,index){
    sh.setColumnWidth(HEADERS.length+index+1,/detail|diseases|timeline/i.test(column.key)?280:150);
  });
  const filter = sh.getFilter();
  if (filter) filter.remove();
  sh.getRange(1,1,Math.max(lastRow,1),columnCount).createFilter();
}
function readableColumns_(module, records) {
  const fieldKeys = (MODULE_FIELDS[module] || []).slice();
  const memberCollection = module === "survey" || module === "healthSurvey";
  const memberKeys = module === "survey" ? SURVEY_MEMBER_FIELDS.slice() : module === "healthSurvey" ? HEALTH_SURVEY_MEMBER_FIELDS.slice() : [];
  records.forEach(function(record){
    Object.keys(record).forEach(function(key){
      if (["id","module","title","village","createdAt","updatedAt","createdBy"].indexOf(key) !== -1) return;
      if (memberCollection && key === "members") return;
      if (fieldKeys.indexOf(key) === -1) fieldKeys.push(key);
    });
    if (memberCollection) {
      (Array.isArray(record.members) ? record.members : []).forEach(function(member){
        Object.keys(member).forEach(function(key){if(memberKeys.indexOf(key)===-1)memberKeys.push(key);});
      });
    }
  });
  const columns = fieldKeys.map(function(key){return {key:key,label:FIELD_LABELS[key]||key};});
  if (memberCollection) {
    const maxMembers = Math.max(1,records.reduce(function(max,record){return Math.max(max,Array.isArray(record.members)?record.members.length:0);},0));
    columns.push({key:"members.length",label:module === "survey" ? "จำนวนสมาชิก" : "จำนวนสมาชิกที่มีข้อมูล"});
    for (let i=0;i<maxMembers;i++) {
      memberKeys.forEach(function(key){
        columns.push({key:"members["+i+"]."+key,label:"สมาชิก "+(i+1)+" · "+(FIELD_LABELS[key]||key)});
      });
    }
  }
  return columns;
}
function readableValue_(record, key) {
  if (key === "members.length") return Array.isArray(record.members) ? record.members.length : 0;
  const memberMatch = key.match(/^members\[(\d+)\]\.(.+)$/);
  let value = memberMatch ? ((Array.isArray(record.members) ? record.members[Number(memberMatch[1])] : null) || {})[memberMatch[2]] : record[key];
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return value;
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