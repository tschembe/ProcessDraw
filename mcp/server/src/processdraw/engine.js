/**
 * ProcessDraw drawing builder: turns a drawing specification (sheets with
 * items, lines, streams; see reference.md) into a ProcessDraw .drawio file.
 *
 * Numbering, line numbers, labels, title blocks and H&MB tables come from
 * ProcessDraw's own modules (runtime.js). Layout uses the official draw.io MCP
 * passes: ELK (layoutXml) for placement and libavoid (routeXml) for
 * obstacle-avoiding orthogonal lines.
 */
import { Cell, Page, XmlValue, fileXml, pageXml, parsePage } from './model.js';
import { getProcessDraw, createUi } from './runtime.js';
import { layoutXml } from '../elk-pass.js';
import { routeXml } from '../libavoid-pass.js';

const PX_PER_MM = 100 / 25.4;
const FRAMES = ['A3', 'A2', 'A1', 'A0'];
const MM = {A4: [297, 210], A3: [420, 297], A2: [594, 420], A1: [841, 594], A0: [1189, 841]};
const MARGIN = {left: Math.round(20 * PX_PER_MM), top: Math.round(10 * PX_PER_MM), right: Math.round(10 * PX_PER_MM),
	bottom: Math.round(10 * PX_PER_MM), zone: Math.round(5 * PX_PER_MM)};
const TITLE_WIDTH = Math.round(180 * PX_PER_MM);
const TITLE_HEIGHT = 190;
const LOCKED = 'locked=1;movable=0;resizable=0;rotatable=0;deletable=0;editable=0;connectable=0;';
const PAD = 50;
const LABEL_ALLOWANCE = {w: 30, h: 34};

const LINE_TYPES =
{
	main: 'pd_line_main', process: 'pd_line_main', secondary: 'pd_line_secondary', utility: 'pd_line_secondary',
	future: 'pd_line_future', existing: 'pd_line_existing', jacketed: 'pd_line_jacketed',
	process_connection: 'pd_signal_process', impulse: 'pd_signal_process', electric: 'pd_signal_electric',
	pneumatic: 'pd_signal_pneumatic', hydraulic: 'pd_signal_hydraulic', capillary: 'pd_signal_capillary',
	data: 'pd_signal_data', software: 'pd_signal_data'
};

const INLINE_INSTRUMENTS = /orifice|flowmeter|rotameter/;

function safeId(s)
{
	return String(s).replace(/[^A-Za-z0-9_-]/g, '_');
}

/**
 * Adds custom symbols (from the spec or a library) to the ProcessDraw library.
 */
export function registerSymbols(PD, symbols)
{
	var added = [];
	var custom = PD.Library.palettes.filter(function(p) { return p.id == 'pdCustom'; })[0];

	if (custom == null)
	{
		PD.Library.addPalette('pdCustom', 'ProcessDraw / Custom', []);
		custom = PD.Library.palettes[PD.Library.palettes.length - 1];
	}

	(symbols || []).forEach(function(s)
	{
		var sym = normalizeSymbol(s);
		PD.Stencil.compile(sym);
		var existing = custom.items.findIndex(function(i) { return i.id == sym.id; });

		if (existing >= 0)
		{
			custom.items[existing] = sym;
		}
		else if (PD.Library.getSymbol(sym.id) == null)
		{
			custom.items.push(sym);
		}
		else
		{
			throw new Error('Symbol id "' + sym.id + '" is already used by a built-in symbol');
		}

		added.push(sym);
	});

	return added;
}

export function normalizeSymbol(s)
{
	if (s == null || !s.id || !s.draw || !(s.w > 0) || !(s.h > 0))
	{
		throw new Error('A custom symbol needs id, w, h and draw');
	}

	var cls = s.cls || 'equipment';

	return {
		id: String(s.id), name: s.name || s.id, type: s.type || ('custom.' + s.id), cls: cls,
		standard: s.standard || 'custom', prefix: (s.prefix != null) ? s.prefix : ((cls == 'equipment') ? 'X' : undefined),
		template: s.template || ((cls == 'equipment') ? 'equipment' : undefined), w: +s.w, h: +s.h, draw: s.draw,
		nozzles: s.nozzles || [], data: s.data || {}, tags: s.tags || '', aspect: s.aspect, labelInside: s.labelInside,
		label: s.label, style: s.style
	};
}

/**
 * Builds the drawing. Returns {xml, pages, report: {warnings, tags, lines, sheets}}.
 */
