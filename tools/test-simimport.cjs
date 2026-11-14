// Tests for pd-simimport.js: node --test tools/test-simimport.cjs
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = {console};
ctx.window = ctx;
vm.createContext(ctx);
const dir = path.join(__dirname, '../drawio/src/main/webapp/js/processdraw');
vm.runInContext(fs.readFileSync(path.join(dir, 'pd-xlsx.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(dir, 'pd-simimport.js'), 'utf8'), ctx);
const SI = ctx.ProcessDraw.SimImport;
const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= (tol || 1e-6), a + ' != ' + b);
const COMPS = [{name: 'Methane', key: 'comp_Methane'}, {name: 'n-Butane', key: 'comp_n_Butane'},
	{name: 'CO2', key: 'comp_CO2'}, {name: 'Water', key: 'comp_Water'}];

test('temperature', () =>
{
	near(SI.convert(313.15, 'K', 'temperature', 'metric'), 40);
	near(SI.convert('104', '°F', 'temperature', 'metric'), 40);
	near(SI.convert(40, 'C', 'temperature', 'imperial'), 104);
	assert.strictEqual(SI.convert(40, 'xyz', 'temperature', 'metric'), null);
});

test('pressure becomes gauge', () =>
{
	near(SI.convert(2301.325, 'kPa', 'pressure', 'metric'), 22, 1e-9);
	near(SI.convert(2301325, 'Pa', 'pressure', 'metric'), 22, 1e-9);
	near(SI.convert(22, 'barg', 'pressure', 'metric'), 22);
	near(SI.convert(22, 'bar(g)', 'pressure', 'metric'), 22);
	near(SI.convert(23.01325, 'bara', 'pressure', 'metric'), 22, 1e-9);
	near(SI.convert(100, 'psig', 'pressure', 'imperial'), 100, 1e-6);
	near(SI.convert(114.696, 'psia', 'pressure', 'imperial'), 100, 1e-3);
	assert.strictEqual(SI.convert(22, '', 'pressure', 'metric'), null);
});

test('flows, density, viscosity, fractions', () =>
{
	near(SI.convert(13.3889, 'kg/s', 'mass_flow', 'metric'), 48200, 0.1);
	near(SI.convert(48.2, 't/h', 'mass_flow', 'metric'), 48200);
	near(SI.convert(1890, 'kgmole/h', 'molar_flow', 'metric'), 1890);
	near(SI.convert(525, 'mol/s', 'molar_flow', 'metric'), 1890);
	near(SI.convert(1, 'MMSCFD', 'std_gas_flow', 'metric'), 1179.87);
	near(SI.convert(0.612, 'g/cm3', 'density', 'metric'), 612);
	near(SI.convert(0.00025, 'Pa.s', 'viscosity', 'metric'), 0.25);
	near(SI.convert(62, '%', 'fraction', 'metric'), 0.62);
	near(SI.convert('0,62', '', 'fraction', 'metric'), 0.62);
});

test('number formatting', () =>
{
	assert.strictEqual(SI.formatValue(48213.7, 'mass_flow'), '48214');
	assert.strictEqual(SI.formatValue(21.98765, 'pressure'), '21.99');
	assert.strictEqual(SI.formatValue(0.712345, 'fraction'), '0.7123');
	assert.strictEqual(SI.formatValue(40.0000001, 'temperature'), '40');
	assert.strictEqual(SI.formatValue(-0.0001, 'temperature'), '0');
});

test('labels and units', () =>
{
	assert.deepStrictEqual(JSON.parse(JSON.stringify(SI.splitUnit('Temperature [C]'))), {label: 'Temperature', unit: 'C'});
	assert.deepStrictEqual(JSON.parse(JSON.stringify(SI.splitUnit('Mass Flow (kg/h)'))), {label: 'Mass Flow', unit: 'kg/h'});
	assert.deepStrictEqual(JSON.parse(JSON.stringify(SI.splitUnit('Comp Mole Frac (Methane)'))),
		{label: 'Comp Mole Frac (Methane)', unit: ''});
	const k = (l, u) => SI.matchRow(l, u, COMPS).key;
	assert.strictEqual(k('Vapour Fraction'), 'vapour_fraction');
	assert.strictEqual(k('Molar Fraction (Vapor Phase)'), 'vapour_fraction');
	assert.strictEqual(k('Temperature [C]'), 'temperature');
	assert.strictEqual(k('Pressure', 'kPa'), 'pressure');
	assert.strictEqual(k('True VP at 37.8 C (Pressure)'), null);
	assert.strictEqual(k('Molar Flow [kgmole/h]'), 'molar_flow');
	assert.strictEqual(k('Mass Flow'), 'mass_flow');
	assert.strictEqual(k('Std Gas Flow [MMSCFD]'), 'std_gas_flow');
	assert.strictEqual(k('Actual Volume Flow [m3/h]'), 'vol_flow');
	assert.strictEqual(k('Molecular Weight'), 'molecular_weight');
	assert.strictEqual(k('Mass Density [kg/m3]'), 'density');
	assert.strictEqual(k('Std Ideal Liq Mass Density'), null);
	assert.strictEqual(k('Viscosity [cP]'), 'viscosity');
	assert.strictEqual(k('Comp Mole Frac (Methane)'), 'comp_Methane');
	assert.strictEqual(k('Molar Fraction (Mixture) / n-Butane'), 'comp_n_Butane');
	assert.strictEqual(k('Comp Mole Frac (nC4)'), 'comp_n_Butane');
	assert.strictEqual(k('H2O'), 'comp_Water');
	assert.strictEqual(SI.matchRow('Comp Mass Frac (CO2)', null, COMPS).basis, 'mass fraction');
	assert.strictEqual(k('Heat Flow [kJ/h]'), null);
});

test('HYSYS workbook copy (units in labels)', () =>
{
	const tsv = '\t1\t2\t3\n' +
		'Vapour Fraction\t0.6200\t0.5800\t1.0000\n' +
		'Temperature [C]\t78.00\t40.00\t40.00\n' +
		'Pressure [kPa]\t2301\t2251\t2231\n' +
		'Molar Flow [kgmole/h]\t1890\t1890\t1096\n' +
		'Mass Flow [kg/h]\t4.820e+004\t4.820e+004\t2.140e+004\n' +
		'Heat Flow [kJ/h]\t-1.2e+08\t-1.3e+08\t-6e+07\n' +
		'Comp Mole Frac (Methane)\t0.7120\t0.7120\t0.9020\n';
	const a = SI.analyse(ctx.ProcessDraw.Xlsx.parseDelimited(tsv), COMPS);
	assert.strictEqual(a.transposed, false);
	assert.strictEqual(a.unitColumn, -1);
	assert.deepStrictEqual(Array.from(a.streams, s => s.name), ['1', '2', '3']);
	assert.deepStrictEqual(Array.from(a.rows, r => r.match.key), ['vapour_fraction', 'temperature', 'pressure', 'molar_flow',
		'mass_flow', null, 'comp_Methane']);
	const p = a.rows[2];
	near(SI.convert(p.raw[1], p.match.unit, 'pressure', 'metric'), 21.99, 0.01);
	near(SI.convert(a.rows[4].raw[1], a.rows[4].match.unit, 'mass_flow', 'metric'), 48200);
});

test('DWSIM CSV export (unit column, SI units)', () =>
{
	const csv = 'Object,Units,Feed,Gas,Liquid\n' +
		'Temperature,K,351.15,313.15,313.15\n' +
		'Pressure,Pa,2301325,2131325,2131325\n' +
		'Mass Flow,kg/s,13.389,5.944,7.444\n' +
		'Molar Flow,mol/s,525,304.4,220.6\n' +
		'Vapor Phase Molar Fraction,,0.62,1,0\n' +
		'Molar Fraction (Mixture) / Methane,,0.712,0.902,0.45\n';
	const a = SI.analyse(ctx.ProcessDraw.Xlsx.parseDelimited(csv), COMPS);
	assert.strictEqual(a.unitColumn, 1);
	assert.deepStrictEqual(Array.from(a.streams, s => s.name), ['Feed', 'Gas', 'Liquid']);
	assert.deepStrictEqual(Array.from(a.rows, r => r.match.key), ['temperature', 'pressure', 'mass_flow', 'molar_flow',
		'vapour_fraction', 'comp_Methane']);
	near(SI.convert(a.rows[0].raw[2], a.rows[0].match.unit, 'temperature', 'metric'), 78);
	near(SI.convert(a.rows[3].raw[2], a.rows[3].match.unit, 'molar_flow', 'metric'), 1890);
});

test('streams in rows are transposed', () =>
{
	const csv = 'Stream,Temperature [C],Pressure [barg],Mass Flow [kg/h]\nS1,78,22,48200\nS2,40,21.5,48200\n';
	const a = SI.analyse(ctx.ProcessDraw.Xlsx.parseDelimited(csv), COMPS);
	assert.strictEqual(a.transposed, true);
	assert.deepStrictEqual(Array.from(a.streams, s => s.name), ['S1', 'S2']);
	assert.deepStrictEqual(Array.from(a.rows, r => r.match.key), ['temperature', 'pressure', 'mass_flow']);
});

test('stream matching by number and name', () =>
{
	const streams = [{n: '1', d: 'Well fluids'}, {n: '2', d: 'Cooled feed'}, {n: '3', d: 'Flash gas'}];
	const attr = (s, k) => (k == 'stream_number') ? s.n : s.d;
	assert.strictEqual(SI.matchStream('2', streams, attr), streams[1]);
	assert.strictEqual(SI.matchStream('Stream 3', streams, attr), streams[2]);
	assert.strictEqual(SI.matchStream('S1', streams, attr), streams[0]);
	assert.strictEqual(SI.matchStream('flash gas', streams, attr), streams[2]);
	assert.strictEqual(SI.matchStream('Unknown', streams, attr), null);
});
