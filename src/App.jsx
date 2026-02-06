import React, { useEffect, useMemo, useState, useRef } from "react"
import BsiForm from "./BsiForm.jsx"
import SummaryDashboard from "./SummaryDashboard.jsx"
import { prettyFileId } from "./lib/utils.js"

const APP_VERSION = import.meta?.env?.VITE_APP_VERSION || "1.0.0"

// Extract a clean file name from a stored path (Windows or POSIX). Keeps UI professional.
function fileBasename(p) {
  if (!p) return ""
  const s = String(p)
  const normalized = s.replace(/\\/g, "/")
  const parts = normalized.split("/").filter(Boolean)
  return parts.length ? parts[parts.length - 1] : normalized
}

function BrandHeader() {
  const logoSrc = `${import.meta.env.BASE_URL}bdas-logo.png`
  return (
    <div className="flex items-start justify-between gap-4">
      {/* LEFT: Logo + App Title */}
      <div className="flex items-start gap-4">
        <img
          src={logoSrc}
          alt="BDAS Logo"
          className="hidden md:block h-24 w-24 object-contain opacity-95 select-none pointer-events-none mt-1"
          draggable={false}
        />

        <div>
          <div className="text-4xl md:text-5xl font-bold tracking-wider text-emerald-300">
            BDAS
          </div>
          <div className="text-slate-200 mt-1 text-sm md:text-base">
            Borescope Data Archiving Systems
          </div>
          <div className="h-px bg-slate-700/60 mt-3 w-56"></div>
        </div>
      </div>
    </div>
  )
}

function Home({ onGoEntry, onGoView, onGoSummary, onOpenLogin, onChangePasswordClick, backupInfo, onBackupNow }) {
  const [showAbout, setShowAbout] = useState(false)

  return (
    <div className="relative min-h-[calc(100vh-120px)]">
      {/* ✅ Do NOT repeat the title on Home */}
      <div className="mb-6">
        <div className="text-slate-300 mt-3">
          Record and Analyze Defects Noted During Borescope Inspections
        </div>

      {/* Monthly Backup Reminder (Soft vs Strong) */}
      {(() => {
        const days = backupInfo?.daysSince
        const has = !!backupInfo?.lastBackupAt

        let level = "none"
        if (!has) level = "strong"
        else if (typeof days === "number" && days >= 60) level = "strong"
        else if (typeof days === "number" && days >= 30) level = "soft"

        if (level === "none") return null

        const isStrong = level === "strong"
        const title = isStrong ? "Backup Overdue" : "Backup Reminder"
        const msg = !has
          ? "No backup has been created yet."
          : `Last backup was ${days} day(s) ago.`

        return (
          <div
            className={
              isStrong
                ? "mt-4 rounded-2xl border border-orange-500/50 bg-orange-500/15 p-4"
                : "mt-4 rounded-2xl border border-yellow-400/40 bg-yellow-400/10 p-4"
            }
          >
            <div
              className={
                isStrong
                  ? "font-semibold text-orange-200"
                  : "font-semibold text-yellow-200"
              }
            >
              {title}
            </div>
            <div className="text-sm text-slate-200 mt-1">
              {msg} {isStrong ? "Immediate backup is strongly recommended." : "Please create a backup for safety."}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={onBackupNow || onOpenLogin}
                className={
                  isStrong
                    ? "px-4 py-2 rounded-xl bg-orange-400/20 border border-orange-400/40 text-orange-100 hover:bg-orange-400/25"
                    : "px-4 py-2 rounded-xl bg-yellow-400/20 border border-yellow-400/40 text-yellow-100 hover:bg-yellow-400/25"
                }
              >
                Backup Now
              </button>
            </div>
          </div>
        )
      })()}

      </div>

      <div className="flex items-center justify-center min-h-[55vh]">
        <div className="grid gap-4 w-full max-w-xl">
          <button
            onClick={onGoEntry}
            className="w-full text-left rounded-2xl px-6 py-5 transition shadow-lg
              bg-gradient-to-br from-slate-800/80 to-slate-900/60 border border-slate-700 hover:border-emerald-500/50"
          >
            <div className="text-xl font-bold text-white">Data Entry</div>
            <div className="text-sm text-slate-300 mt-1">Create New Borescope Inspection Defect Record</div>
          </button>

          <button
            onClick={onGoView}
            className="w-full text-left rounded-2xl px-6 py-5 transition shadow-lg
              bg-gradient-to-br from-slate-800/80 to-slate-900/60 border border-slate-700 hover:border-amber-500/50"
          >
            <div className="text-xl font-bold text-white">View Data</div>
            <div className="text-sm text-slate-300 mt-1">Browse and Analyze Saved Inspection Defects Record</div>
          </button>

          <button
            onClick={onGoSummary}
            className="w-full text-left rounded-2xl px-6 py-5 transition shadow-lg
              bg-gradient-to-br from-slate-800/80 to-slate-900/60 border border-slate-700 hover:border-sky-400/50"
          >
            <div className="text-xl font-bold text-white">Summary Dashboard</div>
            <div className="text-sm text-slate-300 mt-1">View Inspection Insights</div>
          </button>
        </div>
      </div>

      {/* Admin actions (bottom-left) */}
      <div className="absolute bottom-3 left-3 flex flex-col gap-2">
        <button
          onClick={onOpenLogin}
          className="bg-slate-800/70 hover:bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-700"
          title="Admin Login"
        >
          Admin Login
        </button>
        <button
          onClick={onChangePasswordClick}
          className="bg-slate-800/70 hover:bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-700"
          title="Change Admin Password"
        >
          Change Password
        </button>
      </div>

      {/* About button (bottom-right) */}
      <button
        onClick={() => setShowAbout(true)}
        className="absolute bottom-3 right-3 bg-slate-800/70 hover:bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-700"
        title="About"
      >
        About
      </button>

      {showAbout ? (
        <ModalShell title="About" onClose={() => setShowAbout(false)}>
          <div className="text-slate-200">
            <div className="font-semibold text-white">Borescope Data Archiving System (BDAS)</div>
            <div className="text-sm text-slate-300 mt-1">Version: {APP_VERSION}</div>
            <div className="text-sm text-slate-300 mt-1">Developed by: Flt Lt Ahmad Hassan Tehseen</div>
            <div className="text-sm text-slate-300 mt-1">© 2026</div>
          </div>
        </ModalShell>
      ) : null}

    </div>
  )
}

function cleanIpcMessage(err) {
  let msg = String(err?.message || err || "")
  msg = msg.replace(/^Error invoking remote method 'bsi:[^']+':\s*/i, "")
  msg = msg.replace(/^Error:\s*/i, "")
  return msg.trim()
}

function ChangePasswordModal({ open, onClose }) {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmNew, setConfirmNew] = useState("")
  const [msg, setMsg] = useState("")
  const [busy, setBusy] = useState(false)
  const pwRef = useRef(null)

  useEffect(() => {
    if (!open) {
      setCurrentPassword("")
      setNewPassword("")
      setConfirmNew("")
      setMsg("")
      setBusy(false)
    }
  }, [open])

  if (!open) return null

  const submit = async () => {
    setMsg("")
    if (!currentPassword || !newPassword || !confirmNew) {
      setMsg("All fields are required")
      return
    }
    if (newPassword !== confirmNew) {
      setMsg("New Admin Password and confirmation do not match")
      return
    }

    setBusy(true)
    try {
      const ok = await window.bsi.changePassword(currentPassword, newPassword)
      if (ok) {
        setMsg("Admin Password updated")
        setCurrentPassword("")
        setNewPassword("")
        setConfirmNew("")
      } else {
        setMsg("Incorrect Password Try again")
      }
    } catch (e) {
      setMsg(cleanIpcMessage(e) || "Operation failed Please try again")
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell title="Change Admin Password" onClose={onClose}>
      <label className="block text-sm text-slate-200 mb-1">Current Admin Password</label>
      <input
        className="input2"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        type="password"
      />

      <label className="block text-sm text-slate-200 mb-1 mt-3">New Admin Password</label>
      <input className="input2" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" />

      <label className="block text-sm text-slate-200 mb-1 mt-3">Re-enter New Password</label>
      <input className="input2" value={confirmNew} onChange={(e) => setConfirmNew(e.target.value)} type="password" />

      {msg ? <div className="text-sm text-amber-200 mt-3">{msg}</div> : null}

      <div className="flex gap-2 justify-end mt-4">
        <button onClick={onClose} className="btnMuted" disabled={busy}>
          Close
        </button>
        <button onClick={submit} className="btnPrimary" disabled={busy}>
          {busy ? "Saving" : "Save"}
        </button>
      </div>
    </ModalShell>
  )
}

