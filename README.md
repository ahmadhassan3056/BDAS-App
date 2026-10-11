# BDAS-App

Borescope Data Archiving System (**BDAS**) is an offline-first desktop application for recording, archiving, and analyzing borescope inspection defect data.

## Tech Stack

- **Electron** (desktop shell, native dialogs, filesystem operations)
- **React + Vite** (renderer/UI)
- **SQLite** (local database)
- **Filesystem attachments** (defect images and related documents)

## Architecture Overview

BDAS is organized into three layers:

1. **Electron Main Process** (`electron.cjs`)
   - Creates application windows and menu
   - Handles IPC handlers
   - Manages backup/restore and data transfer packaging
   - Performs filesystem operations for attachments and password file

2. **Preload Bridge** (`preload.cjs`)
   - Exposes a safe API as `window.bsi.*`
   - Prevents direct Node.js access from the renderer

3. **Database + Business Rules** (`db.cjs`)
   - Creates and migrates schema
   - Enforces validation on save
   - Maintains Tail/Engine assignment mappings
   - Applies import dedupe and follow-up relinking via UUIDs

## Core Data Model

### Main table: `bsi_records`
Each inspection defect record includes fields such as:

- Tail and engine (`aircraftTailNo`, `engineSN`)
- Inspection metadata (date, type, scheduled/unscheduled)
- Area/sub-area and positional data (stage/edge/zone/blade coverage)
- Defect details and dimensions (`length`, `width`, `height`, `area`)
- Inspector and unit details
- Disposal and monitoring details
- TST/TAF status and number
- Follow-up linkage (`isFollowUp`, `previousRecordId`, `previousRecordUuid`)
- Attachment path arrays (`imagePaths`, `docPaths`)
- Transfer-safe IDs (`recordUuid`)

### Admin tables

- `tails`
- `engines`
- `assignments` (with `attachedAt` / `detachedAt` history)

### Settings table

- `app_settings` (e.g., backup metadata)

## Key Validation and Workflow Rules

- Required fields are validated in both UI and DB layer.
- **Override mode** can bypass mandatory checks after password verification.
- At least one dimension (`length`/`width`/`height`/`area`) is required unless override is used.
- If TST/TAF is enabled, TST/TAF number is required.
- If disposal is **Monitoring on Short Sampling**, short sampling hours are required.
- Follow-up records require linkage to a previous record.

## Attachments

- Records are saved to DB first.
- Files are saved under:

  `{userData}/attachments/{recordId}/`

- DB record is then updated with attachment path arrays.

## Tail ↔ Engine Mapping

- One active engine can be assigned to one tail at a time.
- Assignment history is preserved via `detachedAt`.
- Re-assignment automatically detaches existing active mappings.

## Backup and Restore

BDAS supports full backup/restore through `.bdasbak` files, including:

- SQLite DB snapshot
- Attachments
- Admin password file

Restore includes validation and safe path handling to prevent path traversal.

## Data Transfer

BDAS supports export/import packages (`.bdas`) for:

- Selected Tail records
- Selected Engine records

Packages include records and embedded attachment files. Import uses record UUID dedupe and relinks follow-ups using UUID references.

## Main UI Areas

- **Home**
- **Data Entry**
- **View Data**
- **Summary Dashboard**

Additional admin actions include login, password change, mapping management, backup/restore, and transfer operations.

## Development

Install dependencies:

```bash
npm install
```

Run renderer only (Vite):

```bash
npm run dev
```

Run full desktop app (Vite + Electron):

```bash
npm run start
```

Build renderer:

```bash
npm run build:renderer
```

Create distributable package:

```bash
npm run dist
```
