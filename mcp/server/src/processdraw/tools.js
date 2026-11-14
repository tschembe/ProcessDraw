/**
 * ProcessDraw MCP tools: definitions and handlers. Registered next to the
 * official draw.io tools in ../index.js.
 */
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'fs';
import { join, dirname, resolve, extname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';
import { getProcessDraw } from './runtime.js';
import { buildDrawing, normalizeSymbol } from './engine.js';
import { renderPages, openInApp, appAvailable } from './render.js';
import { useLibrary, saveSymbol, symbolPreviewXml, libraryPath } from './library.js';
import { describeDrawing, updateDrawing, exportLists, loadPages } from './reader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REFERENCE = readFileSync(join(__dirname, 'reference.md'), 'utf8');

export const tools =
[
	{
		name: 'processdraw_get_reference',
		description: 'Returns the ProcessDraw drawing reference: the JSON spec for processdraw_create_drawing ' +
			'(sheets, items, lines, streams, nozzles, data fields), the custom symbol drawing language and the ' +
			'workflow for turning a paper, report or project description into PFDs and P&IDs. Read it once before ' +
			'the first ProcessDraw drawing.',
		inputSchema: {type: 'object', properties: {}}
	},
	{
		name: 'processdraw_list_symbols',
		description: 'Lists ProcessDraw P&ID/PFD symbols (ISO 10628, ISA 5.1, IEC 62424, plus custom symbols) ' +
			'with id, class, tag prefix and nozzle names for connecting lines. Optional query filters by words ' +
			'(e.g. "pump", "control valve", "column", "psv").',
		inputSchema: {type: 'object', properties: {query: {type: 'string', description: 'Search words (optional)'}}}
	},
	{
		name: 'processdraw_create_drawing',
		description: 'Creates a ProcessDraw P&ID or PFD file (.drawio) from a JSON spec of sheets with items ' +
			'(symbols, tags, engineering data), lines between nozzles, stream data and options (frame, H&MB ' +
			'table, summaries). Tags, instrument loops, line numbers (also through valves and across sheets), ' +
			'off-page links, layout and line routing, title block and revisions are done automatically. Returns ' +
			'warnings, Project Check results and a preview image of each sheet, and opens the file in ' +
			'ProcessDraw. Call processdraw_get_reference once first for the spec format.',
		inputSchema: {
			type: 'object',
			properties: {
				path: {type: 'string', description: 'Output file, absolute path ending in .drawio'},
				spec: {type: 'object', description: 'Drawing spec (see processdraw_get_reference)'},
				overwrite: {type: 'boolean', description: 'Replace an existing file (default false)'},
				preview: {type: 'boolean', description: 'Return preview images (default true)'},
				open: {type: 'boolean', description: 'Open in ProcessDraw (default true)'}
			},
			required: ['path', 'spec']
		}
	},
	{
		name: 'processdraw_define_symbol',
		description: 'Creates or updates a custom ProcessDraw symbol for equipment or items missing from the ' +
			'library, drawn with the ProcessDraw drawing language (see processdraw_get_reference), with named ' +
			'nozzles. Saves it to the custom symbol library (usable in processdraw_create_drawing by id, and as a ' +
			'draw.io library file ProcessDraw opens with File > Open Library) and returns a preview image with the ' +
			'nozzles marked. Check the preview and correct the drawing if needed.',
		inputSchema: {
			type: 'object',
			properties: {
				symbol: {type: 'object', description: '{id, name, cls, prefix, template, w, h, draw, nozzles: [[x, y, name]], data}'},
				library: {type: 'string', description: 'Library .json path (default ~/.processdraw/custom-symbols.json)'}
			},
			required: ['symbol']
		}
	},
	{
		name: 'processdraw_read_drawing',
		description: 'Reads a ProcessDraw .drawio file and returns its project data, sheets, items with tags and ' +
			'data, line numbers, streams and the Project Check problems (duplicate tags, open ends, missing data).',
		inputSchema: {type: 'object', properties: {path: {type: 'string', description: 'Absolute .drawio path'}},
			required: ['path']}
	},
	{
		name: 'processdraw_update_drawing',
		description: 'Changes engineering data in an existing ProcessDraw .drawio file without touching the layout: ' +
			'items by tag, lines by line number (all segments, number rebuilt from the pattern) and streams by ' +
			'stream number. Example updates: [{"tag": "P-101A", "data": {"flow_rate": "45"}}, ' +
			'{"line": "6\\"-P-1001-A1A", "data": {"size": "8\\""}}, {"stream": 3, "data": {"temperature": "40"}}].',
		inputSchema: {
			type: 'object',
			properties: {
				path: {type: 'string', description: 'Absolute .drawio path'},
				updates: {type: 'array', items: {type: 'object'}, description: '[{tag | line | stream, data}]'}
			},
			required: ['path', 'updates']
		}
	},
	{
		name: 'processdraw_export_lists',
		description: 'Writes the equipment list, line list, instrument index, valve list, specials, stream table ' +
			'and Project Check of a ProcessDraw .drawio file to an Excel workbook (.xlsx). The workbook can be ' +
			'edited and imported back in ProcessDraw (Import Lists from Excel).',
		inputSchema: {
			type: 'object',
			properties: {
				path: {type: 'string', description: 'Absolute .drawio path'},
				out: {type: 'string', description: 'Output .xlsx path (default next to the drawing)'}
			},
			required: ['path']
		}
	},
	{
		name: 'processdraw_preview',
		description: 'Returns preview images of the sheets of an existing .drawio file, rendered by ProcessDraw.',
		inputSchema: {
			type: 'object',
			properties: {
				path: {type: 'string', description: 'Absolute .drawio path'},
				pages: {type: 'array', items: {type: 'number'}, description: 'Sheet indexes, 0-based (default all, max 6)'}
			},
			required: ['path']
		}
	}
];

function text(t)
{
	return {type: 'text', text: t};
}

function image(data)
{
	return {type: 'image', data: data, mimeType: 'image/png'};
}

function requirePath(path, ext)
{
	if (typeof path !== 'string' || path.length == 0)
	{
		throw new Error('path is required');
	}

	var abs = resolve(path);

	if (extname(abs).toLowerCase() != ext)
	{
		throw new Error('path must end in ' + ext);
	}

	return abs;
}

async function previews(file, count, scale)
{
	if (!appAvailable())
	{
		return [text('(No preview: ProcessDraw is not installed next to this server.)')];
	}

	try
	{
		var indexes = [];

		for (var i = 0; i < Math.min(count, 6); i++)
		{
			indexes.push(i);
		}

		return (await renderPages(file, indexes, scale)).map(function(p) { return image(p.data); });
	}
	catch (e)
	{
		return [text('(Preview failed: ' + e.message + ')')];
	}
}

function symbolLine(s)
{
	return s.id + ' | ' + s.name + ' | ' + s.cls + ((s.prefix) ? ' | prefix ' + s.prefix : '') +
		((s.edge) ? ' | line' : ' | nozzles: ' + ((s.nozzles || []).map(function(n) { return n[2]; }).join(', ') || '-'));
}

export async function handle(name, args)
{
	args = args || {};
	var PD = getProcessDraw();
	useLibrary();

	if (name == 'processdraw_get_reference')
	{
		return {content: [text(REFERENCE)]};
	}

	if (name == 'processdraw_list_symbols')
	{
		var words = String(args.query || '').toLowerCase().split(/\s+/).filter(Boolean);
		var out = [];

		PD.Library.palettes.forEach(function(p)
		{
			var list = p.items.filter(function(s)
			{
				var hay = (s.id + ' ' + s.name + ' ' + (s.tags || '') + ' ' + s.cls + ' ' + (s.type || '')).toLowerCase();

				return words.every(function(w) { return hay.indexOf(w) >= 0; });
			});

			if (list.length > 0)
			{
				out.push('## ' + p.title.replace('ProcessDraw / ', ''));
				list.forEach(function(s) { out.push(symbolLine(s)); });
			}
		});

		return {content: [text((out.length > 0) ? out.join('\n') :
			'No symbol matches "' + args.query + '". Try other words or define one with processdraw_define_symbol.')]};
	}

	if (name == 'processdraw_create_drawing')
	{
		var file = requirePath(args.path, '.drawio');

		if (existsSync(file) && !args.overwrite)
		{
			throw new Error(file + ' exists; pass overwrite: true to replace it');
		}

		var spec = (typeof args.spec === 'string') ? JSON.parse(args.spec) : args.spec;
		var result = await buildDrawing(spec || {});
		writeFileSync(file, result.xml);
		var r = result.report;
		var lines = ['Created ' + file, '', 'Sheets: ' + r.sheets.join('; '), 'Tags: ' + r.tags.join(', '),
			'Line numbers: ' + (r.lines.join(', ') || '-'), 'Stream markers: ' + r.streams];

		if (r.warnings.length > 0)
		{
			lines.push('', 'Warnings (fix the spec and create again):');
			r.warnings.forEach(function(w) { lines.push('- ' + w); });
		}

		if (r.issues.length > 0)
		{
			lines.push('', 'Project Check:');
			r.issues.slice(0, 40).forEach(function(w) { lines.push('- ' + w); });

			if (r.issues.length > 40)
			{
				lines.push('- … ' + (r.issues.length - 40) + ' more');
			}
		}

		var opened = (args.open !== false) ? openInApp(file) : false;
		lines.push('', (opened) ? 'Opened in ProcessDraw.' : 'Open the file in ProcessDraw to review it.');
		var content = [text(lines.join('\n'))];

		if (args.preview !== false)
		{
			content = content.concat(await previews(file, result.pages.length, 0.7));
		}

		return {content: content};
	}

	if (name == 'processdraw_define_symbol')
	{
		var def = args.symbol;

		if (typeof def === 'string')
		{
			def = JSON.parse(def);
		}

		normalizeSymbol(def);
		var saved = saveSymbol(def, args.library ? libraryPath(args.library) : null);
		var dir = mkdtempSync(join(tmpdir(), 'processdraw-symbol-'));
		var content = [text('Saved symbol "' + def.id + '" to ' + saved.json + ' (draw.io library for ProcessDraw: ' +
			saved.xml + ', open it with File > Open Library). Use it in specs as "symbol": "' + def.id + '".')];

		try
		{
			var tmp = join(dir, 'symbol.drawio');
			writeFileSync(tmp, symbolPreviewXml(def));
			content = content.concat(await previews(tmp, 1, 1));
		}
		finally
		{
			rmSync(dir, {recursive: true, force: true});
		}

		return {content: content};
	}

	if (name == 'processdraw_read_drawing')
	{
		return {content: [text(describeDrawing(requirePath(args.path, '.drawio')))]};
	}

	if (name == 'processdraw_update_drawing')
	{
		var report = updateDrawing(requirePath(args.path, '.drawio'), args.updates || []);

		return {content: [text('Updated:\n' + report.map(function(r) { return '- ' + r; }).join('\n') +
			'\n\nReopen the file in ProcessDraw to see the changes.')]};
	}

	if (name == 'processdraw_export_lists')
	{
		var src = requirePath(args.path, '.drawio');
		var out = (args.out) ? requirePath(args.out, '.xlsx') : src.replace(/\.drawio$/i, ' lists.xlsx');
		var counts = await exportLists(src, out);

		return {content: [text('Wrote ' + out + ' (' + counts.join(', ') + ')')]};
	}

	if (name == 'processdraw_preview')
	{
		var f = requirePath(args.path, '.drawio');
		var pages = loadPages(f);
		var idx = (args.pages || pages.map(function(p, i) { return i; })).slice(0, 6);

		if (!appAvailable())
		{
			return {content: [text('ProcessDraw is not installed next to this server, so no preview.')]};
		}

		var imgs = await renderPages(f, idx, 0.7);

		return {content: imgs.map(function(p) { return image(p.data); })};
	}

	throw new Error('Unknown tool: ' + name);
}
