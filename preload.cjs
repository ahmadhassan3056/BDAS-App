const { contextBridge, ipcRenderer } = require("electron")

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args)

// Normalize helpers
const asObj = (x) => (x && typeof x === "object" ? x : null)

contextBridge.exposeInMainWorld("bsi", {
  // Records
  listRecords: (...args) => invoke("bsi:listRecords", ...args),
  saveRecord: (...args) => invoke("bsi:saveRecord", ...args),
  deleteRecord: (idOrObj) => {
    const obj = asObj(idOrObj)
    const id = obj?.id ?? idOrObj
    return invoke("bsi:deleteRecord", { id })
  },

  // Attachments / files
  saveAttachments: (...args) => invoke("bsi:saveAttachments", ...args),
  getImageDataUrl: (filePathOrObj) => {
    const obj = asObj(filePathOrObj)
    const filePath = obj?.filePath ?? filePathOrObj
    return invoke("bsi:getImageDataUrl", { filePath })
  },
  openFile: (filePathOrObj) => {
    const obj = asObj(filePathOrObj)
    const filePath = obj?.filePath ?? filePathOrObj
    return invoke("bsi:openFile", { filePath })
  },

  // Tail / Engine / Assignments (normalize payloads)
  listTails: () => invoke("bsi:listTails"),
  addTail: (tailNoOrObj) => {
    const obj = asObj(tailNoOrObj)
    const tailNo = obj?.tailNo ?? tailNoOrObj
    return invoke("bsi:addTail", { tailNo })
  },
  deleteTail: (tailNoOrObj, password) => {
    const obj = asObj(tailNoOrObj)
    const tailNo = obj?.tailNo ?? tailNoOrObj
    return invoke("bsi:deleteTail", { tailNo, password })
  },

  listEngines: () => invoke("bsi:listEngines"),
  addEngine: (engineOrObj) => {
    const obj = asObj(engineOrObj)
    const engineSN = obj?.engineSN ?? obj?.engineS ?? obj?.engine ?? obj?.engineSn ?? engineOrObj
    return invoke("bsi:addEngine", { engineSN })
  },
  deleteEngine: (engineOrObj, password) => {
    const obj = asObj(engineOrObj)
    const engineSN = obj?.engineSN ?? obj?.engineSn ?? engineOrObj
    return invoke("bsi:deleteEngine", { engineSN, password })
  },

  listAssignments: () => invoke("bsi:listAssignments"),
  attachEngineToTail: (payload) => invoke("bsi:attachEngineToTail", payload),
  detachTail: (payload) => invoke("bsi:detachTail", payload),
  getAssignedEngine: (payload) => invoke("bsi:getAssignedEngine", payload),

  // Password / Admin
  verifyPassword: (password) => invoke("bsi:verifyPassword", password),
  changePassword: (currentPassword, newPassword) =>
      invoke("bsi:changePassword", { currentPassword, newPassword }),

  // Excel export
  exportToExcel: (...args) => invoke("bsi:exportToExcel", ...args),

  // Data Transfer
  exportTailPackage: (payload) => invoke("bsi:exportTailPackage", payload),
  exportEnginePackage: (payload) => invoke("bsi:exportEnginePackage", payload),
  importTailPackage: (payload) => invoke("bsi:importTailPackage", payload),

  // Full Backup / Restore
  getLastBackupInfo: () => invoke("bsi:getLastBackupInfo"),
  createBackup: () => invoke("bsi:createBackup"),
  restoreBackup: () => invoke("bsi:restoreBackup"),
  relaunchApp: () => invoke("bsi:relaunchApp"),
})