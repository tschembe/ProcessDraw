// Tests for pd-xlsx.js: node --test tools/test-xlsx.cjs
// Writes a workbook with the real writer; when PD_XLSX_OUT is set the files are
// also zipped to that path (via python3) so they can be opened with openpyxl.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const {execFileSync} = require('child_process');

const ctx = {console};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../drawio/src/main/webapp/js/processdraw/pd-xlsx.js'), 'utf8'), ctx);
const X = ctx.ProcessDraw.Xlsx;

const sheets = [
	{name: 'Equipment List', title: 'EQUIPMENT LIST', info: ['Project 2026-114', 'Date 2026-11-14'],
		columns: [{header: 'Tag', width: 10}, {header: 'Service', width: 30}, {header: 'Design pressure [barg]'}],
		rows: [['P-101A', 'Condensate <pump> & "spare"', 25], ['V-101', 'Flash Drum', 12.5]]},
	{name: 'Lines/Piping: [all]?', title: 'LINE LIST', info: [], columns: [{header: 'Line number'}],
		rows: [['6"-P-1001-A1A']]},
	{name: 'Equipment List', title: 'DUPLICATE NAME', columns: [], rows: []}
];

test('column names', () =>
{
	assert.deepStrictEqual([0, 25, 26, 27, 701, 702].map(X.colName), ['A', 'Z', 'AA', 'AB', 'ZZ', 'AAA']);
});

test('sheet names are valid and unique', () =>
{
	const used = {};
	assert.strictEqual(X.sheetName('Lines/Piping: [all]?', used), 'Lines Piping   all');
	assert.strictEqual(X.sheetName('Equipment', used), 'Equipment');
	assert.strictEqual(X.sheetName('equipment', used), 'equipment 2');
	assert.strictEqual(X.sheetName('x'.repeat(40), used).length, 31);
});

test('workbook files', () =>
{
	const files = X.buildFiles(sheets, {title: 'Test'});
	assert.ok(files['[Content_Types].xml'].includes('sheet3.xml'));
	assert.ok(files['xl/workbook.xml'].includes('name="Equipment List 2"'));
	assert.ok(files['xl/workbook.xml'].includes('_xlnm._FilterDatabase'));
	const s1 = files['xl/worksheets/sheet1.xml'];
	assert.ok(s1.includes('Condensate &lt;pump&gt; &amp; &quot;spare&quot;'));
	assert.ok(s1.includes('<v>12.5</v>'), 'numbers stay numeric');
	assert.ok(s1.includes('<autoFilter ref="A5:C7"/>'), 'filter covers header and rows');
	assert.ok(s1.includes('ySplit="5"'), 'header row frozen');

	if (process.env.PD_XLSX_OUT)
	{
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdxlsx-'));

		for (const [p, content] of Object.entries(files))
		{
			fs.mkdirSync(path.join(dir, path.dirname(p)), {recursive: true});
			fs.writeFileSync(path.join(dir, p), content);
		}

		execFileSync('python3', ['-c', 'import os,sys,zipfile\nd,o=sys.argv[1],sys.argv[2]\n' +
			'z=zipfile.ZipFile(o,"w",zipfile.ZIP_DEFLATED)\n' +
			'[z.write(os.path.join(r,f),os.path.relpath(os.path.join(r,f),d)) for r,_,fs in os.walk(d) for f in fs]\n' +
			'z.close()', dir, process.env.PD_XLSX_OUT]);
	}
});

// ---------------------------------------------------------------- Reading
function loadWithZip()
{
	const zctx = {console, setTimeout, clearTimeout, setImmediate, Promise, Uint8Array, ArrayBuffer, TextEncoder, TextDecoder};
	zctx.window = zctx;
	zctx.self = zctx;
	vm.createContext(zctx);
	const web = path.join(__dirname, '../drawio/src/main/webapp/js');
	vm.runInContext(fs.readFileSync(path.join(web, 'jszip/jszip.min.js'), 'utf8'), zctx);
	vm.runInContext(fs.readFileSync(path.join(web, 'processdraw/pd-xlsx.js'), 'utf8'), zctx);
	return zctx;
}

