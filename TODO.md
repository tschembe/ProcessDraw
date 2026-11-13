# ProcessDraw TODO

Legend: `[x]` done · `[ ]` open · `[~]` partly done. One phase at a time; the user tests after each phase.

## Phase 0 — Setup ✅
- [x] Clone drawio-desktop + drawio submodule (v32.6.10)
- [x] npm install + Electron binary
- [x] Rebrand to ProcessDraw (package.json, window title, Help > About ProcessDraw)
- [x] Desktop detection accepts `ProcessDraw/` user agent (bootstrap.js, export.js, vsdxImporter.js)
- [x] Auto-update disabled
- [x] Extension hook `js/processdraw/ProcessDraw.js` loaded from PostConfig.js
- [x] Git: branch `processdraw` in both repos, remotes renamed to `upstream`
- [x] PROCESSDRAW.md (run, layout, changed upstream files, roadmap)

## Phase 1 — Symbol libraries ✅
- [x] Stencil mini-language → mxStencil XML, embedded inline as `shape=stencil(...)` so files and
      PDF/SVG/PNG export work without ProcessDraw being loaded
- [x] Sidebar integration: 12 ProcessDraw palettes above General, survive sidebar refresh, searchable
- [x] Data templates: every symbol carries `pd_class`, `pd_type`, `pd_standard`, `pd_tag_prefix`, `tag`
      + class-specific fields (Edit Data / Ctrl+M)
- [x] Nozzles: named connection points on every equipment/valve/fitting/instrument symbol
- [x] Equipment — Vessels & Columns (7)
- [x] Equipment — Tanks & Storage (7)
- [x] Equipment — Heat Transfer (10)
- [x] Equipment — Pumps, Compressors & Drivers (14)
- [x] Equipment — Separation, Mixing & Solids (12)
- [x] Valves & Actuators (18)
- [x] Piping Fittings & Specials (17)
- [x] Lines: 5 process lines + 6 signal lines (pneumatic //, hydraulic, capillary, data link via custom edge shapes)
- [x] Instruments — ISA 5.1 (4 shapes × 4 locations + interlock = 17)
- [x] Primary elements & gauges (6)
- [x] Instruments — IEC 62424 / DIN EN 62424 PCE requests (3, basic — please review against your company standard)
- [x] Annotations: flow arrow, off-page connectors, tie-in, battery limit (5)
- [x] Test: all 127 symbols rendered through CLI export (`npm run symbols`), sidebar loads 12/12 palettes
      in normal and dev mode
- [ ] User test in the editor: drag, connect to nozzles, Edit Data, save/reopen, PDF export
- [x] Commit + update PROCESSDRAW.md

## Phase 2 — Smart objects
- [ ] Engineering properties panel (Format sidebar tab) per pd_class, with units
- [ ] Auto tag numbering (prefix + sequence, A/B suffix for spares), configurable start/step
- [ ] Renumber / re-tag tools, tag uniqueness check while typing
- [ ] ISA instrument bubble: type `FIC-101` → function/loop split, bubble updates
- [ ] Copy/paste and duplicate get new tags
- [ ] Equipment data sheet dialog (all fields)
- [ ] Double-click on a symbol edits its tag (today it edits the `%tag%` label template)
- [ ] Units per field (bar(g), °C, m³/h …) and unit system setting

## Phase 3 — Line numbering
- [ ] Project line number pattern editor (e.g. `{size}"-{service}-{seq}-{class}-{insul}`)
- [ ] Pipe line properties (size, service code, pipe class, insulation, from/to)
- [ ] Automatic line number generation + label update
- [ ] Service code & pipe class lists (editable)
- [ ] Line breaks / segment continuation keeps one line number

## Phase 4 — Multi-sheet project
- [ ] Sheets = pages; sheet number/title in page metadata
- [ ] Off-page connector pairs (from/to sheet, jump on double click)
- [ ] Project-wide tag uniqueness across sheets
- [ ] Project settings dialog (project no., client, units, patterns) stored in file

## Phase 5 — PFD & stream tables
- [ ] Stream number marker (diamond) linked to stream data
- [ ] Heat & material balance table (vertical/horizontal), editable, linked to streams
- [ ] Stream table updates when stream data changes
- [ ] PFD equipment summary labels

## Phase 6 — Lists & checks
- [ ] Equipment list → .xlsx
- [ ] Line list → .xlsx
- [ ] Instrument index → .xlsx
- [ ] Valve list → .xlsx
- [ ] Consistency checker: duplicate tags, unconnected nozzles, missing data, lines without number
- [ ] Results panel with click-to-locate

## Phase 7 — Drawing sheets
- [ ] A3 / A1 sheet templates with border and grid references
- [ ] Title block (project data fields auto-filled)
- [ ] Revision table + revision clouds
- [ ] IFR / IFA / IFC stamps
- [ ] Print/PDF of all sheets with title blocks

## Later
- [ ] Excel import (round-trip edits)
- [ ] DXF export
- [ ] Simulator import (DWSIM / HYSYS stream data)