function LoginModal({ open, onClose, onLoggedIn }) {
  const [password, setPassword] = useState("")
  const [msg, setMsg] = useState("")
  const [busy, setBusy] = useState(false)
  const pwRef = useRef(null)

  useEffect(() => {
    if (!open) {
      setPassword("")
      setMsg("")
      setBusy(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => pwRef.current?.focus(), 0)
    return () => clearTimeout(t)
  }, [open])

  if (!open) return null

  const submit = async () => {
    setMsg("")
    if (!password) return setMsg("Password is required")

    setBusy(true)
    try {
      const ok = await window.bsi.verifyPassword(password)
      if (!ok) return setMsg("Incorrect Password Try again")
      onLoggedIn()
      onClose()
    } catch (e) {
      setMsg(cleanIpcMessage(e) || "Operation failed Please try again")
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell title="Admin Login" onClose={onClose}>
      <div className="text-sm text-slate-300 mb-3">Enter Admin Password to continue</div>
      <label className="block text-sm text-slate-200 mb-1">Admin Password</label>
      <input className="input2" ref={pwRef} value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }} type="password" />

      {msg ? <div className="text-sm text-amber-200 mt-3">{msg}</div> : null}

      <div className="flex gap-2 justify-end mt-4">
        <button onClick={onClose} className="btnMuted" disabled={busy}>
          Cancel
        </button>
        <button onClick={submit} className="btnPrimary" disabled={busy}>
          {busy ? "Checking" : "Login"}
        </button>
      </div>
    </ModalShell>
  )
}

