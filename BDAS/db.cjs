const path = require("path")
const fs = require("fs")
const crypto = require("crypto")
const sqlite3 = require("sqlite3").verbose()

let _db = null
let _dbPath = null

function openDb(app) {
  const dir = app.getPath("userData")
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const dbPath = path.join(dir, "bsi.sqlite")
  const db = new sqlite3.Database(dbPath)
  return { db, dbPath }
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err)
      else resolve(this)
    })
  })
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err)
      else resolve(row)
    })
  })
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err)
      else resolve(rows)
    })
  })
}

async function tableHasColumn(db, table, column) {
  const info = await all(db, `PRAGMA table_info(${table})`)
  return info.some((c) => c.name === column)
}

async function ensureColumns(db) {
  // bsi_records base table
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS bsi_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      aircraftTailNo TEXT NOT NULL DEFAULT '',
      engineSN TEXT NOT NULL DEFAULT '',
      inspectionDate TEXT NOT NULL DEFAULT '',
      engineHours TEXT NOT NULL DEFAULT '',
      inspectionType TEXT NOT NULL DEFAULT '',
      scheduledUnscheduled TEXT NOT NULL DEFAULT '',
      inspectionArea TEXT NOT NULL DEFAULT '',
      subArea TEXT NOT NULL DEFAULT '',
      stageNumber TEXT NOT NULL DEFAULT '',
      edge TEXT NOT NULL DEFAULT '',
      zone TEXT NOT NULL DEFAULT '',
      bladeCoverage TEXT NOT NULL DEFAULT '',
      defectType TEXT NOT NULL DEFAULT '',
      length TEXT NOT NULL DEFAULT '',
      width TEXT NOT NULL DEFAULT '',
      height TEXT NOT NULL DEFAULT '',
      area TEXT NOT NULL DEFAULT '',
      shortSamplingHours TEXT NOT NULL DEFAULT '',
      inspectorName TEXT NOT NULL DEFAULT '',
      inspectorId TEXT NOT NULL DEFAULT '',
      unitSection TEXT NOT NULL DEFAULT '',
      disposal TEXT NOT NULL DEFAULT '',
      remarks TEXT NOT NULL DEFAULT '',
      tstTafEnabled INTEGER NOT NULL DEFAULT 0,
      tstTafNumber TEXT NOT NULL DEFAULT '',
      imagePaths TEXT NOT NULL DEFAULT '[]',
      docPaths TEXT NOT NULL DEFAULT '[]',
      isFollowUp INTEGER NOT NULL DEFAULT 0,
      previousRecordId INTEGER,
      overrideUsed INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT ''
    )`
  )

  // Add missing columns if upgrading from older versions
  const addIfMissing = async (col, sqlType, defSql) => {
    const has = await tableHasColumn(db, "bsi_records", col)
    if (!has) {
      await run(db, `ALTER TABLE bsi_records ADD COLUMN ${col} ${sqlType} ${defSql || ""}`)
    }
  }

  await addIfMissing("subArea", "TEXT", "NOT NULL DEFAULT ''")
  await addIfMissing("docPaths", "TEXT", "NOT NULL DEFAULT '[]'")
  await addIfMissing("isFollowUp", "INTEGER", "NOT NULL DEFAULT 0")
  await addIfMissing("previousRecordId", "INTEGER", "")
  await addIfMissing("overrideUsed", "INTEGER", "NOT NULL DEFAULT 0")
  await addIfMissing("createdAt", "TEXT", "NOT NULL DEFAULT ''")
  await addIfMissing("recordUuid", "TEXT", "NOT NULL DEFAULT ''")
  await addIfMissing("previousRecordUuid", "TEXT", "NOT NULL DEFAULT ''")
  // (imagePaths already exists in your current line; keep safe)
  await addIfMissing("imagePaths", "TEXT", "NOT NULL DEFAULT '[]'")
  await addIfMissing("tstTafEnabled", "INTEGER", "NOT NULL DEFAULT 0")
  await addIfMissing("tstTafNumber", "TEXT", "NOT NULL DEFAULT ''")
  await addIfMissing("unitSection", "TEXT", "NOT NULL DEFAULT ''")
  await addIfMissing("bladeCoverage", "TEXT", "NOT NULL DEFAULT ''")
  await addIfMissing("recordUuid", "TEXT", "NOT NULL DEFAULT ''")
  await addIfMissing("previousRecordUuid", "TEXT", "NOT NULL DEFAULT ''")
}

async function backfillUuids(db) {
  // Ensure every record has a stable UUID for safe cross-unit import/merge
  const rows = await all(db, "SELECT id, recordUuid, previousRecordId, previousRecordUuid FROM bsi_records")
  for (const r of rows) {
    const id = Number(r.id)
    const cur = String(r.recordUuid || "").trim()
    if (!cur) {
      const u = crypto.randomUUID()
      await run(db, "UPDATE bsi_records SET recordUuid = ? WHERE id = ?", [u, id])
    }
  }

  // Backfill previousRecordUuid using previousRecordId when present
  const links = await all(db, "SELECT id, previousRecordId, previousRecordUuid FROM bsi_records WHERE previousRecordId IS NOT NULL")
  for (const r of links) {
    const id = Number(r.id)
    const prevId = Number(r.previousRecordId)
    const prevUuid = String(r.previousRecordUuid || "").trim()
    if (!prevUuid && prevId) {
      const prev = await get(db, "SELECT recordUuid FROM bsi_records WHERE id = ?", [prevId])
      const u = String(prev?.recordUuid || "").trim()
      if (u) {
        await run(db, "UPDATE bsi_records SET previousRecordUuid = ? WHERE id = ?", [u, id])
      }
    }
  }
}

async function ensureAdminTables(db) {
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS tails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tailNo TEXT UNIQUE NOT NULL
    )`
  )
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS engines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      engineSN TEXT UNIQUE NOT NULL
    )`
  )
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tailNo TEXT NOT NULL,
      engineSN TEXT NOT NULL,
      attachedAt TEXT NOT NULL,
      detachedAt TEXT,
      FOREIGN KEY (tailNo) REFERENCES tails(tailNo),
      FOREIGN KEY (engineSN) REFERENCES engines(engineSN)
    )`
  )
}

