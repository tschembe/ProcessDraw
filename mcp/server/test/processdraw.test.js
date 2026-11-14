// ProcessDraw MCP tools, end to end over stdio (node --test).
// Set PROCESSDRAW_TEST_RENDER=1 to also render previews with the ProcessDraw CLI.
import test from "node:test";
import assert from "node:assert";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "fs";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "pd-mcp-test-"));
const render = process.env.PROCESSDRAW_TEST_RENDER == "1";

async function connect()
{
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(__dirname, "..", "src", "index.js")],
    env: Object.assign({}, process.env, {PROCESSDRAW_OPEN: "off", DRAWIO_BROWSER: "off",
      PROCESSDRAW_LIBRARY: join(dir, "symbols.json")}),
  });
  const client = new Client({name: "test", version: "1"});
  await client.connect(transport);
  return client;
}

const SPEC = {
  project: {projectNumber: "T-1", projectName: "Test Plant", docPrefix: "T-1-PID-"},
  settings: {components: ["Methane", "Water"]},
  sheets: [
    {
      title: "Feed", frame: "auto", layout: "auto",
      items: [
        {id: "V1", symbol: "pd_vessel_vertical", data: {service: "Feed Drum"}},
        {id: "P1", symbol: "pd_pump_centrifugal", data: {service: "Feed Pump"}},
        {id: "FV", symbol: "pd_valve_control", tag: "FV-201"},
        {id: "SC", symbol: "test_scrubber"},
        {id: "OUT", symbol: "pd_offpage_out", description: "TO", link: "C01"},
      ],
      lines: [
        {id: "L1", from: "V1.bottom", to: "P1.suction", data: {size: "4\"", service_code: "P", pipe_class: "A1A"}},
        {id: "L2", from: "P1.discharge", to: "FV.in", data: {size: "3\"", service_code: "P", pipe_class: "A1A"}},
        {id: "L3", from: "FV.out", to: "OUT.in"},
        {id: "L4", from: "V1.top", to: "SC.inlet"},
        {id: "L5", from: "V1.nozzle-x", to: "P1"},
      ],
      streams: [{line: "L1", data: {temperature: "40", comp_Methane: "0.2"}}],
      hmb: true,
      summaries: ["V1"],
    },
    {
      title: "Product", frame: "A3",
      items: [
        {id: "IN", symbol: "pd_offpage_in", description: "FROM", link: "C01"},
        {id: "T1", symbol: "pd_tank_cone_roof", data: {service: "Product Tank"}},
      ],
      lines: [{id: "L1", from: "IN.out", to: "T1.L1"}],
    },
  ],
};

test("ProcessDraw tools over MCP", async (t) =>
{
  const client = await connect();

  try
  {
    const list = await client.listTools();
    const names = list.tools.map((x) => x.name);

    for (const n of ["processdraw_get_reference", "processdraw_list_symbols", "processdraw_create_drawing",
      "processdraw_define_symbol", "processdraw_read_drawing", "processdraw_update_drawing",
      "processdraw_export_lists", "processdraw_preview", "open_drawio_xml", "search_shapes"])
    {
      assert.ok(names.includes(n), "tool " + n);
    }

    for (const tool of list.tools)
    {
      assert.ok(tool.description.length <= 2048, tool.name + " description too long");
    }

    const ref = await client.callTool({name: "processdraw_get_reference", arguments: {}});
    assert.match(ref.content[0].text, /Drawing language/);

    const symbols = await client.callTool({name: "processdraw_list_symbols", arguments: {query: "centrifugal pump"}});
    assert.match(symbols.content[0].text, /pd_pump_centrifugal .*nozzles: suction, discharge/);

    const def = await client.callTool({name: "processdraw_define_symbol", arguments: {preview: render, symbol: {
      id: "test_scrubber", name: "Test Scrubber", cls: "equipment", prefix: "S", template: "vessel", w: 40, h: 90,
      draw: "p M 0 10 A 20 10 0 0 1 40 10 L 40 80 A 20 10 0 0 1 0 80 Z; fs; d 1; p M 0 45 L 40 45; s; d 0",
      nozzles: [[0, 30, "inlet"], [20, 0, "gas-out"], [20, 90, "drain"]]}}});
    assert.ok(!def.isError, def.content[0].text);
    assert.ok(existsSync(join(dir, "symbols.json")) && existsSync(join(dir, "symbols.xml")), "library files");
    assert.match(readFileSync(join(dir, "symbols.xml"), "utf8"), /^<mxlibrary>\[\{"xml":/);

    const file = join(dir, "test.drawio");
    const res = await client.callTool({name: "processdraw_create_drawing",
      arguments: {path: file, spec: SPEC, preview: render}});
    assert.ok(!res.isError, res.content[0].text);
    const report = res.content[0].text;
    assert.match(report, /Tags: V-101, P-101, FV-201, S-101/);
    assert.match(report, /4"-P-1001-A1A/);
    assert.match(report, /3"-P-1002-A1A/);
    assert.match(report, /has no nozzle "nozzle-x"/);

    const xml = readFileSync(file, "utf8");
    assert.match(xml, /connector_id="C01"[^>]*sheet="T-1-PID-002"|sheet="T-1-PID-002"[^>]*connector_id="C01"/);
    assert.ok((xml.match(/line_number="3&quot;-P-1002-A1A"/g) || []).length >= 3,
      "line continues through the valve and the off-page connector");
    assert.match(xml, /pd_class="hmb"/);
    assert.match(xml, /HEAT AND MATERIAL BALANCE/);
    assert.match(xml, /pageWidth="1654"/);

    if (render)
    {
      assert.ok(res.content.filter((c) => c.type == "image").length == 2, "two previews");
    }

    const read = await client.callTool({name: "processdraw_read_drawing", arguments: {path: file}});
    assert.match(read.content[0].text, /P-101 \[equipment\] service=Feed Pump/);
    assert.match(read.content[0].text, /3"-P-1002-A1A \(2 segment\(s\)\)/);

    const upd = await client.callTool({name: "processdraw_update_drawing", arguments: {path: file,
      updates: [{tag: "P-101", data: {flow_rate: "12"}}, {line: "4\"-P-1001-A1A", data: {size: "6\""}}]}});
    assert.ok(!upd.isError, upd.content[0].text);
    const read2 = await client.callTool({name: "processdraw_read_drawing", arguments: {path: file}});
    assert.match(read2.content[0].text, /flow_rate=12/);
    assert.match(read2.content[0].text, /6"-P-1001-A1A/);

    const xl = await client.callTool({name: "processdraw_export_lists", arguments: {path: file}});
    assert.match(xl.content[0].text, /Equipment: 4/);
    assert.ok(existsSync(join(dir, "test lists.xlsx")));

    const again = await client.callTool({name: "processdraw_create_drawing", arguments: {path: file, spec: SPEC}});
    assert.ok(again.isError, "no overwrite without overwrite: true");
  }
  finally
  {
    await client.close();
    rmSync(dir, {recursive: true, force: true});
  }
});