export async function buildDrawing(spec, options)
{
	options = options || {};
	var PD = getProcessDraw();
	var T = PD.Tags;
	var warnings = [];
	registerSymbols(PD, spec.symbols);
	var settings = Object.assign({}, T.DEFAULTS, mapSettings(spec.settings || {}), mapProject(spec.project || {}));
	var sheetsSpec = spec.sheets || [];

	if (sheetsSpec.length == 0)
	{
		throw new Error('spec.sheets is empty');
	}

	// ------------------------------------------------------------ pages and project data
	var pages = sheetsSpec.map(function(sh, i)
	{
		var page = new Page('sheet-' + (i + 1), sh.name || ((sh.number || pad(i + 1, 3)) + ' ' + (sh.title || 'Sheet')).trim());
		page._spec = sh;
		page._index = i;

		return page;
	});

	var ui = createUi(pages);
	ui.currentPage = pages[0];
	var settingValues = {};

	for (var key in settings)
	{
		settingValues[key] = settings[key];
	}

	T.setSettings(ui, settingValues);
	settings = T.getSettings(ui);

	pages.forEach(function(page, i)
	{
		var sh = page._spec;
		var number = sh.number || pad(i + 1, 3);
		var root = page.root.value;
		root.setAttribute('pd_sheet_number', number);
		root.setAttribute('pd_drawing_number', sh.drawing || ((settings.docPrefix) ? settings.docPrefix + number : ''));
		root.setAttribute('pd_sheet_title', sh.title || '');
		root.setAttribute('pd_sheet_type', sh.type || 'P&ID');
		root.setAttribute('pd_sheet_status', sh.status || '');
		root.setAttribute('pd_sheet_scale', sh.scale || 'NTS');
		root.setAttribute('pd_drawn_by', sh.drawnBy || settings.preparedBy || '');
		root.setAttribute('pd_checked_by', sh.checkedBy || '');
		root.setAttribute('pd_approved_by', sh.approvedBy || '');
		root.setAttribute('pd_revisions', JSON.stringify(sh.revisions || []));
	});

	// ------------------------------------------------------------ items
	var items = {};
	var used = {counts: {}, max: {}, maxLoop: 0};
	var pending = [];

	pages.forEach(function(page)
	{
		var sh = page._spec;

		(sh.items || []).forEach(function(it)
		{
			var sym = PD.Library.getSymbol(it.symbol);

			if (sym == null)
			{
				warnings.push('Unknown symbol "' + it.symbol + '" for item ' + it.id +
					' (use processdraw_list_symbols or define it with processdraw_define_symbol)');
				return;
			}

			if (!it.id)
			{
				warnings.push('An item without id was skipped (symbol ' + it.symbol + ')');
				return;
			}

			var ref = page._index + ':' + it.id;

			if (items[ref] != null)
			{
				warnings.push('Duplicate item id "' + it.id + '" on sheet ' + page.name);
				return;
			}

			var value = PD.Library.createValue(sym);
			var scale = +it.scale || +spec.symbolScale || 1.4;
			var cell = new Cell('pd' + (page._index + 1) + '-' + safeId(it.id), value, PD.Library.getStyle(sym));
			cell.vertex = true;
			cell.geometry = {x: (it.x != null) ? +it.x : 0, y: (it.y != null) ? +it.y : 0,
				width: Math.round(sym.w * scale), height: Math.round(sym.h * scale), points: []};
			cell._sym = sym;
			cell._spec = it;
			cell._page = page;
			page.add(cell, page.layer);
			items[ref] = cell;

			for (var k in (it.data || {}))
			{
				value.setAttribute(k, it.data[k]);
			}

			if (sym.cls == 'offpage')
			{
				value.setAttribute('description', it.description || value.getAttribute('description') || '');

				if (it.link)
				{
					value.setAttribute('connector_id', String(it.link));
				}
			}

			if (sym.cls == 'instrument')
			{
				var p = (it.tag) ? T.parseInstrument(it.tag) : null;
				var fn = String(it['function'] || (p && p.fn) || value.getAttribute('function') || '').toUpperCase();
				var loop = String(it.loop || (p && p.loop) || '');
				value.setAttribute('function', fn);

				if (loop && loop != '???')
				{
					value.setAttribute('loop', loop);
					value.setAttribute('tag', T.formatInstrument((p && p.area) || '', fn, loop, settings));
					used.maxLoop = Math.max(used.maxLoop, parseInt(loop, 10) || 0);
				}
				else
				{
					pending.push(cell);
				}
			}
			else if (value.hasAttribute('tag'))
			{
				if (it.tag)
				{
					value.setAttribute('tag', it.tag);
					var parsed = T.parse(it.tag);

					if (parsed != null)
					{
						used.max[parsed.prefix.toUpperCase()] = Math.max(used.max[parsed.prefix.toUpperCase()] || 0, parsed.number);
					}
				}
				else if (sym.prefix && value.getAttribute('tag') != '')
				{
					pending.push(cell);
				}
			}
		});
	});

	// Tags for items without one: next free number per prefix, next loop for instruments
	pending.forEach(function(cell)
	{
		var v = cell.value;

		if (cell._sym.cls == 'instrument')
		{
			used.maxLoop = (used.maxLoop > 0) ? used.maxLoop + settings.step : settings.start;
			var loop = pad(used.maxLoop, settings.digits);
			v.setAttribute('loop', loop);
			v.setAttribute('tag', T.formatInstrument('', v.getAttribute('function'), loop, settings));
		}
		else
		{
			var prefix = String(cell._sym.prefix).toUpperCase();
			used.max[prefix] = (used.max[prefix] > 0) ? used.max[prefix] + settings.step : settings.start;
			v.setAttribute('tag', T.format(prefix, used.max[prefix], settings));
		}
	});

	var tagCount = {};

	Object.keys(items).forEach(function(ref)
	{
		var tag = items[ref].value.getAttribute('tag');

		if (tag)
		{
			tagCount[tag.toUpperCase()] = (tagCount[tag.toUpperCase()] || 0) + 1;
		}
	});

	Object.keys(tagCount).forEach(function(t)
	{
		if (tagCount[t] > 1)
		{
			warnings.push('Tag ' + t + ' is used ' + tagCount[t] + ' times');
		}
	});

	// ------------------------------------------------------------ lines
	var lines = [];
	var lineRefs = {};

	pages.forEach(function(page)
	{
		(page._spec.lines || []).forEach(function(ln, li)
		{
			var symId = LINE_TYPES[ln.type || 'main'] || ln.type;
			var sym = PD.Library.getSymbol(symId);

			if (sym == null || !sym.edge)
			{
				warnings.push('Unknown line type "' + ln.type + '" (' + Object.keys(LINE_TYPES).join(', ') + ')');
				return;
			}

			var ends = [resolveEnd(ln.from, page, items, warnings, ln), resolveEnd(ln.to, page, items, warnings, ln)];

			if (ends[0] == null || ends[1] == null)
			{
				return;
			}

			var id = ln.id || ('L' + (li + 1));
			var cell = new Cell('pd' + (page._index + 1) + '-' + safeId(id), PD.Library.createValue(sym), sym.style);
			cell.edge = true;
			cell.geometry = {relative: true, points: (ln.waypoints || []).map(function(p) { return {x: +p[0], y: +p[1]}; })};
			cell._spec = ln;
			cell._sym = sym;
			cell._ends = ends;
			cell.style = withConstraint(withConstraint(sym.style, ends[0], 'exit'), ends[1], 'entry');
			page.add(cell, page.layer);
			page.connect(cell, ends[0].cell, ends[1].cell);
			lines.push(cell);
			lineRefs[page._index + ':' + id] = cell;
		});
	});

	numberLines(PD, lines, settings, warnings);

	// From / To from the connected tags
	lines.forEach(function(e)
	{
		if (e._sym.cls != 'line')
		{
			return;
		}

		['from', 'to'].forEach(function(k, i)
		{
			var t = e._ends[i].cell.value.getAttribute('tag');

			if (!e.value.getAttribute(k) && t && t.indexOf('???') < 0)
			{
				e.value.setAttribute(k, t);
			}
		});
	});

	// ------------------------------------------------------------ off-page connectors
	var connectors = {};

	Object.keys(items).forEach(function(ref)
	{
		var c = items[ref];
		var link = c.value.getAttribute('connector_id');

		if (c._sym.cls == 'offpage' && link)
		{
			connectors[link] = (connectors[link] || []).concat([c]);
		}
	});

	Object.keys(connectors).forEach(function(link)
	{
		var pair = connectors[link];

		if (pair.length != 2)
		{
			warnings.push('Off-page link ' + link + ' has ' + pair.length + ' connector(s); it needs exactly 2');
			return;
		}

		pair.forEach(function(c, i)
		{
			var partner = pair[1 - i];
			c.value.setAttribute('sheet', PD.Project.getSheetLabel(ui, partner._page));
		});
	});

	// ------------------------------------------------------------ streams
	var streamNumber = 0;
	var streams = [];

	pages.forEach(function(page)
	{
		(page._spec.streams || []).forEach(function(st)
		{
			var n = parseInt(st.number, 10);

			if (!isNaN(n))
			{
				streamNumber = Math.max(streamNumber, n);
			}
		});
	});

	pages.forEach(function(page)
	{
		(page._spec.streams || []).forEach(function(st)
		{
			var edge = lineRefs[page._index + ':' + st.line];

			if (edge == null)
			{
				warnings.push('Stream on unknown line "' + st.line + '" (give the line an id)');
				return;
			}

			var sym = PD.Library.getSymbol('pd_stream_diamond');
			var value = PD.Library.createValue(sym);
			var number = (st.number != null) ? String(st.number) : String(++streamNumber);
			value.setAttribute('stream_number', number);

			for (var k in (st.data || {}))
			{
				value.setAttribute(k, st.data[k]);
			}

			PD.PFD.getComponents(ui).forEach(function(c)
			{
				if (!value.hasAttribute(c.key))
				{
					value.setAttribute(c.key, '');
				}
			});

			var cell = new Cell(edge.id + '-s' + number, value, PD.Library.getStyle(sym));
			cell.vertex = true;
			cell.geometry = {x: 0, y: 0, width: sym.w, height: sym.h, relative: true, offset: {x: -sym.w / 2, y: -sym.h / 2},
				points: []};
			page.add(cell, edge);
			streams.push(cell);
		});
	});

	// ------------------------------------------------------------ layout, frame, generated labels
	for (var i = 0; i < pages.length; i++)
	{
		await layoutPage(PD, ui, pages[i], warnings, options);
	}

	pages.forEach(function(page)
	{
		ui.currentPage = page;
		refreshGenerated(PD, ui, page);
	});

	ui.currentPage = pages[0];
	var issues = PD.Lists.runChecks(ui).map(function(i)
	{
		return i.severity + ': ' + i.item + ': ' + i.problem + ((pages.length > 1) ? ' (' + PD.Project.getSheetLabel(ui, i.page) + ')' : '');
	});

	return {
		xml: fileXml(pages),
		pages: pages,
		ui: ui,
		report: {
			sheets: pages.map(function(p)
			{
				return p.name + ' — ' + (p._frame || 'no frame') + ', ' + p.children_count + ' items';
			}),
			tags: Object.keys(items).map(function(r) { return items[r].value.getAttribute('tag'); }).filter(Boolean),
			lines: unique(lines.filter(function(l) { return l._sym.cls == 'line'; })
				.map(function(l) { return l.value.getAttribute('line_number'); })),
			streams: streams.length,
			warnings: warnings,
			issues: issues
		}
	};
}

