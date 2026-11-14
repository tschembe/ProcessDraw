/**
 * ProcessDraw Excel round trip: reads a workbook made with Export Lists to
 * Excel (and edited in Excel, LibreOffice, ...) and writes the changed values
 * back into the drawing after a preview.
 *
 * Exported sheets carry a hidden ID column and a hidden key row (see
 * pd-lists.js withIds): "#id" rows are found by "<page id>|<cell id>", "#line"
 * rows by line number (all segments of the line change), and the "#streams"
 * sheet has one column per stream marker. Keys starting with "=" are calculated
 * columns and are not imported.
 */
(function()
{
	var ProcessDraw = window.ProcessDraw = window.ProcessDraw || {};
	var Tags = ProcessDraw.Tags;
	var Fields = ProcessDraw.Fields;

	mxResources.parse('pdImportLists=Import Lists from Excel...\n');

	/**
	 * Excel value as text: numbers without float noise (12.300000001 -> 12.3).
	 */
	function text(value)
	{
		if (value == null)
		{
			return '';
		}

		if (typeof value === 'number')
		{
			return String(parseFloat(value.toPrecision(12)));
		}

		return String(value).trim();
	};

	/**
	 * True if the drawing value and the Excel value are the same; numbers compare by
	 * value so that Excel's "22" equals the drawing's "22.0".
	 */
	function same(before, after)
	{
		if (String(before).trim() == after)
		{
			return true;
		}

		var num = /^\s*-?\d+(\.\d+)?([eE][-+]?\d+)?\s*$/;

		if (num.test(before) && num.test(after))
		{
			var a = parseFloat(before);
			var b = parseFloat(after);

			return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
		}

		return false;
	};

	function indexCells(ui)
	{
		var byId = {};
		var lines = {};

		Tags.forEachCell(ui, function(cell, page)
		{
			byId[((page != null) ? page.getId() : '') + '|' + cell.id] = {cell: cell, page: page};

			if (Tags.attr(cell, 'pd_class') == 'line' && Tags.attr(cell, 'line_number') != '')
			{
				var n = Tags.attr(cell, 'line_number');
				lines[n] = (lines[n] || []).concat([{cell: cell, page: page}]);
			}
		});

		return {byId: byId, lines: lines};
	};

	function describe(cell)
	{
		return Tags.attr(cell, 'tag') || Tags.attr(cell, 'line_number') ||
			((Tags.attr(cell, 'stream_number')) ? 'Stream ' + Tags.attr(cell, 'stream_number') : '') ||
			Fields.getLabel(String(Tags.attr(cell, 'pd_type')).split('.').pop());
	};

	/**
	 * Field to write for a key: valves show the inlet size of safety valves in the
	 * Size column.
	 */
	function targetKey(cell, key)
	{
		if (key == 'size' && !cell.value.hasAttribute('size') && cell.value.hasAttribute('inlet_size'))
		{
			return 'inlet_size';
		}

		return key;
	};

	/**
	 * Compares the workbook with the drawing. Returns {changes, notes}:
	 * changes [{target: {cell, page} | {line, segments}, key, label, before, after, item, sheet}],
	 * notes [text] for rows that could not be matched.
	 */
	function plan(ui, workbook)
	{
		var index = indexCells(ui);
		var changes = [];
		var notes = [];
		var used = 0;

		for (var s = 0; s < workbook.length; s++)
		{
			var sheet = workbook[s];
			var rows = sheet.rows;
			var keyRow = -1;

			for (var r = 0; r < rows.length && keyRow < 0; r++)
			{
				var first = text(rows[r][0]);
				keyRow = (first == '#id' || first == '#line' || first == '#streams') ? r : -1;
			}

			if (keyRow < 0)
			{
				continue;
			}

			used++;
			var keys = rows[keyRow].map(text);
			var mode = keys[0];

			if (mode == '#streams')
			{
				// Columns are stream markers, rows are fields
				for (var c = 1; c < keys.length; c++)
				{
					if (keys[c].charAt(0) == '=' || keys[c] == '')
					{
						continue;
					}

					var stream = index.byId[keys[c]];

					if (stream == null)
					{
						notes.push(sheet.name + ': stream column ' + (c + 1) + ' not found in the drawing');
						continue;
					}

					for (var r = keyRow + 1; r < rows.length; r++)
					{
						var field = text(rows[r][0]);

						if (field == '' || field.charAt(0) == '=')
						{
							continue;
						}

						var after = text(rows[r][c]);
						var before = Tags.attr(stream.cell, field);

						if (!same(before, after))
						{
							changes.push({target: stream, key: field, label: Fields.getLabel(field), before: before,
								after: after, item: describe(stream.cell), sheet: sheet.name});
						}
					}
				}

				continue;
			}

			for (var r = keyRow + 1; r < rows.length; r++)
			{
				var row = rows[r];
				var id = text(row[0]);

				if (id == '')
				{
					if (row.slice(1).some(function(v) { return text(v) != ''; }))
					{
						notes.push(sheet.name + ' row ' + (r + 1) + ': new row without ID, not imported ' +
							'(add new items in the drawing)');
					}

					continue;
				}

				var target = null;
				var current = null;

				if (mode == '#line' && id.substring(0, 5) != 'cell:')
				{
					var segments = index.lines[id];

					if (segments != null)
					{
						target = {line: id, segments: segments};
						current = segments[0].cell;
					}
				}
				else
				{
					var found = index.byId[(id.substring(0, 5) == 'cell:') ? id.substring(5) : id];

					if (found != null)
					{
						target = found;
						current = found.cell;
					}
				}

				if (target == null)
				{
					notes.push(sheet.name + ' row ' + (r + 1) + ': ' + id + ' is no longer in the drawing');
					continue;
				}

				for (var c = 1; c < keys.length; c++)
				{
					var key = keys[c];

					if (key == '' || key.charAt(0) == '=' || key.charAt(0) == '#')
					{
						continue;
					}

					var field = targetKey(current, key);
					var after = text(row[c]);
					var before = Tags.attr(current, field);

					if (!same(before, after))
					{
						changes.push({target: target, key: field, label: Fields.getLabel(field), before: before,
							after: after, item: describe(current), sheet: sheet.name});
					}
				}
			}
		}

		if (used == 0)
		{
			notes.push('This workbook has no ProcessDraw lists. Export the lists with ProcessDraw > Export ' +
				'Lists to Excel, edit that file and import it again.');
		}

		return {changes: changes, notes: notes};
	};

	/**
	 * Writes the planned changes in one undoable edit.
	 */
	function apply(ui, changes)
	{
		var graph = ui.editor.graph;
		var lineChanges = {};
		var count = 0;

		graph.model.beginUpdate();
		try
		{
			for (var i = 0; i < changes.length; i++)
			{
				var ch = changes[i];

				if (ch.target.line != null)
				{
					// Line data goes to every segment; collected so the number is rebuilt once
					var group = lineChanges[ch.target.line] = lineChanges[ch.target.line] ||
						{segments: ch.target.segments, values: {}};
					group.values[ch.key] = ch.after;
				}
				else if (ch.key == 'tag')
				{
					Tags.setTag(ui, ch.target.cell, ch.after);
				}
				else
				{
					var values = {};
					values[ch.key] = ch.after;

					if (ch.target.cell.value.getAttribute('pd_class') == 'line' && ProcessDraw.Lines != null &&
						mxUtils.indexOf(ProcessDraw.Lines.LINE_KEYS, ch.key) >= 0)
					{
						ProcessDraw.Lines.update(ui, ch.target.cell, values, false);
					}
					else
					{
						Tags.setAttributes(graph, ch.target.cell, values);
					}
				}

				count++;
			}

			for (var n in lineChanges)
			{
				var segs = lineChanges[n].segments;

				for (var j = 0; j < segs.length; j++)
				{
					ProcessDraw.Lines.update(ui, segs[j].cell, lineChanges[n].values, false);
				}
			}
		}
		finally
		{
			graph.model.endUpdate();
		}

		if (ProcessDraw.PFD != null)
		{
			ProcessDraw.PFD.refreshPage(ui);
		}

		return count;
	};

	function showPreview(ui, result, fileName)
	{
		var div = document.createElement('div');
		div.style.fontSize = '12px';
		var head = document.createElement('div');
		head.style.cssText = 'font-weight:bold;font-size:14px;margin-bottom:4px;';
		mxUtils.write(head, 'Import from ' + fileName);
		div.appendChild(head);

		var summary = document.createElement('div');
		summary.style.marginBottom = '6px';
		var items = {};
		result.changes.forEach(function(c) { items[c.item] = true; });
		mxUtils.write(summary, (result.changes.length == 0) ? 'No changes found: the drawing already has these values.' :
			result.changes.length + ' change(s) to ' + Object.keys(items).length + ' item(s). Undo reverts the whole import.');
		div.appendChild(summary);

		var list = document.createElement('div');
		list.style.cssText = 'max-height:300px;overflow:auto;border:1px solid rgba(128,128,128,0.3);padding:4px 6px;';
		var lastSheet = null;
		var shown = Math.min(result.changes.length, 500);

		for (var i = 0; i < shown; i++)
		{
			var ch = result.changes[i];

			if (ch.sheet != lastSheet)
			{
				var h = document.createElement('div');
				h.style.cssText = 'font-weight:bold;margin:4px 0 2px 0;';
				mxUtils.write(h, ch.sheet);
				list.appendChild(h);
				lastSheet = ch.sheet;
			}

			var line = document.createElement('div');
			line.style.whiteSpace = 'nowrap';
			mxUtils.write(line, ch.item + ' · ' + ch.label + ': ' + ((ch.before === '') ? '(empty)' : ch.before) +
				' → ' + ((ch.after === '') ? '(empty)' : ch.after));
			list.appendChild(line);
		}

		if (result.changes.length > shown)
		{
			mxUtils.write(list, '… and ' + (result.changes.length - shown) + ' more');
		}

		if (result.changes.length > 0)
		{
			div.appendChild(list);
		}

		if (result.notes.length > 0)
		{
			var notes = document.createElement('div');
			notes.style.cssText = 'margin-top:8px;color:#b26a00;max-height:120px;overflow:auto;';
			mxUtils.write(notes, result.notes.join('\n'));
			notes.style.whiteSpace = 'pre-wrap';
			div.appendChild(notes);
		}

		var dlg = new CustomDialog(ui, div, (result.changes.length > 0) ? function()
		{
			var n = apply(ui, result.changes);
			ui.editor.setStatus(n + ' value(s) imported from ' + fileName);
		} : null, null, (result.changes.length > 0) ? 'Apply ' + result.changes.length + ' change(s)' :
			mxResources.get('close'), null, null, result.changes.length == 0);

		ui.showDialog(dlg.container, 560, Math.min(window.innerHeight - 60, 260 +
			Math.min(shown, 14) * 18 + ((result.notes.length > 0) ? 90 : 0)), true, true);
	};

	/**
	 * Lets the user pick a file and calls fn(arrayBuffer or text, file).
	 */
	function pickFile(accept, asText, fn)
	{
		var input = document.createElement('input');
		input.setAttribute('type', 'file');
		input.setAttribute('accept', accept);
		input.style.display = 'none';
		document.body.appendChild(input);

		mxEvent.addListener(input, 'change', function()
		{
			var file = (input.files != null) ? input.files[0] : null;
			input.parentNode.removeChild(input);

			if (file != null)
			{
				var reader = new FileReader();
				reader.onload = function() { fn(reader.result, file); };

				if (asText)
				{
					reader.readAsText(file);
				}
				else
				{
					reader.readAsArrayBuffer(file);
				}
			}
		});

		input.click();
	};

	function importFile(ui, data, fileName)
	{
		return ProcessDraw.Xlsx.readWorkbook(data).then(function(workbook)
		{
			var result = plan(ui, workbook);
			showPreview(ui, result, fileName);

			return result;
		});
	};

	ProcessDraw.Roundtrip =
	{
		text: text,
		same: same,
		plan: plan,
		apply: apply,
		pickFile: pickFile,
		importFile: importFile,

		install: function(ui)
		{
			ui.actions.addAction('pdImportLists', function()
			{
				pickFile('.xlsx', false, function(data, file)
				{
					importFile(ui, data, file.name).catch(function(e)
					{
						ui.handleError(e);
					});
				});
			});
		}
	};
})();
