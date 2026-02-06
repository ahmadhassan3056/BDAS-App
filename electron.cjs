const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require("electron")
const path = require("path")
const fs = require("fs")

app.setName("BDAS")

const db = require("./db.cjs")

const isDev = !app.isPackaged
let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    title: "BDAS – Borescope Data Archiving System",
    autoHideMenuBar: false,
    icon: path.join(__dirname, process.platform === "win32" ? "assets/icon.ico" : "assets/icon.png"),
    width: 1200,
    height: 800,
    backgroundColor: "#0b1220",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs")
    }
  })

  // Standard application menu (File / Edit / View / Window / Help)
  const menu = Menu.buildFromTemplate([
    { label: "File", submenu: [{ role: "quit" }] },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "pasteAndMatchStyle" },
        { role: "delete" },
        { role: "selectAll" }
      ]
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" }
      ]
    },
    { label: "Window", submenu: [{ role: "minimize" }, { role: "close" }] },
    { label: "Help", submenu: [{ role: "about" }] }
  ])
  Menu.setApplicationMenu(menu)
  mainWindow.setMenuBarVisibility(false)

  // Open maximized by default
  mainWindow.maximize()

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173")
    mainWindow.webContents.openDevTools({ mode: "detach" })
  } else {
    const indexHtml = path.join(app.getAppPath(), "dist", "index.html")
    mainWindow.loadFile(indexHtml)
  }

  mainWindow.on("closed", () => {
    mainWindow = null
  })
}

// ---------------- Password storage ----------------
function getPasswordFile() {
  const dir = app.getPath("userData")
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return path.join(dir, "override_password.txt")
}

function getCurrentPassword() {
  const f = getPasswordFile()
  if (!fs.existsSync(f)) {
    fs.writeFileSync(f, "1234", "utf8")
    return "1234"
  }
  return String(fs.readFileSync(f, "utf8") || "").trim() || "1234"
}

function setPassword(newPass) {
  const f = getPasswordFile()
  fs.writeFileSync(f, String(newPass), "utf8")
  return true
}

// ---------------- Attachments helpers ----------------
function getAttachmentsDir() {
  const base = path.join(app.getPath("userData"), "attachments")
  if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true })
  return base
}

function getDbPath() {
  return path.join(app.getPath("userData"), "bsi.sqlite")
}

function getWalPath() {
  return getDbPath() + "-wal"
}

function getShmPath() {
  return getDbPath() + "-shm"
}

function walkFiles(dir) {
  const out = []
  if (!dir || !fs.existsSync(dir)) return out
  const items = fs.readdirSync(dir, { withFileTypes: true })
  for (const it of items) {
    const p = path.join(dir, it.name)
    if (it.isDirectory()) out.push(...walkFiles(p))
    else if (it.isFile()) out.push(p)
  }
  return out
}

function ensureDirForFile(filePath) {
  const d = path.dirname(filePath)
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true })
}

function rmIfExists(p) {
  try {
    if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true })
  } catch {}
}

function safeName(name) {
  return String(name || "file")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .slice(0, 180)
}

function writeBinary(filePath, bytesArray) {
  const buf = Buffer.from(Uint8Array.from(bytesArray || []))
  fs.writeFileSync(filePath, buf)
}

// ---------------- App lifecycle ----------------
app.whenReady().then(async () => {
  try {
    await db.init(app)
  } catch (e) {
    dialog.showErrorBox("Startup Error", `Database init failed:\n\n${e?.message || String(e)}`)
    app.quit()
    return
  }

  createWindow()

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})

// ---------------- IPC (matches preload: bsi:*) ----------------
ipcMain.handle("bsi:saveRecord", async (_evt, data) => {
  return await db.saveRecord(data)
})

ipcMain.handle("bsi:listRecords", async (_evt, limit) => {
  return await db.listRecords(limit || 5000)
})

ipcMain.handle("bsi:verifyPassword", async (_evt, password) => {
  const cur = getCurrentPassword()
  return String(password || "") === cur
})

ipcMain.handle("bsi:changePassword", async (_evt, payload) => {
  const { currentPassword, newPassword } = payload || {}
  const cur = getCurrentPassword()
  if (String(currentPassword || "") !== cur) return false
  if (!newPassword || String(newPassword).length < 3) {
    throw new Error("New password must be at least 3 characters.")
  }
  setPassword(String(newPassword))
  return true
})