function unique(list)
{
	return list.filter(function(v, i) { return v && list.indexOf(v) == i; });
}

function pad(n, d)
{
	var s = String(n);

	while (s.length < d)
	{
		s = '0' + s;
	}

	return s;
}

function mapSettings(s)
{
	var r = {};
	var keys = {units: 'units', linePattern: 'linePattern', lineStart: 'lineStart', lineDigits: 'lineDigits',
		serviceCodes: 'serviceCodes', pipeClasses: 'pipeClasses', compBasis: 'compBasis', tagStart: 'start',
		tagStep: 'step', tagDigits: 'digits', separator: 'separator', streamStart: 'streamStart'};

	for (var k in keys)
	{
		if (s[k] != null)
		{
			r[keys[k]] = s[k];
		}
	}

	if (s.components != null)
	{
		r.components = Array.isArray(s.components) ? s.components.join('\n') : String(s.components);
	}

	['serviceCodes', 'pipeClasses'].forEach(function(k)
	{
		if (r[k] != null && typeof r[k] === 'object')
		{
			r[k] = Object.keys(r[k]).map(function(c) { return c + ' = ' + s[k][c]; }).join('\n');
		}
	});

	return r;
}

function mapProject(p)
{
	var r = {};
	['projectNumber', 'projectName', 'client', 'site', 'area', 'preparedBy', 'docPrefix'].forEach(function(k)
	{
		if (p[k] != null)
		{
			r[k] = String(p[k]);
		}
	});

	return r;
}

