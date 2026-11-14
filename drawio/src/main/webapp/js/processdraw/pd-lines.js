/**
 * ProcessDraw line numbering.
 *
 * Line numbers are built from the project pattern, e.g.
 *   {size}-{service_code}-{sequence}-{pipe_class}[-{insulation}]  ->  6"-P-1001-A1A-H
 * {field} is any data field of the line. A part in [ ] is left out when one of
 * its fields is empty; an empty field outside [ ] is shown as "?".
 *
 * A line keeps its number through valves and fittings: a new line connected to
 * an inline item takes over the line on the other side. Changes to a line
 * apply to all segments with the same line number unless switched off.
 *
 * The pure functions (formatLine, parseCodes) are covered by tools/test-lines.cjs.
 */
(function()
{
	var ProcessDraw = window.ProcessDraw = window.ProcessDraw || {};
	var Tags = ProcessDraw.Tags;

	// Data that defines a line and is shared by its segments
	var LINE_KEYS = ['size', 'service_code', 'sequence', 'pipe_class', 'insulation', 'fluid',
		'line_number', 'pd_line_manual'];
	var MISSING = '?';

	// ---------------------------------------------------------------- Pure functions

	/**
	 * Splits a pattern into [{optional, parts: [{text} | {field}]}] groups.
	 */
	function parsePattern(pattern)
	{
		var groups = [];
		var current = {optional: false, parts: []};
		var re = /\{([A-Za-z0-9_]+)\}|\[|\]|[^{}\[\]]+|[{}]/g;
		var m;

		while ((m = re.exec(String(pattern || ''))) != null)
		{
			if (m[0] == '[' || m[0] == ']')
			{
				if (current.parts.length > 0)
				{
					groups.push(current);
				}

				current = {optional: m[0] == '[', parts: []};
			}
			else if (m[1] != null)
			{
				current.parts.push({field: m[1]});
			}
			else
			{
				current.parts.push({text: m[0]});
			}
		}

		if (current.parts.length > 0)
		{
			groups.push(current);
		}

		return groups;
	};

	/**
	 * Builds a line number from the pattern and the given values.
	 */
	function formatLine(pattern, values)
	{
		var groups = parsePattern(pattern);
		var result = '';

		for (var i = 0; i < groups.length; i++)
		{
			var text = '';
			var missing = false;

			for (var j = 0; j < groups[i].parts.length; j++)
			{
				var part = groups[i].parts[j];

				if (part.field != null)
				{
					var v = String(values[part.field] || '').trim();

					if (v.length == 0)
					{
						missing = true;
						v = MISSING;
					}

					text += v;
				}
				else
				{
					text += part.text;
				}
			}

			if (!groups[i].optional || !missing)
			{
				result += text;
			}
		}

		return result;
	};

	/**
	 * Parses "CODE = Description" lines into [{code, description}].
	 */
	function parseCodes(text)
	{
		var result = [];
		var lines = String(text || '').split(/\r?\n|;/);

		for (var i = 0; i < lines.length; i++)
		{
			var line = lines[i].trim();

			if (line.length > 0)
			{
				var idx = line.indexOf('=');
				result.push((idx > 0) ? {code: line.substring(0, idx).trim(),
					description: line.substring(idx + 1).trim()} : {code: line, description: ''});
			}
		}

		return result;
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

	// ---------------------------------------------------------------- Model

	function isLine(cell)
	{
		return cell != null && Tags.isPd(cell) && Tags.attr(cell, 'pd_class') == 'line';
	};

	function getValues(cell)
	{
		var values = {};

		for (var i = 0; i < cell.value.attributes.length; i++)
		{
			values[cell.value.attributes[i].name] = cell.value.attributes[i].value;
		}

		return values;
	};

	function computeNumber(ui, values)
	{
		return formatLine(Tags.getSettings(ui).linePattern, values);
	};

	/**
	 * Returns all line segments (all pages) with the given line number.
	 */
	function getSegments(ui, lineNumber)
	{
		var result = [];
		lineNumber = String(lineNumber || '').trim();

		if (lineNumber.length > 0)
		{
			Tags.forEachCell(ui, function(cell)
			{
				if (isLine(cell) && Tags.attr(cell, 'line_number').trim() == lineNumber)
				{
					result.push(cell);
				}
			});
		}

		return result;
	};

	function nextSequence(ui)
	{
		var settings = Tags.getSettings(ui);
		var max = 0;

		Tags.forEachCell(ui, function(cell)
		{
			if (isLine(cell))
			{
				var n = parseInt(Tags.attr(cell, 'sequence'), 10);

				if (!isNaN(n))
				{
					max = Math.max(max, n);
				}
			}
		});

		return pad((max > 0) ? max + settings.step : settings.lineStart, settings.lineDigits);
	};

	/**
	 * Sets values on a line and refreshes its number unless it was typed in.
	 */
	function apply(ui, cell, values)
	{
		var merged = getValues(cell);

		for (var key in values)
		{
			merged[key] = values[key];
		}

		var result = {};

		for (var key in values)
		{
			result[key] = values[key];
		}

		if (merged.pd_line_manual != '1')
		{
			result.line_number = computeNumber(ui, merged);
		}

		Tags.setAttributes(ui.editor.graph, cell, result);
	};

	/**
	 * Changes line data. With allSegments the change goes to every segment
	 * that has the same line number as this one.
	 */
	function update(ui, cell, values, allSegments)
	{
		var graph = ui.editor.graph;
		var targets = (allSegments) ? getSegments(ui, Tags.attr(cell, 'line_number')) : [];

		if (mxUtils.indexOf(targets, cell) < 0)
		{
			targets.push(cell);
		}

		graph.model.beginUpdate();
		try
		{
			for (var i = 0; i < targets.length; i++)
			{
				apply(ui, targets[i], values);
			}
		}
		finally
		{
			graph.model.endUpdate();
		}

		return targets.length;
	};

	/**
	 * Typed-in line number: kept as is (pattern no longer used for this line).
	 */
	function setManualNumber(ui, cell, text, allSegments)
	{
		text = String(text || '').trim();

		if (text.length == 0)
		{
			return update(ui, cell, {pd_line_manual: null}, allSegments);
		}

		return update(ui, cell, {line_number: text, pd_line_manual: '1'}, allSegments);
	};

	function useAutoNumber(ui, cell, allSegments)
	{
		return update(ui, cell, {pd_line_manual: null}, allSegments);
	};

	/**
	 * Copies the line data of source to cell.
	 */
	function copyLine(ui, source, cell)
	{
		var values = {};

		for (var i = 0; i < LINE_KEYS.length; i++)
		{
			var v = Tags.attr(source, LINE_KEYS[i]);
			values[LINE_KEYS[i]] = (v.length > 0) ? v : null;
		}

		Tags.setAttributes(ui.editor.graph, cell, values);
	};

	/**
	 * Finds a numbered line that continues at a terminal of edge: a line the edge
	 * is connected to directly, or a line on the other side of an inline item
	 * (valve, fitting, special item, inline instrument).
	 */
	function findContinuation(ui, edge)
	{
		var model = ui.editor.graph.model;
		var ends = [model.getTerminal(edge, true), model.getTerminal(edge, false)];

		for (var i = 0; i < ends.length; i++)
		{
			var t = ends[i];

			if (t == null)
			{
				continue;
			}

			if (isLine(t) && Tags.attr(t, 'sequence') != '')
			{
				return t;
			}

			var cls = Tags.attr(t, 'pd_class');

			// Linked off-page connector: the line on the partner's sheet
			if (cls == 'offpage' && ProcessDraw.Project != null)
			{
				var partners = ProcessDraw.Project.findPartners(ui, t);

				for (var p = 0; p < partners.length; p++)
				{
					var pc = partners[p].cell;

					for (var k = 0; k < pc.getEdgeCount(); k++)
					{
						var pe = pc.getEdgeAt(k);

						if (pe != edge && isLine(pe) && Tags.attr(pe, 'sequence') != '')
						{
							return pe;
						}
					}
				}
			}

			if (cls == 'valve' || cls == 'fitting' || cls == 'special' || cls == 'instrument')
			{
				var edges = model.getEdges(t);

				for (var j = 0; j < edges.length; j++)
				{
					if (edges[j] != edge && isLine(edges[j]) && Tags.attr(edges[j], 'sequence') != '')
					{
						return edges[j];
					}
				}
			}
		}

		return null;
	};

	/**
	 * Fills From / To with the tags of the connected items if they are empty.
	 */
	function fillEnds(ui, edge)
	{
		var model = ui.editor.graph.model;
		var values = {};
		var keys = [['from', true], ['to', false]];

		for (var i = 0; i < keys.length; i++)
		{
			var t = model.getTerminal(edge, keys[i][1]);
			var tag = (t != null && Tags.isPd(t)) ? Tags.attr(t, 'tag') : '';

			if (Tags.attr(edge, keys[i][0]) == '' && tag != '' && tag.indexOf('???') < 0)
			{
				values[keys[i][0]] = tag;
			}
		}

		if (Object.keys(values).length > 0)
		{
			Tags.setAttributes(ui.editor.graph, edge, values);
		}
	};

	/**
	 * Called when a line was added with terminals or got connected: continues
	 * a neighbouring line or starts a new one.
	 */
	function onConnected(ui, edge)
	{
		if (!isLine(edge) || Tags.suspended)
		{
			return;
		}

		var model = ui.editor.graph.model;

		if (model.getTerminal(edge, true) == null && model.getTerminal(edge, false) == null)
		{
			return;
		}

		model.beginUpdate();
		try
		{
			if (Tags.attr(edge, 'sequence') == '' && Tags.getSettings(ui).autonumber)
			{
				var source = findContinuation(ui, edge);

				if (source != null)
				{
					copyLine(ui, source, edge);
				}
				else
				{
					apply(ui, edge, {sequence: nextSequence(ui)});
				}
			}

			fillEnds(ui, edge);
		}
		finally
		{
			model.endUpdate();
		}
	};

	/**
	 * Gives all selected segments the line data of the first numbered one.
	 */
	function join(ui, cells)
	{
		var lines = cells.filter(isLine);
		var source = null;

		for (var i = 0; i < lines.length && source == null; i++)
		{
			source = (Tags.attr(lines[i], 'sequence') != '') ? lines[i] : null;
		}

		if (source == null || lines.length < 2)
		{
			return 0;
		}

		var graph = ui.editor.graph;
		graph.model.beginUpdate();
		try
		{
			for (var i = 0; i < lines.length; i++)
			{
				if (lines[i] != source)
				{
					copyLine(ui, source, lines[i]);
				}
			}
		}
		finally
		{
			graph.model.endUpdate();
		}

		return lines.length;
	};

	/**
	 * Gives the selected segments a new sequence number (a new line).
	 */
	function split(ui, cells)
	{
		var lines = cells.filter(isLine);

		if (lines.length == 0)
		{
			return null;
		}

		var graph = ui.editor.graph;
		var seq = nextSequence(ui);
		graph.model.beginUpdate();
		try
		{
			for (var i = 0; i < lines.length; i++)
			{
				apply(ui, lines[i], {sequence: seq, pd_line_manual: null});
			}
		}
		finally
		{
			graph.model.endUpdate();
		}

		return Tags.attr(lines[0], 'line_number');
	};

	/**
	 * Recomputes all automatic line numbers (after the pattern changed).
	 */
	function renumberAll(ui)
	{
		var count = 0;
		var graph = ui.editor.graph;
		graph.model.beginUpdate();
		try
		{
			Tags.forEachCell(ui, function(cell, page)
			{
				if (isLine(cell) && Tags.attr(cell, 'pd_line_manual') != '1' &&
					Tags.attr(cell, 'sequence') != '')
				{
					apply(ui, cell, {});
					count++;
				}
			});
		}
		finally
		{
			graph.model.endUpdate();
		}

		return count;
	};

	function getCodeOptions(ui, key)
	{
		var settings = Tags.getSettings(ui);
		var text = (key == 'service_code') ? settings.serviceCodes : ((key == 'pipe_class') ? settings.pipeClasses : null);

		return (text != null) ? parseCodes(text).map(function(c)
		{
			return c.code + ((c.description) ? '|' + c.description : '');
		}) : null;
	};

	ProcessDraw.Lines =
	{
		LINE_KEYS: LINE_KEYS,
		parsePattern: parsePattern,
		formatLine: formatLine,
		parseCodes: parseCodes,
		isLine: isLine,
		computeNumber: computeNumber,
		getSegments: getSegments,
		nextSequence: nextSequence,
		update: update,
		setManualNumber: setManualNumber,
		useAutoNumber: useAutoNumber,
		findContinuation: findContinuation,
		onConnected: onConnected,
		join: join,
		split: split,
		renumberAll: renumberAll,
		getCodeOptions: getCodeOptions,

		install: function(ui)
		{
			var graph = ui.editor.graph;

			graph.addListener(mxEvent.CELLS_ADDED, function(sender, evt)
			{
				var cells = evt.getProperty('cells') || [];

				for (var i = 0; i < cells.length; i++)
				{
					try
					{
						onConnected(ui, cells[i]);
					}
					catch (e)
					{
						console.error('ProcessDraw: line numbering failed', e);
					}
				}
			});

			graph.addListener(mxEvent.CELL_CONNECTED, function(sender, evt)
			{
				try
				{
					onConnected(ui, evt.getProperty('edge'));
				}
				catch (e)
				{
					console.error('ProcessDraw: line numbering failed', e);
				}
			});
		}
	};
})();