function AdminPanel({ onExit , prefillAttach, clearPrefill }) {
  const [tails, setTails] = useState([])
  const [engines, setEngines] = useState([])
  const [assignments, setAssignments] = useState([])

  const activeAssignments = useMemo(() => {
    const arr = Array.isArray(assignments) ? assignments : []
    return arr.filter((a) => a && !a.detachedAt && a.engineSN)
  }, [assignments])

  const [newTail, setNewTail] = useState("")
  const [newEngine, setNewEngine] = useState("")
  const [tailPick, setTailPick] = useState("")
  const [enginePick, setEnginePick] = useState("")

  const [msg, setMsg] = useState("")
  const [busy, setBusy] = useState(false)


  // ---------------- Full Backup / Restore (UI) ----------------
  const [backupInfo, setBackupInfo] = useState({ lastBackupAt: "", lastBackupFile: "", daysSince: null })
  const [backupBusy, setBackupBusy] = useState(false)

  const refreshBackupInfo = async () => {
    try {
      if (typeof window?.bsi?.getLastBackupInfo !== "function") return
      const info = await window.bsi.getLastBackupInfo()
      if (info) setBackupInfo(info)
    } catch (e) {
      console.error("getLastBackupInfo failed:", e)
    }
  }

  useEffect(() => {
    refreshBackupInfo()
  }, [])

  const doCreateBackup = async () => {
    setMsg("")
    setBackupBusy(true)
    try {
      if (typeof window?.bsi?.createBackup !== "function") {
        throw new Error("Backup service is not available Please update/reinstall the app")
      }
      const res = await window.bsi.createBackup()
      if (res?.canceled) return
      if (res?.ok) {
        setMsg("Backup created successfully")
        await refreshBackupInfo()
      } else {
        setMsg("Backup was not created")
      }
    } catch (e) {
      setMsg(cleanIpcMessage(e) || "Backup failed")
    } finally {
      setBackupBusy(false)
    }
  }

  const doRestoreBackup = async () => {
    setMsg("")
    setBackupBusy(true)
    try {
      if (typeof window?.bsi?.restoreBackup !== "function") {
        throw new Error("Restore service is not available Please update/reinstall the app")
      }
      const res = await window.bsi.restoreBackup()
      if (res?.canceled) return
      if (res?.ok) {
        setMsg("Backup restored successfully The app will restart now")
        setTimeout(() => {
          try { window?.bsi?.relaunchApp?.() } catch {}
        }, 600)
      } else {
        setMsg("Restore failed")
      }
    } catch (e) {
      setMsg(cleanIpcMessage(e) || "Restore failed")
    } finally {
      setBackupBusy(false)
    }
  }
  const getBsi = () => {
    const api = window?.bsi
    if (!api) throw new Error("Unable to access application services Please restart the app")
    for (const k of ["listTails", "listEngines", "listAssignments"]) {
      if (typeof api[k] !== "function") throw new Error(`Admin API missing: ${k}. Please update/reinstall the app.`)
    }
    return api
  }

  const load = async () => {
    try {
      const bsi = getBsi()
      const [t, e, a] = await Promise.all([bsi.listTails(), bsi.listEngines(), bsi.listAssignments()])
      setTails(Array.isArray(t) ? t : [])
      setEngines(Array.isArray(e) ? e : [])
      setAssignments(Array.isArray(a) ? a : [])
    } catch (e) {
      console.error(e)
      setMsg(cleanIpcMessage(e) || "Unable to load data Please refresh")
      setTails([])
      setEngines([])
      setAssignments([])
    }
  }

  useEffect(() => {
    load()
  }, [])

  const addTail = async () => {
    setMsg("")
    if (!newTail.trim()) return setMsg("Tail No is required")
    setBusy(true)
    try {
      await window.bsi.addTail(newTail.trim())
      setNewTail("")
      await load()
      setMsg("Tail No Added")
    } catch (e) {
      setMsg(cleanIpcMessage(e) || "Operation failed Please try again")
    } finally {
      setBusy(false)
    }
  }

  const deleteTail = async (tailNo) => {
    setMsg("")
    const t = String(tailNo || "").trim()
    if (!t) return
    setBusy(true)
    try {
      await window.bsi.deleteTail(t)
      await load()
      setMsg("Tail No deleted")
    } catch (e) {
      setMsg(cleanIpcMessage(e) || "Failed to delete Tail No")
    } finally {
      setBusy(false)
    }
  }

  const deleteEngine = async (engineSN) => {
    setMsg("")
    const e = String(engineSN || "").trim()
    if (!e) return
    setBusy(true)
    try {
      await window.bsi.deleteEngine(e)
      await load()
      setMsg("Engine deleted")
    } catch (err) {
      setMsg(cleanIpcMessage(err) || "Operation failed Please try again")
    } finally {
      setBusy(false)
    }
  }

  const addEngine = async () => {
    setMsg("")
    if (!newEngine.trim()) return setMsg("Engine S No is required")
    setBusy(true)
    try {
      await window.bsi.addEngine(newEngine.trim())
      setNewEngine("")
      await load()
      setMsg("Engine S No Added")
    } catch (e) {
      setMsg(cleanIpcMessage(e) || "Operation failed Please try again")
    } finally {
      setBusy(false)
    }
  }

  const attach = async () => {
    setMsg("")
    if (!tailPick) return setMsg("Select Tail No")
    if (!enginePick) return setMsg("Select Engine S No")
    setBusy(true)
    try {
      await window.bsi.attachEngineToTail({ tailNo: tailPick, engineSN: enginePick })
      await load()
      setMsg("Attached successfully")
    } catch (e) {
      setMsg(cleanIpcMessage(e) || "Attach failed")
    } finally {
      setBusy(false)
    }
  }

  const detach = async () => {
    setMsg("")
    if (!tailPick) return setMsg("Select Tail No to detach")
    setBusy(true)
    try {
      await window.bsi.detachTail({ tailNo: tailPick })
      await load()
      setMsg("Detached successfully")
    } catch (e) {
      setMsg(cleanIpcMessage(e) || "Operation failed Please try again")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-2xl font-extrabold text-amber-200">Admin Module</div>
          <div className="text-slate-300 text-sm">
            Manage Tail No and Engine S No assignments
          </div>
        </div>
        <div className="flex items-center gap-2">          <button onClick={onExit} className="btnMuted">
            Exit Admin
          </button>
        </div>
      </div>

      {msg ? (
        <div className="text-sm text-emerald-200" title={msg}>
          {msg}
        </div>
      ) : null}

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="cardX">
          <div className="cardTitle">Add Tail No</div>
          <input className="input2 mt-2" value={newTail} onChange={(e) => setNewTail(e.target.value)} />
          <button onClick={addTail} className="btnPrimary mt-3" disabled={busy}>
            Add Tail No
          </button>
          <div className="mt-3 border-t border-slate-700/60 pt-3">
            <div className="text-xs text-slate-300 mb-2">Added Tail Nos</div>
            <div className="max-h-40 overflow-auto space-y-1 pr-1">
              {tails.length === 0 ? (
                <div className="text-xs text-slate-500">No tail numbers.</div>
              ) : (
                tails.map((t) => (
                  <div key={t.tailNo} className="flex items-center justify-between gap-2 bg-slate-900/40 border border-slate-700/60 rounded-xl px-3 py-2">
                    <div className="text-sm text-slate-100">{t.tailNo}</div>
                    <button
                      className="px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/35 text-rose-200 text-xs font-semibold hover:bg-rose-500/20"
                      onClick={() => deleteTail(t.tailNo)}
                      disabled={busy}
                      title="Delete Tail No"
                    >
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="text-xs text-slate-500 mt-2">
              Note: A Tail No can only be deleted if it is not attached to an engine
            </div>
          </div>
        </div>

        <div className="cardX">
          <div className="cardTitle">Add Engine S No</div>
          <input className="input2 mt-2" value={newEngine} onChange={(e) => setNewEngine(e.target.value)} />
          <button onClick={addEngine} className="btnPrimary mt-3" disabled={busy}>
            Add Engine
          </button>
          <div className="mt-3 border-t border-slate-700/60 pt-3">
            <div className="text-xs text-slate-300 mb-2">Added Engine S No</div>
            <div className="max-h-40 overflow-auto space-y-1 pr-1">
              {engines.length === 0 ? (
                <div className="text-xs text-slate-500">No engines.</div>
              ) : (
                engines.map((x) => (
                  <div key={x.engineSN} className="flex items-center justify-between gap-2 bg-slate-900/40 border border-slate-700/60 rounded-xl px-3 py-2">
                    <div className="text-sm text-slate-100">{x.engineSN}</div>
                    <button
                      className="px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/35 text-rose-200 text-xs font-semibold hover:bg-rose-500/20"
                      onClick={() => deleteEngine(x.engineSN)}
                      disabled={busy}
                      title="Delete Engine S No"
                    >
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="text-xs text-slate-500 mt-2">
              Note: An Engine S No can only be deleted if it is not attached to a Tail No
            </div>
          </div>
        </div>

        <div className="cardX">
          <div className="cardTitle">Attach / Detach</div>
          <div className="text-xs text-slate-400 mb-2">Select a Tail No and Engine S No to attach / detach</div>

          <label className="text-sm text-slate-200 mt-2 block">Tail No</label>
          <select className="input2" value={tailPick} onChange={(e) => setTailPick(e.target.value)}>
            <option value="">Select</option>
            {tails.map((t) => (
              <option key={t.tailNo} value={t.tailNo}>
                {t.tailNo}
              </option>
            ))}
          </select>

          <label className="text-sm text-slate-200 mt-3 block">Engine S No</label>
          <select className="input2" value={enginePick} onChange={(e) => setEnginePick(e.target.value)}>
            <option value="">Select</option>
            {engines.map((x) => (
              <option key={x.engineSN} value={x.engineSN}>
                {x.engineSN}
              </option>
            ))}
          </select>

          <div className="flex gap-2 mt-3">
            <button onClick={attach} className="btnPrimary" disabled={busy}>
              Attach
            </button>
            <button onClick={detach} className="btnWarn" disabled={busy}>
              Detach Tail
            </button>
          </div>

          <div className="text-xs text-slate-400 mt-2">
            Note: When an engine is re-attached, old records become visible again
          </div>
        </div>
      </div>

      <div className="cardX">
        <div className="cardTitle">Current Assignments</div>
        <div className="text-xs text-slate-400 mb-2">Shows actively attached aircraft and engines</div>
        <div className="overflow-auto">
          <table className="min-w-[700px] w-full text-sm">
            <thead className="bg-slate-900/70 text-slate-200">
              <tr>
                <th className="text-left px-3 py-2 text-xs uppercase tracking-wider">Tail No</th>
                <th className="text-left px-3 py-2 text-xs uppercase tracking-wider">Engine S No</th>
                                <th className="text-left px-3 py-2 text-xs uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="text-slate-100">
              {activeAssignments.length === 0 ? (
                <tr>
                  <td className="px-3 py-2 text-slate-300" colSpan={3}>
                    No active assignments.
                  </td>
                </tr>
              ) : (
                activeAssignments.map((a) => (
                  <tr key={a.id} className="border-t border-slate-800 hover:bg-slate-800/40">
                    <td className="px-3 py-2">{a.tailNo}</td>
                    <td className="px-3 py-2">{a.engineSN}</td>
                                        <td className="px-3 py-2">
                      {a.detachedAt ? (
                        <span className="px-2 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs text-slate-200">
                          Detached
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-xs text-emerald-200" title={a.engineSN || ""}>
                          Active
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      
      <div className="cardX">
        <div className="cardTitle">Backup / Restore</div>
        <div className="text-sm text-slate-300">
          Create backup including attachments, or restore from a previously created backup.
        </div>

        <div className="mt-3 grid md:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-slate-700 bg-slate-900/40 p-3">
            <div className="text-xs uppercase tracking-wider text-slate-400">Last Backup</div>
            <div className="mt-1 text-sm text-slate-100">
              {backupInfo?.lastBackupAt ? backupInfo.lastBackupAt : "No backup yet"}
            </div>
            {backupInfo?.lastBackupFile ? (
              <div className="mt-1 text-xs text-slate-300 truncate" title={backupInfo.lastBackupFile}>
                {backupInfo.lastBackupFile}
              </div>
            ) : null}
            {typeof backupInfo?.daysSince === "number" ? (
              <div className="mt-1 text-xs text-slate-400">{backupInfo.daysSince} day(s) ago</div>
            ) : null}
          </div>

          <div className="flex items-center gap-2 md:col-span-2 flex-wrap">
            <button onClick={doCreateBackup} className="btnPrimary" disabled={busy || backupBusy}>
              {backupBusy ? "Working..." : "Create Backup"}
            </button>
            <button
              onClick={() => {
                const ok = window.confirm(
                  "RESTORE WARNING:\n\nRestoring a backup will replace the current database and may overwrite attachment files.\n\nProceed to select a backup file?"
                )
                if (ok) doRestoreBackup()
              }}
              className="btnWarn"
              disabled={busy || backupBusy}
              title="Restore Backup"
            >
              Restore Backup
            </button>
            
          </div>
        </div>

        <div className="text-xs text-slate-400 mt-2">
          Important: Create a backup at least once every month for safety.
        </div>
      </div>

      <style>{commonStyles}</style>
    </div>
  )
}

function ModalShell({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md rounded-2xl p-4 border border-slate-700 shadow-xl bg-gradient-to-b from-slate-900 to-slate-950">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="text-lg font-semibold text-white">{title}</div>
          <button onClick={onClose} className="btnMuted px-3 py-1">
            ✕
          </button>
        </div>
        {children}
        <style>{commonStyles}</style>
      </div>
    </div>
  )
}

/* ---------------- View Data (updated columns: Sub Area + Follow-up + Docs) ---------------- */

function ImageViewer({ open, src, onClose }) {
  if (!open || !src) return null
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-end mb-2">
          <button onClick={onClose} className="btnMuted">
            Close
          </button>
        </div>
        <div className="bg-slate-950 border border-slate-700 rounded-2xl p-3">
          <img src={src} className="w-full h-auto rounded-lg" alt="defect" />
        </div>
        <style>{commonStyles}</style>
      </div>
    </div>
  )
}

function DeleteModal({ open, record, onClose, onDeleted }) {
  const [password, setPassword] = useState("")
  const [msg, setMsg] = useState("")
  const [busy, setBusy] = useState(false)
  const pwRef = useRef(null)

  useEffect(() => {
    if (!open) {
      setPassword("")
      setMsg("")
      setBusy(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => pwRef.current?.focus(), 0)
    return () => clearTimeout(t)
  }, [open])


  if (!open || !record) return null

  const confirmDelete = async () => {
    setMsg("")
    if (!password) return setMsg("Password is required")

    setBusy(true)
    try {
      const ok = await window.bsi.verifyPassword(password)
      if (!ok) return setMsg("Incorrect Password Try again")
      await window.bsi.deleteRecord(record.id)
      onClose()
      onDeleted()
    } catch (e) {
      setMsg(cleanIpcMessage(e) || "Operation failed Please try again")
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell title="Delete Record" onClose={onClose}>
      <div className="text-sm text-slate-300 mb-3">
        Tail No <span className="text-white">{record.aircraftTailNo}</span> — Engine S No:{" "}
        <span className="text-white">{record.engineSN}</span>
      </div>

      <label className="block text-sm text-slate-200 mb-1">Password</label>
      <input className="input2" ref={pwRef} value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmDelete(); } }} type="password" />

      {msg ? <div className="text-sm text-amber-200 mt-3">{msg}</div> : null}

      <div className="flex gap-2 justify-end mt-4">
        <button onClick={onClose} className="btnMuted" disabled={busy}>
          Cancel
        </button>
        <button onClick={confirmDelete} className="btnWarn" disabled={busy}>
          {busy ? "Deleting" : "Delete"}
        </button>
      </div>
      <style>{commonStyles}</style>
    </ModalShell>
  )
}

function Thumb({ filePath, ensureThumb, onClick }) {
  const [src, setSrc] = useState("")

  useEffect(() => {
    let alive = true
    ;(async () => {
      const url = await ensureThumb(filePath)
      if (alive && url) setSrc(url)
    })()
    return () => {
      alive = false
    }
  }, [filePath])

  return src ? (
    <button
      onClick={onClick}
      className="w-10 h-10 rounded-lg border border-slate-700 overflow-hidden hover:ring-2 hover:ring-emerald-500"
      title="Open image"
    >
      <img src={src} className="w-full h-full object-cover" alt="thumb" />
      <style>{commonStyles}</style>
    </button>
  ) : (
    <div className="w-10 h-10 rounded-lg border border-slate-700 bg-slate-800/60" />
  )
}

function ViewData({ onGoEntry, preset, colVis: persistedColVis, setColVis: setPersistedColVis }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [viewErr, setViewErr] = useState("")

  // filters
  const [qAny, setQAny] = useState("")
  const [qTail, setQTail] = useState("")
  const [qEngine, setQEngine] = useState("")
  
  const [qTstTaf, setQTstTaf] = useState("")
  const [qRecordId, setQRecordId] = useState(null)
const [fArea, setFArea] = useState("")
  const [fSubArea, setFSubArea] = useState("")
  const [fDefect, setFDefect] = useState("")
  const [fDisposal, setFDisposal] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  // Column visibility (View Data)
  const DEFAULT_COL_VIS = {
    no: true,
    tail: true,
    engine: true,
    inspectionDate: true,
    engineHours: true,
    inspectionType: true,
    scheduled: true,
    area: true,
    subArea: true,
    stage: true,
    edge: true,
    zone: true,
    defectType: true,
    dimensions: true,
    disposal: true,
    tstTaf: true,
    shortSampling: true,
    inspector: true,
    inspectorPakNo: true,
    unitSection: true,
    remarks: true,
    images: true,
    docs: true,
    action: true
  }

  const [localColVis, setLocalColVis] = useState(DEFAULT_COL_VIS)
  const colVis = persistedColVis ?? localColVis
  const setColVis = setPersistedColVis ?? setLocalColVis
  const [colPickerOpen, setColPickerOpen] = useState(false)
  const toggleCol = (k) => setColVis((p) => ({ ...p, [k]: !p[k] }))
  const showCol = (k) => (k === "action" ? true : !!colVis[k])

  useEffect(() => {
    if (!preset) return

    const rid = preset.recordId ?? null
    if (rid != null && rid !== "") {
      // Single-record drill-down: ignore all other filters
      setQRecordId(rid)
      setQAny("")
      setQTail("")
      setQEngine("")
      setQTstTaf("")
      setFArea("")
      setFSubArea("")
      setFDefect("")
      setFDisposal("")
      setDateFrom("")
      setDateTo("")
      return
    }

    // Normal presets (engine/tail/wildcard/TST etc.)
    setQRecordId(null)
    setQAny(preset.qAny ?? "")
    setQTail(preset.qTail ?? "")
    setQEngine(preset.qEngine ?? "")
    setQTstTaf(preset.tstTafNumber ?? "")
    setFArea(preset.fArea ?? "")
    setFSubArea(preset.fSubArea ?? "")
    setFDefect(preset.fDefect ?? "")
    setFDisposal(preset.fDisposal ?? "")
    setDateFrom(preset.dateFrom ?? "")
    setDateTo(preset.dateTo ?? "")
  }, [preset?.version])

  const [delOpen, setDelOpen] = useState(false)
  const [delRecord, setDelRecord] = useState(null)

  const [imgOpen, setImgOpen] = useState(false)
  const [imgSrc, setImgSrc] = useState("")
  const [imgCache, setImgCache] = useState({})

  const load = async () => {
    setLoading(true)
    setViewErr("")
    try {
      if (!window?.bsi?.listRecords) throw new Error("Unable to load data Please refresh")
      const data = await window.bsi.listRecords(5000)
      setRows(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error("View Data load failed:", e)
      setRows([])
      setViewErr(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const sorted = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => (a.id || 0) - (b.id || 0))
    return copy
  }, [rows])

  const filteredSorted = useMemo(() => {
    const any = qAny.trim().toLowerCase()
    const tail = qTail.trim().toLowerCase()
    const eng = qEngine.trim().toLowerCase()
    const tst = String(qTstTaf || "").trim()
    const rid = qRecordId == null || qRecordId === "" ? null : Number(qRecordId)

    return sorted.filter((r) => {
      if (dateFrom && (!r.inspectionDate || r.inspectionDate < dateFrom)) return false
      if (dateTo && (!r.inspectionDate || r.inspectionDate > dateTo)) return false
      if (rid != null && Number(r.id) !== rid) return false

      if (fArea && r.inspectionArea !== fArea) return false
      if (fSubArea && r.subArea !== fSubArea) return false
      if (fDefect && r.defectType !== fDefect) return false
      if (fDisposal && r.disposal !== fDisposal) return false

      if (tail && String(r.aircraftTailNo || "").toLowerCase().indexOf(tail) === -1) return false
      if (eng && String(r.engineSN || "").toLowerCase().indexOf(eng) === -1) return false
      if (tst) {
        const enabled = Number(r.tstTafEnabled) === 1
        const num = String(r.tstTafNumber || "").trim()
        const key = num || "(No Number)"
        if (!enabled && !num) return false
        if (key !== tst) return false
      }

      if (!any) return true
      const blob = [
        r.aircraftTailNo,
        r.engineSN,
        r.inspectionDate,
        r.engineHours,
        r.inspectionType,
        r.scheduledUnscheduled,
        r.inspectionArea,
        r.subArea,
        r.stageNumber,
        r.edge,
        r.zone,
        r.bladeCoverage,
        r.defectType,
        r.disposal,
        r.tstTafEnabled ? "TST/TAF" : "",
        r.tstTafNumber,
        r.shortSamplingHours,
        r.inspectorName,
        r.inspectorId,
        r.unitSection,
        r.remarks,
        r.isFollowUp ? "FOLLOWUP" : ""
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      return blob.includes(any)
    })
  }, [sorted, qAny, qTail, qEngine, fArea, fSubArea, fDefect, fDisposal, dateFrom, dateTo])

  const numberedForExport = useMemo(() => filteredSorted.map((r, idx) => ({ ...r, __no: idx + 1 })), [filteredSorted])

  const resetFilters = () => {
    setQAny("")
    setQTail("")
    setQEngine("")
    setFArea("")
    setFSubArea("")
    setFDefect("")
    setFDisposal("")
    setDateFrom("")
    setDateTo("")
  }

  const exportExcel = async () => {
    await window.bsi.exportToExcel(numberedForExport)
  }

  const ensureThumb = async (filePath) => {
    if (!filePath) return null
    if (imgCache[filePath]) return imgCache[filePath]
    const dataUrl = await window.bsi.getImageDataUrl(filePath)
    setImgCache((p) => ({ ...p, [filePath]: dataUrl }))
    return dataUrl
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-3 md:items-end md:justify-between">
        <div>
          <div className="text-xl font-bold text-emerald-300">Borescope Inspection Records</div>
        </div>

        <div className="flex gap-2">
          <div className="relative">
            <button onClick={() => setColPickerOpen((p) => !p)} className="btnMuted">
              Column Selection
            </button>
            {colPickerOpen ? (
              <div className="absolute right-0 mt-2 w-[300px] bg-slate-900 border border-slate-700 rounded-2xl shadow-xl p-3 z-30">
                <div className="text-sm font-bold text-slate-100 mb-2">Show / Hide Columns</div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ["no", "S No"],
                    ["tail", "Tail No"],
                    ["engine", "Engine S No"],
                    ["inspectionDate", "Inspection Date"],
                    ["engineHours", "Engine Hours"],
                    ["inspectionType", "Inspection Type"],
                    ["scheduled", "Scheduled"],
                    ["area", "Inspection Area"],
                    ["subArea", "Sub Area"],
                    ["stage", "Stage"],
                    ["edge", "Edge"],
                    ["zone", "Zone"],
                    ["defectType", "Defect Type"],
                    ["dimensions", "L/W/H/Area"],
                    ["disposal", "Disposal"],
                    ["tstTaf", "TST/TAF"],
                    ["shortSampling", "Short Sampling"],
                    ["inspector", "Inspector"],
                    ["inspectorPakNo", "Pak No"],
                    ["unitSection", "Unit / Section"],
                    ["remarks", "Remarks"],
                    ["images", "Images"],
                    ["docs", "Docs"],
                    ["action", "Action"]
                  ].map(([k, label]) => (
                    <label key={k} className="flex items-center gap-2 text-xs text-slate-200 select-none">
                      <input type="checkbox" checked={!!colVis[k]} onChange={() => toggleCol(k)} />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
                <div className="flex gap-2 mt-3">
                  <button className="btnMuted" onClick={() => setColVis(DEFAULT_COL_VIS)}>
                    Reset
                  </button>
                  <button className="btnPrimary" onClick={() => setColPickerOpen(false)}>
                    Done
                  </button>
                </div>
</div>
            ) : null}
          </div>
          <button onClick={exportExcel} className="btnPrimary">
            Export Excel
          </button>
          <button onClick={load} className="btnMuted">
            Refresh
          </button>

        </div>
      </div>

      {viewErr ? (
        <div className="rounded-xl border border-rose-500/50 bg-rose-950/30 p-3 text-rose-200">
          <div className="font-semibold">View Data failed to load</div>
          <div className="text-sm mt-1 whitespace-pre-wrap">{viewErr}</div>
          <div className="text-xs text-rose-300/80 mt-2">
            Tip: restart the app after fixes. If this persists, copy this message and send it to the developer.
          </div>
        </div>
      ) : null}

      <div className="grid md:grid-cols-4 gap-3">
        <div>
          <label className="text-sm text-slate-200">Wildcard Search</label>
          <input value={qAny} onChange={(e) => setQAny(e.target.value)} className="input2" placeholder="Search records" />
        </div>

        <div>
          <label className="text-sm text-slate-200">Tail No</label>
          <input value={qTail} onChange={(e) => setQTail(e.target.value)} className="input2" />
        </div>

        <div>
          <label className="text-sm text-slate-200">Engine S No</label>
          <input value={qEngine} onChange={(e) => setQEngine(e.target.value)} className="input2" />
        </div>

        <div className="flex items-end justify-end">
          <button onClick={resetFilters} className="btnMuted">
            Reset Filters
          </button>
        </div>

        <div>
          <label className="text-sm text-slate-200">Inspection Area</label>
          <select value={fArea} onChange={(e) => setFArea(e.target.value)} className="input2">
            <option value="">All</option>
            <option value="LPC">LPC</option>
            <option value="HPC">HPC</option>
            <option value="Combustion Chamber">Combustion Chamber</option>
            <option value="HPT">HPT</option>
            <option value="LPT">LPT</option>
          </select>
        </div>

        <div>
          <label className="text-sm text-slate-200">Sub Area</label>
          <select value={fSubArea} onChange={(e) => setFSubArea(e.target.value)} className="input2">
            <option value="">All</option>
            <option value="Stator">Stator</option>
            <option value="Rotor">Rotor</option>
            <option value="Flame Tube">Flame Tube</option>
            <option value="Spark Plug Body">Spark Plug Body</option>
            <option value="Fuel Nozzle">Fuel Nozzle</option>
            <option value="NGV">NGV</option>
          </select>
        </div>

        <div>
          <label className="text-sm text-slate-200">Defect Type</label>
          <select value={fDefect} onChange={(e) => setFDefect(e.target.value)} className="input2">
            <option value="">All</option>
            <option value="Nick">Nick</option>
            <option value="Dent">Dent</option>
            <option value="Indentation">Indentation</option>
            <option value="Crack">Crack</option>
            <option value="Erosion">Erosion</option>
            <option value="Burn">Burn</option>
            <option value="Piece Chipped Off">Piece Chipped Off</option>
            <option value="Tear">Tear</option>
            <option value="Cut Mark">Cut Mark</option>
            <option value="Bend">Bend</option>
            <option value="Deformation">Deformation</option>
            <option value="Bulging">Bulging</option>
          </select>
        </div>

        <div>
          <label className="text-sm text-slate-200">Disposal</label>
          <select value={fDisposal} onChange={(e) => setFDisposal(e.target.value)} className="input2">
            <option value="">All</option>
            <option value="Serviceable / No Additional Action">Serviceable / No Additional Action</option>
            <option value="Engine Rejected">Engine Rejected</option>
            <option value="Monitoring on Short Sampling">Monitoring on Short Sampling</option>
            <option value="Repair by 102 AED Team (for 1st Stage only)">Repair by 102 AED Team (for 1st Stage only)</option>
          </select>
        </div>

        <div>
          <label className="text-sm text-slate-200">Date From</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input2" />
        </div>

        <div>
          <label className="text-sm text-slate-200">Date To</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input2" />
        </div>
      </div>

      <div className="cardX overflow-hidden">
        <div className="overflow-auto">
          <div className="relative overflow-auto max-h-[70vh] max-w-full"><table className="min-w-[2200px] w-full text-sm">
            <thead className="bg-slate-800/70 text-slate-200 sticky top-0 z-20 backdrop-blur bg-slate-900/90">
              <tr>
                {showCol("no") ? <th className="text-left px-3 py-2 text-xs uppercase tracking-wider">S No</th> : null}
                {showCol("tail") ? <th className="text-left px-3 py-2 text-xs uppercase tracking-wider">Tail No</th> : null}
                {showCol("engine") ? <th className="text-left px-3 py-2 text-xs uppercase tracking-wider">Engine S No</th> : null}
                {showCol("inspectionDate") ? <th className="text-left px-3 py-2 text-xs uppercase tracking-wider">Inspection Date</th> : null}
                {showCol("engineHours") ? <th className="text-left px-3 py-2 text-xs uppercase tracking-wider">Engine Hours</th> : null}
                {showCol("inspectionType") ? <th className="text-left px-3 py-2 text-xs uppercase tracking-wider">Inspection Type</th> : null}
                {showCol("scheduled") ? <th className="text-left px-3 py-2 text-xs uppercase tracking-wider">Scheduled / Unscheduled</th> : null}
                {showCol("area") ? <th className="text-left px-3 py-2 text-xs uppercase tracking-wider">Inspection Area</th> : null}
                {showCol("subArea") ? <th className="text-left px-3 py-2 text-xs uppercase tracking-wider">Sub Area</th> : null}
                {showCol("stage") ? <th className="text-left px-3 py-2 text-xs uppercase tracking-wider">Stage</th> : null}
                {showCol("edge") ? <th className="text-left px-3 py-2 text-xs uppercase tracking-wider">Edge</th> : null}
                {showCol("zone") ? <th className="text-left px-3 py-2 text-xs uppercase tracking-wider">Zone</th> : null}
                {showCol("defectType") ? <th className="text-left px-3 py-2 text-xs uppercase tracking-wider">Defect Type</th> : null}
                {showCol("dimensions") ? <th className="text-left px-3 py-2 text-xs uppercase tracking-wider">L/W/H/Area</th> : null}
                {showCol("disposal") ? <th className="text-left px-3 py-2 text-xs uppercase tracking-wider">Disposal</th> : null}
                {showCol("tstTaf") ? <th className="text-left px-3 py-2 text-xs uppercase tracking-wider">TST/TAF</th> : null}
                {showCol("shortSampling") ? <th className="text-left px-3 py-2 text-xs uppercase tracking-wider">Short Sampling (hrs)</th> : null}
                {showCol("inspector") ? <th className="text-left px-3 py-2 text-xs uppercase tracking-wider">Inspector</th> : null}
                {showCol("inspectorPakNo") ? <th className="text-left px-3 py-2 text-xs uppercase tracking-wider">Pak No</th> : null}
                {showCol("unitSection") ? <th className="text-left px-3 py-2 text-xs uppercase tracking-wider">Unit / Section</th> : null}
                {showCol("remarks") ? <th className="text-left px-3 py-2 text-xs uppercase tracking-wider">Remarks</th> : null}
                {showCol("images") ? <th className="text-left px-3 py-2 text-xs uppercase tracking-wider">Images</th> : null}
                {showCol("docs") ? <th className="text-left px-3 py-2 text-xs uppercase tracking-wider">Docs</th> : null}
                {showCol("action") ? <th className="text-left px-3 py-2 text-xs uppercase tracking-wider">Action</th> : null}
              </tr>
            </thead>

            <tbody className="text-slate-100">
              {loading ? (
                <tr>
                  <td className="px-3 py-2 text-slate-300" colSpan={Object.values(colVis).filter(Boolean).length || 1}>
                    Loading...
                  </td>
                </tr>
              ) : filteredSorted.length === 0 ? (
                <tr>
                  <td className="px-3 py-2 text-slate-300" colSpan={Object.values(colVis).filter(Boolean).length || 1}>
                    No records found Adjust filters or clear search
                  </td>
                </tr>
              ) : (
                filteredSorted.map((r, idx) => {
                  const imgs = (() => {
                    try {
                      const a = r.imagePaths ? JSON.parse(r.imagePaths) : []
                      return Array.isArray(a) ? a : []
                    } catch {
                      return []
                    }
                  })()

                  const docs = (() => {
                    try {
                      const a = r.docPaths ? JSON.parse(r.docPaths) : []
                      return Array.isArray(a) ? a : []
                    } catch {
                      return []
                    }
                  })()

                  const isFU = !!r.isFollowUp
                  return (
                    <tr
                      key={r.id}
                      className={`border-t border-slate-800/80 hover:bg-slate-800/35 transition-colors duration-150 ${
                        isFU ? "bg-amber-500/10" : idx % 2 === 1 ? "bg-slate-900/25" : ""
                      }`}
                    >
                      {showCol("no") ? <td className="px-3 py-2">{idx + 1}</td> : null}
                      {showCol("tail") ? <td className="px-3 py-2">{r.aircraftTailNo}</td> : null}
                      {showCol("engine") ? <td className="px-3 py-2">{r.engineSN}</td> : null}
                      {showCol("inspectionDate") ? <td className="px-3 py-2">{r.inspectionDate}</td> : null}
                      {showCol("engineHours") ? <td className="px-3 py-2">{r.engineHours}</td> : null}
                      {showCol("inspectionType") ? <td className="px-3 py-2">{r.inspectionType}</td> : null}
                      {showCol("scheduled") ? <td className="px-3 py-2">{r.scheduledUnscheduled}</td> : null}
                      {showCol("area") ? <td className="px-3 py-2">{r.inspectionArea}</td> : null}
                      {showCol("subArea") ? <td className="px-3 py-2">{r.subArea}</td> : null}
                      {showCol("stage") ? <td className="px-3 py-2">{r.stageNumber}</td> : null}
                      {showCol("edge") ? <td className="px-3 py-2">{r.edge}</td> : null}
                      {showCol("zone") ? <td className="px-3 py-2">{r.zone}</td> : null}
                      {showCol("defectType") ? <td className="px-3 py-2">{r.defectType}</td> : null}

                      {showCol("dimensions") ? (
                        <td className="px-3 py-2">
                          <span className="text-slate-200">
                            L:{r.length || "—"} W:{r.width || "—"} H:{r.height || "—"} A:{r.area || "—"}
                          </span>
                        </td>
                      ) : null}

                      {showCol("disposal") ? <td className="px-3 py-2">{r.disposal}</td> : null}

                      {showCol("tstTaf") ? (
                        <td className="px-3 py-2">
                          {r.tstTafEnabled ? (
                            <span className="px-2 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-xs text-emerald-200" title={r.tstTafNumber || ""}>
                              {r.tstTafNumber ? prettyFileId(r.tstTafNumber) : "TST/TAF"}
                            </span>
                          ) : (
                            ""
                          )}
                        </td>
                      ) : null}

                      {showCol("shortSampling") ? <td className="px-3 py-2">{r.shortSamplingHours}</td> : null}
                      {showCol("inspector") ? <td className="px-3 py-2">{r.inspectorName}</td> : null}
                      {showCol("inspectorPakNo") ? <td className="px-3 py-2">{r.inspectorId}</td> : null}
                      {showCol("unitSection") ? <td className="px-3 py-2">{r.unitSection}</td> : null}
                      {showCol("remarks") ? <td className="px-3 py-2">{r.remarks}</td> : null}

                      {showCol("images") ? (
                        <td className="px-3 py-2">
                          {imgs.length ? (
                            <div className="flex items-center gap-2">
                              {imgs.slice(0, 6).map((p, i) => (
                                <Thumb
                                  key={i}
                                  filePath={p}
                                  ensureThumb={async (fp) => {
                                    if (!fp) return null
                                    return await window.bsi.getImageDataUrl(fp)
                                  }}
                                  onClick={async () => {
                                    const url = await window.bsi.getImageDataUrl(p)
                                    if (url) {
                                      setImgSrc(url)
                                      setImgOpen(true)
                                    }
                                  }}
                                />
                              ))}
                              {imgs.length > 6 ? <span className="text-xs text-slate-300">+{imgs.length - 6}</span> : null}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      ) : null}

                      {showCol("docs") ? (
                        <td className="px-3 py-2">
                          {docs.length ? (
                            <div className="flex flex-wrap gap-2">
                              {docs.slice(0, 3).map((p, i) => {
                                const name = fileBasename(p)
                                const ext = (name.split(".").pop() || "").toLowerCase()
                                const badge =
                                  ext === "pdf"
                                    ? "PDF"
                                    : ext === "doc" || ext === "docx"
                                      ? "DOC"
                                      : ext === "xls" || ext === "xlsx"
                                        ? "XLS"
                                        : ext
                                          ? ext.toUpperCase()
                                          : ""
                                return (
                                  <button
                                    key={i}
                                    onClick={() => window.bsi.openFile(p)}
                                    className="inline-flex items-center gap-2 px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 hover:border-sky-400 text-xs"
                                    title={name}
                                  >
                                    <span className="opacity-80">📎</span>
                                    <span className="max-w-[220px] truncate">{name}</span>
                                    {badge ? (
                                      <span className="ml-1 px-1.5 py-0.5 rounded-md bg-slate-900/60 border border-slate-700 text-[10px] tracking-wide">
                                        {badge}
                                      </span>
                                    ) : null}
                                  </button>
                                )
                              })}
                              {docs.length > 3 ? <span className="text-xs text-slate-300">+{docs.length - 3}</span> : null}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      ) : null}

                      {showCol("action") ? (
                        <td className="px-3 py-2">
                          <button
                            onClick={() => {
                              setDelRecord(r)
                              setDelOpen(true)
                            }}
                            className="btnWarn"
                          >
                            Delete
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table></div>
        </div>
      </div>

      <DeleteModal open={delOpen} record={delRecord} onClose={() => setDelOpen(false)} onDeleted={load} />
      <ImageViewer open={imgOpen} src={imgSrc} onClose={() => setImgOpen(false)} />

      <style>{commonStyles}</style>
    </div>
  )
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    // keep in console for debugging
    console.error("UI crashed:", error, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4">
          <div className="text-lg font-semibold text-rose-200">Something went wrong</div>
          <div className="text-sm text-rose-100/90 mt-1 break-words">
            {this.state.error?.message || String(this.state.error)}
          </div>
          <div className="flex gap-2 mt-3">
            <button
              className="px-3 py-2 rounded-lg border border-rose-500/40 bg-rose-500/20 hover:bg-rose-500/25"
              onClick={() => {
                this.setState({ hasError: false, error: null })
                this.props.onReset?.()
              }}
            >
              Back to Home
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  const [tab, setTab] = useState("home")
  const [adminPrefill, setAdminPrefill] = useState(null)

  const [pwOpen, setPwOpen] = useState(false)

  const [backupInfo, setBackupInfo] = useState({ lastBackupAt: "", lastBackupFile: "", daysSince: null })

  const refreshBackupInfo = async () => {
    try {
      if (typeof window?.bsi?.getLastBackupInfo !== "function") return
      const info = await window.bsi.getLastBackupInfo()
      if (info) setBackupInfo(info)
    } catch {}
  }

  useEffect(() => {
    refreshBackupInfo()
  }, [])

  const [loginOpen, setLoginOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loginTarget, setLoginTarget] = useState("admin")

  // Lock Admin again when user leaves Admin tab
  useEffect(() => {
    if (tab !== "admin" && isAdmin) setIsAdmin(false)
  }, [tab])

  
  // Reset View Data filters (excluding Column Selection) when leaving View Data
  useEffect(() => {
    if (tab !== "view" && viewPreset) setViewPreset(null)
  }, [tab])
// presets for view
  const [viewPreset, setViewPreset] = useState(null)

  // Column visibility persisted across View Data visits
  const DEFAULT_COL_VIS = {
    no: true,
    tail: true,
    engine: true,
    inspectionDate: true,
    engineHours: true,
    inspectionType: true,
    scheduled: true,
    area: true,
    subArea: true,
    stage: true,
    edge: true,
    zone: true,
    defectType: true,
    dimensions: true,
    disposal: true,
    tstTaf: true,
    shortSampling: true,
    inspector: true,
    inspectorPakNo: true,
    unitSection: true,
    remarks: true,
    techRemarks: false,
    images: true,
    docs: true,
    followUp: false,
  }
  const [viewColVis, setViewColVis] = useState(DEFAULT_COL_VIS)
  const [presetVersion, setPresetVersion] = useState(1)

  const goViewWithPreset = (preset) => {
    setPresetVersion((v) => v + 1)
    setViewPreset({ ...(preset || {}), version: presetVersion + 1 })
    setTab("view")
  }

  return (
    <div className="min-h-screen bg-[#0B1220] text-white">
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 shadow-[0_2px_12px_rgba(0,0,0,0.35)] headerFadeIn">
        <div className="max-w-7xl mx-auto px-3 py-4">
          <BrandHeader />

          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => setTab("home")} className={tabBtn(tab === "home")}>
              Home
            </button>
            <button onClick={() => setTab("summary")} className={tabBtn(tab === "summary")}>
              Summary
            </button>
            <button onClick={() => setTab("entry")} className={tabBtn(tab === "entry")}>
              Data Entry
            </button>
            <button onClick={() => setTab("view")} className={tabBtn(tab === "view")}>
              View Data
            </button>

            <button
              onClick={() => {
                // Always require password when entering Admin
                if (tab !== "admin") {
                  setLoginTarget("admin")
                  setLoginOpen(true)
                }
              }}
              className={tabBtn(tab === "admin")}
            >
              Admin
            </button>

<button
  onClick={() => {
    if (tab !== "transfer") setTab("transfer")
  }}
  className={tabBtn(tab === "transfer")}
>
  Data Transfer
</button>

          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 py-6">
        {tab === "home" ? (
          <Home
            onGoEntry={() => setTab("entry")}
            onGoView={() => setTab("view")}
            onGoSummary={() => setTab("summary")}
            onOpenLogin={() => {
              setLoginTarget("admin")
              setLoginOpen(true)
            }}
            onChangePasswordClick={() => setPwOpen(true)}
          backupInfo={backupInfo}
            onBackupNow={() => {
              setLoginTarget("admin")
              setLoginOpen(true)
            }}
          />
) : null}

        {tab === "summary" ? <SummaryDashboard onGoViewWithPreset={goViewWithPreset} /> : null}

        {tab === "entry" ? <BsiForm /> : null}

        {tab === "view" ? (
          <ErrorBoundary onReset={() => setTab("home")}>
            <ViewData onGoEntry={() => setTab("entry")} preset={viewPreset} colVis={viewColVis} setColVis={setViewColVis} />
          </ErrorBoundary>
        ) : null}

        {tab === "admin" ? (
          <ErrorBoundary onReset={() => setTab("home")}>
            {isAdmin ? (
              <AdminPanel prefillAttach={adminPrefill} clearPrefill={() => setAdminPrefill(null)} onExit={() => setTab("home")} />
            ) : (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
                <div className="text-lg font-semibold">Admin Access</div>
                <div className="mt-1 text-slate-300">
                  Authorized users only. Please enter the Admin password to continue.
                </div>
                <div className="mt-4 flex gap-2">
                  <button className="px-4 py-2 rounded bg-slate-200 text-slate-900 hover:bg-white" onClick={() => setLoginOpen(true)}>
                    Admin Login
                  </button>
                  <button className="px-4 py-2 rounded border border-slate-700 hover:bg-slate-800" onClick={() => setTab("home")}>
                    Back to Home
                  </button>
                </div>
              </div>
            )}
          </ErrorBoundary>

        ) : null}

        {tab === "transfer" ? (
  <ErrorBoundary onReset={() => setTab("home")}>
    <DataTransferPanel onPrefillAttach={(pair) => {
            setTab("admin")
            setAdminPrefill(pair)
          }} />
  </ErrorBoundary>
) : null}

      </div>

      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />

      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onLoggedIn={() => {
          if (loginTarget === "admin") {
            setIsAdmin(true)
            setTab("admin")
          }
        }}
      />

      <style>{commonStyles}</style>
    </div>
  )
}


function PasswordActionModal({ open, title, helper, onClose, onConfirm }) {
  const [password, setPassword] = useState("")
  const [msg, setMsg] = useState("")
  const [busy, setBusy] = useState(false)
  const pwRef = useRef(null)

  useEffect(() => {
    if (!open) {
      setPassword("")
      setMsg("")
      setBusy(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => pwRef.current?.focus?.(), 50)
    return () => clearTimeout(t)
  }, [open])

  if (!open) return null

  const submit = async () => {
    setMsg("")
    if (!password) return setMsg("Password is required")

    setBusy(true)
    try {
      const ok = await window.bsi.verifyPassword(password)
      if (!ok) return setMsg("Incorrect Password Try again")
      await onConfirm(password)
      onClose()
    } catch (e) {
      setMsg(cleanIpcMessage(e) || "Operation failed Please try again")
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell title={title || "Confirm"} onClose={onClose}>
      {helper ? <div className="text-sm text-slate-300 mb-3">{helper}</div> : null}

      <label className="block text-sm text-slate-200 mb-1">Password</label>
      <input
        className="input2"
        ref={pwRef}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            submit()
          }
        }}
        type="password"
      />

      {msg ? <div className="text-sm text-red-300 mt-2">{msg}</div> : null}

      <div className="mt-4 flex justify-end gap-2">
        <button className="btnMuted" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button className="btnPrimary" onClick={submit} disabled={busy}>
          Proceed
        </button>
      </div>
    </ModalShell>
  )
}


function DataTransferPanel({ onPrefillAttach }) {
  const [engines, setEngines] = useState([])
  const [engineSN, setEngineSN] = useState("")
  const [selectedEngines, setSelectedEngines] = useState([])
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState("")
  const [pwOpen, setPwOpen] = useState(false)
  const [pwMode, setPwMode] = useState("export") // export | import
  const [importHint, setImportHint] = useState(null)

  const load = async () => {
    try {
      const e = await window.bsi.listEngines()
      setEngines(Array.isArray(e) ? e : [])
    } catch {
      setEngines([])
    }
  }

  useEffect(() => {
    load()
  }, [])

  const doExport = async (password) => {
    const enginesToExport =
      Array.isArray(selectedEngines) && selectedEngines.length > 0
        ? selectedEngines
        : engineSN
          ? [engineSN]
          : []
    if (enginesToExport.length === 0) throw new Error("Engine S No is required")
    setBusy(true)
    try {
      const res = await window.bsi.exportEnginePackage({ password, engines: enginesToExport, dateFrom, dateTo })
      if (res?.canceled) return
      if (res?.ok) setResult(`Export completed`)
      else setResult(`Export failed`)
    } finally {
      setBusy(false)
    }
  }

  const doImport = async (password) => {
    setBusy(true)
    try {
      const res = await window.bsi.importTailPackage({ password })
      if (res?.canceled) return
      if (res?.ok) {
        const imported = res?.imported ?? 0
        const skipped = res?.skipped ?? 0
        setResult(`Import completed Imported ${imported} Skipped ${skipped}`)
        const miss = Array.isArray(res?.missingPairs) ? res.missingPairs : []
        setImportHint(miss)
        // Refresh engines in case new engines were imported
        load()
      } else setResult(`Import failed`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="cardX">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xl font-semibold">Data Transfer</div>
          <div className="text-sm text-slate-300 mt-1">Import / Export Engine data between Bases</div>
        </div>
      </div>

      <div className="mt-4 grid md:grid-cols-2 gap-4">
        <div className="cardInner">
          <div className="text-base font-semibold">Export Engine Data</div>
          <div className="mt-3">
            <label className="block text-sm text-slate-200 mb-1">Engine S No (Select single or multiple engines)</label>
            <select
              className="input2"
              multiple
              value={selectedEngines}
              onChange={(e) => {
                const opts = Array.from(e.target.selectedOptions || []).map((o) => o.value)
                setSelectedEngines(opts)
                setEngineSN(opts.length === 1 ? opts[0] : "")
              }}
            >
              {engines.map((e) => (
                <option key={e.engineSN} value={e.engineSN}>
                  {e.engineSN}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-200 mb-1">From</label>
              <input className="input2" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm text-slate-200 mb-1">To</label>
              <input className="input2" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              className="btnPrimary"
              disabled={busy}
              onClick={() => {
                setPwMode("export")
                setPwOpen(true)
              }}
            >
              Export
            </button>

            <button
              className="btnWarn"
              disabled={busy}
              onClick={() => {
                setSelectedEngines([])
                setEngineSN("")
                setDateFrom("")
                setDateTo("")
                setResult("")
              }}
            >
              Reset
            </button>
          </div>
        </div>

        <div className="cardInner">
          <div className="text-base font-semibold">Import Data</div>
          <div className="text-sm text-slate-300 mt-2">
            Import BDAS package received from another base. Imported records will be merged into your database.
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              className="btnPrimary"
              disabled={busy}
              onClick={() => {
                setPwMode("import")
                setPwOpen(true)
              }}
            >
              Import
            </button>
</div>
        </div>
      </div>

      {result ? <div className="mt-4 text-sm text-slate-200">{result}</div> : null}

      <PasswordActionModal
        open={pwOpen}
        title={pwMode === "export" ? "Export Engine Data" : "Import Engine Data"}
        helper={pwMode === "export" ? "Enter Admin Password to export engine data" : "Enter Admin Password to import engine data"}
        onClose={() => setPwOpen(false)}
        onConfirm={(password) => (pwMode === "export" ? doExport(password) : doImport(password))}
      />

      {importHint && importHint.length ? (
        <div className="mt-4 border border-slate-700 rounded-xl p-3 bg-slate-900/50">
          <div className="text-sm font-semibold text-slate-100">Action Required</div>
          <div className="text-sm text-slate-200 mt-1">
            Imported records are linked to the following aircraft/engine pairs and will become visible after you add and attach them in Admin.
          </div>
          <div className="mt-2 space-y-1">
            {importHint.map((p, i) => (
              <div key={`${p.tailNo || ""}-${p.engineSN || ""}-${i}`} className="text-sm text-slate-200">
                Tail No {p.tailNo} &nbsp;&nbsp; Engine S No {p.engineSN}
              </div>
            ))}
          </div>
          <div className="mt-3">
            <button
              className="btnPrimary"
              onClick={() => {
                const first = importHint && importHint.length ? importHint[0] : null
                if (first && onPrefillAttach) onPrefillAttach(first)
              }}
            >
              Go to Admin
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}


function tabBtn(active) {
  return `px-4 py-2 rounded-lg border transition ${
    active
      ? "bg-emerald-500 text-black border-emerald-400"
      : "bg-slate-800/60 text-white border-slate-700 hover:bg-slate-800 hover:border-sky-400/50"
  }`
}

const commonStyles = `
  .cardX{
    border-radius: 16px;
    border: 1px solid rgba(30,42,69,0.9);
    background: linear-gradient(180deg, rgba(17,26,46,0.78), rgba(11,18,32,0.78));
    padding: 16px;
  }
  .cardTitle{
    font-weight: 700;
    color: #e2e8f0;
  }
  .input2{
    width: 100%;
    margin-top: 6px;
    padding: 12px 12px;
    transition: border-color 150ms ease, box-shadow 150ms ease;
    border-radius: 14px;
    background: rgba(30,41,59,0.72);
    border: 1px solid rgba(71,85,105,0.9);
    color: #e2e8f0;
    outline: none;
  }
  .input2:focus{
    box-shadow: 0 0 0 2px rgba(56,189,248,0.30);
    border-color: rgba(56,189,248,0.6);
  }
  .btnPrimary{
    min-height: 40px;
    transition: filter 150ms ease, background 150ms ease, border-color 150ms ease;
    padding: 10px 14px;
    border-radius: 14px;
    background: linear-gradient(180deg, rgba(16,185,129,0.95), rgba(5,150,105,0.95));
    color: #06121c;
    font-weight: 800;
    border: 1px solid rgba(16,185,129,0.55);
  }
  .btnPrimary:hover{ filter: brightness(1.05); }
  .btnMuted{
    min-height: 40px;
    transition: border-color 150ms ease, background 150ms ease;
    padding: 10px 14px;
    border-radius: 14px;
    background: rgba(30,41,59,0.7);
    color: #fff;
    border: 1px solid rgba(71,85,105,0.9);
  }
  .btnMuted:hover{ border-color: rgba(56,189,248,0.45); }
  .btnWarn{
    min-height: 40px;
    transition: background 150ms ease, border-color 150ms ease;
    padding: 10px 14px;
    border-radius: 12px;
    background: rgba(245,158,11,0.16);
    color: #fde68a;
    border: 1px solid rgba(245,158,11,0.45);
    font-weight: 700;
  }
  .btnWarn:hover{ background: rgba(245,158,11,0.22); }
`