/**
 * "P1.discharge" -> {cell, nozzle: [x, y, name] | null}
 */
function resolveEnd(text, page, items, warnings, ln)
{
	if (!text)
	{
		warnings.push('Line ' + (ln.id || '') + ' has no ' + ((text === ln.from) ? 'from' : 'to'));
		return null;
	}

	var s = String(text);
	var dot = s.indexOf('.');
	var id = (dot >= 0) ? s.substring(0, dot) : s;
	var nozzle = (dot >= 0) ? s.substring(dot + 1) : null;
	var cell = items[page._index + ':' + id];

	if (cell == null)
	{
		warnings.push('Line ' + (ln.id || '') + ': unknown item "' + id + '" on sheet ' + page.name);
		return null;
	}

	var noz = null;

	if (nozzle)
	{
		noz = (cell._sym.nozzles || []).filter(function(n) { return n[2] == nozzle; })[0];

		if (noz == null)
		{
			warnings.push('Line ' + (ln.id || '') + ': ' + id + ' (' + cell._sym.id + ') has no nozzle "' + nozzle +
				'"; nozzles: ' + (cell._sym.nozzles || []).map(function(n) { return n[2]; }).join(', '));
		}
	}

	return {cell: cell, nozzle: noz};
}

function withConstraint(style, end, prefix)
{
	if (end.nozzle == null)
	{
		return style;
	}

	var sym = end.cell._sym;

	return style + prefix + 'X=' + round4(end.nozzle[0] / sym.w) + ';' + prefix + 'Y=' + round4(end.nozzle[1] / sym.h) +
		';' + prefix + 'Dx=0;' + prefix + 'Dy=0;' + prefix + 'Perimeter=0;';
}

