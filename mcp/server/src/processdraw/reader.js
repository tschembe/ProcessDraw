/**
 * Reading, updating and list export for existing ProcessDraw drawings.
 * Updates change only the attributes of the targeted cells in the page XML;
 * the rest of the file stays byte for byte (pages.js writes the page back).
 */
import { readFileSync, writeFileSync } from 'fs';
import { listPageMeta, readPageXml, writePageXml, assertPagePath } from '../pages.js';
import { parsePage, esc, parseAttrs } from './model.js';
import { getProcessDraw, createUi } from './runtime.js';

export function loadPages(path)
{
	assertPagePath(path);
	var meta = listPageMeta(readFileSync(path, 'utf8'));

	return meta.map(function(m)
	{
		var page = parsePage(readPageXml(path, m.index).xml, m.id || ('page-' + m.index), m.name || ('Page-' + (m.index + 1)));
		page._index = m.index;

		return page;
	});
}

function attr(cell, name)
{
	return (cell != null && cell.value != null && typeof cell.value === 'object') ? (cell.value.getAttribute(name) || '') : '';
}

/**
 * Text summary of a drawing: project, sheets, items with data, lines, streams
 * and the Project Check results.
 */
export function describeDrawing(path)
{
	var PD = getProcessDraw();
	var pages = loadPages(path);
	var ui = createUi(pages);
	var s = PD.Tags.getSettings(ui);
	var out = [];
	out.push('Project: ' + [s.projectNumber, s.projectName, s.client].filter(Boolean).join(' / '));
	out.push('Units: ' + s.units + ' · line pattern ' + s.linePattern);

	pages.forEach(function(page)
	{
		ui.currentPage = page;
		out.push('');
		out.push('## Sheet ' + PD.Project.getSheetLabel(ui, page) + ' — ' + page.name);
		var items = [];
		var lines = {};
		var streams = [];

		PD.Tags.forEachCell(ui, function(cell, p)
		{
			if (p != page)
			{
				return;
			}

			var cls = attr(cell, 'pd_class');
			var data = cell.value.attributes.filter(function(a)
			{
				return a.value !== '' && !/^(label|placeholders|tag|pd_.*)$/.test(a.name);
			}).map(function(a) { return a.name + '=' + a.value; });

			if (cls == 'line')
			{
				var n = attr(cell, 'line_number') || '(not numbered)';
				lines[n] = lines[n] || {segments: 0, data: data};
				lines[n].segments++;
			}
			else if (cls == 'stream')
			{
				streams.push('stream ' + attr(cell, 'stream_number') + ': ' + data.join(', '));
			}
			else if (['equipment', 'valve', 'instrument', 'special', 'offpage'].indexOf(cls) >= 0)
			{
				items.push((attr(cell, 'tag') || '(' + attr(cell, 'pd_type') + ')') + ' [' + cls + '] ' + data.join(', '));
			}
		});

		out.push('Items (' + items.length + '):');
		items.forEach(function(i) { out.push('- ' + i); });
		out.push('Lines (' + Object.keys(lines).length + '):');
		Object.keys(lines).forEach(function(n) { out.push('- ' + n + ' (' + lines[n].segments + ' segment(s)) ' + lines[n].data.join(', ')); });

		if (streams.length > 0)
		{
			out.push('Streams:');
			streams.forEach(function(st) { out.push('- ' + st); });
		}
	});

	ui.currentPage = pages[0];
	var issues = PD.Lists.runChecks(ui);
	out.push('');
	out.push('## Project Check: ' + ((issues.length == 0) ? 'no problems' : issues.length + ' problem(s)'));
	issues.forEach(function(i) { out.push('- ' + i.severity + ': ' + i.item + ': ' + i.problem); });

	return out.join('\n');
}

/**
 * Rewrites the attributes of one wrapped cell in page XML.
 */
