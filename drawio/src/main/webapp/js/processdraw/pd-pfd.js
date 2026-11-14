/**
 * ProcessDraw PFD tools: stream markers, heat & material balance (H&MB) tables
 * and equipment summaries.
 *
 * - A stream marker (pd_class stream) carries the stream data. "Add Stream
 *   Marker" puts it on a line as a child of the edge, so it moves with the line.
 * - An H&MB table (pd_class hmb) is a cell whose HTML label is built from the
 *   streams. Tables and summaries are rebuilt inside the same undoable edit as
 *   the change that affects them (model BEFORE_UNDO), so undo keeps them right.
 * - Double-click on a table opens the H&MB editor; blocks copied from Excel or
 *   a simulator can be pasted into it.
 */
(function()
{
	var ProcessDraw = window.ProcessDraw = window.ProcessDraw || {};
	var Tags = ProcessDraw.Tags;
	var Library = ProcessDraw.Library;
	var Fields = ProcessDraw.Fields;

	var PROPS = ['temperature', 'pressure', 'vapour_fraction', 'mass_flow', 'molar_flow', 'vol_flow',
		'std_gas_flow', 'molecular_weight', 'density', 'viscosity'];

	mxResources.parse(
		'pdAddStream=Add Stream Marker\n' +
		'pdAddHmb=Insert H&MB Table\n' +
		'pdEditHmb=Edit H&MB Values...\n' +
		'pdAddSummary=Add Equipment Summary\n' +
		'pdHmbSettings=Streams & Components...\n');

	// ---------------------------------------------------------------- Palette

	var TABLE_STYLE = 'text;html=1;whiteSpace=nowrap;overflow=visible;align=left;verticalAlign=top;' +
		'fontSize=9;spacing=0;strokeColor=none;fillColor=none;resizable=0;autosize=1;';

	Library.addPalette('pdPfd', 'ProcessDraw / PFD & Streams',
	[
		{id: 'pd_stream_diamond', name: 'Stream Number (diamond)', type: 'stream.diamond', cls: 'stream',
			label: '%stream_number%', labelInside: true, w: 28, h: 20, aspect: true,
			draw: 'p M 14 0 L 28 10 L 14 20 L 0 10 Z; fs', nozzles: [], data: {stream_number: ''},
			style: 'fontSize=9;fontStyle=1;', tags: 'stream number marker pfd diamond'},
		{id: 'pd_stream_circle', name: 'Stream Number (circle)', type: 'stream.circle', cls: 'stream',
			label: '%stream_number%', labelInside: true, w: 24, h: 24, aspect: true,
			draw: 'e 0 0 24 24; fs', nozzles: [], data: {stream_number: ''},
			style: 'fontSize=9;fontStyle=1;', tags: 'stream number marker pfd circle'},
		{id: 'pd_hmb_table', name: 'Heat & Material Balance Table', type: 'hmb.table', cls: 'hmb',
			label: '<b>HEAT AND MATERIAL BALANCE</b><br>(fills in from the stream markers)',
			w: 200, h: 60, rawStyle: TABLE_STYLE,
			data: {hmb_scope: 'page', hmb_layout: 'columns', hmb_hide_empty: '1'},
			tags: 'heat material balance hmb stream table pfd'}
	]);

	// ---------------------------------------------------------------- Streams

	function isStream(cell)
	{
		return Tags.isPd(cell) && Tags.attr(cell, 'pd_class') == 'stream';
	};

	function isTable(cell)
	{
		return Tags.isPd(cell) && Tags.attr(cell, 'pd_class') == 'hmb';
	};

	function isSummary(cell)
	{
		return Tags.isPd(cell) && Tags.attr(cell, 'pd_class') == 'summary';
	};

	/**
	 * Component list from the project settings, with the attribute key of each.
	 */
	function getComponents(ui)
	{
		var names = String(Tags.getSettings(ui).components || '').split(/\r?\n|,|;/);
		var result = [];

		for (var i = 0; i < names.length; i++)
		{
			var name = names[i].trim();

			if (name.length > 0)
			{
				result.push({name: name, key: 'comp_' + name.replace(/[^A-Za-z0-9]/g, '_')});
			}
		}

		return result;
	};

	/**
	 * Returns [{cell, page}] of stream markers, on the current page only or on all.
	 */
	function getStreams(ui, allPages)
	{
		var result = [];

		Tags.forEachCell(ui, function(cell, page)
		{
			if (isStream(cell) && (allPages || page == null || page == ui.currentPage))
			{
				result.push({cell: cell, page: page});
			}
		});

		result.sort(function(a, b)
		{
			var na = parseFloat(Tags.attr(a.cell, 'stream_number'));
			var nb = parseFloat(Tags.attr(b.cell, 'stream_number'));

			return (isNaN(na) ? 1e9 : na) - (isNaN(nb) ? 1e9 : nb);
		});

		return result;
	};

	/**
	 * Adds missing component fields (empty) to the stream.
	 */
	function ensureComponents(ui, cell)
	{
		var comps = getComponents(ui);
		var values = {};
		var missing = false;

		for (var i = 0; i < comps.length; i++)
		{
			if (!cell.value.hasAttribute(comps[i].key))
			{
				values[comps[i].key] = '';
				missing = true;
			}
		}

		if (missing)
		{
			Tags.setAttributes(ui.editor.graph, cell, values);
		}
	};

	function nextStreamNumber(ui)
	{
		var max = 0;

		Tags.forEachCell(ui, function(cell)
		{
			var n = parseInt(Tags.attr(cell, 'stream_number'), 10);

			if (isStream(cell) && !isNaN(n))
			{
				max = Math.max(max, n);
			}
		});

		return String((max > 0) ? max + 1 : Tags.getSettings(ui).streamStart);
	};

	/**
	 * Numbers new and copied stream markers, adds component fields and fills new
	 * tables and summaries.
	 */
	function onCellsAdded(ui, cells)
	{
		var graph = ui.editor.graph;
		var all = [];

		for (var i = 0; i < cells.length; i++)
		{
			all = all.concat(graph.model.getDescendants(cells[i]));
		}

		var streams = all.filter(isStream);

		if (streams.length == 0 && all.filter(isTable).length == 0)
		{
			return;
		}

		var counts = {};

		Tags.forEachCell(ui, function(cell)
		{
			if (isStream(cell))
			{
				var n = Tags.attr(cell, 'stream_number');
				counts[n] = (counts[n] || 0) + 1;
			}
		});

		graph.model.beginUpdate();
		try
		{
			for (var i = 0; i < streams.length; i++)
			{
				var n = Tags.attr(streams[i], 'stream_number');

				if ((n == '' || counts[n] > 1) && !Tags.suspended)
				{
					counts[n]--;
					var next = nextStreamNumber(ui);
					Tags.setAttributes(graph, streams[i], {stream_number: next});
					counts[next] = 1;
				}

				ensureComponents(ui, streams[i]);
			}
		}
		finally
		{
			graph.model.endUpdate();
		}
	};

	/**
	 * Puts a stream marker on each given edge (in the middle of the line).
	 */
	function addMarkers(ui, edges, symbolId)
	{
		var graph = ui.editor.graph;
		var sym = Library.getSymbol(symbolId || 'pd_stream_diamond');
		var added = [];

		graph.model.beginUpdate();
		try
		{
			for (var i = 0; i < edges.length; i++)
			{
				var marker = Library.createCell(sym);
				marker.geometry = new mxGeometry(0, 0, sym.w, sym.h);
				marker.geometry.relative = true;
				marker.geometry.offset = new mxPoint(-sym.w / 2, -sym.h / 2);
				var line = edges[i];

				// The line's service or fluid as first description
				var desc = Tags.attr(line, 'fluid') || Tags.attr(line, 'line_number') || '';

				if (desc)
				{
					marker.value.setAttribute('description', desc);
				}

				added.push(graph.addCell(marker, line));
			}
		}
		finally
		{
			graph.model.endUpdate();
		}

		graph.setSelectionCells(added);

		return added;
	};

	// ---------------------------------------------------------------- H&MB table

	function esc(s)
	{
		return mxUtils.htmlEntities(String((s != null) ? s : ''), false);
	};

	/**
	 * Rows of the table: [{key, label, unit}] (stream data rows and components).
	 */
	function getRows(ui)
	{
		var system = Tags.getSettings(ui).units;
		var rows = [{key: 'description', label: 'Description', unit: ''}];

		for (var i = 0; i < PROPS.length; i++)
		{
			rows.push({key: PROPS[i], label: Fields.getLabel(PROPS[i]), unit: Fields.getUnit(PROPS[i], system)});
		}

		var comps = getComponents(ui);
		var basis = Tags.getSettings(ui).compBasis;

		for (var i = 0; i < comps.length; i++)
		{
			rows.push({key: comps[i].key, label: comps[i].name, unit: (basis == 'mass fraction') ? 'wt frac' :
				'mol frac', component: true});
		}

		return rows;
	};

	function buildTableHtml(ui, table)
	{
		var streams = getStreams(ui, Tags.attr(table, 'hmb_scope') == 'all');
		var rows = getRows(ui);
		var hideEmpty = Tags.attr(table, 'hmb_hide_empty') != '0';
		var byRow = Tags.attr(table, 'hmb_layout') == 'rows';
		var td = 'border:1px solid currentColor;padding:1px 4px;';

		if (hideEmpty)
		{
			rows = rows.filter(function(r)
			{
				return streams.some(function(s)
				{
					return Tags.attr(s.cell, r.key) !== '';
				});
			});
		}

		var html = '<table style="border-collapse:collapse;font-size:inherit;">';
		var colCount = (byRow) ? rows.length + 1 : streams.length + 2;
		html += '<tr><td colspan="' + colCount + '" style="' + td +
			'text-align:center;font-weight:bold;">HEAT AND MATERIAL BALANCE</td></tr>';

		if (streams.length == 0)
		{
			return html + '<tr><td style="' + td + '">Add stream markers to the lines ' +
				'(ProcessDraw &gt; Add Stream Marker)</td></tr></table>';
		}

		if (!byRow)
		{
			html += '<tr><td style="' + td + 'font-weight:bold;">Stream</td><td style="' + td + '"></td>';

			for (var j = 0; j < streams.length; j++)
			{
				html += '<td style="' + td + 'font-weight:bold;text-align:center;">' +
					esc(Tags.attr(streams[j].cell, 'stream_number')) + '</td>';
			}

			html += '</tr>';

			for (var i = 0; i < rows.length; i++)
			{
				html += '<tr><td style="' + td + '">' + esc(rows[i].label) + '</td><td style="' + td + '">' +
					esc(rows[i].unit) + '</td>';

				for (var j = 0; j < streams.length; j++)
				{
					html += '<td style="' + td + 'text-align:' + ((rows[i].key == 'description') ? 'center' : 'right') +
						';">' + esc(Tags.attr(streams[j].cell, rows[i].key)) + '</td>';
				}

				html += '</tr>';
			}
		}
		else
		{
			html += '<tr><td style="' + td + 'font-weight:bold;">Stream</td>';

			for (var i = 0; i < rows.length; i++)
			{
				html += '<td style="' + td + 'font-weight:bold;text-align:center;">' + esc(rows[i].label) +
					((rows[i].unit) ? '<br>' + esc(rows[i].unit) : '') + '</td>';
			}

			html += '</tr>';

			for (var j = 0; j < streams.length; j++)
			{
				html += '<tr><td style="' + td + 'font-weight:bold;text-align:center;">' +
					esc(Tags.attr(streams[j].cell, 'stream_number')) + '</td>';

				for (var i = 0; i < rows.length; i++)
				{
					html += '<td style="' + td + 'text-align:right;">' +
						esc(Tags.attr(streams[j].cell, rows[i].key)) + '</td>';
				}

				html += '</tr>';
			}
		}

		return html + '</table>';
	};

	// ---------------------------------------------------------------- Equipment summary

	function getSummaryLines(ui, eq)
	{
		var system = Tags.getSettings(ui).units;
		var type = Tags.attr(eq, 'pd_type');
		var a = function(k) { return Tags.attr(eq, k); };
		var u = function(k) { return Fields.getUnit(k, system); };
		var lines = [];

		function add(text, needed)
		{
			for (var i = 0; i < needed.length; i++)
			{
				if (a(needed[i]) === '')
				{
					return;
				}
			}

			lines.push(text);
		};

		if (/^(vessel|column|tank|reactor|filter)/.test(type))
		{
			add('ID ' + a('diameter') + ' x ' + (a('length_tt') || a('height_tt')) + ' ' + u('diameter') + ' T/T',
				['diameter']);
		}
		else if (/^pump/.test(type))
		{
			add(a('flow_rate') + ' ' + u('flow_rate') + ' @ ' + a('differential_head') + ' ' + u('differential_head'),
				['flow_rate', 'differential_head']);
		}
		else if (/^(compressor|turbine|fan)/.test(type))
		{
			add(a('flow_rate') + ' ' + u('flow_rate'), ['flow_rate']);
			add(a('suction_pressure') + ' / ' + a('discharge_pressure') + ' ' + u('suction_pressure'),
				['suction_pressure', 'discharge_pressure']);
		}
		else if (/^(hx|fired_heater|cooling_tower)/.test(type))
		{
			add('Duty ' + a('duty') + ' ' + u('duty'), ['duty']);
			add('Area ' + a('area') + ' ' + u('area'), ['area']);
		}

		add('Power ' + a('power') + ' ' + u('power'), ['power']);
		add('Design ' + a('design_pressure') + ' ' + u('design_pressure') + ' @ ' + a('design_temperature') + ' ' +
			u('design_temperature'), ['design_pressure', 'design_temperature']);
		add(a('material'), ['material']);

		return lines;
	};

	function buildSummaryHtml(ui, summary)
	{
		var eq = ui.editor.graph.model.getCell(Tags.attr(summary, 'pd_ref'));

		if (eq == null || !Tags.isPd(eq))
		{
			return '<i>' + esc(Tags.attr(summary, 'pd_ref_tag') || '?') + ' (deleted)</i>';
		}

		var html = '<b>' + esc(Tags.attr(eq, 'tag')) + '</b>';

		if (Tags.attr(eq, 'service'))
		{
			html += '<br>' + esc(Tags.attr(eq, 'service').toUpperCase());
		}

		var lines = getSummaryLines(ui, eq);

		for (var i = 0; i < lines.length; i++)
		{
			html += '<br>' + esc(lines[i]);
		}

		return html;
	};

	/**
	 * Adds a summary above each given equipment item.
	 */
	function addSummaries(ui, cells)
	{
		var graph = ui.editor.graph;
		var added = [];
		var equipment = cells.filter(function(c)
		{
			return Tags.attr(c, 'pd_class') == 'equipment';
		});

		graph.model.beginUpdate();
		try
		{
			for (var i = 0; i < equipment.length; i++)
			{
				var geo = graph.getCellGeometry(equipment[i]);
				var value = mxUtils.createXmlDocument().createElement('object');
				value.setAttribute('pd_class', 'summary');
				value.setAttribute('pd_type', 'summary.equipment');
				value.setAttribute('pd_ref', equipment[i].id);
				value.setAttribute('pd_ref_tag', Tags.attr(equipment[i], 'tag'));
				value.setAttribute('label', '');
				var cell = new mxCell(value, new mxGeometry(geo.x + geo.width / 2 - 60, geo.y - 70, 120, 50),
					'text;html=1;align=center;verticalAlign=bottom;fontSize=9;whiteSpace=nowrap;autosize=1;' +
					'resizable=0;strokeColor=none;fillColor=none;');
				cell.vertex = true;
				added.push(graph.addCell(cell, graph.model.getParent(equipment[i])));
			}

			refreshPage(ui);
		}
		finally
		{
			graph.model.endUpdate();
		}

		return added;
	};

	// ---------------------------------------------------------------- Refresh

	var refreshing = false;

	/**
	 * Rebuilds the tables and summaries of the current page.
	 */
	function refreshPage(ui)
	{
		if (refreshing)
		{
			return 0;
		}

		refreshing = true;
		var graph = ui.editor.graph;
		var count = 0;

		try
		{
			graph.model.beginUpdate();
			try
			{
				var cells = graph.model.getDescendants(graph.model.getRoot());

				for (var i = 0; i < cells.length; i++)
				{
					var html = (isTable(cells[i])) ? buildTableHtml(ui, cells[i]) :
						((isSummary(cells[i])) ? buildSummaryHtml(ui, cells[i]) : null);

					// pd_refresh: made outside the editor (MCP server), sized here from the rendered HTML
					if (html != null && (Tags.attr(cells[i], 'label') != html || Tags.attr(cells[i], 'pd_refresh') == '1'))
					{
						Tags.setAttributes(graph, cells[i], {label: html, pd_refresh: null});
						graph.updateCellSize(cells[i], true);
						count++;
					}
				}
			}
			finally
			{
				graph.model.endUpdate();
			}
		}
		finally
		{
			refreshing = false;
		}

		return count;
	};

	/**
	 * True if the edit changes stream data, equipment data or project settings.
	 */
	function affectsTables(ui, edit)
	{
		var root = ui.editor.graph.model.getRoot();

		for (var i = 0; i < edit.changes.length; i++)
		{
			var change = edit.changes[i];
			var cell = (change instanceof mxValueChange) ? change.cell :
				((change instanceof mxChildChange) ? change.child : null);

			// New tables and summaries are filled in right away
			if (change instanceof mxChildChange && (isTable(cell) || isSummary(cell)) && change.parent != null)
			{
				return true;
			}

			if (cell != null && (cell == root || isStream(cell) ||
				(Tags.isPd(cell) && Tags.attr(cell, 'pd_class') == 'equipment')))
			{
				return true;
			}

			// Deleting a line also deletes its stream marker
			if (change instanceof mxChildChange && cell != null && cell.children != null &&
				cell.children.some(isStream))
			{
				return true;
			}
		}

		return false;
	};

	// ---------------------------------------------------------------- H&MB editor

	function openEditor(ui, table)
	{
		var allPages = Tags.attr(table, 'hmb_scope') == 'all';
		var streams = getStreams(ui, allPages);

		if (streams.length == 0)
		{
			ui.alert('There are no stream markers yet. Select a line and use ProcessDraw > Add Stream Marker.');
			return;
		}

		var rows = getRows(ui);
		var div = document.createElement('div');
		div.style.fontSize = '12px';
		var head = document.createElement('div');
		head.style.fontWeight = 'bold';
		head.style.fontSize = '14px';
		head.style.marginBottom = '4px';
		mxUtils.write(head, 'Heat & Material Balance');
		div.appendChild(head);
		var hint = document.createElement('div');
		hint.style.opacity = '0.65';
		hint.style.fontSize = '11px';
		hint.style.marginBottom = '6px';
		mxUtils.write(hint, 'Tip: copy a block of cells in Excel or your simulator and paste it into the first cell; ' +
			'it fills to the right and down.');
		div.appendChild(hint);

		var wrapper = document.createElement('div');
		wrapper.style.overflow = 'auto';
		wrapper.style.maxHeight = Math.max(240, window.innerHeight - 320) + 'px';
		var grid = document.createElement('table');
		grid.style.borderCollapse = 'collapse';
		var inputs = [];

		var tr = document.createElement('tr');
		tr.appendChild(document.createElement('th'));
		tr.appendChild(document.createElement('th'));

		for (var j = 0; j < streams.length; j++)
		{
			var th = document.createElement('th');
			th.style.padding = '2px';
			mxUtils.write(th, 'Stream ' + Tags.attr(streams[j].cell, 'stream_number'));
			tr.appendChild(th);
		}

		grid.appendChild(tr);

		for (var i = 0; i < rows.length; i++)
		{
			tr = document.createElement('tr');
			var tdLabel = document.createElement('td');
			tdLabel.style.paddingRight = '6px';
			tdLabel.style.whiteSpace = 'nowrap';
			mxUtils.write(tdLabel, rows[i].label);
			tr.appendChild(tdLabel);
			var tdUnit = document.createElement('td');
			tdUnit.style.paddingRight = '6px';
			tdUnit.style.opacity = '0.6';
			tdUnit.style.whiteSpace = 'nowrap';
			mxUtils.write(tdUnit, rows[i].unit);
			tr.appendChild(tdUnit);
			inputs.push([]);

			for (var j = 0; j < streams.length; j++)
			{
				var td = document.createElement('td');
				td.style.padding = '1px';
				var input = document.createElement('input');
				input.setAttribute('type', 'text');
				input.style.width = (rows[i].key == 'description') ? '110px' : '70px';
				input.style.boxSizing = 'border-box';
				input.value = Tags.attr(streams[j].cell, rows[i].key);
				input.setAttribute('data-row', i);
				input.setAttribute('data-col', j);
				td.appendChild(input);
				tr.appendChild(td);
				inputs[i].push(input);
			}

			grid.appendChild(tr);
		}

		// Pasting a block (tab separated rows) fills to the right and down
		mxEvent.addListener(grid, 'paste', function(evt)
		{
			var target = evt.target;
			var text = (evt.clipboardData != null) ? evt.clipboardData.getData('text/plain') : '';

			if (target.nodeName != 'INPUT' || (text.indexOf('\t') < 0 && text.indexOf('\n') < 0))
			{
				return;
			}

			evt.preventDefault();
			var r0 = parseInt(target.getAttribute('data-row'), 10);
			var c0 = parseInt(target.getAttribute('data-col'), 10);
			var lines = text.replace(/\r/g, '').replace(/\n$/, '').split('\n');

			for (var r = 0; r < lines.length && r0 + r < inputs.length; r++)
			{
				var values = lines[r].split('\t');

				for (var c = 0; c < values.length && c0 + c < streams.length; c++)
				{
					inputs[r0 + r][c0 + c].value = values[c].trim();
				}
			}
		});

		mxEvent.addListener(grid, 'keydown', function(evt)
		{
			evt.stopPropagation();
		});

		wrapper.appendChild(grid);
		div.appendChild(wrapper);

		var dlg = new CustomDialog(ui, div, function()
		{
			var graph = ui.editor.graph;
			graph.model.beginUpdate();
			try
			{
				for (var j = 0; j < streams.length; j++)
				{
					var values = {};
					var changed = false;

					for (var i = 0; i < rows.length; i++)
					{
						var v = inputs[i][j].value.trim();

						if (v != Tags.attr(streams[j].cell, rows[i].key))
						{
							values[rows[i].key] = v;
							changed = true;
						}
					}

					if (changed)
					{
						Tags.setAttributes(graph, streams[j].cell, values);
					}
				}

				refreshPage(ui);
			}
			finally
			{
				graph.model.endUpdate();
			}
		}, null, mxResources.get('apply'));

		ui.showDialog(dlg.container, Math.min(window.innerWidth - 80, 260 + streams.length * 78),
			Math.min(window.innerHeight - 80, 170 + rows.length * 26), true, true);
	};

	// ---------------------------------------------------------------- Settings

	function showSettings(ui)
	{
		var s = Tags.getSettings(ui);
		var div = document.createElement('div');
		div.style.fontSize = '12px';
		var title = document.createElement('div');
		title.style.fontWeight = 'bold';
		title.style.fontSize = '14px';
		title.style.marginBottom = '8px';
		mxUtils.write(title, 'Streams & Components');
		div.appendChild(title);

		var label = document.createElement('div');
		mxUtils.write(label, 'Components shown in the H&MB tables (one per line):');
		div.appendChild(label);
		var area = document.createElement('textarea');
		area.style.width = '100%';
		area.style.height = '150px';
		area.style.boxSizing = 'border-box';
		area.style.fontFamily = 'monospace';
		area.value = String(s.components || '').split(/,|;/).join('\n');
		area.setAttribute('placeholder', 'Nitrogen\nCO2\nMethane\nEthane\nPropane\nWater');
		div.appendChild(area);

		var row = document.createElement('div');
		row.style.margin = '8px 0';
		mxUtils.write(row, 'Composition basis: ');
		var basis = document.createElement('select');
		var opts = ['mole fraction', 'mass fraction'];

		for (var i = 0; i < opts.length; i++)
		{
			var o = document.createElement('option');
			o.value = opts[i];
			mxUtils.write(o, opts[i]);
			basis.appendChild(o);
		}

		basis.value = s.compBasis;
		row.appendChild(basis);
		div.appendChild(row);

		var startRow = document.createElement('div');
		mxUtils.write(startRow, 'First stream number: ');
		var start = document.createElement('input');
		start.setAttribute('type', 'text');
		start.style.width = '60px';
		start.value = s.streamStart;
		startRow.appendChild(start);
		div.appendChild(startRow);

		var dlg = new CustomDialog(ui, div, function()
		{
			var graph = ui.editor.graph;
			var n = parseInt(start.value, 10);

			graph.model.beginUpdate();
			try
			{
				Tags.setSettings(ui, {components: area.value.split(/\r?\n/).map(function(c) { return c.trim(); })
					.filter(function(c) { return c.length > 0; }).join('\n'), compBasis: basis.value,
					streamStart: (isNaN(n) || n < 0) ? 1 : n});

				var streams = getStreams(ui, true);

				for (var i = 0; i < streams.length; i++)
				{
					ensureComponents(ui, streams[i].cell);
				}

				refreshPage(ui);
			}
			finally
			{
				graph.model.endUpdate();
			}
		}, null, mxResources.get('apply'));

		ui.showDialog(dlg.container, 420, 380, true, true);
	};

	// ---------------------------------------------------------------- Install

	function install(ui)
	{
		var graph = ui.editor.graph;

		graph.addListener(mxEvent.CELLS_ADDED, function(sender, evt)
		{
			try
			{
				onCellsAdded(ui, evt.getProperty('cells') || []);
			}
			catch (e)
			{
				console.error('ProcessDraw: stream numbering failed', e);
			}
		});

		// Rebuilds tables and summaries in the same undoable edit as the change
		graph.model.addListener(mxEvent.BEFORE_UNDO, function(sender, evt)
		{
			try
			{
				if (!refreshing && affectsTables(ui, evt.getProperty('edit')))
				{
					refreshPage(ui);
				}
			}
			catch (e)
			{
				console.error('ProcessDraw: H&MB refresh failed', e);
			}
		});

		// Streams on other sheets may have changed; files from the MCP server need sizing
		ui.editor.addListener('fileLoaded', function()
		{
			window.setTimeout(function()
			{
				try
				{
					refreshPage(ui);
				}
				catch (e)
				{
					console.error('ProcessDraw: H&MB refresh failed', e);
				}
			}, 0);
		});

		ui.editor.addListener('pageSelected', function()
		{
			window.setTimeout(function()
			{
				try
				{
					refreshPage(ui);
				}
				catch (e)
				{
					console.error('ProcessDraw: H&MB refresh failed', e);
				}
			}, 0);
		});

		// Tables and summaries are generated: no in-place text editing
		var isCellEditable = graph.isCellEditable;

		graph.isCellEditable = function(cell)
		{
			return !isTable(cell) && !isSummary(cell) && isCellEditable.apply(this, arguments);
		};

		var graphDblClick = graph.dblClick;

		graph.dblClick = function(evt, cell)
		{
			if (this.isEnabled() && isTable(cell))
			{
				mxEvent.consume(evt);
				openEditor(ui, cell);
			}
			else if (this.isEnabled() && isSummary(cell))
			{
				mxEvent.consume(evt);
				var eq = this.model.getCell(Tags.attr(cell, 'pd_ref'));

				if (eq != null && ProcessDraw.Properties != null)
				{
					ProcessDraw.Properties.openDataSheet(ui, eq);
				}
			}
			else
			{
				graphDblClick.apply(this, arguments);
			}
		};

		ui.actions.addAction('pdAddStream', function()
		{
			var edges = ui.editor.graph.getSelectionCells().filter(function(c)
			{
				return ui.editor.graph.model.isEdge(c);
			});

			if (edges.length == 0)
			{
				ui.alert('Select one or more lines to put a stream number on.');
			}
			else
			{
				addMarkers(ui, edges);
			}
		});

		ui.actions.addAction('pdAddHmb', function()
		{
			var g = ui.editor.graph;
			var cell = Library.createCell(Library.getSymbol('pd_hmb_table'));
			var bounds = g.getGraphBounds();
			var s = g.view.scale;
			var t = g.view.translate;
			cell.geometry.x = (bounds.width > 0) ? bounds.x / s - t.x : 20;
			cell.geometry.y = (bounds.height > 0) ? (bounds.y + bounds.height) / s - t.y + 40 : 20;
			g.setSelectionCells(g.importCells([cell], 0, 0, g.getDefaultParent()));
			refreshPage(ui);
		});

		ui.actions.addAction('pdEditHmb', function()
		{
			var g = ui.editor.graph;
			var table = (isTable(g.getSelectionCell())) ? g.getSelectionCell() : null;

			if (table == null)
			{
				var cells = g.model.getDescendants(g.model.getRoot()).filter(isTable);
				table = (cells.length > 0) ? cells[0] : null;
			}

			if (table == null)
			{
				ui.alert('Insert an H&MB table first (ProcessDraw > Insert H&MB Table).');
			}
			else
			{
				openEditor(ui, table);
			}
		});

		ui.actions.addAction('pdAddSummary', function()
		{
			var cells = addSummaries(ui, ui.editor.graph.getSelectionCells());

			if (cells.length == 0)
			{
				ui.alert('Select one or more equipment items.');
			}
			else
			{
				ui.editor.graph.setSelectionCells(cells);
			}
		});

		ui.actions.addAction('pdHmbSettings', function()
		{
			showSettings(ui);
		});

		var createPopupMenu = ui.menus.createPopupMenu;

		ui.menus.createPopupMenu = function(menu, cell, evt)
		{
			createPopupMenu.apply(this, arguments);
			var g = ui.editor.graph;
			var cells = g.getSelectionCells();

			if (cells.length > 0 && cells.every(function(c) { return g.model.isEdge(c); }))
			{
				menu.addSeparator();
				this.addMenuItems(menu, ['pdAddStream'], null, evt);
			}
			else if (cells.length > 0 && cells.every(function(c) { return Tags.attr(c, 'pd_class') == 'equipment'; }))
			{
				menu.addSeparator();
				this.addMenuItems(menu, ['pdAddSummary'], null, evt);
			}
			else if (cells.length == 1 && isTable(cells[0]))
			{
				menu.addSeparator();
				this.addMenuItems(menu, ['pdEditHmb'], null, evt);
			}
		};
	};

	ProcessDraw.PFD =
	{
		PROPS: PROPS,
		isStream: isStream,
		isTable: isTable,
		isSummary: isSummary,
		getComponents: getComponents,
		getStreams: getStreams,
		ensureComponents: ensureComponents,
		nextStreamNumber: nextStreamNumber,
		addMarkers: addMarkers,
		addSummaries: addSummaries,
		buildTableHtml: buildTableHtml,
		buildSummaryHtml: buildSummaryHtml,
		refreshPage: refreshPage,
		openEditor: openEditor,
		install: install
	};
})();
