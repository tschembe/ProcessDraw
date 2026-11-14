# Notice

This directory contains a modified copy of the official draw.io MCP server:

- Source: https://github.com/jgraph/drawio-mcp, commit `310aa3c` (`mcp-tool-server` 1.12.0 and `shared/`)
- Copyright draw.io Ltd (JGraph), licensed under the Apache License 2.0 (see [LICENSE](LICENSE))

Changes made for ProcessDraw (2026-11):

- `server/src/index.js`: server name and help text; registers the ProcessDraw tools
  (`processdraw_*`) next to the official tools and routes their calls to `src/processdraw/tools.js`.
- `server/package.json`: package name, version, description; publishing scripts removed.
- New: `server/src/processdraw/` and `server/test/processdraw.test.js`.

All other files are unchanged copies of the official code.
