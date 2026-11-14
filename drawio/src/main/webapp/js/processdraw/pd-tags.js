/**
 * ProcessDraw tags: parsing, ISA 5.1 letter decoding, project settings,
 * project-wide scanning and automatic tag numbering.
 *
 * The pure functions (parse, format, decodeIsa) need no editor and are
 * covered by tools/test-tags.cjs.
 */
(function()
{
	var ProcessDraw = window.ProcessDraw = window.ProcessDraw || {};

	// ---------------------------------------------------------------- Pure functions

	/**
	 * Splits "10-P-101A" into {prefix: '10-P', sep: '-', number: 101, digits: '101', suffix: 'A'}.
	 * Returns null for tags without a number ("P-???", "").
	 */
	function parse(tag)
	{
		var m = /^(.*?)([-_ ]?)(\d+)([A-Za-z]?)$/.exec(String(tag || '').trim());

		if (m == null || m[1].length == 0)
		{
			return null;
		}

		return {prefix: m[1], sep: m[2], number: parseInt(m[3], 10), digits: m[3], suffix: m[4].toUpperCase()};
	};

	/**
	 * Splits an instrument tag "FIC-101", "FIC 101", "FIC101" or "20-FIC-101A" into
	 * {area, fn, loop}. Returns null if the tag is not an instrument tag.
	 */
	function parseInstrument(tag)
	{
		var m = /^(?:(.+?)-)?([A-Za-z]{1,6})[-_ ]?(\d+[A-Za-z]?|\?\?\?)$/.exec(String(tag || '').trim());

		if (m == null)
		{
			return null;
		}

		return {area: m[1] || '', fn: m[2].toUpperCase(), loop: m[3].toUpperCase()};
	};

	function pad(n, digits)
	{
		var s = String(n);

		while (s.length < digits)
		{
			s = '0' + s;
		}

		return s;
	};

	function format(prefix, number, settings, suffix)
	{
		return prefix + settings.separator + pad(number, settings.digits) + (suffix || '');
	};

	function formatInstrument(area, fn, loop, settings)
	{
		return ((area) ? area + '-' : '') + fn + settings.separator + loop;
	};

	var ISA_FIRST =
	{
		A: 'Analysis', B: 'Burner / Combustion', C: 'Conductivity', D: 'Density', E: 'Voltage', F: 'Flow',
		G: 'Gauging', H: 'Hand', I: 'Current', J: 'Power', K: 'Time', L: 'Level', M: 'Moisture',
		N: 'User\'s choice', O: 'User\'s choice', P: 'Pressure', Q: 'Quantity', R: 'Radiation',
		S: 'Speed / Frequency', T: 'Temperature', U: 'Multivariable', V: 'Vibration', W: 'Weight / Force',
		X: 'Unclassified', Y: 'Event / State', Z: 'Position'
	};

	var ISA_MODIFIER = {D: 'Differential', F: 'Ratio', J: 'Scan', K: 'Rate of Change', Q: 'Totalizing'};

	var ISA_SUCCEEDING =
	{
		A: 'Alarm', B: 'User\'s choice', C: 'Controller', E: 'Element', G: 'Gauge', H: 'High',
		I: 'Indicating', K: 'Control Station', L: 'Low', M: 'Middle', N: 'User\'s choice', O: 'Orifice',
		P: 'Test Point', R: 'Recording', S: 'Switch', T: 'Transmitter', U: 'Multifunction', V: 'Valve',
		W: 'Well', X: 'Unclassified', Y: 'Relay / Compute', Z: 'Final Element'
	};

	/**
	 * Decodes ISA 5.1 identification letters, e.g. "FIC" -> "Flow Indicating Controller".
	 */
	function decodeIsa(fn)
	{
		fn = String(fn || '').toUpperCase();

		if (!/^[A-Z]+$/.test(fn) || ISA_FIRST[fn.charAt(0)] == null)
		{
			return '';
		}

		var words = [ISA_FIRST[fn.charAt(0)]];
		var i = 1;

		// Safety valves and safety elements (PSV, PSE, TSV, TSE)
		if (/^[A-Z]S[VE]$/.test(fn))
		{
			return words[0] + ' Safety ' + ((fn.charAt(2) == 'V') ? 'Valve' : 'Element');
		}

		if (fn.length > 1 && ISA_MODIFIER[fn.charAt(1)] != null)
		{
			words.push(ISA_MODIFIER[fn.charAt(1)]);
			i = 2;
		}

		for (; i < fn.length; i++)
		{
			words.push(ISA_SUCCEEDING[fn.charAt(i)] || fn.charAt(i));
		}

		return words.join(' ');
	};

	// ---------------------------------------------------------------- Settings

	var DEFAULTS =
	{
		start: 101,
		step: 1,
		digits: 3,
		separator: '-',
		autonumber: true,
		units: 'metric',
		linePattern: '{size}-{service_code}-{sequence}-{pipe_class}[-{insulation}]',
		lineStart: 1001,
		lineDigits: 4,
		serviceCodes: 'P = Process\nG = Process gas\nF = Flare\nV = Vent\nD = Drain\n' +
			'CWS = Cooling water supply\nCWR = Cooling water return\nLS = Low pressure steam\n' +
			'MS = Medium pressure steam\nHS = High pressure steam\nC = Condensate\nIA = Instrument air\n' +
			'PA = Plant air\nN = Nitrogen\nFG = Fuel gas\nW = Water\nDW = Demineralized water\nCH = Chemical',
		pipeClasses: 'A1A = CS, 150#, RF, CA 3 mm\nA3A = CS, 300#, RF, CA 3 mm\nB1A = SS316L, 150#, RF\n' +
			'B3A = SS316L, 300#, RF\nD1A = CS galvanized, 150#, utilities',
		projectNumber: '',
		projectName: '',
		client: '',
		site: '',
		area: '',
		preparedBy: '',
		docPrefix: ''
	};

	// Root cell attribute for each setting
	var SETTING_KEYS =
	{
		start: 'pd_tag_start',
		step: 'pd_tag_step',
		digits: 'pd_tag_digits',
		separator: 'pd_tag_separator',
		autonumber: 'pd_autonumber',
		units: 'pd_units',
		linePattern: 'pd_line_pattern',
		lineStart: 'pd_line_start',
		lineDigits: 'pd_line_digits',
		serviceCodes: 'pd_service_codes',
		pipeClasses: 'pd_pipe_classes',
		projectNumber: 'pd_project_number',
		projectName: 'pd_project_name',
		client: 'pd_client',
		site: 'pd_site',
		area: 'pd_area',
		preparedBy: 'pd_prepared_by',
		docPrefix: 'pd_doc_prefix'
	};

	function getPages(ui)
	{
		return (ui.pages != null && ui.pages.length > 0) ? ui.pages : [null];
	};

	function getPageRoot(ui, page)
	{
		if (page == null || page == ui.currentPage)
		{
			return ui.editor.graph.model.getRoot();
		}

		if (page.root == null && typeof ui.updatePageRoot === 'function')
		{
			ui.updatePageRoot(page);
		}

		return page.root;
	};

	/**
	 * Project settings are stored as attributes on the root cell of the first
	 * page (the same place as Edit Data with nothing selected).
	 */
	function getSettings(ui)
	{
		var result = {};
		var root = getPageRoot(ui, getPages(ui)[0]);
		var value = (root != null && mxUtils.isNode(root.value)) ? root.value : null;

		for (var key in DEFAULTS)
		{
			var stored = (value != null) ? value.getAttribute(SETTING_KEYS[key]) : null;

			if (stored == null || stored === '')
			{
				result[key] = DEFAULTS[key];
			}
			else if (typeof DEFAULTS[key] === 'number')
			{
				var n = parseInt(stored, 10);
				result[key] = (isNaN(n)) ? DEFAULTS[key] : n;
			}
			else if (typeof DEFAULTS[key] === 'boolean')
			{
				result[key] = stored == '1' || stored == 'true';
			}
			else
			{
				result[key] = stored;
			}
		}

		return result;
	};

	/**
	 * Sets attributes on the root cell of a page (sheet data, project settings).
	 * Undoable on the current page; other pages are changed directly and the
	 * file is marked as modified. A null value removes the attribute.
	 */
	function setPageAttributes(ui, page, values)
	{
		var root = getPageRoot(ui, page);
		var value = (mxUtils.isNode(root.value)) ? root.value.cloneNode(true) :
			mxUtils.createXmlDocument().createElement('object');

		for (var key in values)
		{
			if (values[key] == null)
			{
				value.removeAttribute(key);
			}
			else
			{
				value.setAttribute(key, String(values[key]));
			}
		}

		if (page == null || page == ui.currentPage)
		{
			ui.editor.graph.model.setValue(root, value);
		}
		else
		{
			root.value = value;
			var file = ui.getCurrentFile();

			if (file != null)
			{
				file.fileChanged();
			}
		}
	};

	function getPageAttribute(ui, page, name)
	{
		var root = getPageRoot(ui, page);

		return (root != null && mxUtils.isNode(root.value)) ? (root.value.getAttribute(name) || '') : '';
	};

	function setSettings(ui, values)
	{
		var attrs = {};

		for (var key in values)
		{
			var v = values[key];
			attrs[SETTING_KEYS[key]] = (typeof v === 'boolean') ? (v ? '1' : '0') : String(v);
		}

		setPageAttributes(ui, getPages(ui)[0], attrs);
	};

	// ---------------------------------------------------------------- Cells

	function isPd(cell)
	{
		return cell != null && mxUtils.isNode(cell.value) && cell.value.getAttribute('pd_class') != null &&
			cell.value.getAttribute('pd_class') != '';
	};

	function attr(cell, name)
	{
		return (mxUtils.isNode(cell.value)) ? (cell.value.getAttribute(name) || '') : '';
	};

	/**
	 * Calls fn(cell, page) for every ProcessDraw cell in all pages.
	 */
	function forEachCell(ui, fn)
	{
		var pages = getPages(ui);

		for (var i = 0; i < pages.length; i++)
		{
			var root = getPageRoot(ui, pages[i]);
			var stack = (root != null) ? [root] : [];

			while (stack.length > 0)
			{
				var cell = stack.pop();

				if (isPd(cell))
				{
					fn(cell, pages[i]);
				}

				for (var j = (cell.children != null) ? cell.children.length - 1 : -1; j >= 0; j--)
				{
					stack.push(cell.children[j]);
				}
			}
		}
	};

	/**
	 * Returns [{cell, page}] of all other cells that use the given tag.
	 */
	function findTag(ui, tag, exceptCell)
	{
		var result = [];
		tag = String(tag || '').trim().toUpperCase();

		if (tag.length > 0 && tag.indexOf('???') < 0)
		{
			forEachCell(ui, function(cell, page)
			{
				if (cell != exceptCell && attr(cell, 'tag').trim().toUpperCase() == tag)
				{
					result.push({cell: cell, page: page});
				}
			});
		}

		return result;
	};

	/**
	 * Index of used tags: counts per tag, highest number per prefix and highest
	 * instrument loop number.
	 */
	function buildIndex(ui)
	{
		var index = {counts: {}, max: {}, maxLoop: 0};

		forEachCell(ui, function(cell)
		{
			var tag = attr(cell, 'tag').trim().toUpperCase();

			if (tag.length == 0 || tag.indexOf('???') >= 0)
			{
				return;
			}

			index.counts[tag] = (index.counts[tag] || 0) + 1;

			if (attr(cell, 'pd_class') == 'instrument')
			{
				var loop = parseInt(attr(cell, 'loop'), 10);

				if (!isNaN(loop))
				{
					index.maxLoop = Math.max(index.maxLoop, loop);
				}
			}
			else
			{
				var p = parse(tag);

				if (p != null)
				{
					index.max[p.prefix] = Math.max(index.max[p.prefix] || 0, p.number);
				}
			}
		});

		return index;
	};

	function nextNumber(current, settings)
	{
		return (current > 0) ? current + settings.step : settings.start;
	};

	/**
	 * Sets several attributes of a cell in one undoable change.
	 */
	function setAttributes(graph, cell, values)
	{
		var value = cell.value.cloneNode(true);

		for (var key in values)
		{
			if (values[key] == null)
			{
				value.removeAttribute(key);
			}
			else
			{
				value.setAttribute(key, values[key]);
			}
		}

		graph.model.setValue(cell, value);
	};

	/**
	 * Sets the tag of a cell. For instruments the function letters and loop
	 * number are updated from the tag.
	 */
	function setTag(ui, cell, tag)
	{
		var graph = ui.editor.graph;
		tag = String(tag || '').trim();
		var values = {tag: tag};

		if (attr(cell, 'pd_class') == 'instrument')
		{
			var p = parseInstrument(tag);

			if (p != null)
			{
				values['function'] = p.fn;
				values.loop = p.loop;
				values.tag = formatInstrument(p.area, p.fn, p.loop, getSettings(ui));
			}
		}

		setAttributes(graph, cell, values);
	};

	/**
	 * Gives the cell the next free tag. Uses and updates the given index.
	 */
	function assignNext(ui, cell, index, settings)
	{
		var graph = ui.editor.graph;

		if (attr(cell, 'pd_class') == 'instrument')
		{
			var p = parseInstrument(attr(cell, 'tag'));
			var fn = (p != null) ? p.fn : (attr(cell, 'function') || attr(cell, 'pd_tag_prefix') || 'X');
			index.maxLoop = nextNumber(index.maxLoop, settings);
			var loop = pad(index.maxLoop, settings.digits);
			var tag = formatInstrument((p != null) ? p.area : '', fn, loop, settings);
			setAttributes(graph, cell, {tag: tag, 'function': fn, loop: loop});
		}
		else
		{
			var current = parse(attr(cell, 'tag'));
			var prefix = (current != null) ? current.prefix : attr(cell, 'pd_tag_prefix');

			if (prefix == '')
			{
				return;
			}

			prefix = prefix.toUpperCase();
			index.max[prefix] = nextNumber(index.max[prefix] || 0, settings);
			setAttributes(graph, cell, {tag: format(prefix, index.max[prefix], settings)});
		}

		var newTag = attr(cell, 'tag').toUpperCase();
		index.counts[newTag] = (index.counts[newTag] || 0) + 1;
	};

	/**
	 * Sorts cells top to bottom, then left to right (rows of 20px tolerance).
	 */
	function sortByPosition(graph, cells)
	{
		return cells.slice().sort(function(a, b)
		{
			var ga = graph.getCellGeometry(a) || {x: 0, y: 0};
			var gb = graph.getCellGeometry(b) || {x: 0, y: 0};

			return (Math.abs(ga.y - gb.y) > 20) ? ga.y - gb.y : ga.x - gb.x;
		});
	};

	/**
	 * Numbers cells that were just added: tags ending in ??? and tags that are
	 * now used twice (copy/paste, duplicate).
	 */
	function autoNumber(ui, cells)
	{
		if (ProcessDraw.Tags.suspended)
		{
			return;
		}

		var settings = getSettings(ui);

		if (!settings.autonumber)
		{
			return;
		}

		var graph = ui.editor.graph;
		var candidates = [];
		var all = [];

		for (var i = 0; i < cells.length; i++)
		{
			all = all.concat(graph.model.getDescendants(cells[i]));
		}

		for (var i = 0; i < all.length; i++)
		{
			var tag = attr(all[i], 'tag').trim();

			if (isPd(all[i]) && tag.length > 0 && mxUtils.indexOf(candidates, all[i]) < 0)
			{
				candidates.push(all[i]);
			}
		}

		if (candidates.length == 0)
		{
			return;
		}

		var index = buildIndex(ui);
		candidates = sortByPosition(graph, candidates);

		graph.model.beginUpdate();
		try
		{
			for (var i = 0; i < candidates.length; i++)
			{
				var tag = attr(candidates[i], 'tag').trim().toUpperCase();

				if (tag.indexOf('???') >= 0 || index.counts[tag] > 1)
				{
					if (index.counts[tag] > 1)
					{
						index.counts[tag]--;
					}

					assignNext(ui, candidates[i], index, settings);
				}
			}
		}
		finally
		{
			graph.model.endUpdate();
		}
	};

	/**
	 * Numbers the given cells in position order starting at start (or the next
	 * free number if start is null). Instruments get new loop numbers.
	 */
	function renumber(ui, cells, start)
	{
		var graph = ui.editor.graph;
		var settings = getSettings(ui);
		var index = buildIndex(ui);
		cells = sortByPosition(graph, cells.filter(function(c)
		{
			return isPd(c) && (attr(c, 'pd_tag_prefix') != '' || attr(c, 'tag') != '');
		}));

		if (start != null)
		{
			// Restarts every prefix of the selection (and the loop numbers) at start
			index.maxLoop = start - settings.step;

			for (var i = 0; i < cells.length; i++)
			{
				var p = parse(attr(cells[i], 'tag'));
				var prefix = ((p != null) ? p.prefix : attr(cells[i], 'pd_tag_prefix')).toUpperCase();
				index.max[prefix] = start - settings.step;
			}
		}

		graph.model.beginUpdate();
		try
		{
			for (var i = 0; i < cells.length; i++)
			{
				assignNext(ui, cells[i], index, settings);
			}
		}
		finally
		{
			graph.model.endUpdate();
		}

		return cells.length;
	};

	/**
	 * Returns {duplicates: {tag: [{cell, page}]}, unnumbered: [{cell, page}]}.
	 */
	function check(ui)
	{
		var byTag = {};
		var result = {duplicates: {}, unnumbered: []};

		forEachCell(ui, function(cell, page)
		{
			var tag = attr(cell, 'tag').trim();

			if (tag.indexOf('???') >= 0)
			{
				result.unnumbered.push({cell: cell, page: page});
			}
			else if (tag.length > 0)
			{
				var key = tag.toUpperCase();
				byTag[key] = byTag[key] || [];
				byTag[key].push({cell: cell, page: page});
			}
		});

		for (var key in byTag)
		{
			if (byTag[key].length > 1)
			{
				result.duplicates[key] = byTag[key];
			}
		}

		return result;
	};

	ProcessDraw.Tags =
	{
		suspended: false,
		DEFAULTS: DEFAULTS,
		parse: parse,
		parseInstrument: parseInstrument,
		format: format,
		formatInstrument: formatInstrument,
		decodeIsa: decodeIsa,
		getSettings: getSettings,
		setSettings: setSettings,
		setPageAttributes: setPageAttributes,
		getPageAttribute: getPageAttribute,
		getPages: getPages,
		getPageRoot: getPageRoot,
		isPd: isPd,
		attr: attr,
		forEachCell: forEachCell,
		findTag: findTag,
		buildIndex: buildIndex,
		setAttributes: setAttributes,
		setTag: setTag,
		assignNext: assignNext,
		autoNumber: autoNumber,
		renumber: renumber,
		check: check,
		sortByPosition: sortByPosition,

		/**
		 * Numbers inserted, pasted and duplicated symbols automatically.
		 */
		install: function(ui)
		{
			ui.editor.graph.addListener(mxEvent.CELLS_ADDED, function(sender, evt)
			{
				try
				{
					autoNumber(ui, evt.getProperty('cells') || []);
				}
				catch (e)
				{
					console.error('ProcessDraw: auto numbering failed', e);
				}
			});
		}
	};
})();