function round4(v)
{
	return Math.round(v * 10000) / 10000;
}

/**
 * Line numbers: segments joined through inline items (valves, fittings,
 * specials, inline instruments) and linked off-page connectors form one line
 * with one number; its data is merged from the segments.
 */
function numberLines(PD, lines, settings, warnings)
{
	var process = lines.filter(function(l) { return l._sym.cls == 'line'; });
	var parent = process.map(function(l, i) { return i; });

	function find(i)
	{
		while (parent[i] != i)
		{
			parent[i] = parent[parent[i]];
			i = parent[i];
		}

		return i;
	}

	function union(a, b)
	{
		parent[find(a)] = find(b);
	}

	var byEnd = {};
	var byLink = {};

	process.forEach(function(l, i)
	{
		l._ends.forEach(function(e)
		{
			var c = e.cell;
			var cls = c._sym.cls;
			var inline = cls == 'valve' || cls == 'fitting' || cls == 'special' ||
				(cls == 'instrument' && INLINE_INSTRUMENTS.test(c._sym.type));

			if (inline)
			{
				byEnd[c.id + '@' + c._page.id] = (byEnd[c.id + '@' + c._page.id] || []).concat([i]);
			}

			if (cls == 'offpage' && c.value.getAttribute('connector_id'))
			{
				byLink[c.value.getAttribute('connector_id')] = (byLink[c.value.getAttribute('connector_id')] || []).concat([i]);
			}
		});
	});

	[byEnd, byLink].forEach(function(map)
	{
		Object.keys(map).forEach(function(k)
		{
			for (var j = 1; j < map[k].length; j++)
			{
				union(map[k][0], map[k][j]);
			}
		});
	});

	var groups = {};
	var first = {};

	process.forEach(function(l, i)
	{
		var g = find(i);
		groups[g] = (groups[g] || []).concat([l]);
		first[g] = (first[g] != null) ? first[g] : i;
	});

	var maxSeq = 0;

	process.forEach(function(l)
	{
		var s = parseInt((l._spec.data || {}).sequence, 10);

		if (!isNaN(s))
		{
			maxSeq = Math.max(maxSeq, s);
		}
	});

	// Numbers in drawing order: a line gets its number at its first segment
	Object.keys(groups).sort(function(a, b) { return first[a] - first[b]; }).forEach(function(g)
	{
		var segs = groups[g];
		var data = {};

		segs.forEach(function(l)
		{
			var d = l._spec.data || {};

			for (var k in d)
			{
				if (data[k] == null || data[k] === '')
				{
					data[k] = d[k];
				}
			}
		});

		if (data.sequence == null || data.sequence === '')
		{
			maxSeq = (maxSeq > 0) ? maxSeq + settings.step : settings.lineStart;
			data.sequence = pad(maxSeq, settings.lineDigits);
		}

		var manual = segs.map(function(l) { return l._spec.line_number; }).filter(Boolean)[0];

		segs.forEach(function(l)
		{
			for (var k in data)
			{
				if (k != 'from' && k != 'to')
				{
					l.value.setAttribute(k, data[k]);
				}
			}

			var own = l._spec.data || {};

			if (own.from)
			{
				l.value.setAttribute('from', own.from);
			}

			if (own.to)
			{
				l.value.setAttribute('to', own.to);
			}

			if (manual)
			{
				l.value.setAttribute('line_number', manual);
				l.value.setAttribute('pd_line_manual', '1');
			}
			else
			{
				l.value.setAttribute('line_number', PD.Lines.formatLine(settings.linePattern, attrs(l.value)));
			}
		});
	});
}

