import React, { useEffect, useMemo, useRef, useState } from "react"
import { prettyFileId } from "./lib/utils.js"

function toYmd(d) {
  if (!d) return ""
  const s = String(d)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const dt = new Date(s)
  if (isNaN(dt.getTime())) return ""
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, "0")
  const day = String(dt.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function uniq(arr) {
  return Array.from(new Set((arr || []).filter(Boolean)))
}

function byIdAsc(a, b) {
  return (a?.id || 0) - (b?.id || 0)
}

function Card({ title, subtitle, children, className = "" }) {
  return (
    <div className={`bg-brand-card/60 border border-brand-border rounded-2xl p-4 ${className}`.trim()}>
      <div className="text-slate-200 font-semibold">{title}</div>
      {subtitle ? <div className="text-xs text-slate-400 mt-0.5">{subtitle}</div> : null}
      <div className="mt-3">{children}</div>
    </div>
  )
}

function PrimaryBtn({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-brand-secondary text-black font-semibold"
    >
      {children}
    </button>
  )
}

function GhostBtn({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-4 py-2 rounded-lg bg-slate-800/70 hover:bg-slate-800 text-white border border-brand-border"
    >
      {children}
    </button>
  )
}

export default function SummaryDashboard({ onGoViewWithPreset }) {
  const [rows, setRows] = useState([])
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(false)

  // Drill-down controls (optional)
  const [enginePick, setEnginePick] = useState("")
  const [tailPick, setTailPick] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")

  // UI state
  const [showEngineTailPanel, setShowEngineTailPanel] = useState(false)
  const engineTailRef = useRef(null)

  const [showShortSamplingPanel, setShowShortSamplingPanel] = useState(false)
  const shortSamplingRef = useRef(null)

  // View More / View Less (limit visible entries; keep existing layout and click behavior)
  const INITIAL_MED = 4
  const [moreEnginesDefects, setMoreEnginesDefects] = useState(false)
  const [moreShortSampling, setMoreShortSampling] = useState(false)
  const [moreTstTaf, setMoreTstTaf] = useState(false)
  const [moreRecentDefects, setMoreRecentDefects] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const api = window?.bsi
      const [data, a] = await Promise.all([
        api?.listRecords?.(5000),
        api?.listAssignments?.().catch?.(() => []) ?? [],
      ])
      const arr = Array.isArray(data) ? data : []
      arr.sort(byIdAsc)
      setRows(arr)
      setAssignments(Array.isArray(a) ? a : [])
    } catch (e) {
      setRows([])
      setAssignments([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const go = (preset = {}) => {
    onGoViewWithPreset?.({
      qAny: preset.qAny || "",
      qTail: preset.qTail || "",
      qEngine: preset.qEngine || "",
      tstTafNumber: preset.tstTafNumber || "",
      fArea: preset.fArea || "",
      fDefect: preset.fDefect || "",
      fDisposal: preset.fDisposal || "",
      dateFrom: preset.dateFrom || "",
      dateTo: preset.dateTo || "",
      recordId: preset.recordId ?? null,
      version: Date.now(),
    })
  }

  // ===== Global KPI values (independent of drill-down selection) =====
  const basics = useMemo(() => {
    const totalRecords = rows.length
    const engines = uniq(rows.map((r) => (r.engineSN || "").trim()))
    const uniqueEngines = engines.length

    // Latest record per engine (global)
    const latestByEngine = new Map()
    for (const r of rows) {
      const key = (r.engineSN || "").trim()
      if (!key) continue
      const prev = latestByEngine.get(key)
      if (!prev) {
        latestByEngine.set(key, r)
        continue
      }
      const da = toYmd(prev.inspectionDate || prev.createdAt) || ""
      const db = toYmd(r.inspectionDate || r.createdAt) || ""
      const better = db > da ? r : db < da ? prev : (r.id || 0) > (prev.id || 0) ? r : prev
      latestByEngine.set(key, better)
    }

    const latestByEngineArr = Array.from(latestByEngine.values()).sort((a, b) =>
      String(a.engineSN || "").localeCompare(String(b.engineSN || ""))
    )

    const enginesOnShortSampling = Array.from(latestByEngine.values()).filter(
      (r) => r.disposal === "Monitoring on Short Sampling"
    )

    return {
      totalRecords,
      uniqueEngines,
      latestByEngineArr,
      enginesOnShortSamplingCount: enginesOnShortSampling.length,
    }
  }, [rows])

  // ===== Scoped rows (drill-down selection affects everything except KPIs) =====
  const scopedRows = useMemo(() => {
    let out = rows
    const eng = (enginePick || "").trim()
    const tail = (tailPick || "").trim()
    const from = toYmd(fromDate)
    const to = toYmd(toDate)

    if (eng) out = out.filter((r) => String(r.engineSN || "").trim() === eng)
    if (tail) out = out.filter((r) => String(r.aircraftTailNo || "").trim() === tail)

    if (from || to) {
      out = out.filter((r) => {
        const d = toYmd(r.inspectionDate || r.createdAt)
        if (!d) return false
        if (from && d < from) return false
        if (to && d > to) return false
        return true
      })
    }
    return out
  }, [rows, enginePick, tailPick, fromDate, toDate])

  
  const tailToEngine = useMemo(() => {
    const map = new Map()
    const arr = Array.isArray(assignments) ? assignments : []
    for (const a of arr) {
      if (!a) continue
      if (a.detachedAt) continue
      const tail = String(a.tailNo || "").trim()
      const eng = String(a.engineSN || "").trim()
      if (!tail || !eng) continue
      map.set(tail, eng)
    }
    return map
  }, [assignments])

  useEffect(() => {
    // Lock Engine S No to active assignment for selected Tail No
    if (!tailPick) {
      setEnginePick("")
      return
    }
    const eng = tailToEngine.get(tailPick) || ""
    setEnginePick(eng)
  }, [tailPick, tailToEngine])
const engineOptions = useMemo(() => {
    const list = uniq(rows.map((r) => (r.engineSN || "").trim()))
    list.sort((a, b) => String(a).localeCompare(String(b)))
    return list
  }, [rows])

  const tailOptions = useMemo(() => {
    const list = uniq(rows.map((r) => (r.aircraftTailNo || "").trim()))
    list.sort((a, b) => String(a).localeCompare(String(b)))
    return list
  }, [rows])

  // ===== Scoped operational list: Engines on Short Sampling (may have multiple areas/frequencies) =====
  const scopedShortSampling = useMemo(() => {
    const byEngine = new Map()
    for (const r of scopedRows) {
      if (r.disposal !== "Monitoring on Short Sampling") continue
      const engineSN = (r.engineSN || "").trim()
      if (!engineSN) continue

      const area = [r.inspectionArea, r.subArea].filter(Boolean).join(" / ") || "—"
      const defectType = String(r.defectType || "").trim() || "—"
      const freq = String(r.shortSamplingHours || "").trim()
      const date = toYmd(r.inspectionDate || r.createdAt) || ""
      const tailNo = (r.aircraftTailNo || "").trim()
      const key = `${area}__${freq}__${defectType}`

      const arr = byEngine.get(engineSN) || []
      if (!arr.some((x) => x.key === key)) arr.push({ key, area, freq, defectType, date, tailNo })
      byEngine.set(engineSN, arr)
    }

    const cards = []
    for (const [engineSN, items] of byEngine.entries()) {
      const sorted = [...items].sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      cards.push({ engineSN, tailNo: sorted[0]?.tailNo || "", items: sorted })
    }
    cards.sort((a, b) => String(a.engineSN).localeCompare(String(b.engineSN)))
    return cards
  }, [scopedRows])

  // ===== Scoped operational list: TST / TAF grouped by number (latest to earliest) =====
  const scopedTstTafGroups = useMemo(() => {
    const groups = new Map()
    for (const r of scopedRows) {
      const enabled = Number(r.tstTafEnabled) === 1
      const num = String(r.tstTafNumber || "").trim()
      if (!enabled && !num) continue
      const key = num || "(No Number)"
      const arr = groups.get(key) || []
      arr.push(r)
      groups.set(key, arr)
    }

    const out = []
    for (const [tstTafNumber, arr] of groups.entries()) {
      const items = [...arr].sort((a, b) => {
        const da = toYmd(a.inspectionDate || a.createdAt) || ""
        const db = toYmd(b.inspectionDate || b.createdAt) || ""
        if (db !== da) return db.localeCompare(da)
        return (b.id || 0) - (a.id || 0)
      })

      const latest = items[0]
      const latestDate = toYmd(latest?.inspectionDate || latest?.createdAt) || ""
      const engines = uniq(items.map((x) => (x.engineSN || "").trim()))
      const tails = uniq(items.map((x) => (x.aircraftTailNo || "").trim()))

      out.push({ tstTafNumber, latestDate, engines, tails, items })
    }

    out.sort((a, b) => (b.latestDate || "").localeCompare(a.latestDate || ""))
    return out
  }, [scopedRows])

  // ===== Scoped counts =====
  const scopedCounts = useMemo(() => {
    const count = (key) => {
      const m = new Map()
      for (const r of scopedRows) {
        const v = String(r[key] || "").trim()
        if (!v) continue
        m.set(v, (m.get(v) || 0) + 1)
      }
      const arr = Array.from(m.entries()).map(([name, c]) => ({ name, c }))
      arr.sort((a, b) => b.c - a.c || a.name.localeCompare(b.name))
      return arr.slice(0, 10)
    }

    return {
      defectType: count("defectType"),
      disposal: count("disposal"),
    }
  }, [scopedRows])

  // ===== Scoped recent defects (latest 10) =====
  const scopedRecentDefects = useMemo(() => {
    const arr = [...scopedRows]
    arr.sort((a, b) => {
      const da = toYmd(a.inspectionDate || a.createdAt) || ""
      const db = toYmd(b.inspectionDate || b.createdAt) || ""
      if (db !== da) return db.localeCompare(da)
      return (b.id || 0) - (a.id || 0)
    })
    return arr.slice(0, 10)
  }, [scopedRows])

  const resetDrilldown = () => {
    setEnginePick("")
    setTailPick("")
    setFromDate("")
    setToDate("")
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <div className="text-2xl font-bold text-emerald-400">Summary Dashboard</div>
</div>

        <div className="flex gap-2">
          <GhostBtn onClick={load}>{loading ? "Refreshing..." : "Refresh Data"}</GhostBtn>
          <PrimaryBtn onClick={() => go({})}>Open All Records</PrimaryBtn>
        </div>
      </div>

      {/* KPI cards (global totals) */}
      <div className="grid md:grid-cols-3 gap-3">
        <div className="bg-brand-card/60 border border-brand-border rounded-2xl p-4">
          <div className="text-xs text-slate-400">Total Defects (All Engines)</div>
          <div className="text-3xl font-extrabold text-slate-100 mt-1">{basics.totalRecords}</div>
        </div>

        <button
          type="button"
          onClick={() => {
            const next = !showEngineTailPanel
            setShowEngineTailPanel(next)
            if (next) {
              setTimeout(() => engineTailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60)
            }
          }}
          className="text-left bg-brand-card/60 border border-brand-border rounded-2xl p-4 hover:bg-slate-900/80 transition"
          title="Show engines and tails"
        >
          <div className="text-xs text-slate-400">Total Engines with Defects</div>
          <div className="text-3xl font-extrabold text-slate-100 mt-1">{basics.uniqueEngines}</div>
          <div className="text-xs text-slate-500 mt-1">
            {showEngineTailPanel ? "Click to collapse" : "Click to view engines & tails"}
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            const next = !showShortSamplingPanel
            setShowShortSamplingPanel(next)
            if (next) {
              setTimeout(() => shortSamplingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60)
            }
          }}
          className="text-left bg-brand-card/60 border border-brand-border rounded-2xl p-4 hover:bg-slate-900/80 transition"
          title="Show engines on short sampling"
        >
          <div className="text-xs text-slate-400">Engines on Short Sampling</div>
          <div className="text-3xl font-extrabold text-brand-primary mt-1">{basics.enginesOnShortSamplingCount}</div>
          <div className="text-xs text-slate-500 mt-1">
            {showShortSamplingPanel ? "Click to collapse" : "Click to view details"}
          </div>
        </button>
      </div>

      {/* Engines & tails panel (toggle from KPI) */}
      {showEngineTailPanel ? (
        <div ref={engineTailRef} className="bg-slate-900/50 border border-brand-border rounded-2xl p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-slate-100 font-semibold">Engines with Defects</div>
              <div className="text-xs text-slate-400">
                Click an engine to open its records.
              </div>
            </div>
            <GhostBtn onClick={() => setShowEngineTailPanel(false)}>Close</GhostBtn>
          </div>

          <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {(moreEnginesDefects ? basics.latestByEngineArr : basics.latestByEngineArr.slice(0, INITIAL_MED)).map((r) => (
              <button
                key={`${r.engineSN || ""}-${r.id || 0}`}
                onClick={() => go({ qEngine: r.engineSN })}
                className="text-left px-3 py-2 rounded-xl bg-slate-800/60 border border-brand-border hover:bg-slate-800 transition"
              >
                <div className="text-slate-100 font-semibold">{r.engineSN || "—"}</div>
                <div className="text-xs text-slate-300 mt-1">
                  Tail No: <span className="text-slate-100">{r.aircraftTailNo || "—"}</span>
                </div>
              </button>
            ))}
          </div>

          {basics.latestByEngineArr.length > INITIAL_MED ? (
            <div className="mt-3 flex justify-end">
              <GhostBtn onClick={() => setMoreEnginesDefects((p) => !p)}>
                {moreEnginesDefects ? "View Less" : "View More"}
              </GhostBtn>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Short sampling details panel (toggle from KPI) */}
      {showShortSamplingPanel ? (
        <div ref={shortSamplingRef} className="bg-brand-card/60 border border-brand-border rounded-2xl p-4 mt-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-slate-100 font-semibold">Engines on Short Sampling</div>
              <div className="text-xs text-slate-400 mt-0.5">
                Click an engine to open its records.
              </div>
            </div>
            <GhostBtn onClick={() => setShowShortSamplingPanel(false)}>Close</GhostBtn>
          </div>

          {loading ? (
            <div className="text-slate-300 mt-3">Loading...</div>
          ) : scopedShortSampling.length === 0 ? (
            <div className="text-slate-400 mt-3">No engines on short sampling for the current selection.</div>
          ) : (
            <div>
              <div className="grid sm:grid-cols-2 gap-2 mt-3">
                {(moreShortSampling ? scopedShortSampling : scopedShortSampling.slice(0, INITIAL_MED)).map((x) => (
                <button
                  key={x.engineSN}
                  onClick={() => go({ qEngine: x.engineSN })}
                  className="text-left p-3 rounded-2xl bg-slate-800/50 border border-brand-border hover:bg-slate-800 transition"
                >
                  <div className="text-slate-100 font-semibold text-lg">{x.engineSN}</div>
                  <div className="text-sm text-slate-300 mt-1">
                    Tail No: <span className="text-slate-100">{x.tailNo || "—"}</span>
                  </div>

                  <div className="mt-2 space-y-2">
                    {x.items.map((it) => (
                      <div key={it.key} className="text-xs text-slate-300">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">{it.area}</span>
                          <span className="text-brand-primary whitespace-nowrap">{it.freq ? `${it.freq} hrs` : "—"}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          Defect: <span className="text-slate-200">{it.defectType || "—"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </button>
                ))}
              </div>

              {scopedShortSampling.length > INITIAL_MED ? (
                <div className="mt-3 flex justify-end">
                  <GhostBtn onClick={() => setMoreShortSampling((p) => !p)}>
                    {moreShortSampling ? "View Less" : "View More"}
                  </GhostBtn>
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}


      {/* Main 3-column section */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card
          title="Filter Summary Data"
        >
          <div className="grid gap-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-slate-300">Engine S No</label>
                <select
                  value={enginePick}
                  disabled
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-brand-card/60 border border-brand-border text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">All</option>
                  {engineOptions.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm text-slate-300">Tail No</label>
                <select
                  value={tailPick}
                  onChange={(e) => setTailPick(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-brand-card/60 border border-brand-border text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">All</option>
                  {tailOptions.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-slate-300">From</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-brand-card/60 border border-brand-border text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-sm text-slate-300">To</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-brand-card/60 border border-brand-border text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <PrimaryBtn onClick={() => go({ qEngine: enginePick, qTail: tailPick, dateFrom: fromDate, dateTo: toDate })}>
                Open Filtered
              </PrimaryBtn>
              <GhostBtn onClick={resetDrilldown}>Reset</GhostBtn>
            </div>
          </div>
        </Card>

        <Card
          title="Engines on Short Sampling"
        >
          {loading ? (
            <div className="text-slate-300">Loading...</div>
          ) : scopedShortSampling.length === 0 ? (
            <div className="text-slate-400">No engines on short sampling for the current selection.</div>
          ) : (
            <div>
              <div className="grid sm:grid-cols-2 gap-2">
                {(moreShortSampling ? scopedShortSampling : scopedShortSampling.slice(0, INITIAL_MED)).map((x) => (
                <button
                  key={x.engineSN}
                  onClick={() => go({ qEngine: x.engineSN })}
                  className="text-left p-3 rounded-2xl bg-slate-800/50 border border-brand-border hover:bg-slate-800 transition"
                >
                  <div className="text-slate-100 font-semibold text-lg">{x.engineSN}</div>
                  <div className="text-sm text-slate-300 mt-1">
                    Tail No: <span className="text-slate-100">{x.tailNo || "—"}</span>
                  </div>

                  <div className="mt-2 space-y-1">
                    {x.items.map((it) => (
                      <div key={it.key} className="space-y-0.5">
                        <div className="text-xs text-slate-300 flex items-center justify-between gap-2">
                          <span className="truncate">{it.area}</span>
                          <span className="text-brand-primary whitespace-nowrap">{it.freq ? `${it.freq} hrs` : "—"}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          Defect: <span className="text-slate-200">{it.defectType || "—"}</span>
                        </div>
                      </div>
                    ))}</div>
                </button>
              ))}
              </div>

              {scopedShortSampling.length > INITIAL_MED ? (
                <div className="mt-3 flex justify-end">
                  <GhostBtn onClick={() => setMoreShortSampling((p) => !p)}>
                    {moreShortSampling ? "View Less" : "View More"}
                  </GhostBtn>
                </div>
              ) : null}
            </div>
          )}
        </Card>

        <Card title="TST / TAF">
          {loading ? (
            <div className="text-slate-300">Loading...</div>
          ) : scopedTstTafGroups.length === 0 ? (
            <div className="text-slate-400">No TST / TAF cases for the current selection.</div>
          ) : (
            <div>
              <div className="space-y-2">
                {(moreTstTaf ? scopedTstTafGroups : scopedTstTafGroups.slice(0, INITIAL_MED)).map((g) => {
                const primaryEngine = g.engines[0] || String(g.items[0]?.engineSN || "")
                const tailNo = g.tails.join(", ") || String(g.items[0]?.aircraftTailNo || "")
                return (
                  <button
                    key={g.tstTafNumber}
                    onClick={() => go({ tstTafNumber: g.tstTafNumber })}
                    className="w-full text-left p-3 rounded-2xl bg-slate-800/50 border border-brand-border hover:bg-slate-800 transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-slate-100 font-semibold text-lg">{primaryEngine || "—"}</div>
                        <div className="text-sm text-slate-300 mt-1">
                          Tail No: <span className="text-slate-100">{tailNo || "—"}</span>
                        </div>
                        <div className="text-sm text-slate-300 mt-1">
                          TST / TAF No: <span className="text-slate-100">{prettyFileId(g.tstTafNumber) || "—"}</span>
                        </div>
                      </div>
                      <div className="text-xs text-slate-400 whitespace-nowrap">{g.latestDate || ""}</div>
                    </div>

                    <div className="mt-2 space-y-1">
                      {g.items.map((r) => (
                        <div key={r.id} className="text-xs text-slate-300 flex flex-wrap gap-x-2 gap-y-1">
                          <span className="text-slate-400">{toYmd(r.inspectionDate || r.createdAt) || ""}</span>
                          <span>•</span>
                          <span className="text-slate-100">{r.inspectionArea || "—"}</span>
                          <span>•</span>
                          <span className="truncate">{r.defectType || "—"}</span>
                        </div>
                      ))}
                    </div>
                  </button>
                )
                })}
              </div>

              {scopedTstTafGroups.length > INITIAL_MED ? (
                <div className="mt-3 flex justify-end">
                  <GhostBtn onClick={() => setMoreTstTaf((p) => !p)}>
                    {moreTstTaf ? "View Less" : "View More"}
                  </GhostBtn>
                </div>
              ) : null}
            </div>
          )}
        </Card>
      </div>

      {/* Bottom insights */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Defect Type Wise Record">
          <div className="flex flex-wrap gap-2">
            {scopedCounts.defectType.length ? (
              scopedCounts.defectType.map((x) => (
                <button
                  key={x.name}
                  onClick={() => go({ fDefect: x.name, qEngine: enginePick, qTail: tailPick, dateFrom: fromDate, dateTo: toDate })}
                  className="px-3 py-2 rounded-xl bg-slate-800/70 border border-brand-border hover:bg-slate-800 text-slate-100"
                  title="Open filtered records"
                >
                  <div className="text-sm font-semibold">{x.name}</div>
                  <div className="text-xs text-slate-400">{x.c} records</div>
                </button>
              ))
            ) : (
              <div className="text-slate-400">No data.</div>
            )}
          </div>
        </Card>

        <Card title="Disposal Wise Record">
          <div className="flex flex-wrap gap-2">
            {scopedCounts.disposal.length ? (
              scopedCounts.disposal.map((x) => (
                <button
                  key={x.name}
                  onClick={() => go({ fDisposal: x.name, qEngine: enginePick, qTail: tailPick, dateFrom: fromDate, dateTo: toDate })}
                  className="px-3 py-2 rounded-xl bg-slate-800/70 border border-brand-border hover:bg-slate-800 text-slate-100"
                >
                  <div className="text-sm font-semibold">{x.name}</div>
                  <div className="text-xs text-slate-400">{x.c} records</div>
                </button>
              ))
            ) : (
              <div className="text-slate-400">No data.</div>
            )}
          </div>
        </Card>

        <Card title="Last 10 Recorded Defects">
          {scopedRecentDefects.length ? (
            <div className="space-y-2">
              {(moreRecentDefects ? scopedRecentDefects : scopedRecentDefects.slice(0, INITIAL_MED)).map((r) => (
                <button
                  key={r.id}
                  onClick={() => go({ recordId: r.id })}
                  className="w-full text-left bg-slate-800/50 border border-brand-border rounded-xl px-3 py-2 hover:bg-slate-800 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-slate-100 font-semibold">{r.engineSN || "—"}</div>
                    <div className="text-xs text-slate-400">{toYmd(r.inspectionDate || r.createdAt) || ""}</div>
                  </div>
                  <div className="text-sm text-slate-300 mt-1">
                    {r.defectType ? `Defect: ${r.defectType}` : "—"} • {r.inspectionArea || "—"} • {r.disposal || "—"}
                    {r.disposal === "Monitoring on Short Sampling" && r.shortSamplingHours ? ` • ${r.shortSamplingHours} hrs` : ""}
                  </div>
                </button>
              ))}

              {scopedRecentDefects.length > INITIAL_MED ? (
                <div className="pt-2 flex justify-end">
                  <GhostBtn onClick={() => setMoreRecentDefects((p) => !p)}>
                    {moreRecentDefects ? "View Less" : "View More"}
                  </GhostBtn>
                </div>
              ) : null}
              <div className="pt-2">
                <GhostBtn onClick={() => go({})}>Open all records</GhostBtn>
              </div>
            </div>
          ) : (
            <div className="text-slate-400">No records.</div>
          )}
        </Card>
      </div>
    </div>
  )
}