function setCellAttributes(xml, id, values)
{
	var re = new RegExp('<(object|UserObject)\\b([^>]*?)\\bid="' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"([^>]*)>');
	var m = re.exec(xml);

	if (m == null)
	{
		return null;
	}

	var attrs = parseAttrs(m[2] + ' id="' + esc(id) + '"' + m[3]);
	var names = attrs.map(function(a) { return a[0]; });

	for (var k in values)
	{
		var i = names.indexOf(k);

		if (values[k] == null)
		{
			if (i >= 0)
			{
				attrs.splice(i, 1);
				names.splice(i, 1);
			}
		}
		else if (i >= 0)
		{
			attrs[i][1] = String(values[k]);
		}
		else
		{
			attrs.splice(attrs.length - 1, 0, [k, String(values[k])]);
			names.splice(names.length - 1, 0, k);
		}
	}

	var tag = '<' + m[1] + attrs.map(function(a) { return ' ' + a[0] + '="' + esc(a[1]) + '"'; }).join('') + '>';

	return xml.substring(0, m.index) + tag + xml.substring(m.index + m[0].length);
}

/**
 * Applies data updates: [{tag | line | stream, data}]. Line updates go to all
 * segments of the line and rebuild their line number. Returns a report.
 */
export function updateDrawing(path, updates)
{
	var PD = getProcessDraw();
	var pages = loadPages(path);
	var ui = createUi(pages);
	var settings = PD.Tags.getSettings(ui);
	var changes = {};
	var report = [];

	(updates || []).forEach(function(u)
	{
		var targets = [];

		pages.forEach(function(page)
		{
			Object.keys(page.cells).forEach(function(id)
			{
				var c = page.cells[id];

				if ((u.tag && attr(c, 'tag').toUpperCase() == String(u.tag).toUpperCase()) ||
					(u.line && attr(c, 'pd_class') == 'line' && attr(c, 'line_number') == u.line) ||
					(u.stream != null && attr(c, 'pd_class') == 'stream' && attr(c, 'stream_number') == String(u.stream)))
				{
					targets.push({page: page, cell: c});
				}
			});
		});

		if (targets.length == 0)
		{
			report.push('not found: ' + (u.tag || u.line || ('stream ' + u.stream)));
			return;
		}

		targets.forEach(function(t)
		{
			var values = Object.assign({}, u.data || {});

			for (var k in values)
			{
				t.cell.value.setAttribute(k, values[k]);
			}

			if (attr(t.cell, 'pd_class') == 'line' && attr(t.cell, 'pd_line_manual') != '1')
			{
				var a = {};
				t.cell.value.attributes.forEach(function(x) { a[x.name] = x.value; });
				values.line_number = PD.Lines.formatLine(settings.linePattern, a);
				t.cell.value.setAttribute('line_number', values.line_number);
			}

			if (attr(t.cell, 'pd_class') == 'instrument' && values.tag)
			{
				var p = PD.Tags.parseInstrument(values.tag);

				if (p != null)
				{
					values['function'] = p.fn;
					values.loop = p.loop;
				}
			}

			var key = t.page._index;
			changes[key] = changes[key] || {};
			changes[key][t.cell.id] = Object.assign(changes[key][t.cell.id] || {}, values);
		});

		report.push((u.tag || u.line || ('stream ' + u.stream)) + ': ' + Object.keys(u.data || {}).join(', ') +
			' (' + targets.length + ' cell(s))');
	});

	Object.keys(changes).forEach(function(index)
	{
		var xml = readPageXml(path, +index).xml;

		Object.keys(changes[index]).forEach(function(id)
		{
			var updated = setCellAttributes(xml, id, changes[index][id]);

			if (updated != null)
			{
				xml = updated;
			}
		});

		writePageXml(path, +index, xml);
	});

	return report;
}

/**
 * Writes the ProcessDraw lists (equipment, lines, instruments, valves, specials,
 * streams, check) of a drawing to an .xlsx file.
 */
export async function exportLists(path, out)
{
	var PD = getProcessDraw();
	var pages = loadPages(path);
	var ui = createUi(pages);
	var sheets = PD.Lists.getSheets(ui);
	var data = await new Promise(function(resolve, reject)
	{
		PD.Xlsx.toBase64(sheets, {title: 'ProcessDraw lists'}, resolve, reject);
	});

	writeFileSync(out, Buffer.from(data, 'base64'));

	return sheets.map(function(s) { return s.name + ': ' + s.rows.length; });
}
