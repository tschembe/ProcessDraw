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