// delete without reason
ipcMain.handle("bsi:deleteRecord", async (_evt, payload) => {
  // Support both legacy call styles:
  //   invoke("bsi:deleteRecord", { id })
  //   invoke("bsi:deleteRecord", id)
  let id = null
  if (payload && typeof payload === "object") {
    id = payload.id ?? payload.recordId ?? null
  } else {
    id = payload
  }

  // Allow numeric/string ids; reject empty/undefined/null
  if (id === undefined || id === null || String(id).trim() === "") {
    throw new Error("Missing record id.")
  }

  return await db.deleteRecord(Number(id))
})

// Save attachments: images + docs
ipcMain.handle("bsi:saveAttachments", async (_evt, payload) => {
  const { recordId, images, docs } = payload || {}
  if (!recordId) throw new Error("Missing recordId for attachments.")

  const recDir = path.join(getAttachmentsDir(), String(recordId))
  if (!fs.existsSync(recDir)) fs.mkdirSync(recDir, { recursive: true })

  const savedImages = []
  if (Array.isArray(images) && images.length) {
    for (const img of images) {
      const fname = `${Date.now()}_${safeName(img?.name)}`
      const fpath = path.join(recDir, fname)
      writeBinary(fpath, img?.data)
      savedImages.push(fpath)
    }
  }

  const savedDocs = []
  if (Array.isArray(docs) && docs.length) {
    for (const doc of docs) {
      const fname = `${Date.now()}_${safeName(doc?.name)}`
      const fpath = path.join(recDir, fname)
      writeBinary(fpath, doc?.data)
      savedDocs.push(fpath)
    }
  }

  await db.updateAttachments(Number(recordId), savedImages, savedDocs)
  return { ok: true, images: savedImages, docs: savedDocs }
})

// Convert image file path to Data URL
ipcMain.handle("bsi:getImageDataUrl", async (_evt, payload) => {
  const { filePath } = payload || {}
  if (!filePath) return ""
  if (!fs.existsSync(filePath)) return ""

  const ext = path.extname(filePath).toLowerCase()
  const mime =
    ext === ".png"
      ? "image/png"
      : ext === ".jpg" || ext === ".jpeg"
      ? "image/jpeg"
      : ext === ".webp"
      ? "image/webp"
      : "image/jpeg"

  const b64 = fs.readFileSync(filePath).toString("base64")
  return `data:${mime};base64,${b64}`
})

// Open file in default app (PDF/Word etc.)
ipcMain.handle("bsi:openFile", async (_evt, payload) => {
  const { filePath } = payload || {}
  if (!filePath) return { ok: false }
  if (!fs.existsSync(filePath)) return { ok: false, error: "File not found." }
  const res = await shell.openPath(filePath)
  if (res) return { ok: false, error: res }
  return { ok: true }
})

// Admin / Mapping
ipcMain.handle("bsi:listTails", async () => db.listTails())
ipcMain.handle("bsi:addTail", async (_evt, payload) => db.addTail(payload?.tailNo))
ipcMain.handle("bsi:deleteTail", async (_evt, payload) => db.deleteTail(payload?.tailNo))
ipcMain.handle("bsi:listEngines", async () => db.listEngines())
ipcMain.handle("bsi:addEngine", async (_evt, payload) => db.addEngine(payload?.engineSN))
ipcMain.handle("bsi:deleteEngine", async (_evt, payload) => db.deleteEngine(payload?.engineSN))
ipcMain.handle("bsi:listAssignments", async () => db.listAssignments())
ipcMain.handle("bsi:attachEngineToTail", async (_evt, payload) => db.attachEngineToTail(payload))
ipcMain.handle("bsi:detachTail", async (_evt, payload) => db.detachTail(payload?.tailNo))
ipcMain.handle("bsi:getAssignedEngine", async (_evt, payload) => db.getAssignedEngine(payload?.tailNo))

