# ProcessDraw drawing reference

ProcessDraw draws PFDs and P&IDs from a JSON **spec**. Symbols, tags, line numbers, title
blocks and H&MB tables follow the ProcessDraw rules, so the file opens in ProcessDraw with all
engineering data (lists, checks, Excel export work).

## Workflow (paper / report / project → drawing)

1. Read the source and list: equipment (with service and data), streams and their conditions,
   control loops (measured variable, controller, final element), utilities, battery limits.
2. `processdraw_list_symbols` for the symbols you need (query e.g. "pump", "column", "psv").
   If something is missing, design it with `processdraw_define_symbol` (look at the preview).
3. Build one sheet per process section (about 6–12 main equipment items per sheet). Connect
   sheets with off-page connectors that share a `link`.
4. `processdraw_create_drawing` with the spec. Check the returned preview and warnings, fix the
   spec (missing nozzles, unknown symbols) and build again.
5. Give the user the file path. They open it in ProcessDraw to review and refine.

Use tags, line sizes and design data from the source when given; otherwise leave them out —
ProcessDraw numbers the items (P-101, V-101, …) and lines (pattern below) itself.

## Spec

```json
{
  "project": {"projectNumber": "2026-120", "projectName": "Gas Plant", "client": "ACME",
              "site": "Plant 2", "area": "Unit 100", "preparedBy": "…", "docPrefix": "2026-120-PID-"},
  "settings": {"units": "metric", "components": ["Methane", "Ethane", "Water"],
               "linePattern": "{size}-{service_code}-{sequence}-{pipe_class}[-{insulation}]"},
  "symbols": [ /* optional custom symbols, same format as processdraw_define_symbol */ ],
  "sheets": [{
    "title": "Feed Cooling and Flash Drum", "type": "P&ID", "number": "001",
    "frame": "auto", "status": "ISSUED FOR REVIEW",
    "revisions": [{"rev": "A", "date": "2026-11-14", "description": "Issued for review", "by": "AI"}],
    "layout": "auto", "direction": "horizontal",
    "items": [
      {"id": "E1", "symbol": "pd_hx_shell_tube_u", "data": {"service": "Feed Cooler", "duty": "1450"}},
      {"id": "V1", "symbol": "pd_vessel_vertical_demister", "tag": "V-101", "data": {"service": "Flash Drum"}},
      {"id": "P1", "symbol": "pd_pump_centrifugal", "tag": "P-101A"},
      {"id": "LT", "symbol": "pd_inst_discrete_field", "function": "LT", "loop": "101"},
      {"id": "IN", "symbol": "pd_offpage_in", "description": "FEED FROM", "link": "C01"}
    ],
    "lines": [
      {"id": "L1", "from": "IN.out", "to": "E1.tube-in", "data": {"size": "6\"", "service_code": "P", "pipe_class": "A1A"}},
      {"id": "L2", "from": "E1.tube-out", "to": "V1.L2"},
      {"id": "S1", "type": "electric", "from": "LT.right", "to": "LIC.left"}
    ],
    "streams": [{"line": "L1", "data": {"description": "Feed", "temperature": "78", "pressure": "22",
                 "mass_flow": "48200", "comp_Methane": "0.71"}}],
    "hmb": true,
    "summaries": ["E1", "V1"]
  }]
}
```

### Items
- `id` (required, unique on the sheet, used in lines), `symbol` (id from processdraw_list_symbols).
- `tag` optional (else automatic). Instruments: `function` (ISA letters, e.g. "FIC") and `loop`
  ("101") or `tag` "FIC-101"; give the same loop to all members of one control loop.
- `data`: engineering fields (service, material, design_pressure, design_temperature, flow_rate,
  differential_head, power, duty, area, diameter, length_tt, size, pipe_class, fail_position,
  set_pressure, range, location …). Values are text in the project units (metric: barg, °C,
  m³/h, kW, mm; imperial: psig, °F, gpm, hp, in).
- `x`, `y` optional: with positions on all items and `"layout": "manual"` nothing is moved.
- Off-page connectors: `pd_offpage_out` (line goes to another sheet, nozzle `in`) and
  `pd_offpage_in` (line comes from another sheet, nozzle `out`); the pair shares `link`.

### Lines
- `from` / `to`: `"<item id>.<nozzle>"` (nozzle names from processdraw_list_symbols). Without
  a nozzle the line attaches anywhere on the item.
- `type`: main (default), secondary, future, existing, jacketed; signal lines:
  process_connection, electric, pneumatic, hydraulic, capillary, data.
- `data`: size, service_code (P, G, CWS, CWR, LS, MS, HS, C, IA, N, FG, F, V, D, W, …),
  pipe_class, insulation (H, C, P, ET, ST …), fluid, sequence. Segments joined through valves,
  fittings and linked off-page connectors are one line: data from any segment applies to all.
- `line_number` sets a fixed number instead of the pattern.

### Streams (PFD)
`{"line": "<line id>", "number": 1, "data": {...}}` puts a stream marker on the line. Fields:
description, temperature, pressure, vapour_fraction, mass_flow, molar_flow, vol_flow,
std_gas_flow, molecular_weight, density, viscosity and `comp_<Name>` for components listed in
settings.components (spaces and dashes become `_`, e.g. `comp_n_Butane`). `"hmb": true` adds
the heat and material balance table.

### Sheets
`frame`: auto (smallest of A3, A2, A1, A0 that fits), A3, A2, A1, A0 or none. Title block and
revision table are filled from project, sheet and revisions. `summaries`: item ids that get an
equipment summary label above the drawing (useful on PFDs).

## Custom symbols (processdraw_define_symbol)

```json
{"id": "my_scrubber", "name": "Venturi Scrubber", "cls": "equipment", "prefix": "S",
 "template": "vessel", "w": 40, "h": 100,
 "draw": "p M 0 12 A 20 12 0 0 1 40 12 L 40 88 A 20 12 0 0 1 0 88 Z; fs; p M 20 0 L 20 30; s",
 "nozzles": [[20, 0, "inlet"], [20, 100, "drain"], [40, 40, "gas-out"]]}
```

- `cls`: equipment, valve, instrument, special, fitting, annotation. `prefix`: tag prefix.
  `template`: vessel, column, tank, heat_exchanger, pump, compressor, fan, filter, equipment,
  valve, control_valve, safety_valve, instrument, special.
- Coordinates are in the symbol's own w × h box (y down). Nozzles `[x, y, name]` on the outline.
- Drawing language (commands separated by `;`):
  `e x y w h` ellipse · `r x y w h` rectangle · `rr x y w h arc` rounded rectangle ·
  `p <path>` with `M x y`, `L x y`, `Q x1 y1 x y`, `C x1 y1 x2 y2 x y`,
  `A rx ry rotation large sweep x y`, `Z` · then paint the shape: `fs` fill+stroke, `s` stroke,
  `f` fill, `F` solid (stroke colour) · `d 1`/`d 0` dashed on/off · `t x y size text`.
- Keep symbols simple line art in the style of ISO 10628 (outline, white fill, black lines).
  Look at the returned preview and correct the drawing if it is wrong.
