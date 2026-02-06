import React, { useEffect, useMemo, useState } from "react"


const INSPECTION_TYPES = [
  "Compressor 50 Hrs",
  "Engine 100 Hrs",
  "Short Sampling",
  "Ferry in",
  "Ferry out",
  "Suspected Bird Hit / FOD / IOD",
  "Acceptance Inspection",
  "Miscellaneous",
  "One Time Inspection"
]

const SCHEDULED_OPTIONS = ["Scheduled", "Unscheduled"]

// ✅ new inspection areas
const INSPECTION_AREAS = ["LPC", "HPC", "Combustion Chamber", "HPT", "LPT"]

const DEFECT_TYPES = [
  "Nick",
  "Dent",
  "Indentation",
  "Crack",
  "Erosion",
  "Burn",
  "Piece Chipped Off",
  "Tear",
  "Cut Mark",
  "Bend",
  "Deformation",
  "Bulging"
]

const DISPOSAL_OPTIONS = [
  "Serviceable / No Additional Action",
  "Engine Rejected",
  "Monitoring on Short Sampling",
  "Repair by 102 AED Team (for 1st Stage only)"
]

const EDGE_OPTIONS = ["Leading Edge", "Trailing Edge", "Blade Tip", "Blade Surface"]

const getStageOptionsForArea = (inspectionArea) => {
  if (inspectionArea === "LPC") return ["1st", "2nd", "3rd", "4th"]
  if (inspectionArea === "HPC") return ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"]
  return []
}
const ZONE_OPTIONS = ["Zone A", "Zone B", "Zone C"]
const BLADE_COVERAGE_OPTIONS = ["All Blades", "Partial Blades"]

const initialForm = {
  aircraftTailNo: "",
  engineSN: "",
  inspectionDate: "",
  engineHours: "",
  inspectionType: "",
  scheduledUnscheduled: "",

  inspectionArea: "",
  subArea: "",

  stageNumber: "",
  edge: "",
  zone: "",
  bladeCoverage: "",

  defectType: "",

  length: "",
  width: "",
  height: "",
  area: "",

  shortSamplingHours: "",
  inspectorName: "",
  inspectorId: "",
  unitSection: "",
  disposal: "",
  remarks: "",

  tstTafEnabled: false,
  tstTafNumber: "",

  // ✅ follow-up linkage
  isFollowUp: false,
  previousRecordId: "",

  // attachments (kept out of DB save payload)
  defectImages: [],
  defectDocs: []
}

function isNumericOrEmpty(v) {
  // Allow empty, integers, decimals, leading dot, trailing dot
  // Valid while typing: "", "12", "12.", "12.5", ".5", "0."
  return v === "" || /^(\d+(\.\d*)?|\.\d*)$/.test(v)
}

async function fileToBytes(file) {
  const ab = await file.arrayBuffer()
  const u8 = new Uint8Array(ab)
  return Array.from(u8)
}