// ---------------- Full Backup / Restore ----------------
ipcMain.handle("bsi:getLastBackupInfo", async () => {
  let lastBackupAt = ""
  let lastBackupFile = ""
  try {
    lastBackupAt = await db.getSetting("lastBackupAt")
    lastBackupFile = await db.getSetting("lastBackupFile")
  } catch {}

  const iso = String(lastBackupAt || "").trim()
  let daysSince = null
  if (iso) {
    const t = Date.parse(iso)
    if (!Number.isNaN(t)) {
      daysSince = Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000))
      if (daysSince < 0) daysSince = 0
    }
  }

  return { lastBackupAt: iso, lastBackupFile: String(lastBackupFile || ""), daysSince }
})

ipcMain.handle("bsi:createBackup", async () => {
  const userData = app.getPath("userData")
  const nowIso = new Date().toISOString()

  // Create a consistent DB snapshot even if WAL is enabled
  const tmpDb = path.join(userData, `bsi_snapshot_${Date.now()}.sqlite`)
  try {
    await db.vacuumInto(tmpDb)
  } catch (e) {
    // If VACUUM INTO fails for any reason, fall back to the raw DB file (best-effort)
    rmIfExists(tmpDb)
  }

  const defaultBaseName = `BDAS_BACKUP_${fmtDDMMYYYY(new Date())}.bdasbak`
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: "Create Full Backup",
    defaultPath: defaultBaseName,
    filters: [
      { name: "BDAS Backup", extensions: ["bdasbak"] },
      { name: "All Files", extensions: ["*"] }
    ]
  })
  if (canceled || !filePath) {
    rmIfExists(tmpDb)
    return { ok: false, canceled: true }
  }

  const dbToRead = fs.existsSync(tmpDb) ? tmpDb : getDbPath()
  if (!fs.existsSync(dbToRead)) {
    rmIfExists(tmpDb)
    throw new Error("Database file not found.")
  }

  const dbB64 = fs.readFileSync(dbToRead).toString("base64")

  // Include attachments + admin password file
  const files = []
  const attachmentsDir = getAttachmentsDir()
  const absFiles = walkFiles(attachmentsDir)
  for (const p of absFiles) {
    const rel = path.relative(userData, p).replace(/\\/g, "/")
    files.push({ rel, dataB64: fs.readFileSync(p).toString("base64") })
  }

  const pwFile = getPasswordFile()
  if (fs.existsSync(pwFile)) {
    const rel = path.relative(userData, pwFile).replace(/\\/g, "/")
    files.push({ rel, dataB64: fs.readFileSync(pwFile).toString("base64") })
  }

  const backup = {
    app: "BDAS",
    type: "FullBackup",
    version: 1,
    exportedAt: nowIso,
    dbB64,
    files
  }

  fs.writeFileSync(filePath, JSON.stringify(backup), "utf8")
  rmIfExists(tmpDb)

  try {
    await db.setSetting("lastBackupAt", nowIso)
    await db.setSetting("lastBackupFile", path.basename(filePath))
  } catch {}

  return { ok: true, filePath, exportedAt: nowIso }
})

ipcMain.handle("bsi:restoreBackup", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: "Restore Backup",
    properties: ["openFile"],
    filters: [
      { name: "BDAS Backup", extensions: ["bdasbak"] },
      { name: "All Files", extensions: ["*"] }
    ]
  })
  if (canceled || !filePaths || !filePaths[0]) return { ok: false, canceled: true }

  const userData = app.getPath("userData")
  const raw = fs.readFileSync(filePaths[0], "utf8")
  let backup = null
  try {
    backup = JSON.parse(raw)
  } catch {
    throw new Error("Invalid backup file.")
  }

  if (backup?.app !== "BDAS" || backup?.type !== "FullBackup") {
    throw new Error("Unsupported backup file.")
  }

  const dbB64 = String(backup?.dbB64 || "")
  if (!dbB64) throw new Error("Backup does not contain database data.")

  // Close DB before overwriting
  try {
    await db.closeDb()
  } catch {}

  // Remove WAL/SHM so we don't keep old journaling files
  rmIfExists(getWalPath())
  rmIfExists(getShmPath())

  // Restore DB
  const dbBuf = Buffer.from(dbB64, "base64")
  ensureDirForFile(getDbPath())
  fs.writeFileSync(getDbPath(), dbBuf)

  // Restore files (attachments + password)
  const files = Array.isArray(backup?.files) ? backup.files : []
  // Wipe current attachments before restore
  rmIfExists(path.join(userData, "attachments"))

  for (const f of files) {
    const rel = String(f?.rel || "").replace(/\\/g, "/")
    if (!rel) continue

    // Block path traversal
    const norm = path.posix.normalize(rel)
    if (norm.startsWith("../") || norm.startsWith("..\\") || norm.includes("/../")) continue

    // Allow only attachments/* or override_password.txt
    if (!(norm.startsWith("attachments/") || norm === "override_password.txt")) continue

    const abs = path.join(userData, norm)
    ensureDirForFile(abs)
    const buf = Buffer.from(String(f?.dataB64 || ""), "base64")
    fs.writeFileSync(abs, buf)
  }

  // Reopen DB so the current session continues safely
  try {
    await db.reopen(app)
  } catch (e) {
    dialog.showErrorBox("Restore Warning", `Backup restored but database re-open failed:\n\n${e?.message || String(e)}`)
  }

  return { ok: true, restoredFrom: path.basename(filePaths[0]) }
})

