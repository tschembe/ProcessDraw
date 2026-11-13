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

## Where the ProcessDraw code lives

| Path | Purpose |
|---|---|
| `drawio/src/main/webapp/js/processdraw/` | **All ProcessDraw features** (symbols, smart objects, lists, ...) |
| `drawio/src/main/webapp/js/processdraw/ProcessDraw.js` | Entry point, registers with the editor via `Draw.loadPlugin` |
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

Why the user agent patch: Electron puts the product name into the user agent
(`ProcessDraw/32.6.10`), and draw.io detects desktop mode by looking for `draw.io/`.

**Always run `npm run sync -- disableUpdate`** (never plain `npm run sync`): otherwise
the app would try to install official draw.io updates over ProcessDraw.

## Git layout

Two repositories, each on branch `processdraw`:

- `processdraw/` (desktop wrapper), remote `upstream` = jgraph/drawio-desktop
- `processdraw/drawio/` (editor, submodule), remote `upstream` = jgraph/drawio

Commit editor changes inside `drawio/` first, then commit the updated submodule pointer
in the outer repo.

## Roadmap

| Phase | Content | Status |
|---|---|---|
| 0 | Setup, rebrand, extension hook, git | done |
| 1 | ISA 5.1 / ISO 10628 + DIN/EN symbol libraries with nozzles and data templates | |
| 2 | Smart objects: engineering properties, auto tag numbering, ISA instrument bubbles | |
| 3 | Configurable line numbering spec | |
| 4 | Multi-sheet project, off-page connectors, project-wide tag uniqueness | |
| 5 | PFD stream markers + heat and material balance tables | |
| 6 | Excel equipment/line/instrument/valve lists + consistency checker | |
| 7 | Drawing sheets: title block, revision table, revision clouds, IFR/IFC stamps | |
