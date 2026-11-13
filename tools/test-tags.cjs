// Unit tests for the pure tag functions in pd-tags.js: node --test tools/test-tags.cjs
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = {console, mxUtils: {isNode: () => false}};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../drawio/src/main/webapp/js/processdraw/pd-tags.js'), 'utf8'), ctx);
const T = ctx.ProcessDraw.Tags;
const S = {separator: '-', digits: 3, start: 101, step: 1};
const plain = (o) => JSON.parse(JSON.stringify(o));

test('parse equipment tags', () =>
{
	assert.deepStrictEqual(plain(T.parse('P-101A')), {prefix: 'P', sep: '-', number: 101, digits: '101', suffix: 'A'});
	assert.deepStrictEqual(plain(T.parse('10-P-101')), {prefix: '10-P', sep: '-', number: 101, digits: '101', suffix: ''});
	assert.deepStrictEqual(plain(T.parse('TK205')), {prefix: 'TK', sep: '', number: 205, digits: '205', suffix: ''});
	assert.strictEqual(T.parse('P-???'), null);
	assert.strictEqual(T.parse(''), null);
	assert.strictEqual(T.parse('101'), null);
});

test('parse instrument tags', () =>
{
	assert.deepStrictEqual(plain(T.parseInstrument('FIC-101')), {area: '', fn: 'FIC', loop: '101'});
	assert.deepStrictEqual(plain(T.parseInstrument('fic 101a')), {area: '', fn: 'FIC', loop: '101A'});
	assert.deepStrictEqual(plain(T.parseInstrument('PT101')), {area: '', fn: 'PT', loop: '101'});
	assert.deepStrictEqual(plain(T.parseInstrument('20-LT-005')), {area: '20', fn: 'LT', loop: '005'});
	assert.deepStrictEqual(plain(T.parseInstrument('TI-???')), {area: '', fn: 'TI', loop: '???'});
	assert.strictEqual(T.parseInstrument('hello world'), null);
});

test('format', () =>
{
	assert.strictEqual(T.format('P', 7, S), 'P-007');
	assert.strictEqual(T.format('E', 1201, S, 'B'), 'E-1201B');
	assert.strictEqual(T.formatInstrument('', 'FIC', '101', S), 'FIC-101');
	assert.strictEqual(T.formatInstrument('20', 'LT', '005', S), '20-LT-005');
});

test('decode ISA letters', () =>
{
	assert.strictEqual(T.decodeIsa('FIC'), 'Flow Indicating Controller');
	assert.strictEqual(T.decodeIsa('PDIT'), 'Pressure Differential Indicating Transmitter');
	assert.strictEqual(T.decodeIsa('LAHH'), 'Level Alarm High High');
	assert.strictEqual(T.decodeIsa('PSV'), 'Pressure Safety Valve');
	assert.strictEqual(T.decodeIsa('FQI'), 'Flow Totalizing Indicating');
	assert.strictEqual(T.decodeIsa('TT'), 'Temperature Transmitter');
	assert.strictEqual(T.decodeIsa(''), '');
	assert.strictEqual(T.decodeIsa('12'), '');
});