ipcMain.handle("bsi:isDev", async () => ({ ok: true, isDev }))

ipcMain.handle("bsi:relaunchApp", async () => {
  // IMPORTANT:
  // In packaged builds, we relaunch the whole app (recommended after Restore).
  // In dev (npm run start), relaunching would terminate the Vite dev server (wait-on),
  // causing a blank window. So in dev we just reload the renderer safely.
  if (isDev) {
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        // Reload UI; DB has already been re-opened in restore handler.
        mainWindow.webContents.reloadIgnoringCache()
      }
    } catch {}
    return { ok: true, mode: "reload" }
  }

  app.relaunch()
  app.exit(0)
  return { ok: true, mode: "relaunch" }
})

// ---------------- Data Transfer ----------------
function fmtDDMMYYYY(d = new Date()) {
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const yyyy = String(d.getFullYear())
  return `${dd}${mm}${yyyy}`
}

ipcMain.handle("bsi:exportTailPackage", async (_evt, payload) => {
  const { password, tailNo, tails, dateFrom, dateTo } = payload || {}
  const cur = getCurrentPassword()
  if (String(password || "") !== cur) throw new Error("Incorrect Password")

  const list = Array.isArray(tails) && tails.length ? tails : [tailNo]
  const tailList = list.map((x) => String(x || "").trim()).filter(Boolean)
  if (!tailList.length) throw new Error("Tail No is required.")

  const records = []
  for (const t of tailList) {
    const recs = await db.getTailRecordsForTransfer({ tailNo: t, dateFrom, dateTo })
    if (Array.isArray(recs) && recs.length) records.push(...recs)
  }

  const packagedRecords = []
  for (const r of records) {
    const imagePaths = Array.isArray(r.imagePaths) ? r.imagePaths : []
    const docPaths = Array.isArray(r.docPaths) ? r.docPaths : []

    const imageFiles = []
    for (const p of imagePaths) {
      if (!p || !fs.existsSync(p)) continue
      imageFiles.push({
        name: path.basename(p),
        dataB64: fs.readFileSync(p).toString("base64")
      })
    }

    const docFiles = []
    for (const p of docPaths) {
      if (!p || !fs.existsSync(p)) continue
      docFiles.push({
        name: path.basename(p),
        dataB64: fs.readFileSync(p).toString("base64")
      })
    }

    const rec = { ...r }
    // remove local-only attachment paths; package stores file bytes instead
    delete rec.imagePaths
    delete rec.docPaths
    packagedRecords.push({ ...rec, imageFiles, docFiles })
  }

  const pkg = {
    app: "BDAS",
    type: "TailPackage",
    version: 1,
    exportedAt: new Date().toISOString(),
    tailNo: tailList.length === 1 ? tailList[0] : "",
    tails: tailList,
    dateFrom: String(dateFrom || ""),
    dateTo: String(dateTo || ""),
    records: packagedRecords
  }

  const { canceled, filePath } = await dialog.showSaveDialog({
    title: "Export Tail No Data",
    defaultPath: `BDAS_${safeName(tailList.length === 1 ? tailList[0] : "MULTI")}_${fmtDDMMYYYY(new Date())}.bdas`,
    filters: [
      { name: "BDAS Package", extensions: ["bdas"] },
      { name: "All Files", extensions: ["*"] }
    ]
  })
  if (canceled || !filePath) return { ok: false, canceled: true }

  fs.writeFileSync(filePath, JSON.stringify(pkg), "utf8")
  return { ok: true, filePath }
})


