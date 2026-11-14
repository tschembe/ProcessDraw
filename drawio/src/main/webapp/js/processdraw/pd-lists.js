/**
 * ProcessDraw lists and project check.
 *
 * Export Lists to Excel writes one workbook: equipment list, line list,
 * instrument index, valve list, specials, streams and the check results.
 * Project Check runs all consistency checks and shows them in a window that
 * stays open; clicking an entry selects the item (on any sheet).
 */
(function()
{
	var ProcessDraw = window.ProcessDraw = window.ProcessDraw || {};
	var Tags = ProcessDraw.Tags;
	var Fields = ProcessDraw.Fields;
	var Library = ProcessDraw.Library;

	mxResources.parse(
		'pdExportLists=Export Lists to Excel...\n' +
		'pdProjectCheck=Project Check...\n');

	// Fields that are not list columns
	var SKIP = {label: 1, placeholders: 1, tag: 1, id: 1, tooltip: 1, link: 1, service: 1};

	// ---------------------------------------------------------------- Helpers

	/**
	 * Readable type: the symbol name ("Shell & Tube (U-tube)"), else from pd_type.
	 */
	function humanType(type)
	{
		var sym = getSymbolForType(type);

		if (sym != null)
		{
			return sym.name;
		}

		var s = String(type || '').split('.').reverse().join(' ').replace(/_/g, ' ');

		return s.charAt(0).toUpperCase() + s.substring(1);
	};

	function sheetOf(ui, page)
	{
		return (ProcessDraw.Project != null) ? ProcessDraw.Project.getSheetLabel(ui, page) :
			((page != null) ? page.getName() : '');
	};

	function compareTags(a, b)
	{
		return String(a).localeCompare(String(b), undefined, {numeric: true, sensitivity: 'base'});
	};

	/**
	 * Numeric strings in quantity fields become numbers in Excel.
	 */
	function cellValue(key, value)
	{
		var q = (Fields.FIELDS[key] != null) ? Fields.FIELDS[key].q : null;

		if ((q != null || key.substring(0, 5) == 'comp_') && /^-?\d+(\.\d+)?$/.test(String(value).trim()) &&
			q != 'size')
		{
			return parseFloat(value);
		}

		return value;
	};

	function header(ui, key)
	{
		var unit = Fields.getUnit(key, Tags.getSettings(ui).units);

		return Fields.getLabel(key) + ((unit) ? ' [' + unit + ']' : '');
	};

	/**
	 * Line numbers of the process lines connected to a cell.
	 */
	function connectedLines(cell)
	{
		var result = [];

		for (var i = 0; i < cell.getEdgeCount(); i++)
		{
			var e = cell.getEdgeAt(i);
			var n = Tags.attr(e, 'line_number');

			if (Tags.attr(e, 'pd_class') == 'line' && n != '' && result.indexOf(n) < 0)
			{
				result.push(n);
			}
		}

		return result.join(', ');
	};

	/**
	 * Collects [{cell, page}] for which filter(cell) is true.
	 */
	function collect(ui, filter)
	{
		var result = [];

		Tags.forEachCell(ui, function(cell, page)
		{
			if (filter(cell))
			{
				result.push({cell: cell, page: page});
			}
		});

		return result;
	};

	/**
	 * Data field keys used by the items, in the order they appear.
	 */
	function fieldKeys(items, extraSkip)
	{
		var keys = [];

		for (var i = 0; i < items.length; i++)
		{
			var attrs = items[i].cell.value.attributes;

			for (var j = 0; j < attrs.length; j++)
			{
				var k = attrs[j].name;

				if (!SKIP[k] && k.substring(0, 3) != 'pd_' && (extraSkip == null || !extraSkip[k]) &&
					keys.indexOf(k) < 0)
				{
					keys.push(k);
				}
			}
		}

		return keys;
	};

	function projectInfo(ui)
	{
		var s = Tags.getSettings(ui);
		var info = [];
		var project = [s.projectNumber, s.projectName].filter(function(v) { return v; }).join(' – ');

		if (project)
		{
			info.push('Project: ' + project);
		}

		if (s.client)
		{
			info.push('Client: ' + s.client + ((s.site) ? ', ' + s.site : ''));
		}

		var file = ui.getCurrentFile();
		info.push('Source: ' + ((file != null) ? file.getTitle() : '') + ' · ' + new Date().toISOString().substring(0, 10) +
			' · ProcessDraw ' + ProcessDraw.VERSION);

		return info;
	};

	// ---------------------------------------------------------------- Lists

	/**
	 * Identifies an item for the Excel import: "<page id>|<cell id>".
	 */
	function itemId(it)
	{
		return ((it.page != null) ? it.page.getId() : '') + '|' + it.cell.id;
	};

	/**
	 * Adds the hidden ID column and the hidden key row used by the Excel import.
	 * keys: field key per column; "=" marks calculated (read-only) columns.
	 */
	function withIds(sheet, idKey, keys)
	{
		sheet.columns.unshift({header: 'ID', width: 4, hidden: true});
		sheet.keys = [idKey].concat(keys);

		for (var i = 0; i < sheet.rows.length; i++)
		{
			var row = sheet.rows[i];
			row.unshift((row.importKey != null) ? row.importKey : itemId(row.item));
		}

		return sheet;
	};

	function equipmentList(ui)
	{
		var items = collect(ui, function(c) { return Tags.attr(c, 'pd_class') == 'equipment'; });
		items.sort(function(a, b) { return compareTags(Tags.attr(a.cell, 'tag'), Tags.attr(b.cell, 'tag')); });
		var keys = fieldKeys(items);
		var columns = [{header: 'Tag', width: 12}, {header: 'Equipment type', width: 24}, {header: 'Service', width: 28}];

		for (var i = 0; i < keys.length; i++)
		{
			columns.push({header: header(ui, keys[i]), width: 14});
		}

		columns.push({header: 'Sheet', width: 18});

		return withIds({name: 'Equipment', title: 'EQUIPMENT LIST', columns: columns, rows: items.map(function(it)
		{
			var row = [Tags.attr(it.cell, 'tag'), humanType(Tags.attr(it.cell, 'pd_type')), Tags.attr(it.cell, 'service')]
				.concat(keys.map(function(k) { return cellValue(k, Tags.attr(it.cell, k)); }))
				.concat([sheetOf(ui, it.page)]);
			row.item = it;

			return row;
		})}, '#id', ['tag', '=type', 'service'].concat(keys).concat(['=sheet']));
	};

	/**
	 * One row per line number; segments are merged.
	 */
	function lineList(ui)
	{
		var settings = Tags.getSettings(ui);
		var Lines = ProcessDraw.Lines;
		var services = {};
		var classes = {};

		if (Lines != null)
		{
			Lines.parseCodes(settings.serviceCodes).forEach(function(c) { services[c.code] = c.description; });
			Lines.parseCodes(settings.pipeClasses).forEach(function(c) { classes[c.code] = c.description; });
		}

		var segments = collect(ui, function(c) { return Tags.attr(c, 'pd_class') == 'line'; });
		var groups = {};
		var order = [];

		for (var i = 0; i < segments.length; i++)
		{
			var n = Tags.attr(segments[i].cell, 'line_number');
			var key = (n != '') ? n : '#' + i;

			if (groups[key] == null)
			{
				groups[key] = [];
				order.push(key);
			}

			groups[key].push(segments[i]);
		}

		order.sort(compareTags);

		function joined(list, name)
		{
			var values = [];

			for (var i = 0; i < list.length; i++)
			{
				var v = (name == 'sheet') ? sheetOf(ui, list[i].page) : Tags.attr(list[i].cell, name);

				if (v != '' && values.indexOf(v) < 0)
				{
					values.push(v);
				}
			}

			return values.join(', ');
		};

		var rows = order.map(function(key)
		{
			var g = groups[key];
			var first = g[0].cell;

			// Ends inside the line (e.g. a valve between two segments) are not From / To
			var froms = joined(g, 'from').split(', ');
			var tos = joined(g, 'to').split(', ');

			var row = [(key.charAt(0) == '#') ? '(not numbered)' : key, Tags.attr(first, 'size'),
				Tags.attr(first, 'service_code'), services[Tags.attr(first, 'service_code')] || '',
				Tags.attr(first, 'sequence'), Tags.attr(first, 'pipe_class'), classes[Tags.attr(first, 'pipe_class')] || '',
				Tags.attr(first, 'insulation'), joined(g, 'fluid'),
				froms.filter(function(f) { return tos.indexOf(f) < 0; }).join(', '),
				tos.filter(function(t) { return froms.indexOf(t) < 0; }).join(', '),
				joined(g, 'sheet'), g.length];

			// Numbered lines are found by line number, the others by their segment
			row.importKey = (key.charAt(0) == '#') ? 'cell:' + itemId(g[0]) : key;

			return row;
		});

		return withIds({name: 'Lines', title: 'LINE LIST', columns: [{header: 'Line number', width: 20},
			{header: 'Size', width: 7}, {header: 'Service code', width: 9}, {header: 'Service', width: 22},
			{header: 'Sequence', width: 9}, {header: 'Pipe class', width: 9}, {header: 'Pipe class description', width: 24},
			{header: 'Insulation', width: 9}, {header: 'Fluid', width: 14}, {header: 'From', width: 14},
			{header: 'To', width: 14}, {header: 'Sheet(s)', width: 20}, {header: 'Segments', width: 9}], rows: rows},
			'#line', ['=line_number', 'size', 'service_code', '=service', 'sequence', 'pipe_class', '=pipe_class_description',
			'insulation', 'fluid', '=from', '=to', '=sheets', '=segments']);
	};

	/**
	 * Instruments plus control and safety valves (they belong to instrument loops).
	 */
	function instrumentIndex(ui)
	{
		var items = collect(ui, function(c)
		{
			var cls = Tags.attr(c, 'pd_class');
			var template = Tags.attr(c, 'pd_type');

			return cls == 'instrument' || (cls == 'valve' && Tags.attr(c, 'tag') != '' &&
				/^(valve\.(control|onoff|mov|solenoid|regulator|safety)|rupture_disc)/.test(template));
		});

		var rows = items.map(function(it)
		{
			var c = it.cell;
			var p = Tags.parseInstrument(Tags.attr(c, 'tag'));
			var fn = Tags.attr(c, 'function') || ((p != null) ? p.fn : '');
			var loop = Tags.attr(c, 'loop') || ((p != null) ? p.loop : '');

			var row = [Tags.attr(c, 'tag'), fn, loop, Tags.decodeIsa(fn), humanType(Tags.attr(c, 'pd_type')),
				Tags.attr(c, 'location'), Tags.attr(c, 'service'), Tags.attr(c, 'range'), Tags.attr(c, 'units'),
				Tags.attr(c, 'set_pressure') || Tags.attr(c, 'fail_position'), connectedLines(c), sheetOf(ui, it.page)];
			row.item = it;

			return row;
		});

		rows.sort(function(a, b)
		{
			return compareTags(a[2], b[2]) || compareTags(a[1], b[1]);
		});

		return withIds({name: 'Instruments', title: 'INSTRUMENT INDEX', columns: [{header: 'Tag', width: 12},
			{header: 'Function', width: 9}, {header: 'Loop', width: 8}, {header: 'Description', width: 32},
			{header: 'Type', width: 22}, {header: 'Location', width: 13}, {header: 'Service', width: 22},
			{header: 'Range', width: 12}, {header: 'Units', width: 9}, {header: 'Set pressure / fail position', width: 14},
			{header: 'Line', width: 18}, {header: 'Sheet', width: 18}], rows: rows}, '#id', ['tag', '=function', '=loop',
			'=description', '=type', 'location', 'service', 'range', 'units', '=set_pressure_fail_position', '=line', '=sheet']);
	};

	function valveList(ui)
	{
		var items = collect(ui, function(c) { return Tags.attr(c, 'pd_class') == 'valve'; });
		var unit = function(k) { var u = Fields.getUnit(k, Tags.getSettings(ui).units); return (u) ? ' [' + u + ']' : ''; };

		var rows = items.map(function(it)
		{
			var c = it.cell;

			var row = [Tags.attr(c, 'tag'), humanType(Tags.attr(c, 'pd_type')),
				Tags.attr(c, 'size') || Tags.attr(c, 'inlet_size'), Tags.attr(c, 'pipe_class'),
				Tags.attr(c, 'end_connection'), Tags.attr(c, 'normal_position'), Tags.attr(c, 'fail_position'),
				Tags.attr(c, 'actuator'), cellValue('set_pressure', Tags.attr(c, 'set_pressure')), connectedLines(c),
				sheetOf(ui, it.page)];
			row.item = it;

			return row;
		});

		// Tagged valves first (by tag), then the rest by type
		rows.sort(function(a, b)
		{
			return ((a[0] == '') - (b[0] == '')) || compareTags(a[0], b[0]) || compareTags(a[1], b[1]);
		});

		return withIds({name: 'Valves', title: 'VALVE LIST', columns: [{header: 'Tag', width: 12},
			{header: 'Valve type', width: 22}, {header: 'Size' + unit('size'), width: 9}, {header: 'Pipe class', width: 9},
			{header: 'End connection', width: 13}, {header: 'Normal position', width: 9},
			{header: 'Fail position', width: 9}, {header: 'Actuator', width: 18},
			{header: 'Set pressure' + unit('set_pressure'), width: 11}, {header: 'Line', width: 20},
			{header: 'Sheet', width: 18}], rows: rows}, '#id', ['tag', '=type', 'size', 'pipe_class', 'end_connection',
			'normal_position', 'fail_position', 'actuator', 'set_pressure', '=line', '=sheet']);
	};

	function specialList(ui)
	{
		var items = collect(ui, function(c) { return Tags.attr(c, 'pd_class') == 'special'; });
		items.sort(function(a, b) { return compareTags(Tags.attr(a.cell, 'tag'), Tags.attr(b.cell, 'tag')); });

		return withIds({name: 'Specials', title: 'SPECIAL ITEMS', columns: [{header: 'Tag', width: 12},
			{header: 'Type', width: 22}, {header: 'Service', width: 22}, {header: 'Size', width: 9},
			{header: 'Pipe class', width: 9}, {header: 'Line', width: 20}, {header: 'Sheet', width: 18}],
			rows: items.map(function(it)
			{
				var c = it.cell;

				var row = [Tags.attr(c, 'tag'), humanType(Tags.attr(c, 'pd_type')), Tags.attr(c, 'service'),
					Tags.attr(c, 'size'), Tags.attr(c, 'pipe_class'), connectedLines(c), sheetOf(ui, it.page)];
				row.item = it;

				return row;
			})}, '#id', ['tag', '=type', 'service', 'size', 'pipe_class', '=line', '=sheet']);
	};

	/**
	 * Streams as columns, properties as rows (like the H&MB table).
	 */
	function streamList(ui)
	{
		if (ProcessDraw.PFD == null)
		{
			return null;
		}

		var streams = ProcessDraw.PFD.getStreams(ui, true);

		if (streams.length == 0)
		{
			return null;
		}

		var props = ['description'].concat(ProcessDraw.PFD.PROPS);
		var comps = ProcessDraw.PFD.getComponents(ui);
		var columns = [{header: 'Key', width: 4, hidden: true}, {header: 'Property', width: 22}, {header: 'Unit', width: 10}];

		for (var j = 0; j < streams.length; j++)
		{
			columns.push({header: 'Stream ' + Tags.attr(streams[j].cell, 'stream_number'), width: 12});
		}

		var rows = props.map(function(k)
		{
			return [k, Fields.getLabel(k), Fields.getUnit(k, Tags.getSettings(ui).units)].concat(streams.map(function(s)
			{
				return cellValue(k, Tags.attr(s.cell, k));
			}));
		}).concat(comps.map(function(c)
		{
			return [c.key, c.name, Tags.getSettings(ui).compBasis].concat(streams.map(function(s)
			{
				return cellValue(c.key, Tags.attr(s.cell, c.key));
			}));
		}));

		rows.push(['=sheet', 'Sheet', ''].concat(streams.map(function(s) { return sheetOf(ui, s.page); })));

		// Key row: the stream marker of each column
		return {name: 'Streams', title: 'HEAT AND MATERIAL BALANCE', columns: columns, rows: rows,
			keys: ['#streams', '=property', '=unit'].concat(streams.map(itemId))};
	};

	// ---------------------------------------------------------------- Project check

	var symbolsByType = null;

	function getSymbolForType(type)
	{
		if (symbolsByType == null)
		{
			symbolsByType = {};

			for (var i = 0; i < Library.palettes.length; i++)
			{
				for (var j = 0; j < Library.palettes[i].items.length; j++)
				{
					var sym = Library.palettes[i].items[j];
					symbolsByType[sym.type] = symbolsByType[sym.type] || sym;
				}
			}
		}

		return symbolsByType[type];
	};

	function describe(cell)
	{
		if (Tags.attr(cell, 'pd_class') == 'offpage')
		{
			return ((Tags.attr(cell, 'description') + ' ' + Tags.attr(cell, 'sheet')).trim() || 'Off-page connector') +
				' (off-page connector)';
		}

		var name = Tags.attr(cell, 'tag') || Tags.attr(cell, 'line_number') ||
			((Tags.attr(cell, 'stream_number')) ? 'Stream ' + Tags.attr(cell, 'stream_number') : '');

		return (name ? name + ' ' : '') + '(' + humanType(Tags.attr(cell, 'pd_type')) + ')';
	};

	/**
	 * Returns [{severity: 'error' | 'warning', item, problem, cell, page}].
	 */
	function runChecks(ui)
	{
		var issues = [];

		function add(severity, entry, problem)
		{
			issues.push({severity: severity, item: describe(entry.cell), problem: problem, cell: entry.cell,
				page: entry.page});
		};

		var tags = Tags.check(ui);

		for (var tag in tags.duplicates)
		{
			tags.duplicates[tag].forEach(function(e) { add('error', e, 'Tag used ' + tags.duplicates[tag].length + ' times'); });
		}

		tags.unnumbered.forEach(function(e) { add('warning', e, 'Not numbered'); });

		if (ProcessDraw.Project != null)
		{
			ProcessDraw.Project.checkConnectors(ui).forEach(function(e) { add('warning', e, e.problem.charAt(0).toUpperCase() + e.problem.substring(1)); });
		}

		var streamNumbers = {};

		Tags.forEachCell(ui, function(cell, page)
		{
			var entry = {cell: cell, page: page};
			var cls = Tags.attr(cell, 'pd_class');
			var type = Tags.attr(cell, 'pd_type');

			if (cls == 'equipment')
			{
				// Drivers and agitators sit on a shaft, not on a line
				if (cell.getEdgeCount() == 0 && !/^(driver|agitator)/.test(type))
				{
					add('warning', entry, 'Not connected to any line');
				}

				if (Tags.attr(cell, 'service') == '')
				{
					add('warning', entry, 'Service missing');
				}
			}
			else if (cls == 'valve' || cls == 'fitting' || cls == 'special' ||
				(cls == 'instrument' && /orifice|flowmeter|rotameter/.test(type)))
			{
				var sym = getSymbolForType(type);
				var ends = (sym != null) ? (sym.nozzles || []).filter(function(n)
				{
					return !/^(signal|sense|instrument)$/.test(n[2]);
				}).length : 0;

				// The outlet of a safety valve may discharge to atmosphere
				if (/safety|rupture/.test(type))
				{
					ends = Math.min(ends, 1);
				}

				var connected = 0;

				for (var i = 0; i < cell.getEdgeCount(); i++)
				{
					connected += (Tags.attr(cell.getEdgeAt(i), 'pd_class') != 'signal') ? 1 : 0;
				}

				if (ends > 0 && connected < ends)
				{
					add('warning', entry, connected + ' of ' + ends + ' ends connected');
				}

				if (/^valve\.control/.test(type) && Tags.attr(cell, 'fail_position') == '')
				{
					add('warning', entry, 'Fail position missing');
				}

				if (/^valve\.safety/.test(type) && Tags.attr(cell, 'set_pressure') == '')
				{
					add('warning', entry, 'Set pressure missing');
				}
			}
			else if (cls == 'line' || cls == 'signal')
			{
				if (cell.getTerminal(true) == null || cell.getTerminal(false) == null)
				{
					add('warning', entry, 'Line end not connected');
				}

				if (cls == 'line')
				{
					if (Tags.attr(cell, 'sequence') == '')
					{
						add('warning', entry, 'No line number');
					}
					else if (Tags.attr(cell, 'line_number').indexOf('?') >= 0)
					{
						add('warning', entry, 'Line number incomplete (size, service or pipe class missing)');
					}
				}
			}
			else if (cls == 'stream')
			{
				var n = Tags.attr(cell, 'stream_number');
				streamNumbers[n] = (streamNumbers[n] || []).concat([entry]);
			}
		});

		for (var n in streamNumbers)
		{
			if (streamNumbers[n].length > 1)
			{
				streamNumbers[n].forEach(function(e) { add('error', e, 'Stream number used ' + streamNumbers[n].length + ' times'); });
			}
		}

		issues.sort(function(a, b)
		{
			return ((a.severity == 'error') ? 0 : 1) - ((b.severity == 'error') ? 0 : 1) ||
				compareTags(sheetOf(ui, a.page), sheetOf(ui, b.page)) || compareTags(a.item, b.item);
		});

		return issues;
	};

	function checkList(ui, issues)
	{
		return {name: 'Check', title: 'PROJECT CHECK', columns: [{header: 'Severity', width: 10},
			{header: 'Item', width: 30}, {header: 'Problem', width: 50}, {header: 'Sheet', width: 18}],
			rows: issues.map(function(i) { return [i.severity, i.item, i.problem, sheetOf(ui, i.page)]; })};
	};

	// ---------------------------------------------------------------- Export

	function getSheets(ui)
	{
		var info = projectInfo(ui);
		var sheets = [equipmentList(ui), lineList(ui), instrumentIndex(ui), valveList(ui), specialList(ui),
			streamList(ui), checkList(ui, runChecks(ui))].filter(function(s) { return s != null; });

		for (var i = 0; i < sheets.length; i++)
		{
			sheets[i].info = info;
		}

		return sheets;
	};

	function exportLists(ui)
	{
		var sheets = getSheets(ui);
		var file = ui.getCurrentFile();
		var base = (file != null) ? file.getTitle().replace(/\.(drawio|xml|png|svg)$/i, '') : 'ProcessDraw';
		var counts = sheets.map(function(s) { return s.name + ': ' + s.rows.length; }).join(', ');

		ProcessDraw.Xlsx.toBase64(sheets, {title: base + ' lists'}, function(data)
		{
			ui.saveData(base + ' lists.xlsx', 'xlsx', data,
				'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', true);
			ui.editor.setStatus('Lists exported (' + counts + ')');
		}, function(e)
		{
			ui.handleError(e);
		});
	};

	// ---------------------------------------------------------------- Check window

	var checkWindow = null;

	function showCheckWindow(ui)
	{
		if (checkWindow == null)
		{
			var div = document.createElement('div');
			div.style.cssText = 'height:100%;display:flex;flex-direction:column;font-size:12px;box-sizing:border-box;' +
				'padding:6px 8px;';
			var bar = document.createElement('div');
			bar.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:6px;flex:0 0 auto;';
			var summary = document.createElement('span');
			summary.style.flex = '1 1 auto';
			var recheck = mxUtils.button('Recheck', function() { fill(); });
			recheck.className = 'geBtn';
			bar.appendChild(summary);
			bar.appendChild(recheck);
			div.appendChild(bar);
			var list = document.createElement('div');
			list.style.cssText = 'flex:1 1 auto;overflow:auto;';
			div.appendChild(list);

			var fill = function()
			{
				var issues = runChecks(ui);
				var errors = issues.filter(function(i) { return i.severity == 'error'; }).length;
				summary.innerText = (issues.length == 0) ? 'No problems found.' :
					errors + ' error(s), ' + (issues.length - errors) + ' warning(s)';
				list.innerText = '';
				var lastSheet = null;

				for (var i = 0; i < issues.length; i++)
				{
					(function(issue)
					{
						var sheet = sheetOf(ui, issue.page);

						if (sheet != lastSheet && getPagesCount(ui) > 1)
						{
							var h = document.createElement('div');
							h.style.cssText = 'font-weight:bold;margin:6px 0 2px 0;opacity:0.8;';
							mxUtils.write(h, sheet);
							list.appendChild(h);
							lastSheet = sheet;
						}

						var row = document.createElement('div');
						row.style.cssText = 'padding:2px 4px;cursor:pointer;border-radius:3px;display:flex;gap:6px;';
						row.setAttribute('title', 'Show this item');
						var badge = document.createElement('span');
						badge.style.cssText = 'flex:0 0 auto;font-weight:bold;color:' +
							((issue.severity == 'error') ? '#d32f2f' : '#ed8b00') + ';';
						mxUtils.write(badge, (issue.severity == 'error') ? '●' : '▲');
						row.appendChild(badge);
						var text = document.createElement('span');
						mxUtils.write(text, issue.item + ': ' + issue.problem);
						row.appendChild(text);
						mxEvent.addListener(row, 'mouseenter', function() { row.style.background = 'rgba(128,128,128,0.15)'; });
						mxEvent.addListener(row, 'mouseleave', function() { row.style.background = ''; });
						mxEvent.addListener(row, 'click', function()
						{
							if (ProcessDraw.Project != null)
							{
								ProcessDraw.Project.selectCellOnPage(ui, issue.cell, issue.page);
							}
						});
						list.appendChild(row);
					})(issues[i]);
				}
			};

			var w = 380;
			var h = 360;
			var x = Math.max(10, document.body.clientWidth - w - 280);
			checkWindow = new WrapperWindow(ui, 'Project Check', x, 120, w, h, function() {}, div);
			checkWindow.refresh = fill;
			checkWindow.window.addListener(mxEvent.SHOW, fill);
			fill();
		}
		else
		{
			checkWindow.window.setVisible(true);
			checkWindow.refresh();
		}

		return checkWindow;
	};

	function getPagesCount(ui)
	{
		return (ui.pages != null) ? ui.pages.length : 1;
	};

	ProcessDraw.Lists =
	{
		equipmentList: equipmentList,
		lineList: lineList,
		instrumentIndex: instrumentIndex,
		valveList: valveList,
		specialList: specialList,
		streamList: streamList,
		runChecks: runChecks,
		getSheets: getSheets,
		exportLists: exportLists,
		showCheckWindow: showCheckWindow,

		install: function(ui)
		{
			ui.actions.addAction('pdExportLists', function()
			{
				exportLists(ui);
			});

			ui.actions.addAction('pdProjectCheck', function()
			{
				showCheckWindow(ui);
			});
		}
	};
})();
