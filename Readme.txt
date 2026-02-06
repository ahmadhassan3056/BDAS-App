1) What BDAS is (overall architecture)

BDAS is a desktop application built with:

Electron (desktop shell + system access)

React + Vite (UI)

SQLite (local database)

File storage on disk for attachments (defect images + docs)

Export/Import features to move data between units/systems:

Full backup/restore (everything)

Tail / Engine export packages (subset of records, plus attachments)

Excel export (tabular data only)

There are 3 “layers”:

A) Electron Main Process (electron.cjs)

Owns:

app window creation

filesystem access (attachments, backup files)

IPC handlers (the API your React app calls)

app settings like password file, backup timestamps

backup / restore, import / export packaging

B) Preload Bridge (preload.cjs)

Exposes a safe API at:

window.bsi.*
This prevents the renderer from getting raw Node.js access (good practice).

C) SQLite + Business Rules (db.cjs)

Owns:

schema creation / schema upgrades

record validation rules on save (especially in saveRecord)

admin mapping tables (tails, engines, assignments)

record filtering (hide “detached engines” data)

transfer-safe import logic using UUIDs

2) Core data model (what is stored)
Main table: bsi_records

Each defect entry stores things like:

aircraftTailNo, engineSN

inspectionDate (stored in YYYY-MM-DD string)

engineHours, inspectionType, scheduledUnscheduled

inspectionArea + subArea

stageNumber, edge, zone, bladeCoverage

defectType

length/width/height/area (strings but treated as numbers in UI)

disposal, shortSamplingHours, remarks

inspectorName, inspectorId, unitSection

TST/TAF flag + number

follow-up linkage

isFollowUp

previousRecordId

and also previousRecordUuid

createdAt

overrideUsed

recordUuid (important for import dedupe and follow-up relinking)

attachment paths:

imagePaths (JSON string array)

docPaths (JSON string array)

Admin/mapping tables

tails(tailNo unique)

engines(engineSN unique)

assignments(tailNo, engineSN, attachedAt, detachedAt)

only one active assignment exists for a tail/engine at a time (others are detached)

Settings

app_settings(key,value) for things like:

lastBackupAt

lastBackupFile

3) The most important business rules & conditions
A) Required fields enforcement (two layers)

You enforce rules in both UI (BsiForm.jsx validate()) and DB layer (db.cjs saveRecord()).

The DB layer is the final authority, but the UI prevents common errors early.

“Override” mode

If overrideUsed === true, the DB layer skips required-field enforcement.

UI only allows override after validation fails and after password verification.

Meaning: Supervisor override is basically “force save even if required fields/images are missing”.

B) Dimensions rule (hard requirement unless override)

In DB layer:

It requires at least one of:

length OR width OR height OR area
If none are provided → error.

UI enforces the same.

C) TST/TAF logic

In DB layer:

If tstTafEnabled is ON → tstTafNumber must be present.

In UI you additionally require:

if TST/TAF enabled → at least one document upload is required (defectDocs must exist)

UI error message: "Update TST / TAF"

So: DB requires the number, UI requires number + doc attachment.

D) Short Sampling disposal logic

If disposal === "Monitoring on Short Sampling":

DB requires shortSamplingHours

UI requires shortSamplingHours

This drives dashboard metrics too.

E) Follow-up defect logic

If a record is marked as follow-up:

DB requires previousRecordId

It stores both:

previousRecordId

previousRecordUuid (resolved from the previous record’s uuid)

This uuid pairing is critical for import merge, because ids won’t match between systems.

4) Attachments design (how images/docs are stored)

This is cleanly separated:

Step 1 — Save record into DB first

window.bsi.saveRecord(payload) calls IPC → db.saveRecord()

Step 2 — Save files on disk

After you get recordId, the UI converts File → bytes and calls:

window.bsi.saveAttachments({ recordId, images, docs })

Main process stores them under:

{userData}/attachments/{recordId}/