ipcMain.handle("bsi:exportEnginePackage", async (_evt, payload) => {
  const { password, engineSN, engines, dateFrom, dateTo } = payload || {}
  const cur = getCurrentPassword()
  if (String(password || "") !== cur) throw new Error("Incorrect Password")

  const list = Array.isArray(engines) && engines.length ? engines : [engineSN]
  const engineList = list.map((x) => String(x || "").trim()).filter(Boolean)
  if (!engineList.length) throw new Error("Engine S No is required.")

  const records = []
  for (const e of engineList) {
    const recs = await db.getEngineRecordsForTransfer({ engineSN: e, dateFrom, dateTo })
    if (Array.isArray(recs) && recs.length) records.push(...recs)
  }

  const packagedRecords = []
  for (const r of records) {
    const imagePaths = Array.isArray(r.imagePaths) ? r.imagePaths : []
    const docPaths = Array.isArray(r.docPaths) ? r.docPaths : []

    const imageFiles = []
    for (const p of imagePaths) {
      if (!p || !fs.existsSync(p)) continue
      imageFiles.push({
        name: path.basename(p),
        dataB64: fs.readFileSync(p).toString("base64")
      })
    }

    const docFiles = []
    for (const p of docPaths) {
      if (!p || !fs.existsSync(p)) continue
      docFiles.push({
        name: path.basename(p),
        dataB64: fs.readFileSync(p).toString("base64")
      })
    }

    const rec = { ...r }
    // remove local-only attachment paths; package stores file bytes instead
    delete rec.imagePaths
    delete rec.docPaths
    packagedRecords.push({ ...rec, imageFiles, docFiles })
  }

  const pkg = {
    app: "BDAS",
    type: "EnginePackage",
    version: 1,
    exportedAt: new Date().toISOString(),
    engines: engineList,
    dateFrom: String(dateFrom || "").trim() || null,
    dateTo: String(dateTo || "").trim() || null,
    records: packagedRecords
  }

  const { canceled, filePath } = await dialog.showSaveDialog({
    title: "Export Engine Data",
    defaultPath: `BDAS_${safeName(engineList.length === 1 ? engineList[0] : "MULTI")}_${fmtDDMMYYYY(new Date())}.bdas`,
    filters: [
      { name: "BDAS Package", extensions: ["bdas"] },
      { name: "All Files", extensions: ["*"] }
    ]
  })
  if (canceled || !filePath) return { ok: false, canceled: true }

  fs.writeFileSync(filePath, JSON.stringify(pkg), "utf8")
  return { ok: true, filePath }
})

