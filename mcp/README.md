# ProcessDraw MCP server

Lets Claude (or any MCP client) draw **ProcessDraw P&IDs and PFDs**: upload a paper, report or
project description and ask Claude to draw it. The result is a normal ProcessDraw `.drawio` file
with real ProcessDraw symbols, tags, line numbers, engineering data, stream tables, title blocks
and revisions — so Project Check, the Excel lists and everything else in ProcessDraw work on it.

Based on the official [draw.io MCP tool server](https://github.com/jgraph/drawio-mcp)
(`mcp-tool-server` 1.12.0, Apache 2.0, see [NOTICE.md](NOTICE.md)). All official tools are still
there (`open_drawio_xml`, `open_drawio_mermaid`, `search_shapes`, …); ProcessDraw adds:

| Tool | What it does |
|---|---|
| `processdraw_get_reference` | Spec format, symbol drawing language and the paper → P&ID workflow |
| `processdraw_list_symbols` | ProcessDraw symbols with nozzle names (search by words) |
| `processdraw_create_drawing` | Builds a `.drawio` from a JSON spec: numbering, line numbers, off-page links, ELK layout, libavoid line routing, frame, title block, H&MB; returns a preview image per sheet and opens ProcessDraw |
| `processdraw_define_symbol` | New symbols for missing equipment, drawn with the ProcessDraw drawing language; saved to a library and returned as a preview with nozzles marked |
| `processdraw_read_drawing` | Items, data, line numbers, streams and Project Check of a drawing |
| `processdraw_update_drawing` | Changes data by tag, line number or stream number (layout untouched) |
| `processdraw_export_lists` | Equipment / line / instrument / valve lists etc. to `.xlsx` |
| `processdraw_preview` | Preview images of an existing drawing |

## Setup

```bash
cd mcp/server
npm install
```

The server runs on your computer (stdio). It needs ProcessDraw itself next to it (this
repository with `npm install` done) for preview images and for opening files. The first automatic
layout downloads draw.io's layout engine once (it is cached).

### Claude Code

In this repository `.mcp.json` already registers the server (Claude Code asks once to allow it).
To use it from any folder:

```bash
claude mcp add --scope user processdraw -- node /path/to/ProcessDraw/mcp/server/src/index.js
```

### Claude Desktop (Windows / macOS)

Settings > Developer > Edit Config, then add:

```json
{
  "mcpServers": {
    "processdraw": {
      "command": "node",
      "args": ["C:\\path\\to\\ProcessDraw\\mcp\\server\\src\\index.js"]
    }
  }
}
```

claude.ai in the browser can only use remote MCP servers; use Claude Code or Claude Desktop.

## Using it

> *(attach a paper)* Draw the process in this paper as P&IDs in ProcessDraw. Save it as
> /home/me/projects/plant.drawio. Use tags and conditions from the paper.

Claude reads the reference, picks symbols, defines missing ones, builds the drawing, checks the
preview and the Project Check results and fixes the spec if needed. Open the file in ProcessDraw
to review and refine it.

Environment variables: `PROCESSDRAW_OPEN=off` (don't open ProcessDraw), `PROCESSDRAW_LIBRARY`
(custom symbol library, default `~/.processdraw/custom-symbols.json`), `PROCESSDRAW_HOME`
(ProcessDraw repository if the server is moved), `PROCESSDRAW_ELECTRON` (Electron binary).

## Code

| Path | Purpose |
|---|---|
| `server/src/index.js` | Official tool server, ProcessDraw tools registered next to its tools |
| `server/src/processdraw/runtime.js` | Loads ProcessDraw's editor modules (`drawio/src/main/webapp/js/processdraw/`) headlessly |
| `server/src/processdraw/model.js` | Headless diagram model, page XML parse / write |
| `server/src/processdraw/engine.js` | Spec → drawing: items, numbering, lines, streams, layout, frame |
| `server/src/processdraw/library.js` | Custom symbol library (JSON + draw.io library) and symbol preview |
| `server/src/processdraw/reader.js` | Read / update / export existing drawings |
| `server/src/processdraw/render.js` | Previews with the ProcessDraw CLI, open in ProcessDraw |
| `server/src/processdraw/tools.js` | Tool definitions and handlers |
| `server/src/processdraw/reference.md` | Reference returned by `processdraw_get_reference` |
| `shared/`, other `server/src/*.js`, `server/vendor/` | Official draw.io MCP code (unchanged) |

Tests: `cd server && npm test` (official tests + `test/processdraw.test.js`, which drives the
tools over MCP; `PROCESSDRAW_TEST_RENDER=1` also renders previews).