function attrs(value)
{
	var r = {};
	value.attributes.forEach(function(a) { r[a.name] = a.value; });

	return r;
}

// ---------------------------------------------------------------- layout

function layoutCells(page)
{
	return page.layer.children.filter(function(c) { return c.vertex || c.edge; });
}

/**
 * XML of the page with only items and lines (what ELK and libavoid see).
 * inflate adds label room to every vertex for the layout.
 */
function layoutXmlOf(page, inflate)
{
	var tmp = new Page(page.id, page.name);
	var map = {};

	layoutCells(page).forEach(function(c)
	{
		var copy = new Cell(c.id, null, c.style);
		copy.vertex = c.vertex;
		copy.edge = c.edge;
		var g = c.geometry;
		copy.geometry = (c.vertex) ? {x: g.x, y: g.y, width: g.width + ((inflate && labelBelow(c)) ? LABEL_ALLOWANCE.w : 0),
			height: g.height + ((inflate && labelBelow(c)) ? LABEL_ALLOWANCE.h : 0), points: []} :
			{relative: true, points: (g.points || []).slice()};
		map[c.id] = copy;
		tmp.add(copy, tmp.layer);
	});

	layoutCells(page).forEach(function(c)
	{
		if (c.edge)
		{
			tmp.connect(map[c.id], (c.source) ? map[c.source.id] : null, (c.target) ? map[c.target.id] : null);
		}
	});

	return pageXml(tmp);
}

function labelBelow(cell)
{
	return cell._sym != null && !cell._sym.labelInside;
}

async function layoutPage(PD, ui, page, warnings, options)
{
	var sh = page._spec;
	var cells = layoutCells(page);
	var vertices = cells.filter(function(c) { return c.vertex; });
	page.children_count = vertices.length;

	if (vertices.length == 0)
	{
		placeOnSheet(PD, ui, page, warnings);
		return;
	}

	var auto = (sh.layout == 'auto') || (sh.layout == null && vertices.some(function(c)
	{
		return c._spec.x == null || c._spec.y == null;
	}));

	if (auto && options.layout !== false)
	{
		try
		{
			var laid = await layoutXml(layoutXmlOf(page, true), {direction: (sh.direction == 'vertical') ? 'vertical' : 'horizontal'});
			var parsed = parsePage(laid, page.id, page.name);

			vertices.forEach(function(c)
			{
				var p = parsed.cells[c.id];

				if (p != null && p.geometry != null)
				{
					c.geometry.x = p.geometry.x + ((labelBelow(c)) ? LABEL_ALLOWANCE.w / 2 : 0);
					c.geometry.y = p.geometry.y;
				}
			});
		}
		catch (e)
		{
			warnings.push('Automatic layout not available (' + e.message + '); used a simple grid instead');
			gridLayout(vertices);
		}
	}

	// Normalize to the origin before routing
	var b = bounds(page, false);

	vertices.forEach(function(c)
	{
		c.geometry.x -= b.x;
		c.geometry.y -= b.y;
	});

	cells.filter(function(c) { return c.edge; }).forEach(function(e)
	{
		e.geometry.points = (e._spec.waypoints) ? e.geometry.points.map(function(p) { return {x: p.x - b.x, y: p.y - b.y}; }) : [];
	});

	if (options.routing !== false && sh.routing !== 'none')
	{
		try
		{
			var routed = parsePage(await routeXml(layoutXmlOf(page, false)), page.id, page.name);

			cells.forEach(function(c)
			{
				var r = routed.cells[c.id];

				if (c.edge && r != null)
				{
					c.geometry.points = (r.geometry != null) ? r.geometry.points : [];

					if (r.style)
					{
						c.style = r.style;
					}
				}
			});
		}
		catch (e)
		{
			warnings.push('Line routing not available (' + e.message + ')');
		}
	}

	placeOnSheet(PD, ui, page, warnings);
}

function gridLayout(vertices)
{
	var cols = Math.max(1, Math.ceil(Math.sqrt(vertices.length * 1.6)));

	vertices.forEach(function(c, i)
	{
		c.geometry.x = (i % cols) * 180;
		c.geometry.y = Math.floor(i / cols) * 170;
	});
}

/**
 * Bounds of items (with label room) and line waypoints.
 */
