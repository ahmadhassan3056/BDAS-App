import Database from "better-sqlite3"
import path from "path"
import { app } from "electron"

const dbPath = path.join(app.getPath("userData"), "bsi.db")

const db = new Database(dbPath)

// Create BSI table if not exists
db.prepare(`
  CREATE TABLE IF NOT EXISTS bsi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    aircraftReg TEXT NOT NULL,
    engineSN TEXT NOT NULL,
    ata TEXT NOT NULL,
    severity TEXT NOT NULL,
    defect TEXT NOT NULL,
    status TEXT DEFAULT 'OPEN',
    createdAt TEXT NOT NULL
  )
`).run()

export default db