ipcMain.handle("bsi:importTailPackage", async (_evt, payload) => {
  const { password } = payload || {}
  const cur = getCurrentPassword()
  if (String(password || "") !== cur) throw new Error("Incorrect Password")

  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: "Import Engine Data",
    properties: ["openFile"],
    filters: [
      { name: "BDAS Package", extensions: ["bdas"] },
      { name: "All Files", extensions: ["*"] }
    ]
  })
  if (canceled || !filePaths || !filePaths[0]) return { ok: false, canceled: true }

  const raw = fs.readFileSync(filePaths[0], "utf8")
  let pkg = null
  try {
    pkg = JSON.parse(raw)
  } catch {
    throw new Error("Invalid package file.")
  }

  const recs = Array.isArray(pkg?.records) ? pkg.records : []
  if (!recs.length) return { ok: true, imported: 0, skipped: 0 }

  let imported = 0
  let skipped = 0

  for (const rec of recs) {
    const { imageFiles, docFiles, ...recordData } = rec || {}
    const ins = await db.insertImportedRecord(recordData)
    if (ins?.skipped) {
      skipped += 1
      continue
    }
    imported += 1
    const newId = Number(ins.id)

    const recDir = path.join(getAttachmentsDir(), String(newId))
    if (!fs.existsSync(recDir)) fs.mkdirSync(recDir, { recursive: true })

    const savedImages = []
    if (Array.isArray(imageFiles) && imageFiles.length) {
      for (const img of imageFiles) {
        const fname = `${Date.now()}_${safeName(img?.name)}`
        const fpath = path.join(recDir, fname)
        const buf = Buffer.from(String(img?.dataB64 || ""), "base64")
        fs.writeFileSync(fpath, buf)
        savedImages.push(fpath)
      }
    }

    const savedDocs = []
    if (Array.isArray(docFiles) && docFiles.length) {
      for (const doc of docFiles) {
        const fname = `${Date.now()}_${safeName(doc?.name)}`
        const fpath = path.join(recDir, fname)
        const buf = Buffer.from(String(doc?.dataB64 || ""), "base64")
        fs.writeFileSync(fpath, buf)
        savedDocs.push(fpath)
      }
    }

    await db.updateAttachments(newId, savedImages, savedDocs)
  }

  await db.resolveImportedFollowups()

  // Build required Tail No + Engine S/N pairs from imported package
  const requiredPairsMap = new Map()
  for (const r of recs) {
    const tail = String(r?.aircraftTailNo || "").trim()
    const eng = String(r?.engineSN || "").trim()
    if (!tail || !eng) continue
    requiredPairsMap.set(`${tail}||${eng}`, { tailNo: tail, engineSN: eng })
  }
  const requiredPairs = Array.from(requiredPairsMap.values())

  // Determine which pairs are missing from active assignments
  let activePairs = new Set()
  try {
    const asg = await db.listAssignments()
    const arr = Array.isArray(asg) ? asg : []
    activePairs = new Set(
      arr
        .filter((a) => a && !a.detachedAt && a.tailNo && a.engineSN)
        .map((a) => `${String(a.tailNo).trim()}||${String(a.engineSN).trim()}`)
    )
  } catch {}

  const missingPairs = requiredPairs.filter((p) => !activePairs.has(`${p.tailNo}||${p.engineSN}`))

  return { ok: true, imported, skipped, requiredPairs, missingPairs }
})

// Export to Excel (updated columns, follow-up, subArea, docs excluded as paths)
ipcMain.handle("bsi:exportToExcel", async (_evt, rows) => {
  const xlsx = require("xlsx")
  const data = Array.isArray(rows) ? rows : []

  const mapped = data.map((r) => ({
    "No.": r.__no ?? "",
    "Tail No": r.aircraftTailNo ?? "",
    "Engine Serial No": r.engineSN ?? "",
    "Inspection Date": r.inspectionDate ?? "",
    "Engine Hours": r.engineHours ?? "",
    "Inspection Type": r.inspectionType ?? "",
    "Scheduled / Unscheduled": r.scheduledUnscheduled ?? "",
    "Inspection Area": r.inspectionArea ?? "",
    "Sub Area": r.subArea ?? "",
    "Stage": r.stageNumber ?? "",
    "Edge": r.edge ?? "",
    "Zone": r.zone ?? "",
    "Blade Coverage": r.bladeCoverage ?? "",
    "Defect Type": r.defectType ?? "",
    "Length (mm)": r.length ?? "",
    "Width (mm)": r.width ?? "",
    "Height/Depth (mm)": r.height ?? "",
    "Area (mm²)": r.area ?? "",
    "Disposal": r.disposal ?? "",
    "TST/TAF": r.tstTafEnabled ? (r.tstTafNumber || "YES") : "",
    "Short Sampling (hrs)": r.shortSamplingHours ?? "",
    "Inspector Name": r.inspectorName ?? "",
    "Inspector Pak No": r.inspectorId ?? "",
    "Unit / Section": r.unitSection ?? "",
    "Technical Remarks": r.remarks ?? ""
  }))

  const ws = xlsx.utils.json_to_sheet(mapped)
  const wb = xlsx.utils.book_new()
  xlsx.utils.book_append_sheet(wb, ws, "BDAS Records")

  const { canceled, filePath } = await dialog.showSaveDialog({
    title: "Export Records to Excel",
    defaultPath: "BDAS_Records.xlsx",
    filters: [{ name: "Excel", extensions: ["xlsx"] }]
  })

  if (canceled || !filePath) return { ok: false, canceled: true }

  xlsx.writeFile(wb, filePath)
  return { ok: true, filePath }
})