async function ensureSettingsTable(db) {
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    )`
  )
}

async function getSetting(key) {
  if (!_db) throw new Error("DB not initialized.")
  const k = String(key || "").trim()
  if (!k) return ""
  const row = await get(_db, "SELECT value FROM app_settings WHERE key = ? LIMIT 1", [k])
  return row?.value ?? ""
}

async function setSetting(key, value) {
  if (!_db) throw new Error("DB not initialized.")
  const k = String(key || "").trim()
  if (!k) throw new Error("Setting key is required.")
  const v = value === null || value === undefined ? "" : String(value)
  await run(_db, "INSERT INTO app_settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [k, v])
  return true
}

async function closeDb() {
  if (!_db) return true
  const db = _db
  _db = null
  await new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err)
      else resolve(true)
    })
  })
  return true
}

async function reopen(app) {
  const { db, dbPath } = openDb(app)
  _db = db
  _dbPath = dbPath
  await ensureColumns(_db)
  await backfillUuids(_db)
  await ensureAdminTables(_db)
  await ensureSettingsTable(_db)
  await run(_db, "PRAGMA journal_mode = WAL;")
  await run(_db, "PRAGMA foreign_keys = ON;")
  return true
}

async function vacuumInto(targetFilePath) {
  if (!_db) throw new Error("DB not initialized.")
  const t = String(targetFilePath || "").trim()
  if (!t) throw new Error("Target file path is required.")
  const esc = t.replace(/'/g, "''")
  await run(_db, `VACUUM INTO '${esc}'`)
  return true
}

async function getActiveEngineSet(db) {
  const rows = await all(db, `SELECT DISTINCT engineSN FROM assignments WHERE detachedAt IS NULL`)
  return new Set(rows.map((r) => String(r.engineSN || "").trim()).filter(Boolean))
}

function normalizeString(v) {
  if (v === null || v === undefined) return ""
  return String(v)
}

function normalizeBoolInt(v) {
  return v ? 1 : 0
}

function requireField(name, v) {
  if (!String(v || "").trim()) throw new Error(`${name} is missing.`)
}

async function init(app) {
  const { db, dbPath } = openDb(app)
  _db = db
  _dbPath = dbPath
  // You used to print this path; leaving it harmless:
  console.log("SQLite DB:", dbPath)

  await ensureColumns(_db)
  await backfillUuids(_db)
  await ensureAdminTables(_db)
  await ensureSettingsTable(_db)

  // sensible pragmas
  await run(_db, "PRAGMA journal_mode = WAL;")
  await run(_db, "PRAGMA foreign_keys = ON;")
}

async function saveRecord(data) {
  if (!_db) throw new Error("DB not initialized.")

  const d = data || {}
  const overrideUsed = !!d.overrideUsed

  // If not override, enforce required fields
  if (!overrideUsed) {
    requireField("Tail No", d.aircraftTailNo)
    requireField("Engine Serial No", d.engineSN)
    requireField("Inspection Date", d.inspectionDate)
    requireField("Engine Hours", d.engineHours)
    requireField("Inspection Type", d.inspectionType)
    requireField("Scheduled/Unscheduled", d.scheduledUnscheduled)
    requireField("Inspection Area", d.inspectionArea)
    requireField("Sub Area", d.subArea)
    requireField("Defect Type", d.defectType)
    requireField("Disposal", d.disposal)
    requireField("Inspector Name", d.inspectorName)
    requireField("Inspector ID", d.inspectorId)
    requireField("Unit / Section", d.unitSection)

    const anyDim = String(d.length || "") || String(d.width || "") || String(d.height || "") || String(d.area || "")
    if (!String(anyDim).trim()) {
      throw new Error("At least one of Length/Width/Height/Area is required.")
    }

    if (d.tstTafEnabled && !String(d.tstTafNumber || "").trim()) {
      throw new Error("TST/TAF Number is required when TST/TAF is ON.")
    }

    if (String(d.disposal || "") === "Monitoring on Short Sampling" && !String(d.shortSamplingHours || "").trim()) {
      throw new Error("Short Sampling Frequency is required for Monitoring on Short Sampling.")
    }

    if (d.isFollowUp && !d.previousRecordId) {
      throw new Error("Previous defect entry must be selected for follow-up.")
    }
  }

  // Normalize everything to strings (or empty strings) to avoid NULL constraint problems
  const row = {
    aircraftTailNo: normalizeString(d.aircraftTailNo),
    engineSN: normalizeString(d.engineSN),
    inspectionDate: normalizeString(d.inspectionDate),
    engineHours: normalizeString(d.engineHours),
    inspectionType: normalizeString(d.inspectionType),
    scheduledUnscheduled: normalizeString(d.scheduledUnscheduled),
    inspectionArea: normalizeString(d.inspectionArea),
    subArea: normalizeString(d.subArea),
    stageNumber: normalizeString(d.stageNumber),
    edge: normalizeString(d.edge),
    zone: normalizeString(d.zone),
    bladeCoverage: normalizeString(d.bladeCoverage),
    defectType: normalizeString(d.defectType),
    length: normalizeString(d.length),
    width: normalizeString(d.width),
    height: normalizeString(d.height),
    area: normalizeString(d.area),
    shortSamplingHours: normalizeString(d.shortSamplingHours),
    inspectorName: normalizeString(d.inspectorName),
    inspectorId: normalizeString(d.inspectorId),
    unitSection: normalizeString(d.unitSection),
    disposal: normalizeString(d.disposal),
    remarks: normalizeString(d.remarks),
    tstTafEnabled: normalizeBoolInt(d.tstTafEnabled),
    tstTafNumber: normalizeString(d.tstTafNumber),
    imagePaths: "[]",
    docPaths: "[]",
    isFollowUp: normalizeBoolInt(d.isFollowUp),
    previousRecordId: d.previousRecordId ? Number(d.previousRecordId) : null,
    overrideUsed: normalizeBoolInt(d.overrideUsed),
    createdAt: normalizeString(d.createdAt),
    recordUuid: normalizeString(d.recordUuid) || crypto.randomUUID(),
    previousRecordUuid: normalizeString(d.previousRecordUuid),
  }

  // If follow-up, store stable UUID link as well (for cross-unit data transfer)
  if (row.isFollowUp && row.previousRecordId) {
    const prev = await get(_db, "SELECT recordUuid FROM bsi_records WHERE id = ?", [Number(row.previousRecordId)])
    row.previousRecordUuid = normalizeString(prev?.recordUuid)
  }

  const sql = `
    INSERT INTO bsi_records (
      aircraftTailNo, engineSN, inspectionDate, engineHours, inspectionType, scheduledUnscheduled,
      inspectionArea, subArea, stageNumber, edge, zone, bladeCoverage,
      defectType, length, width, height, area, shortSamplingHours,
      inspectorName, inspectorId, unitSection, disposal, remarks,
      tstTafEnabled, tstTafNumber, imagePaths, docPaths,
      isFollowUp, previousRecordId, previousRecordUuid, overrideUsed, createdAt, recordUuid
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `
  const params = [
    row.aircraftTailNo,
    row.engineSN,
    row.inspectionDate,
    row.engineHours,
    row.inspectionType,
    row.scheduledUnscheduled,
    row.inspectionArea,
    row.subArea,
    row.stageNumber,
    row.edge,
    row.zone,
    row.bladeCoverage,
    row.defectType,
    row.length,
    row.width,
    row.height,
    row.area,
    row.shortSamplingHours,
    row.inspectorName,
    row.inspectorId,
    row.unitSection,
    row.disposal,
    row.remarks,
    row.tstTafEnabled,
    row.tstTafNumber,
    row.imagePaths,
    row.docPaths,
    row.isFollowUp,
    row.previousRecordId,
    row.previousRecordUuid,
    row.overrideUsed,
    row.createdAt,
    row.recordUuid
  ]

  const res = await run(_db, sql, params)
  const id = res.lastID
  const saved = await get(_db, "SELECT * FROM bsi_records WHERE id = ?", [id])
  return saved
}

async function updateAttachments(recordId, imagePaths, docPaths) {
  if (!_db) throw new Error("DB not initialized.")
  const imgs = Array.isArray(imagePaths) ? imagePaths : []
  const docs = Array.isArray(docPaths) ? docPaths : []
  await run(_db, "UPDATE bsi_records SET imagePaths = ?, docPaths = ? WHERE id = ?", [
    JSON.stringify(imgs),
    JSON.stringify(docs),
    Number(recordId)
  ])
  return true
}

async function listRecords(limit = 5000) {
  if (!_db) throw new Error("DB not initialized.")

  // ✅ Hide detached engines: show only engines currently attached to any tail
  const activeEngines = await getActiveEngineSet(_db)

  const rows = await all(_db, "SELECT * FROM bsi_records ORDER BY inspectionDate ASC, id ASC LIMIT ?", [Number(limit || 5000)])

  // If engine is blank, keep it visible (rare override case)
  const filtered = rows.filter((r) => {
    const eng = String(r.engineSN || "").trim()
    if (!eng) return true
    return activeEngines.has(eng)
  })

  // Hide internal merge keys from UI
  for (const r of filtered) {
    delete r.recordUuid
    delete r.previousRecordUuid
  }

  return filtered
}

async function deleteRecord(id) {
  if (!_db) throw new Error("DB not initialized.")
  await run(_db, "DELETE FROM bsi_records WHERE id = ?", [Number(id)])
  return true
}

/* ---------------- Admin / Mapping ---------------- */

async function listTails() {
  const rows = await all(_db, "SELECT tailNo FROM tails ORDER BY tailNo ASC")
  return rows.map((r) => ({ tailNo: r.tailNo }))
}

async function addTail(tailNo) {
  const v = String(tailNo || "").trim()
  if (!v) throw new Error("Tail No is required.")
  await run(_db, "INSERT OR IGNORE INTO tails (tailNo) VALUES (?)", [v])
  return true
}

async function listEngines() {
  const rows = await all(_db, "SELECT engineSN FROM engines ORDER BY engineSN ASC")
  return rows.map((r) => ({ engineSN: r.engineSN }))
}

async function addEngine(engineSN) {
  const v = String(engineSN || "").trim()
  if (!v) throw new Error("Engine S/N is required.")
  await run(_db, "INSERT OR IGNORE INTO engines (engineSN) VALUES (?)", [v])
  return true
}

async function listAssignments() {
  const rows = await all(
    _db,
    "SELECT id, tailNo, engineSN, attachedAt, detachedAt FROM assignments ORDER BY id DESC LIMIT 5000"
  )
  return rows
}

async function attachEngineToTail(payload) {
  const tailNo = String(payload?.tailNo || "").trim()
  const engineSN = String(payload?.engineSN || "").trim()
  if (!tailNo) throw new Error("Tail No is required.")
  if (!engineSN) throw new Error("Engine S/N is required.")

  const now = new Date().toISOString()

  // ensure tail & engine exist
  await addTail(tailNo)
  await addEngine(engineSN)

  // detach any active assignment of this tail
  await run(_db, "UPDATE assignments SET detachedAt = ? WHERE tailNo = ? AND detachedAt IS NULL", [now, tailNo])

  // detach any active assignment of this engine
  await run(_db, "UPDATE assignments SET detachedAt = ? WHERE engineSN = ? AND detachedAt IS NULL", [now, engineSN])

  // create new assignment
  await run(_db, "INSERT INTO assignments (tailNo, engineSN, attachedAt, detachedAt) VALUES (?,?,?,NULL)", [
    tailNo,
    engineSN,
    now
  ])

  return true
}

async function detachTail(tailNo) {
  const t = String(tailNo || "").trim()
  if (!t) throw new Error("Tail No is required.")
  const now = new Date().toISOString()
  await run(_db, "UPDATE assignments SET detachedAt = ? WHERE tailNo = ? AND detachedAt IS NULL", [now, t])
  return true
}

async function getAssignedEngine(tailNo) {
  const t = String(tailNo || "").trim()
  if (!t) return { engineSN: "" }
  const row = await get(_db, "SELECT engineSN FROM assignments WHERE tailNo = ? AND detachedAt IS NULL ORDER BY id DESC LIMIT 1", [t])
  return { engineSN: row?.engineSN || "" }
}

async function deleteTail(tailNo) {
  if (!_db) throw new Error("DB not initialized.")
  const t = String(tailNo || "").trim()
  if (!t) throw new Error("Tail No is required.")
  // Do not allow delete if currently attached to an engine
  const active = await get(_db, "SELECT id FROM assignments WHERE tailNo = ? AND detachedAt IS NULL LIMIT 1", [t])
  if (active) throw new Error("Cannot delete this Tail No because it is attached to an Engine. Detach it first.")
  // Remove any (detached) assignment history for this tail to satisfy FK constraints
  await run(_db, "DELETE FROM assignments WHERE tailNo = ?", [t])
  await run(_db, "DELETE FROM tails WHERE tailNo = ?", [t])
  return true
}

async function deleteEngine(engineSN) {
  if (!_db) throw new Error("DB not initialized.")
  const e = String(engineSN || "").trim()
  if (!e) throw new Error("Engine S/N is required.")
  // Do not allow delete if currently attached to any tail
  const active = await get(_db, "SELECT id FROM assignments WHERE engineSN = ? AND detachedAt IS NULL LIMIT 1", [e])
  if (active) throw new Error("Cannot delete this Engine S/N because it is attached to a Tail No. Detach it first.")
  // Remove any (detached) assignment history for this engine to satisfy FK constraints
  await run(_db, "DELETE FROM assignments WHERE engineSN = ?", [e])
  await run(_db, "DELETE FROM engines WHERE engineSN = ?", [e])
  return true
}

/* ---------------- Data Transfer ---------------- */

function parseJsonArray(text) {
  try {
    const v = JSON.parse(String(text || "[]"))
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

async function getTailRecordsForTransfer({ tailNo, dateFrom, dateTo }) {
  if (!_db) throw new Error("DB not initialized.")
  const t = String(tailNo || "").trim()
  if (!t) throw new Error("Tail No is required.")

  const from = String(dateFrom || "").trim()
  const to = String(dateTo || "").trim()

  const where = ["aircraftTailNo = ?"]
  const params = [t]

  // inspectionDate is stored as YYYY-MM-DD so lexical compare works
  if (from) {
    where.push("inspectionDate >= ?")
    params.push(from)
  }
  if (to) {
    where.push("inspectionDate <= ?")
    params.push(to)
  }

  const sql = `SELECT * FROM bsi_records WHERE ${where.join(" AND ")} ORDER BY inspectionDate ASC, id ASC`
  const rows = await all(_db, sql, params)

  return rows.map((r) => ({
    ...r,
    imagePaths: parseJsonArray(r.imagePaths),
    docPaths: parseJsonArray(r.docPaths)
  }))
}

async function
getEngineRecordsForTransfer({ engineSN, dateFrom, dateTo }) {
  if (!_db) throw new Error("DB not initialized.")
  const e = String(engineSN || "").trim()
  if (!e) throw new Error("Engine S No is required.")

  const from = String(dateFrom || "").trim()
  const to = String(dateTo || "").trim()

  const where = ["engineSN = ?"]
  const params = [e]

  // inspectionDate is stored as YYYY-MM-DD so lexical compare works
  if (from) {
    where.push("inspectionDate >= ?")
    params.push(from)
  }
  if (to) {
    where.push("inspectionDate <= ?")
    params.push(to)
  }

  const sql = `SELECT * FROM bsi_records WHERE ${where.join(" AND ")} ORDER BY inspectionDate ASC, id ASC`
  const rows = await all(_db, sql, params)

  return rows.map((r) => ({
    ...r,
    imagePaths: parseJsonArray(r.imagePaths),
    docPaths: parseJsonArray(r.docPaths)
  }))
}


async function ensureTailExists(tailNo) {
  const t = String(tailNo || "").trim()
  if (!t) return
  await addTail(t)
}

async function ensureEngineExists(engineSN) {
  const e = String(engineSN || "").trim()
  if (!e) return
  await addEngine(e)
}

async function insertImportedRecord(record) {
  if (!_db) throw new Error("DB not initialized.")

  const recUuid = String(record?.recordUuid || "").trim()
  if (!recUuid) throw new Error("Invalid package record UUID.")

  const exists = await get(_db, "SELECT id FROM bsi_records WHERE recordUuid = ? LIMIT 1", [recUuid])
  if (exists?.id) return { skipped: true, id: Number(exists.id) }

  // Ensure tail/engine exist in admin lists
  await ensureTailExists(record.aircraftTailNo)
  await ensureEngineExists(record.engineSN)

  const sql = `
    INSERT INTO bsi_records (
      aircraftTailNo, engineSN, inspectionDate, engineHours, inspectionType, scheduledUnscheduled,
      inspectionArea, subArea, stageNumber, edge, zone, bladeCoverage,
      defectType, length, width, height, area, shortSamplingHours,
      inspectorName, inspectorId, unitSection, disposal, remarks,
      tstTafEnabled, tstTafNumber, imagePaths, docPaths,
      isFollowUp, previousRecordId, previousRecordUuid, overrideUsed, createdAt, recordUuid
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `
  const params = [
    normalizeString(record.aircraftTailNo),
    normalizeString(record.engineSN),
    normalizeString(record.inspectionDate),
    normalizeString(record.engineHours),
    normalizeString(record.inspectionType),
    normalizeString(record.scheduledUnscheduled),
    normalizeString(record.inspectionArea),
    normalizeString(record.subArea),
    normalizeString(record.stageNumber),
    normalizeString(record.edge),
    normalizeString(record.zone),
    normalizeString(record.bladeCoverage),
    normalizeString(record.defectType),
    normalizeString(record.length),
    normalizeString(record.width),
    normalizeString(record.height),
    normalizeString(record.area),
    normalizeString(record.shortSamplingHours),
    normalizeString(record.inspectorName),
    normalizeString(record.inspectorId),
    normalizeString(record.unitSection),
    normalizeString(record.disposal),
    normalizeString(record.remarks),
    normalizeBoolInt(record.tstTafEnabled),
    normalizeString(record.tstTafNumber),
    JSON.stringify(parseJsonArray(record.imagePaths)),
    JSON.stringify(parseJsonArray(record.docPaths)),
    normalizeBoolInt(record.isFollowUp),
    record.previousRecordId ? Number(record.previousRecordId) : null,
    normalizeString(record.previousRecordUuid),
    normalizeBoolInt(record.overrideUsed),
    normalizeString(record.createdAt),
    normalizeString(record.recordUuid)
  ]

  const res = await run(_db, sql, params)
  return { skipped: false, id: Number(res.lastID) }
}

async function resolveImportedFollowups() {
  if (!_db) throw new Error("DB not initialized.")
  // Link follow-ups by UUID in the imported set
  const rows = await all(_db, "SELECT id, previousRecordUuid FROM bsi_records WHERE isFollowUp = 1")
  for (const r of rows) {
    const prevUuid = String(r.previousRecordUuid || "").trim()
    if (!prevUuid) continue
    const prev = await get(_db, "SELECT id FROM bsi_records WHERE recordUuid = ? LIMIT 1", [prevUuid])
    if (prev?.id) {
      await run(_db, "UPDATE bsi_records SET previousRecordId = ? WHERE id = ?", [Number(prev.id), Number(r.id)])
    }
  }
  return true
}

module.exports = {
  init,
  reopen,
  closeDb,
  vacuumInto,
  getSetting,
  setSetting,
  saveRecord,
  updateAttachments,
  listRecords,
  deleteRecord,

  // admin/mapping
  listTails,
  addTail,
  deleteTail,
  listEngines,
  addEngine,
  deleteEngine,
  listAssignments,
  attachEngineToTail,
  detachTail,
  getAssignedEngine,

  // data transfer
  getTailRecordsForTransfer,
  getEngineRecordsForTransfer,
  insertImportedRecord,
  resolveImportedFollowups
}