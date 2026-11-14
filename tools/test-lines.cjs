// Unit tests for the pure line functions in pd-lines.js: node --test tools/test-lines.cjs
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = {console, mxUtils: {isNode: () => false, indexOf: (a, o) => a.indexOf(o)}};
ctx.window = ctx;
vm.createContext(ctx);
const dir = path.join(__dirname, '../drawio/src/main/webapp/js/processdraw');
vm.runInContext(fs.readFileSync(path.join(dir, 'pd-tags.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(dir, 'pd-lines.js'), 'utf8'), ctx);
const L = ctx.ProcessDraw.Lines;
const P = ctx.ProcessDraw.Tags.DEFAULTS.linePattern;
const full = {size: '6"', service_code: 'P', sequence: '1001', pipe_class: 'A1A', insulation: 'H'};

test('default pattern', () =>
{
	assert.strictEqual(L.formatLine(P, full), '6"-P-1001-A1A-H');
	assert.strictEqual(L.formatLine(P, Object.assign({}, full, {insulation: ''})), '6"-P-1001-A1A');
});

test('missing required fields show ?', () =>
{
	assert.strictEqual(L.formatLine(P, {sequence: '1001'}), '?-?-1001-?');
	assert.strictEqual(L.formatLine(P, {size: ' 4" ', service_code: 'CWS', sequence: '0007'}), '4"-CWS-0007-?');
});

test('custom patterns', () =>
{
	assert.strictEqual(L.formatLine('{service_code}{sequence}/{size}', full), 'P1001/6"');
	assert.strictEqual(L.formatLine('[{area}-]{size}-{service_code}-{sequence}', full), '6"-P-1001');
	assert.strictEqual(L.formatLine('[{area}-]{size}-{service_code}-{sequence}', Object.assign({area: '20'}, full)),
		'20-6"-P-1001');
	assert.strictEqual(L.formatLine('LINE {sequence}', full), 'LINE 1001');
	assert.strictEqual(L.formatLine('{sequence}[ ({fluid}, {insulation})]', full), '1001');
	assert.strictEqual(L.formatLine('', full), '');
});

test('code lists', () =>
{
	const codes = JSON.parse(JSON.stringify(L.parseCodes('P = Process\n\nCWS=Cooling water supply\nN2\r\nIA = Air = dry')));
	assert.deepStrictEqual(codes, [{code: 'P', description: 'Process'},
		{code: 'CWS', description: 'Cooling water supply'}, {code: 'N2', description: ''},
		{code: 'IA', description: 'Air = dry'}]);
	assert.strictEqual(L.parseCodes(ctx.ProcessDraw.Tags.DEFAULTS.serviceCodes).length, 18);
});