function bounds(page, withLabels)
{
	var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;

	layoutCells(page).forEach(function(c)
	{
		var g = c.geometry;

		if (c.vertex)
		{
			var lw = (withLabels && labelBelow(c)) ? LABEL_ALLOWANCE.w / 2 : 0;
			x0 = Math.min(x0, g.x - lw); y0 = Math.min(y0, g.y);
			x1 = Math.max(x1, g.x + g.width + lw);
			y1 = Math.max(y1, g.y + g.height + ((withLabels && labelBelow(c)) ? LABEL_ALLOWANCE.h : 0));
		}
		else
		{
			(g.points || []).forEach(function(p)
			{
				x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
			});
		}
	});

	return (isFinite(x0)) ? {x: x0, y: y0, width: x1 - x0, height: y1 - y0} : {x: 0, y: 0, width: 0, height: 0};
}

function moveAll(page, dx, dy)
{
	layoutCells(page).forEach(function(c)
	{
		if (c.vertex)
		{
			c.geometry.x += dx;
			c.geometry.y += dy;
		}
		else
		{
			c.geometry.points = (c.geometry.points || []).map(function(p) { return {x: p.x + dx, y: p.y + dy}; });
		}
	});
}

function frameInner(size)
{
	var w = Math.round(MM[size][0] * PX_PER_MM);
	var h = Math.round(MM[size][1] * PX_PER_MM);

	return {w: w, h: h, x: MARGIN.left + MARGIN.zone, y: MARGIN.top + MARGIN.zone,
		iw: w - MARGIN.left - MARGIN.right - 2 * MARGIN.zone, ih: h - MARGIN.top - MARGIN.bottom - 2 * MARGIN.zone};
}

function estimateTableHeight(PD, ui, page)
{
	var streams = PD.PFD.getStreams(ui, false).length;

	return (page._spec.hmb && streams > 0) ? 30 + 13 * (PD.PFD.PROPS.length + 2 + PD.PFD.getComponents(ui).length) : 0;
}

/**
 * Picks the frame, moves the drawing into it and adds frame, title block,
 * revision table, H&MB table and equipment summaries.
 */
function placeOnSheet(PD, ui, page, warnings)
{
	var sh = page._spec;
	ui.currentPage = page;
	var b = bounds(page, true);
	var summaryBand = ((sh.summaries || []).length > 0) ? 90 : 0;
	var tableH = estimateTableHeight(PD, ui, page);
	var needW = b.width + 2 * PAD;
	var needH = b.height + summaryBand + tableH + ((tableH > 0) ? 60 : 0) + 2 * PAD;
	var frame = String(sh.frame || 'auto');
	var size = null;

	if (frame != 'none')
	{
		var candidates = (frame == 'auto') ? FRAMES : [frame.toUpperCase()];

		for (var i = 0; i < candidates.length && size == null; i++)
		{
			var f = frameInner(candidates[i]);

			if (MM[candidates[i]] == null)
			{
				continue;
			}

			// Room above the title block or to the left of it
			if ((needW <= f.iw && needH <= f.ih - TITLE_HEIGHT - 20) || (needW <= f.iw - TITLE_WIDTH - 20 && needH <= f.ih))
			{
				size = candidates[i];
			}
		}

		if (size == null)
		{
			size = (frame == 'auto') ? 'A0' : frame.toUpperCase();

			if (MM[size] == null)
			{
				size = 'A1';
			}

			warnings.push('The drawing on "' + page.name + '" is larger than ' + size + '; split it over more sheets');
		}
	}

	var origin;

	if (size != null)
	{
		var f = frameInner(size);
		origin = {x: f.x + PAD, y: f.y + PAD + summaryBand};
		page.attrs.pageWidth = String(f.w);
		page.attrs.pageHeight = String(f.h);
		page._frame = size;
	}
	else
	{
		origin = {x: PAD, y: PAD + summaryBand};
	}

	moveAll(page, origin.x - b.x, origin.y - b.y);
	var content = bounds(page, true);

	if (size == null)
	{
		page.attrs.pageWidth = String(Math.max(1169, Math.ceil(content.x + content.width + PAD)));
		page.attrs.pageHeight = String(Math.max(827, Math.ceil(content.y + content.height + tableH + 2 * PAD)));
	}

	// Equipment summaries in a band above the drawing
	(sh.summaries || []).forEach(function(ref)
	{
		var eq = page.cells['pd' + (page._index + 1) + '-' + safeId(ref)];

		if (eq == null)
		{
			warnings.push('Summary for unknown item "' + ref + '"');
			return;
		}

		var value = new XmlValue('object');
		value.setAttribute('pd_class', 'summary');
		value.setAttribute('pd_type', 'summary.equipment');
		value.setAttribute('pd_ref', eq.id);
		value.setAttribute('pd_ref_tag', eq.value.getAttribute('tag') || '');
		value.setAttribute('label', '');
		var cell = new Cell(eq.id + '-summary', value, 'text;html=1;align=center;verticalAlign=bottom;fontSize=9;' +
			'whiteSpace=nowrap;autosize=1;resizable=0;strokeColor=none;fillColor=none;');
		cell.vertex = true;
		cell.geometry = {x: eq.geometry.x + eq.geometry.width / 2 - 60, y: content.y - summaryBand, width: 120,
			height: summaryBand - 10, points: []};
		page.add(cell, page.layer);
	});

	if (tableH > 0)
	{
		var t = PD.Library.getSymbol('pd_hmb_table');
		var tv = PD.Library.createValue(t);
		var table = new Cell('pd' + (page._index + 1) + '-hmb', tv, t.rawStyle);
		table.vertex = true;
		table.geometry = {x: content.x, y: content.y + content.height + 60, width: 400, height: tableH, points: []};
		page.add(table, page.layer);
	}

	if (size != null)
	{
		var f2 = frameInner(size);
		var frameStyle = 'shape=pd_frame;html=1;fillColor=none;strokeColor=default;pointerEvents=0;pdMarginLeft=' +
			MARGIN.left + ';pdMarginTop=' + MARGIN.top + ';pdMarginRight=' + MARGIN.right + ';pdMarginBottom=' +
			MARGIN.bottom + ';pdZone=' + MARGIN.zone + ';pdField=' + Math.round(50 * PX_PER_MM) + ';' + LOCKED;
		var textStyle = 'text;html=1;whiteSpace=nowrap;overflow=visible;align=left;verticalAlign=top;spacing=0;' +
			'strokeColor=none;fillColor=none;autosize=1;' + LOCKED;
		var frameCell = sheetCell('frame', page, frameStyle, {x: 0, y: 0, width: f2.w, height: f2.h});
		var revCell = sheetCell('revtable', page, textStyle, {x: 0, y: 0, width: TITLE_WIDTH, height: 30});
		var titleCell = sheetCell('titleblock', page, textStyle, {x: f2.x + f2.iw - TITLE_WIDTH,
			y: f2.y + f2.ih - TITLE_HEIGHT, width: TITLE_WIDTH, height: TITLE_HEIGHT});

		// Frame at the back
		[titleCell, revCell, frameCell].forEach(function(c)
		{
			c.parent = page.layer;
			page.layer.children.unshift(c);
			page.cells[c.id] = c;
		});

		page.root.value.setAttribute('pd_sheet_size', size + ' (' + MM[size][0] + ' x ' + MM[size][1] + ' mm)');
	}
}