test('write and read back with hidden key row and column', async () =>
{
	const z = loadWithZip();
	const sheet = {name: 'Equipment', title: 'EQUIPMENT LIST', info: ['Project X'],
		columns: [{header: 'ID', hidden: true}, {header: 'Tag'}, {header: 'Flow rate [m³/h]'}],
		keys: ['#id', 'tag', 'flow_rate'], rows: [['p1:7', 'P-101A', 38], ['p1:9', 'V-101 & "x"', '']]};
	const data = await new Promise((res, rej) => z.ProcessDraw.Xlsx.toBase64([sheet], {}, res, rej));
	const wb = await z.ProcessDraw.Xlsx.readWorkbook(Buffer.from(data, 'base64'));
	const rows = wb[0].rows;
	assert.strictEqual(wb[0].name, 'Equipment');
	const keyRow = rows.findIndex(r => r[0] === '#id');
	assert.ok(wb[0].hiddenRows[keyRow], 'key row hidden');
	assert.deepStrictEqual(JSON.parse(JSON.stringify(rows[keyRow + 1])), ['p1:7', 'P-101A', 38]);
	assert.deepStrictEqual(JSON.parse(JSON.stringify(rows[keyRow + 2])), ['p1:9', 'V-101 & "x"', '']);
	const files = z.ProcessDraw.Xlsx.buildFiles([sheet]);
	assert.ok(files['xl/worksheets/sheet1.xml'].includes('hidden="1"/>'), 'hidden column');
});

test('reads a workbook saved by another program (shared strings, rich text)', async (t) =>
{
	const py = process.env.PD_PYTHON;
	if (!py)
	{
		t.skip('set PD_PYTHON to a python with openpyxl');
		return;
	}
	const out = path.join(os.tmpdir(), 'pd-openpyxl-' + process.pid + '.xlsx');
	execFileSync(py, ['-c', 'import sys,openpyxl\nfrom openpyxl.cell.rich_text import CellRichText,TextBlock\n' +
		'from openpyxl.cell.text import InlineFont\nwb=openpyxl.Workbook();ws=wb.active;ws.title="Lines"\n' +
		'ws.append(["Line number","Size"]);ws.append(["#key","size"]);ws.row_dimensions[2].hidden=True\n' +
		'ws.append(["6\\"-P-1001-A1A",6.5]);ws["A4"]=CellRichText([TextBlock(InlineFont(b=True),"rich "),"text"])\n' +
		'ws["B4"]="=1+1"\nwb.save(sys.argv[1])', out]);
	const z = loadWithZip();
	const wb = await z.ProcessDraw.Xlsx.readWorkbook(fs.readFileSync(out));
	fs.unlinkSync(out);
	assert.strictEqual(wb[0].name, 'Lines');
	assert.ok(wb[0].hiddenRows[1]);
	assert.strictEqual(wb[0].rows[2][0], '6"-P-1001-A1A');
	assert.strictEqual(wb[0].rows[2][1], 6.5);
	assert.strictEqual(wb[0].rows[3][0], 'rich text');
});

test('CSV and tab separated text', () =>
{
	const z = loadWithZip();
	const P = (t) => JSON.parse(JSON.stringify(z.ProcessDraw.Xlsx.parseDelimited(t)));
	assert.deepStrictEqual(P('a,b\n"x, y","say ""hi"""\n'), [['a', 'b'], ['x, y', 'say "hi"']]);
	assert.deepStrictEqual(P('Name\tS1\tS2\r\nTemperature [C]\t40\t\r\n'), [['Name', 'S1', 'S2'], ['Temperature [C]', '40', '']]);
	assert.deepStrictEqual(P('﻿a;b;c\n1,5;2;3'), [['a', 'b', 'c'], ['1,5', '2', '3']]);
});
