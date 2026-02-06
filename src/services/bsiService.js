import db from "./database"

/**
 * Insert a new BSI record into database
 */
export function insertBsi(bsi) {
  const stmt = db.prepare(`
    INSERT INTO bsi (
      aircraftReg,
      engineSN,
      ata,
      severity,
      defect,
      status,
      createdAt
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  stmt.run(
    bsi.aircraftReg,
    bsi.engineSN,
    bsi.ata,
    bsi.severity,
    bsi.defect,
    "OPEN",
    new Date().toISOString()
  )
}

/**
 * Get all BSI records
 */
export function getAllBsis() {
  const stmt = db.prepare(`
    SELECT * FROM bsi
    ORDER BY createdAt DESC
  `)

  return stmt.all()
}