function sheetCell(cls, page, style, geo)
{
	var value = new XmlValue('object');
	value.setAttribute('pd_class', cls);
	value.setAttribute('pd_type', 'sheet.' + cls);
	value.setAttribute('label', '');

	// The editor sizes generated labels from their rendered HTML when it first shows the page
	value.setAttribute('pd_refresh', '1');
	var cell = new Cell('pd' + (page._index + 1) + '-' + cls, value, style);
	cell.vertex = true;
	cell.geometry = Object.assign({points: []}, geo);

	return cell;
}

/**
 * Title block, revision table, H&MB tables and summaries with the labels the
 * editor would generate (it refreshes them again when the page is shown).
 */
function refreshGenerated(PD, ui, page)
{
	Object.keys(page.cells).forEach(function(id)
	{
		var c = page.cells[id];
		var cls = (c.value != null && typeof c.value === 'object') ? c.value.getAttribute('pd_class') : null;
		var html = null;

		if (cls == 'titleblock')
		{
			html = PD.Sheet.buildTitleBlockHtml(ui);
		}
		else if (cls == 'revtable')
		{
			html = PD.Sheet.buildRevisionTableHtml(ui);
		}
		else if (cls == 'hmb')
		{
			html = PD.PFD.buildTableHtml(ui, c);
			c.value.setAttribute('pd_refresh', '1');
		}
		else if (cls == 'summary')
		{
			html = PD.PFD.buildSummaryHtml(ui, c);
			c.value.setAttribute('pd_refresh', '1');
		}

		if (html != null)
		{
			c.value.setAttribute('label', html);
		}
	});

	// Revision table above the title block (estimated height until the editor measures it)
	var title = page.cells['pd' + (page._index + 1) + '-titleblock'];
	var rev = page.cells['pd' + (page._index + 1) + '-revtable'];

	if (title != null && rev != null)
	{
		var count = JSON.parse(page.root.value.getAttribute('pd_revisions') || '[]').length;
		rev.geometry.height = 16 + 17 * count;
		rev.geometry.x = title.geometry.x;
		rev.geometry.y = title.geometry.y - rev.geometry.height;
	}
}
