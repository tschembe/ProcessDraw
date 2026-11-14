# ProcessDraw

A desktop PFD and P&ID editor for process engineers, built on
[draw.io desktop](https://github.com/jgraph/drawio-desktop).

- Core editor: `drawio/` (jgraph/drawio, Apache 2.0)
- Desktop wrapper: this repo (jgraph/drawio-desktop, GPL v3). If you ever distribute
  ProcessDraw outside your team, you must also provide its source code under GPL v3.

## Running

```bash
npm install
npm start                 # normal start
DRAWIO_ENV=dev npm start  # opens DevTools and loads unminified editor sources
```

### One-time Linux fix (Electron sandbox)

If `npm start` aborts with *"The SUID sandbox helper binary was found, but is not
configured correctly"*, run once (again after every `npm install` that updates Electron):

```bash
sudo chown root:root node_modules/electron/dist/chrome-sandbox
sudo chmod 4755 node_modules/electron/dist/chrome-sandbox
```

## Where to find the features

**ProcessDraw** menu in the menu bar (between Extras and Help; in the simple theme at the top of the
main menu). Frequent commands first, then submenus: Tags & Equipment, Line Numbers, PFD & Heat and
Material Balance, Sheets & Off-Page Connectors, Lists & Checks, Settings, plus **Quick Guide** (all
features by phase with buttons). Right-click on symbols, lines, connectors and tables shows the
matching commands. The menu is defined in `pd-actions.js` (`SUBMENUS`, `fillMainMenu`).

## MCP server (Claude draws P&IDs)

`mcp/` holds the ProcessDraw MCP server, based on the official draw.io MCP tool server: Claude
(Claude Code, Claude Desktop) creates, reads, updates and exports ProcessDraw drawings and defines
new symbols. Setup and tools: [mcp/README.md](mcp/README.md). It loads the editor modules from
`drawio/src/main/webapp/js/processdraw/` headlessly, so drawings follow the same rules as in the
editor. Cells the server cannot size (title block, revision table, H&MB, summaries) carry
`pd_refresh="1"`; the editor sizes them when the file is loaded and removes the mark.

## Where the ProcessDraw code lives

| Path | Purpose |
|---|---|
| `drawio/src/main/webapp/js/processdraw/` | **All ProcessDraw features** (symbols, smart objects, lists, ...) |
| `drawio/src/main/webapp/js/processdraw/ProcessDraw.js` | Entry point: loads the modules below in order, registers with the editor via `Draw.loadPlugin` |
| `.../processdraw/pd-stencil.js` | Symbol drawing language → stencil XML, embedded as `shape=stencil(...)` |
| `.../processdraw/pd-shapes.js` | Custom shapes: signal lines, drawing frame (`pd_frame`), revision cloud (`pd_revcloud`); also loaded by `export3.html` |
| `.../processdraw/pd-library.js` | Palette registry, engineering data templates, cell creation |
| `.../processdraw/pd-symbols-*.js` | Symbol definitions (equipment, piping/valves/lines, instruments) |
| `.../processdraw/pd-sidebar.js` | Puts the ProcessDraw palettes above the General palette |
| `.../processdraw/pd-tags.js` | Tag parsing, ISA letters, project settings, auto numbering, renumber, tag check |
| `.../processdraw/pd-fields.js` | Field captions, units (metric/imperial) and suggested values |
| `.../processdraw/pd-properties.js` | Engineering tab in the Format panel, data sheet dialog, double-click |
| `.../processdraw/pd-lines.js` | Line number pattern, automatic sequence, continuation through inline items, join/split |
| `.../processdraw/pd-project.js` | Sheets, project settings, linked off-page connectors, jump, connector check |
| `.../processdraw/pd-pfd.js` | Stream markers, H&MB tables and editor, equipment summaries, PFD palette |
| `.../processdraw/pd-xlsx.js` | Minimal XLSX writer (zipped with draw.io's JSZip) |
| `.../processdraw/pd-lists.js` | Equipment / line / instrument / valve / specials / stream lists, Project Check |
| `.../processdraw/pd-sheet.js` | Drawing frames, title block, revision table, revision clouds/triangles, stamps |
| `.../processdraw/pd-roundtrip.js` | Import Lists from Excel: match rows by hidden IDs, preview, apply |
| `.../processdraw/pd-dxf.js` | Export Sheet to DXF (R12, mm, layers) from the rendered diagram |
| `.../processdraw/pd-simimport.js` | Import Stream Data from HYSYS / DWSIM / CSV / XLSX with unit conversion |
| `.../processdraw/pd-actions.js` | ProcessDraw menu, right-click items, renumber/spare/check/settings commands |
| `.../processdraw/pd-selftest.js` | In-app self-test, only loaded with `pdtest=1` |
| `tools/symbol-sheet.cjs` | Builds a sheet with all symbols; `npm run symbols` → `symbols.png` |
| `drawio/src/main/webapp/js/PostConfig.js` | Loads `ProcessDraw.js` (one line added at the end) |

## Changes to upstream files (keep this list complete for upstream merges)

| File | Change |
|---|---|
| `package.json` | name `processdraw`, productName `ProcessDraw`, description, author, no repo links |
| `src/main/disableUpdate.js` | auto-update disabled (`npm run sync -- disableUpdate`) |
| `drawio/src/main/webapp/js/bootstrap.js` | `mxIsElectron` also accepts the ` ProcessDraw/` user agent |
| `drawio/src/main/webapp/js/export.js` | same |
| `drawio/src/main/webapp/js/vsdxImporter.js` | same |
| `drawio/src/main/webapp/js/PostConfig.js` | loads `js/processdraw/ProcessDraw.js` |
| `drawio/src/main/webapp/export3.html` | loads `js/processdraw/pd-shapes.js` (signal lines in CLI/PDF export) |
| `electron-builder-*.json` | `mcp/` and `tools/` are not packaged into the app |

Why the user agent patch: Electron puts the product name into the user agent
(`ProcessDraw/32.6.10`), and draw.io detects desktop mode by looking for `draw.io/`.

**Always run `npm run sync -- disableUpdate`** (never plain `npm run sync`): otherwise
the app would try to install official draw.io updates over ProcessDraw.

## Tests

```bash
npm run test:pd        # tags, ISA, line patterns, XLSX write/read, CSV, simulator import (Node)
npm run symbols        # all symbols → symbols.png
# In-app self-test on an empty diagram (inserts symbols, numbers, renumbers, opens dialogs):
echo '{"pdtest": "1"}' > urlParams.json
# --user-data-dir keeps the test away from a ProcessDraw that is already open
DRAWIO_ENV=dev ELECTRON_ENABLE_LOGGING=1 npx electron . --user-data-dir=/tmp/pd-test empty.drawio 2>&1 | grep PDTEST
rm urlParams.json
```

## Project settings and sheets

Each page is a sheet; its data is on the page's root cell (`pd_sheet_number`, `pd_drawing_number`,
`pd_sheet_title`, `pd_sheet_type`). Project data is on the first page (`pd_project_number`,
`pd_project_name`, `pd_client`, `pd_site`, `pd_area`, `pd_prepared_by`, `pd_doc_prefix`).
Off-page connectors are linked by a shared `connector_id` (C01, C02, ...).
Stream settings: `pd_stream_start`, `pd_components` (one per line), `pd_comp_basis`. Stream markers
store components as `comp_<name>` attributes. H&MB tables and equipment summaries keep their generated
HTML in `label` and are rebuilt in the model's BEFORE_UNDO event (same undo step as the change).
Drawing sheets: per page `pd_sheet_status`, `pd_sheet_scale`, `pd_drawn_by`, `pd_checked_by`,
`pd_approved_by`, `pd_sheet_size`, `pd_revisions` (JSON). Frame, title block and revision table are
locked cells (`pd_class` frame / titleblock / revtable) at the back of the page.

### Numbering settings

Stored as attributes on the root cell of the first page (`pd_tag_start`, `pd_tag_step`,
`pd_tag_digits`, `pd_tag_separator`, `pd_autonumber`, `pd_units`, `pd_line_pattern`, `pd_line_start`,
`pd_line_digits`, `pd_service_codes`, `pd_pipe_classes`). Edit them with ProcessDraw > Tag Numbering &
Units and ProcessDraw > Line Numbering.

## Adding a symbol

Add an entry to one of the `pd-symbols-*.js` files, e.g.

```js
eq({id: 'pd_pump_centrifugal', name: 'Centrifugal Pump', type: 'pump.centrifugal', prefix: 'P',
    template: 'pump', w: 40, h: 44, aspect: true,
    draw: 'e 0 0 40 40; fs; p M 20 0 L 40 0; s',          // drawing language, see pd-stencil.js
    nozzles: [[0, 20, 'suction'], [40, 0, 'discharge']],  // [x, y, name] in drawing units
    tags: 'pump centrifugal'})
```

then run `npm run symbols` and look at `symbols.png`. Data templates (fields per kind of item)
are in `pd-library.js` (`TEMPLATES`). Symbols are copied into each diagram, so changing a
symbol does not change diagrams that already use it.

## Git layout

One repository: https://github.com/tschembe/ProcessDraw (private), branch `main`.
`drawio/` (the editor) is a normal folder, no longer a submodule. The first commit is the
unmodified upstream import (jgraph/drawio-desktop 0623fb3 + jgraph/drawio 32.6.10); every later
commit is ProcessDraw work.

```bash
git clone https://github.com/tschembe/ProcessDraw.git
cd ProcessDraw && npm install && npm start
```

### Updating to a newer draw.io

1. Download the new drawio-desktop and drawio releases.
2. Copy them over the repository (keep `drawio/src/main/webapp/js/processdraw/`, `tools/`,
   `PROCESSDRAW.md`, `TODO.md`).
3. Re-apply the changes listed in "Changes to upstream files" above, run `npm run sync -- disableUpdate`,
   the tests and the self-test, then commit.

## Roadmap

| Phase | Content | Status |
|---|---|---|
| 0 | Setup, rebrand, extension hook, git | done |
| 1 | ISA 5.1 / ISO 10628 + DIN/EN symbol libraries with nozzles and data templates | done |
| 2 | Smart objects: engineering properties, auto tag numbering, ISA instrument bubbles | done |
| 3 | Configurable line numbering spec | done |
| 4 | Multi-sheet project, off-page connectors, project-wide tag uniqueness | done |
| 5 | PFD stream markers + heat and material balance tables | done |
| 6 | Excel equipment/line/instrument/valve lists + consistency checker | done |
| 7 | Drawing sheets: title block, revision table, revision clouds, IFR/IFC stamps | done |
