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

## Phase 2 — Smart objects ✅
- [x] Engineering tab in the Format panel (first tab when one symbol is selected): tag, ISA function/loop,
      all data fields with units and suggested values, duplicate-tag warning while typing
- [x] Data sheet dialog: double-click a symbol (Alt+double-click still edits the label text)
- [x] Auto tag numbering on insert, paste and duplicate (prefix + next free number, project-wide over all pages)
- [x] Instruments: loop numbers; typing `FIC-101` / `fic 101` / `20-FIC-101` splits function and loop;
      ISA letters decoded ("Flow Indicating Controller")
- [x] Manual valves untagged by default; Renumber Selection gives them HV numbers if wanted
- [x] Renumber Selection (position order, optional start number), Number All Unnumbered Items
- [x] Add Spare (A/B): P-101 → P-101A + P-101B (next free letter)
- [x] Check Tags: duplicates and unnumbered items, click to jump to the item (any page)
- [x] Tag numbering & units settings (first number, step, digits, separator, auto on/off, metric/imperial),
      saved in the diagram
- [x] ProcessDraw menu (main menu / menubar) and right-click items
- [x] Tests: `npm run test:pd` (tag parsing, ISA) + in-app self-test (25 checks, see PROCESSDRAW.md)
- [ ] User test in the editor
- [ ] Later: unit conversion when switching unit system; per-area numbering (e.g. 10-P-101 per unit)

## Phase 3 — Line numbering ✅
- [x] Project line number pattern with `{field}` and optional `[ ]` parts, live example
      (default `{size}-{service_code}-{sequence}-{pipe_class}[-{insulation}]` → `6"-P-1001-A1A-H`)
- [x] Line data: line number, size, service code, sequence, pipe class, insulation, fluid, from, to
- [x] Automatic sequence when a line is connected (drawn from a nozzle or dropped and connected later)
- [x] Line continues through valves, fittings, specials and inline instruments (same line number)
- [x] From / To filled with the tags of the connected items
- [x] Changes apply to all segments with the same line number (can be switched off per edit)
- [x] Typed-in line numbers are kept; "Use pattern" returns to automatic
- [x] Service codes and pipe classes as editable project lists, shown as suggestions
- [x] Join Line Segments, Split Line (New Number), Update All Line Numbers; right-click on lines
- [x] Pattern change updates all automatic line numbers on all pages
- [x] Tests: `npm run test:pd` (8 unit tests) + in-app self-test (42 checks)
- [ ] User test in the editor
- [ ] Later: separate sequence per service code (option), line breaks across sheets (phase 4)

## Phase 4 — Multi-sheet project ✅
- [x] Sheets = pages with sheet number, drawing number, title, type (stored on each page)
- [x] Sheets dialog: all sheets in one table, number sheets 001…, drawing numbers from the project prefix,
      rename pages "<no.> <title>", click a page name to go there
- [x] Project settings: project number/name, client, site, area, prepared by, drawing number prefix
- [x] Off-page connectors linked in pairs: create the partner on another sheet or link to an unlinked one
- [x] Connector sheet text follows the partner's sheet (drawing no. › sheet no. › page name)
- [x] Double-click a linked connector jumps to its partner; right-click: Link / Go to Partner
- [x] Lines continue across sheets through linked connectors (same line number)
- [x] Project-wide tag uniqueness across sheets (from phase 2)
- [x] Check Project: unlinked connectors, double links, same direction, outdated sheet text
- [x] Tests: in-app self-test (55 checks); tests run with a separate profile (--user-data-dir)
- [ ] User test in the editor
- [ ] Later: separate files per sheet / project folder (today one .drawio file = one project)

## Phase 5 — PFD & stream tables ✅
- [x] Stream markers (diamond / circle) on lines: Add Stream Marker puts them on the line (move with it)
- [x] Stream numbers 1, 2, 3 … automatically; copies get new numbers; first number configurable
- [x] Stream data: description, T, P, vapour fraction, mass/molar/volume/std gas flow, MW, density,
      viscosity + component fractions (project component list, mole or mass basis)
- [x] H&MB table (sidebar or ProcessDraw > Insert H&MB Table): columns or rows, streams of this sheet or
      all sheets, empty rows hidden, units follow the project unit system
- [x] Table updates in the same undo step as the stream change (undo keeps table and data together)
- [x] H&MB editor (double-click the table): grid of all streams, paste blocks from Excel / simulators
- [x] Equipment summaries (right-click equipment): tag, service, size/duty/flow, power, design, material;
      follow equipment changes; double-click opens the equipment data sheet
- [x] Tables and summaries are not edited as text (generated)
- [x] Tests: in-app self-test (69 checks) — found and fixed missing units for stream T and P
- [ ] User test in the editor
- [ ] Later: import a stream table file (CSV) by stream number; copied summaries keep pointing at the
      original equipment

## Phase 6 — Lists & checks ✅
- [x] Export Lists to Excel: one .xlsx workbook (own writer, no new dependency) with project header,
      units in column headers, frozen header row, filters, column widths, numbers as numbers
- [x] Equipment list (all equipment data, readable equipment types)
- [x] Line list (one row per line number, segments merged, service and pipe class descriptions,
      From / To without the inline items, sheets, segment count)
- [x] Instrument index (instruments + control / on-off / safety valves, ISA descriptions, connected line)
- [x] Valve list (tagged and untagged valves, positions, actuator, set pressure, connected line)
- [x] Specials list, Streams (H&MB) sheet, Check sheet
- [x] Project Check window (stays open): duplicate tags, unnumbered items, unconnected equipment, open
      valve/fitting ends, dangling lines, missing / incomplete line numbers, missing service, fail position
      or set pressure, off-page connector problems, duplicate stream numbers; click selects the item
      on any sheet; Recheck
- [x] Tests: `npm run test:pd` (11 unit tests incl. XLSX writer), self-test 83 checks, workbook verified
      with openpyxl
- [ ] User test: open the exported workbook in Excel / LibreOffice
- [ ] Later: Excel import (round trip), choose which lists / columns, per-sheet lists

## Phase 7 — Drawing sheets ✅
- [x] A4 / A3 / A2 / A1 / A0 landscape frames (ISO 5457 margins, grid references 1… / A… without I and O),
      page size set to match (undoable), frame adapts to dark mode
- [x] Title block (180 mm, bottom right) filled from project and sheet data: client, project, plant/unit,
      prepared by, title, type, drawing no., sheet x of y, revision, status, scale, date, drawn/checked/approved, size
- [x] Revision table above the title block (newest on top), grows upwards
- [x] Drawing Sheet & Revisions dialog (double-click the title block): frame size, status, scale, names,
      revisions with suggested next revision (A, B … skipping I and O; 0, 1 … from IFC)
- [x] Title block / revision table update in the same undo step as the data and when a sheet is shown
- [x] Palette: revision cloud (constant scallop size), revision triangle (current revision),
      stamps IFR / IFA / IFD / IFC / As-Built / Preliminary / Hold / Void (dated today), notes block
- [x] Export Sheets to PDF (draw.io PDF export; verified: A3 page with frame, title block, cloud)
- [x] Tests: in-app self-test 98 checks; PDF exported through the CLI and checked
- [ ] User test: print / PDF of a multi-sheet project

## Menu
- [x] ProcessDraw menu in the menu bar between Extras and Help, grouped submenus per feature area,
      Quick Guide dialog with buttons for every feature (self-test checks position and visibility)

## Later
- [ ] Excel import (round-trip edits)
- [ ] DXF export
- [ ] Simulator import (DWSIM / HYSYS stream data)