and then updates the DB record with JSON arrays of absolute file paths.

Viewing attachments

bsi:getImageDataUrl reads file, returns data URL for display.

bsi:openFile opens a doc/PDF/Word in default OS app.

5) Tail ↔ Engine mapping logic (really important to BDAS)

Your model assumes:

A Tail has one active engine

An engine belongs to one active tail

historical changes are tracked using detachedAt

When you “attach engine to tail”:

ensure tail exists in tails table

ensure engine exists in engines table

detach any existing active assignment for this tail

detach any existing active assignment for this engine

create new active assignment

Records visibility rule

In listRecords() you do something very intentional:

“Hide detached engines: show only engines currently attached to any tail”

So the View Data / Dashboard only shows records for engines that are currently “active” in the assignment table.

But you keep records with blank engineSN visible (override edge-case).

That means BDAS is behaving like an active-fleet view, not a full archive history view (unless engines are still active).

6) Backup / restore (full system safety)
Full backup contains:

a consistent DB snapshot (tries VACUUM INTO, otherwise raw db file)

attachments folder

admin password file (override_password.txt)

All stored as a JSON file with base64 blobs:

extension: .bdasbak

Restore does:

validates backup type and app label

closes DB

wipes WAL/SHM

writes restored db file into userData

wipes attachments folder and restores it

prevents path traversal (normalizes paths and blocks ../)

only allows:

attachments/*

override_password.txt

reopens DB

then suggests relaunch/reload behavior:

in dev: reload renderer

in production: relaunch entire app

This is well thought out.

7) Data transfer packages (Tail/Engine export/import)

You support exporting subsets:

Tail export (.bdas)

admin password required

pick one tail or multiple tails

optional dateFrom/dateTo filter (lexical compare works because YYYY-MM-DD)

includes records + attachment files as base64

removes local paths (imagePaths/docPaths) and embeds actual file bytes instead

Engine export (.bdas)

Same idea, but grouped by engines.

Import

password required

reads .bdas

inserts record only if its recordUuid does not already exist (dedupe)

saves attachments to new recordId folder

updates attachments paths

runs resolveImportedFollowups():

links follow-ups by uuid to local ids

Then it computes:

“required tail-engine pairs” from imported records

compares to active assignments

returns missingPairs so admin can fix mapping

That is a very practical workflow design.

8) UI navigation I understood (from App.jsx + components)

Your app has three main modes:

Home (Data Entry / View Data / Summary Dashboard)

Data Entry (BsiForm)

View Data (inside App.jsx, large table/filtering/export logic)

Summary Dashboard (KPIs + drill downs + “go to view data with preset filters”)

Home has:

backup reminder logic:

no backup ever → strong warning

= 60 days since last backup → strong warning

= 30 days → soft reminder

Admin features:

Admin Login modal

Change Password modal (calls bsi:changePassword)

9) A few key “gotchas” I noticed (not judging — just what’s true)

Admin password is stored in plain text (override_password.txt).

It’s inside userData and included in backup.

For your environment this may be acceptable, but it’s not cryptographically secure.

listRecords() hides records for detached engines.

If someone expects “archive forever”, they might think data is missing.

But if the intent is “current fleet only”, then this is correct.

UI requires defect images always (unless override), but DB doesn’t strictly enforce “image required”.

So the enforcement is “UI level only”.

What BDAS is meant to accomplish?

BDAS is a local, offline-first desktop system that lets you:

maintain a controlled list of active Tail numbers and Engine serial numbers

enforce that each Tail has a single active engine assignment (and vice versa)

enter detailed borescope defect records with strong validation

attach defect images and documents to records safely on disk

analyze records in a table view + a dashboard view

export data to Excel for reporting

transfer records between locations/systems via secure-ish packages:

prevent duplicates using UUID

preserve follow-up chain using UUID mapping

preserve attachments by embedding files inside exports

keep the whole system recoverable via full backup/restore