export default function BsiForm() {
  const [form, setForm] = useState(initialForm)

  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [topMsg, setTopMsg] = useState("")

  // override (password only)
  const [overrideOpen, setOverrideOpen] = useState(false)
  const [overridePassword, setOverridePassword] = useState("")
  const [overrideMsg, setOverrideMsg] = useState("")
  const [overrideBusy, setOverrideBusy] = useState(false)

  // ✅ load tail list + assignments + existing records (for follow-up selection)
  const [tails, setTails] = useState([])
  const [recordsForLink, setRecordsForLink] = useState([])

  // ✅ Map DB id -> S No (same numbering style as View Data: earliest-first)
  const idToSno = useMemo(() => {
    const arr = (recordsForLink || []).slice()
    // Prefer chronological order; fallback to id so numbering is stable
    arr.sort((a, b) => {
      const da = String(a.inspectionDate || "")
      const db = String(b.inspectionDate || "")
      if (da && db && da !== db) return da.localeCompare(db)
      return (a.id || 0) - (b.id || 0)
    })
    const m = new Map()
    arr.forEach((r, i) => m.set(String(r.id), i + 1))
    return m
  }, [recordsForLink])


  const loadLookups = async () => {
    try {
      // Show only actively attached Tail Nos (detachedAt IS NULL)
      const a = await window.bsi.listAssignments()
      const active = (Array.isArray(a) ? a : [])
        .filter((x) => !x?.detachedAt)
        .map((x) => String(x?.tailNo || "").trim())
        .filter(Boolean)

      const unique = Array.from(new Set(active)).sort((x, y) => x.localeCompare(y))
      setTails(unique.map((tailNo) => ({ tailNo })))
    } catch {
      setTails([])
    }
  }

  const loadRecordsForLink = async () => {
    try {
      const data = await window.bsi.listRecords(5000)
      setRecordsForLink(Array.isArray(data) ? data : [])
    } catch {
      setRecordsForLink([])
    }
  }

  useEffect(() => {
    loadLookups()
    loadRecordsForLink()
  }, [])

  const update = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }))

  const handleNumeric = (key) => (e) => {
    const v = e.target.value
    if (isNumericOrEmpty(v)) setForm((p) => ({ ...p, [key]: v }))
  }

  const onPickDefectImages = (e) => {
    const files = Array.from(e.target.files || [])
    setForm((p) => ({ ...p, defectImages: files }))
  }

  const onPickDefectDocs = (e) => {
    const files = Array.from(e.target.files || [])
    setForm((p) => ({ ...p, defectDocs: files }))
  }

  const toggleTstTaf = () => {
    setForm((p) => {
      const turningOn = !p.tstTafEnabled
      const next = { ...p, tstTafEnabled: turningOn }
      if (turningOn) {
        setTopMsg("Please enter TST/TAF Number in TST/TAF Input Field.")
      } else {
        next.tstTafNumber = ""
      }
      return next
    })
  }

  // ✅ Inspection/SubArea options + logic
  const subAreaOptions = useMemo(() => {
    switch (form.inspectionArea) {
      case "LPC":
      case "HPC":
        return ["Stator", "Rotor"]
      case "Combustion Chamber":
        return ["Flame Tube", "Spark Plug Body", "Fuel Nozzle"]
      case "HPT":
      case "LPT":
        return ["Rotor", "NGV"]
      default:
        return []
    }
  }, [form.inspectionArea])

  const requiresStageEdgeZone = useMemo(() => {
    // ✅ shifted logic: only when LPC/HPC AND subArea is Stator/Rotor
    if (form.inspectionArea !== "LPC" && form.inspectionArea !== "HPC") return false
    return form.subArea === "Stator" || form.subArea === "Rotor"
  }, [form.inspectionArea, form.subArea])

  const showZone = useMemo(() => {
    if (!requiresStageEdgeZone) return false
    if (!form.edge) return false
    // Zone hidden only when Blade Tip selected
    return form.edge !== "Blade Tip"
  }, [requiresStageEdgeZone, form.edge])

  const showBladeCoverage = useMemo(() => {
    // For HPT/LPT Rotor
    return (form.inspectionArea === "HPT" || form.inspectionArea === "LPT") && form.subArea === "Rotor"
  }, [form.inspectionArea, form.subArea])

  const showShortSampling = useMemo(
    () => form.disposal === "Monitoring on Short Sampling",
    [form.disposal]
  )

  // ✅ on Tail change: auto-fill engine
  const onTailChange = async (e) => {
    const tailNo = e.target.value
    setForm((p) => ({
      ...p,
      aircraftTailNo: tailNo,
      engineSN: "" // will fill
    }))
    if (!tailNo) return

    try {
      const res = await window.bsi.getAssignedEngine({ tailNo })
      const eng = typeof res === "string" ? res : (res?.engineSN || res?.engine || "")
      setForm((p) => ({ ...p, engineSN: eng }))
    } catch {
      // keep blank
    }
  }

  const engineIsMapped = useMemo(() => {
    return !!form.aircraftTailNo && !!form.engineSN
  }, [form.aircraftTailNo, form.engineSN])

  // ✅ follow-up options: filter by same engine (if present)
  const followUpChoices = useMemo(() => {
    const eng = String(form.engineSN || "").trim()
    const list = recordsForLink
      .filter((r) => !r.isFollowUp) // link to base defects
      .filter((r) => (eng ? String(r.engineSN || "").trim() === eng : true))
      .slice()
    list.sort((a, b) => (b.id || 0) - (a.id || 0))
    return list.slice(0, 250)
  }, [recordsForLink, form.engineSN])

  const validate = () => {
    const e = {}

    // mandatory fields
    if (!form.aircraftTailNo.trim()) e.aircraftTailNo = "Tail No is required."
    if (!form.engineSN.trim()) e.engineSN = "Engine Serial No is required."
    if (!form.inspectionDate) e.inspectionDate = "Inspection Date is required."
    if (!form.engineHours) e.engineHours = "Engine Hours is required."
    if (!form.inspectionType) e.inspectionType = "Inspection Type is required."
    if (!form.scheduledUnscheduled) e.scheduledUnscheduled = "Please select Scheduled/Unscheduled."
    if (!form.inspectionArea) e.inspectionArea = "Inspection Area is required."
    if (!form.subArea) e.subArea = "Sub Area is required."
    if (requiresStageEdgeZone && !form.stageNumber) e.stageNumber = "Stage is required for LPC/HPC (Stator/Rotor)."
    if (requiresStageEdgeZone && !form.edge) e.edge = "Edge is required for LPC/HPC (Stator/Rotor)."
    if (showZone && !form.zone) e.zone = "Zone is required."

    if (!form.defectType) e.defectType = "Defect Type is required."
    if (!form.inspectorName.trim()) e.inspectorName = "Inspector Name is required."
    if (!form.inspectorId) e.inspectorId = "Inspector Pak No is required."
    if (!form.unitSection.trim()) e.unitSection = "Unit / Section is required."
    if (!form.disposal) e.disposal = "Disposal is required."

    // ✅ at least one dimension required
    const anyDim = !!(form.length || form.width || form.height || form.area)
    if (!anyDim) e.dimensions = "At least one of Length/Width/Height/Area is required."

    if (form.tstTafEnabled && !form.tstTafNumber.trim()) {
      e.tstTafNumber = "TST/TAF Number is required when TST/TAF is ON."
    }

    if (form.tstTafEnabled && (!Array.isArray(form.defectDocs) || form.defectDocs.length === 0)) {
      e.defectDocs = "Update TST / TAF"
    }

    if (showShortSampling && !form.shortSamplingHours) {
      e.shortSamplingHours = "Short Sampling Frequency is required for Monitoring on Short Sampling."
    }

    if (form.isFollowUp && !form.previousRecordId) {
      e.previousRecordId = "Select previous defect entry to link."
    }

    // ✅ defect image is mandatory unless supervisor override is used
    if (!Array.isArray(form.defectImages) || form.defectImages.length === 0) {
      e.defectImages = "Image of defect is required. Multiple images can be uploaded"
    }

    // numeric validation (decimals allowed)
    const numericFields = [
      "engineHours",
      "length",
      "width",
      "height",
      "area",
      "shortSamplingHours",
      "inspectorId"
    ]
    for (const k of numericFields) {
      const v = form[k]
      if (v !== "" && !isNumericOrEmpty(v)) e[k] = "Numeric value only."
    }

    return e
  }

  const canOverride = useMemo(() => submitted && Object.keys(errors).length > 0, [submitted, errors])

  const doSave = async ({ overrideUsed }) => {
    // ✅ Save only DB fields first (no File objects)
    const payload = {
      ...form,
      // do NOT send files
      defectImages: undefined,
      defectDocs: undefined,

      // ensure strings for DB
      createdAt: new Date().toISOString(),
      overrideUsed: !!overrideUsed,
      isFollowUp: !!form.isFollowUp,
      previousRecordId: form.isFollowUp ? Number(form.previousRecordId || 0) || null : null
    }

    const saved = await window.bsi.saveRecord(payload)
    const recordId = saved?.id
    if (!recordId) throw new Error("Record id missing after save.")

    // ✅ attachments after save (no cloning error)
    const images = []
    for (const f of form.defectImages || []) {
      images.push({ name: f.name, data: await fileToBytes(f) })
    }

    const docs = []
    for (const f of form.defectDocs || []) {
      docs.push({ name: f.name, data: await fileToBytes(f) })
    }

    if (images.length || docs.length) {
      await window.bsi.saveAttachments({ recordId, images, docs })
    }

    return recordId
  }

  const submit = async () => {
    setTopMsg("")
    setSubmitted(true)

    const e = validate()
    setErrors(e)

    if (Object.keys(e).length > 0) {
      setTopMsg("Please fill the required (*) fields.")
      return
    }

    setBusy(true)
    try {
      await doSave({ overrideUsed: false })
      setTopMsg("Data submitted successfully.")
      setForm(initialForm)
      setErrors({})
      setSubmitted(false)
      await loadRecordsForLink()
    } catch (err) {
      setTopMsg(err?.message || "Save failed.")
    } finally {
      setBusy(false)
    }
  }

  const confirmOverride = async () => {
    setOverrideMsg("")
    if (!overridePassword) return setOverrideMsg("Password is required.")

    setOverrideBusy(true)
    try {
      const ok = await window.bsi.verifyPassword(overridePassword)
      if (!ok) return setOverrideMsg("Invalid password.")

      await doSave({ overrideUsed: true })

      setTopMsg("Data submitted successfully.")
      setOverrideOpen(false)

      setForm(initialForm)
      setErrors({})
      setSubmitted(false)
      await loadRecordsForLink()
    } catch (err) {
      setOverrideMsg(err?.message || "Override save failed.")
    } finally {
      setOverrideBusy(false)
    }
  }

  return (
    <div className="rounded-2xl p-5 border border-slate-700 shadow-xl bg-gradient-to-b from-slate-900/70 to-slate-950/70">
      <div className="text-2xl font-extrabold text-emerald-300 mb-1">New Defect Entry</div>
      <div className="text-slate-300 mb-4">Fields marked with * are mandatory.</div>

      {topMsg ? (
        <div className={`mb-4 text-sm ${Object.keys(errors).length ? "text-amber-200" : "text-emerald-200"}`}>
          {topMsg}
        </div>
      ) : null}

      {errors.dimensions ? <div className="mb-3 text-sm text-amber-200">{errors.dimensions}</div> : null}

      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Tail No" required error={errors.aircraftTailNo}>
          <select className="input" value={form.aircraftTailNo} onChange={onTailChange}>
            <option value="">Select</option>
            {tails.map((t) => (
              <option key={t.tailNo} value={t.tailNo}>
                {t.tailNo}
              </option>
            ))}
          </select>
          <div className="text-xs text-slate-400 mt-1">Tail Numbers are managed in Admin Module.</div>
        </Field>

        <Field label="Engine Serial No" required error={errors.engineSN}>
          <input
            className="input"
            value={form.engineSN}
           
            readOnly={true}
          />
          <div className="text-xs text-slate-400 mt-1">Engine S No automatically appears as per Tail No selection</div>
        </Field>

        <Field label="Inspection Date" required error={errors.inspectionDate}>
          <input className="input" value={form.inspectionDate} onChange={update("inspectionDate")} type="date" />
        </Field>

        <Field label="Engine Hours" required error={errors.engineHours}>
          <input
            className="input"
            value={form.engineHours}
            onChange={handleNumeric("engineHours")}
           
          />
        </Field>

        <Field label="Inspection Type" required error={errors.inspectionType}>
          <select className="input" value={form.inspectionType} onChange={update("inspectionType")}>
            <option value="">Select</option>
            {INSPECTION_TYPES.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Scheduled / Unscheduled" required error={errors.scheduledUnscheduled}>
          <select className="input" value={form.scheduledUnscheduled} onChange={update("scheduledUnscheduled")}>
            <option value="">Select</option>
            {SCHEDULED_OPTIONS.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Inspection Area" required error={errors.inspectionArea}>
          <select
            className="input"
            value={form.inspectionArea}
            onChange={(e) => {
              const v = e.target.value
              setForm((p) => ({
                ...p,
                inspectionArea: v,
                subArea: "",
                stageNumber: "",
                edge: "",
                zone: "",
                bladeCoverage: ""
              }))
            }}
          >
            <option value="">Select</option>
            {INSPECTION_AREAS.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Sub Area" required error={errors.subArea}>
          <select
            className="input"
            value={form.subArea}
            onChange={(e) => {
              const v = e.target.value
              setForm((p) => ({
                ...p,
                subArea: v,
                stageNumber: "",
                edge: "",
                zone: "",
                bladeCoverage: ""
              }))
            }}
            disabled={!form.inspectionArea}
          >
            <option value="">{form.inspectionArea ? "Select" : "Select Inspection Area first"}</option>
            {subAreaOptions.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </Field>

        {requiresStageEdgeZone ? (
          <Field label="Stage" required error={errors.stageNumber}>
            <select className="input" value={form.stageNumber} onChange={update("stageNumber")}>
              <option value="">Select</option>
              {getStageOptionsForArea(form.inspectionArea).map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        {requiresStageEdgeZone ? (
          <Field label="Edge" required error={errors.edge}>
            <select className="input" value={form.edge} onChange={update("edge")}>
              <option value="">Select</option>
              {EDGE_OPTIONS.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        {showZone ? (
          <Field label="Zone" required error={errors.zone}>
            <select className="input" value={form.zone} onChange={update("zone")}>
              <option value="">Select</option>
              {ZONE_OPTIONS.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        {showBladeCoverage ? (
          <Field label="Blade Coverage">
            <select className="input" value={form.bladeCoverage} onChange={update("bladeCoverage")}>
              <option value="">Select</option>
              {BLADE_COVERAGE_OPTIONS.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        <Field label="Defect Type" required error={errors.defectType}>
          <select className="input" value={form.defectType} onChange={update("defectType")}>
            <option value="">Select</option>
            {DEFECT_TYPES.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Length (mm)" error={errors.length}>
          <input className="input" value={form.length} onChange={handleNumeric("length")} />
        </Field>

        <Field label="Width (mm)" error={errors.width}>
          <input className="input" value={form.width} onChange={handleNumeric("width")} />
        </Field>

        <Field label="Height/Depth (mm)" error={errors.height}>
          <input className="input" value={form.height} onChange={handleNumeric("height")} />
        </Field>

        <Field label="Area (mm²)" error={errors.area}>
          <input className="input" value={form.area} onChange={handleNumeric("area")} />
        </Field>

        <Field label="Disposal" required error={errors.disposal}>
          <select className="input" value={form.disposal} onChange={update("disposal")}>
            <option value="">Select</option>
            {DISPOSAL_OPTIONS.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </Field>

        {showShortSampling ? (
          <Field label="Short Sampling Frequency (hrs)" required error={errors.shortSamplingHours}>
            <input className="input" value={form.shortSamplingHours} onChange={handleNumeric("shortSamplingHours")} />
          </Field>
        ) : null}

        <Field label="Remarks">
          <input className="input" value={form.remarks} onChange={update("remarks")} />
        </Field>

        <Field label="Inspector Name" required error={errors.inspectorName}>
          <input className="input" value={form.inspectorName} onChange={update("inspectorName")} />
        </Field>

        <Field label="Inspector Pak No" required error={errors.inspectorId}>
          <input className="input" value={form.inspectorId} onChange={handleNumeric("inspectorId")} />
        </Field>

        <Field label="Unit / Section" required error={errors.unitSection}>
          <input className="input" value={form.unitSection} onChange={update("unitSection")} />
        </Field>

        {/* Follow-up section */}
        <div className="md:col-span-2 rounded-2xl border border-slate-700 bg-slate-900/40 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-semibold text-amber-200">Follow-up / Previously Noted Defect</div>
              <div className="text-xs text-slate-300 mt-1">
                Enable this when defect is previously noted / follow up of a previous defect
              </div>
            </div>

            <label className="flex items-center gap-2 text-slate-200">
              <input
                type="checkbox"
                checked={form.isFollowUp}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    isFollowUp: e.target.checked,
                    previousRecordId: ""
                  }))
                }
              />
              Mark as Follow-up
            </label>
          </div>

          {form.isFollowUp ? (
            <div className="mt-3 grid md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-slate-200">Link to Previous Defect Entry *</label>
                <select
                  className="input"
                  value={form.previousRecordId}
                  onChange={(e) => setForm((p) => ({ ...p, previousRecordId: e.target.value }))}
                >
                  <option value="">Select</option>
                  {followUpChoices.map((r) => (
                    <option key={r.id} value={r.id}>
                      S No {idToSno.get(String(r.id)) || "—"} | Tail No {r.aircraftTailNo} | {r.engineSN} | {r.defectType} | {r.inspectionArea}/{r.subArea} | {r.inspectionDate}
                    </option>
                  ))}
                </select>
                {errors.previousRecordId ? <div className="text-sm text-amber-200 mt-1">{errors.previousRecordId}</div> : null}
              </div>
              <div className="text-xs text-slate-300 flex items-end">
                Note: The list is filtered for selected Tail No. Please select Previous defect to link with.
              </div>
            </div>
          ) : null}
        </div>

        {/* Toggle + TST Number */}
        <Field label="TST / TAF">
          <div className="flex items-center gap-4">
            <span className="text-slate-300 font-medium">OFF</span>

            <div
              onClick={toggleTstTaf}
              className={`relative w-16 h-8 rounded-full cursor-pointer transition-colors ${
                form.tstTafEnabled ? "bg-emerald-500" : "bg-slate-600"
              }`}
            >
              <div
                className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white transition-transform ${
                  form.tstTafEnabled ? "translate-x-8" : ""
                }`}
              />
            </div>

            <span className="text-slate-300 font-medium">TST / TAF</span>
          </div>
          {form.tstTafEnabled ? (
            <div className="mt-2 text-sm text-emerald-200">Please enter TST/TAF Number in TST/TAF Input Field.</div>
          ) : null}
        </Field>

        {form.tstTafEnabled ? (
          <Field label="TST / TAF Number" required error={errors.tstTafNumber}>
            <input className="input" value={form.tstTafNumber} onChange={update("tstTafNumber")} />
          </Field>
        ) : null}

        {/* Attachments */}
        <Field label="Image Upload" required error={errors.defectImages}>
          <input className="input" type="file" multiple accept="image/*" onChange={onPickDefectImages} />
          {form.defectImages?.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {form.defectImages.slice(0, 6).map((f, i) => (
                <span key={i} className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs">
                  {f.name}
                </span>
              ))}
              {form.defectImages.length > 6 ? <span className="text-xs text-slate-300">+{form.defectImages.length - 6}</span> : null}
            </div>
          ) : null}
        </Field>

        {/* ✅ multiple docs */}
        <Field label={form.tstTafEnabled ? "TST / TAF Upload" : "Supporting Documents (PDF/Word) "} required={form.tstTafEnabled} error={errors.defectDocs}>
          <input className="input" type="file" multiple accept=".pdf,.doc,.docx" onChange={onPickDefectDocs} />
          {form.defectDocs?.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {form.defectDocs.slice(0, 6).map((f, i) => (
                <span key={i} className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs">
                  {f.name}
                </span>
              ))}
              {form.defectDocs.length > 6 ? <span className="text-xs text-slate-300">+{form.defectDocs.length - 6}</span> : null}
            </div>
          ) : null}
        </Field>
      </div>

      <div className="mt-6 flex items-center justify-end gap-2">
        {submitted && Object.keys(errors).length > 0 ? (
          <div className="mr-auto text-sm font-semibold text-red-400">Incomplete Form</div>
        ) : null}
        {canOverride ? (
          <button
            onClick={() => {
              setOverridePassword("")
              setOverrideMsg("")
              setOverrideOpen(true)
            }}
            className="px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-200 font-semibold hover:bg-amber-500/25"
            disabled={busy}
          >
            Supervisor Override
          </button>
        ) : null}

        <button onClick={submit} disabled={busy} className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-black font-extrabold disabled:opacity-60">
          {busy ? "Saving..." : "Submit"}
        </button>
      </div>

      {overrideOpen ? (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-2xl p-4 border border-slate-700 shadow-xl bg-gradient-to-b from-slate-900 to-slate-950">
            <div className="text-lg font-semibold text-white mb-3">Supervisor Override</div>

            <label className="block text-sm text-slate-200 mb-1">Supervisor Password</label>
            <input className="input" value={overridePassword} onChange={(e) => setOverridePassword(e.target.value)} type="password" />

            {overrideMsg ? <div className="text-sm text-amber-200 mt-3">{overrideMsg}</div> : null}

            <div className="flex gap-2 justify-end mt-4">
              <button onClick={() => setOverrideOpen(false)} className="px-4 py-2 rounded-xl bg-slate-800 text-white border border-slate-700 hover:border-sky-400/50" disabled={overrideBusy}>
                Cancel
              </button>
              <button onClick={confirmOverride} className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold" disabled={overrideBusy}>
                {overrideBusy ? "Saving..." : "Proceed"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <style>{`
        .input{
          width: 100%;
          padding: 10px 12px;
          border-radius: 12px;
          background: rgba(30,41,59,0.72);
          border: 1px solid rgba(71,85,105,0.9);
          color: #e2e8f0;
          outline: none;
          margin-top: 6px;
        }
        .input:focus{
          box-shadow: 0 0 0 2px rgba(56,189,248,0.35);
          border-color: rgba(56,189,248,0.6);
        }
      `}</style>
    </div>
  )
}

function Field({ label, required = false, error = "", children }) {
  return (
    <div>
      <div className="text-sm text-slate-200 mb-1">
        {label} {required ? <span className="text-amber-300">*</span> : null}
      </div>
      {children}
      {error ? <div className="text-sm text-amber-200 mt-1">{error}</div> : null}
    </div>
  )
}