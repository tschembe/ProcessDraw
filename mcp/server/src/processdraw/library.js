/**
 * Custom symbols defined by the LLM (processdraw_define_symbol): stored in a
 * JSON library and as a draw.io library file (.xml) that ProcessDraw opens with
 * File > Open Library, so the symbols can be dragged from the sidebar too.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';
import { getProcessDraw } from './runtime.js';
import { registerSymbols, normalizeSymbol } from './engine.js';
import { Cell, Page, pageXml } from './model.js';

export function libraryPath(path)
{
	return path || process.env.PROCESSDRAW_LIBRARY || join(homedir(), '.processdraw', 'custom-symbols.json');
}

export function loadLibrary(path)
{
	var file = libraryPath(path);

	if (!existsSync(file))
	{
		return [];
	}

	var data = JSON.parse(readFileSync(file, 'utf8'));

	return Array.isArray(data.symbols) ? data.symbols : [];
}

/**
 * Registers the library symbols in the runtime (call before building).
 */
export function useLibrary(path)
{
	var symbols = loadLibrary(path);

	try
	{
		registerSymbols(getProcessDraw(), symbols);
	}
	catch (e)
	{
		// A broken library entry must not stop drawing with the built-in symbols
	}

	return symbols;
}

/**
 * One-cell model XML of a symbol, as stored in draw.io libraries.
 */
function symbolModel(PD, sym)
{
	var page = new Page('lib', 'lib');
	var cell = new Cell('2', PD.Library.createValue(sym), PD.Library.getStyle(sym));
	cell.vertex = true;
	cell.geometry = {x: 0, y: 0, width: sym.w, height: sym.h, points: []};
	page.add(cell, page.layer);

	return pageXml(page);
}

/**
 * Adds or replaces a symbol in the library; writes the JSON and the draw.io library.
 * Returns {json, xml} paths.
 */
export function saveSymbol(def, path)
{
	var PD = getProcessDraw();
	var sym = normalizeSymbol(def);
	PD.Stencil.compile(sym);
	var file = libraryPath(path);
	var symbols = loadLibrary(file).filter(function(s) { return s.id != sym.id; });
	symbols.push(def);
	mkdirSync(dirname(file), {recursive: true});
	writeFileSync(file, JSON.stringify({symbols: symbols}, null, 1));
	registerSymbols(PD, [def]);

	var entries = symbols.map(function(s)
	{
		var n = normalizeSymbol(s);

		return {xml: PD._ctx.Graph.compress(symbolModel(PD, n)), w: n.w, h: n.h, title: n.name, aspect: 'fixed'};
	});
	var xmlFile = file.replace(/\.json$/i, '') + '.xml';
	writeFileSync(xmlFile, '<mxlibrary>' + JSON.stringify(entries) + '</mxlibrary>');

	return {json: file, xml: xmlFile};
}

/**
 * Preview drawing of a symbol: enlarged, with its nozzles marked and named.
 */
export function symbolPreviewXml(def)
{
	var PD = getProcessDraw();
	var sym = normalizeSymbol(def);
	PD.Stencil.compile(sym);
	var scale = Math.max(2, Math.min(5, 220 / Math.max(sym.w, sym.h)));
	var page = new Page('preview', sym.name);
	var x0 = 120, y0 = 60;
	var cell = new Cell('sym', PD.Library.createValue(sym), PD.Library.getStyle(sym) + 'fontSize=14;');
	cell.vertex = true;
	cell.geometry = {x: x0, y: y0, width: sym.w * scale, height: sym.h * scale, points: []};
	page.add(cell, page.layer);

	(sym.nozzles || []).forEach(function(n, i)
	{
		var cx = x0 + n[0] * scale;
		var cy = y0 + n[1] * scale;
		var dot = new Cell('n' + i, '', 'ellipse;fillColor=#E53935;strokeColor=none;');
		dot.vertex = true;
		dot.geometry = {x: cx - 4, y: cy - 4, width: 8, height: 8, points: []};
		page.add(dot, page.layer);
		var label = new Cell('t' + i, n[2] || ('N' + (i + 1)), 'text;fontSize=11;fontColor=#E53935;align=left;' +
			'verticalAlign=middle;');
		label.vertex = true;
		label.geometry = {x: cx + 6, y: cy - 8, width: 90, height: 16, points: []};
		page.add(label, page.layer);
	});

	return '<mxfile><diagram id="preview" name="preview">' + pageXml(page) + '</diagram></mxfile>';
}
