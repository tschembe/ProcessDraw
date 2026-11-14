/**
 * ProcessDraw drawing sheets: frame with grid references (pd_frame shape), title
 * block and revision table filled from the project and sheet data, revision
 * clouds, revision triangles and issue stamps.
 *
 * Frame, title block and revision table are locked cells at the back of the
 * page (pd_class frame / titleblock / revtable). The title block and revision
 * table are rebuilt in the same undoable edit as a change of the page data
 * (model BEFORE_UNDO) and when a page is shown. Sheet data per page:
 * pd_sheet_status, pd_sheet_scale, pd_drawn_by, pd_checked_by, pd_approved_by,
 * pd_sheet_size and pd_revisions (JSON list of {rev, date, description, by, chk, app}).
 */
(function()
{
	var ProcessDraw = window.ProcessDraw = window.ProcessDraw || {};
	var Tags = ProcessDraw.Tags;
	var Library = ProcessDraw.Library;

	var PX_PER_MM = 100 / 25.4;
	var SIZES = {A4: [297, 210], A3: [420, 297], A2: [594, 420], A1: [841, 594], A0: [1189, 841]};
	var STATUSES = ['PRELIMINARY', 'ISSUED FOR REVIEW', 'ISSUED FOR APPROVAL', 'ISSUED FOR DESIGN',
		'ISSUED FOR CONSTRUCTION', 'AS-BUILT', 'HOLD', 'VOID'];
	var TITLE_WIDTH = Math.round(180 * PX_PER_MM);
	var LOCKED = 'locked=1;movable=0;resizable=0;rotatable=0;deletable=0;editable=0;connectable=0;';

	mxResources.parse(
		'pdDrawingSheet=Drawing Sheet & Revisions...\n' +
		'pdExportSheetsPdf=Export Sheets to PDF...\n');

	// ---------------------------------------------------------------- Palette

	function stamp(id, status, tags)
	{
		return {id: id, name: 'Stamp: ' + status.charAt(0) + status.substring(1).toLowerCase(), type: 'stamp',
			cls: 'stamp', w: 200, h: 44, label: '<b>%status%</b><br><span style="font-size:9px">%date%</span>',
			rawStyle: 'text;html=1;whiteSpace=nowrap;align=center;verticalAlign=middle;rounded=1;arcSize=8;' +
				'strokeColor=#C00000;fontColor=#C00000;fillColor=none;strokeWidth=2;fontSize=13;spacing=4;',
			data: {status: status, date: ''}, tags: 'stamp issue status ' + tags};
	};

	Library.addPalette('pdSheet', 'ProcessDraw / Drawing Sheet & Revisions',
	[
		{id: 'pd_revcloud', name: 'Revision Cloud', type: 'revision.cloud', cls: 'annotation', label: '',
			w: 160, h: 100, rawStyle: 'shape=pd_revcloud;html=1;fillColor=none;strokeColor=#C00000;strokeWidth=1.5;' +
				'pdScallop=14;', tags: 'revision cloud change markup'},
		{id: 'pd_revtriangle', name: 'Revision Triangle', type: 'revision.triangle', cls: 'revision', label: '%rev%',
			labelInside: true, w: 26, h: 22, aspect: true, draw: 'p M 13 0 L 26 22 L 0 22 Z; fs', nozzles: [],
			data: {rev: ''}, style: 'fontSize=9;fontStyle=1;verticalAlign=bottom;spacingBottom=1;strokeColor=#C00000;' +
				'fontColor=#C00000;', tags: 'revision triangle delta marker'},
		stamp('pd_stamp_ifr', 'ISSUED FOR REVIEW', 'ifr review'),
		stamp('pd_stamp_ifa', 'ISSUED FOR APPROVAL', 'ifa approval'),
		stamp('pd_stamp_ifd', 'ISSUED FOR DESIGN', 'ifd design'),
		stamp('pd_stamp_ifc', 'ISSUED FOR CONSTRUCTION', 'ifc construction'),
		stamp('pd_stamp_asbuilt', 'AS-BUILT', 'as built asbuilt'),
		stamp('pd_stamp_prelim', 'PRELIMINARY', 'preliminary draft'),
		stamp('pd_stamp_hold', 'HOLD', 'hold'),
		stamp('pd_stamp_void', 'VOID', 'void cancelled'),
		{id: 'pd_notes', name: 'Notes Block', type: 'annotation.notes', cls: 'annotation',
			label: '<b>NOTES</b><br>1. <br>2. <br>3. ', w: 240, h: 80,
			rawStyle: 'text;html=1;whiteSpace=wrap;align=left;verticalAlign=top;strokeColor=default;fillColor=none;' +
				'spacing=6;fontSize=10;', tags: 'notes general notes text'}
	]);

	// ---------------------------------------------------------------- Sheet data

	function attr(ui, key, page)
	{
		return Tags.getPageAttribute(ui, (page !== undefined) ? page : ui.currentPage, key);
	};

	function getRevisions(ui, page)
	{
		try
		{
			var list = JSON.parse(attr(ui, 'pd_revisions', page) || '[]');

			return (Array.isArray(list)) ? list : [];
		}
		catch (e)
		{
			return [];
		}
	};

	/**
	 * Next revision: letters before construction (A, B, ...), numbers from IFC on.
	 */
	function nextRevision(revisions, status)
	{
		var last = (revisions.length > 0) ? String(revisions[revisions.length - 1].rev || '') : '';
		var numeric = /^\d+$/.test(last);

		if (status == 'ISSUED FOR CONSTRUCTION' || status == 'AS-BUILT')
		{
			return (numeric) ? String(parseInt(last, 10) + 1) : '0';
		}

		if (numeric)
		{
			return String(parseInt(last, 10) + 1);
		}

		if (/^[A-Z]$/.test(last))
		{
			return (last == 'Z') ? 'AA' : String.fromCharCode(last.charCodeAt(0) + (last == 'H' || last == 'N' ? 2 : 1));
		}

		return 'A';
	};

	function currentRevision(ui, page)
	{
		var revs = getRevisions(ui, page);

		return (revs.length > 0) ? revs[revs.length - 1] : null;
	};

	function today()
	{
		return new Date().toISOString().substring(0, 10);
	};

	// ---------------------------------------------------------------- HTML

	function esc(s)
	{
		return mxUtils.htmlEntities(String((s != null) ? s : ''), false);
	};

	var TD = 'border:1px solid currentColor;padding:2px 5px;vertical-align:top;';
	var CAP = '<div style="font-size:7px;opacity:0.7;line-height:1.2;">';

	function field(caption, value, colspan, extra)
	{
		return '<td colspan="' + (colspan || 1) + '" style="' + TD + (extra || '') + '">' + CAP + esc(caption) +
			'</div><div style="font-weight:bold;min-height:12px;">' + esc(value) + '</div></td>';
	};

	function buildTitleBlockHtml(ui)
	{
		var p = Tags.getSettings(ui);
		var sheet = (ProcessDraw.Project != null) ? ProcessDraw.Project.getSheet(ui, ui.currentPage) : {};
		var pages = Tags.getPages(ui);
		var index = Math.max(0, mxUtils.indexOf(pages, ui.currentPage)) + 1;
		var rev = currentRevision(ui);
		var w = TITLE_WIDTH;

		return '<table style="border-collapse:collapse;width:' + w + 'px;font-size:10px;table-layout:fixed;">' +
			'<colgroup><col style="width:17%"><col style="width:17%"><col style="width:16%"><col style="width:16%">' +
			'<col style="width:14%"><col style="width:20%"></colgroup>' +
			'<tr>' + field('CLIENT', p.client, 3) + field('PROJECT', [p.projectNumber, p.projectName]
				.filter(function(v) { return v; }).join('  '), 3) + '</tr>' +
			'<tr>' + field('PLANT / UNIT', [p.site, p.area].filter(function(v) { return v; }).join(' / '), 3) +
				field('PREPARED BY', p.preparedBy, 3) + '</tr>' +
			'<tr><td colspan="6" style="' + TD + '">' + CAP + 'TITLE</div><div style="font-weight:bold;font-size:15px;' +
				'line-height:1.3;">' + esc(String(sheet.title || '').toUpperCase()) + '</div><div style="font-size:9px;">' +
				esc(sheet.type || '') + '</div></td></tr>' +
			'<tr>' + field('DRAWING NO.', sheet.drawing, 3, 'font-size:12px;') + field('SHEET', index + ' OF ' + pages.length) +
				field('REV', (rev != null) ? rev.rev : '') + field('STATUS', attr(ui, 'pd_sheet_status')) + '</tr>' +
			'<tr>' + field('SCALE', attr(ui, 'pd_sheet_scale') || 'NTS') + field('DATE', (rev != null) ? rev.date : '') +
				field('DRAWN', attr(ui, 'pd_drawn_by')) + field('CHECKED', attr(ui, 'pd_checked_by')) +
				field('APPROVED', attr(ui, 'pd_approved_by')) + field('SIZE', attr(ui, 'pd_sheet_size')) + '</tr>' +
			'</table>';
	};

	function buildRevisionTableHtml(ui)
	{
		var revs = getRevisions(ui);
		var th = TD + 'font-size:7px;font-weight:bold;text-align:center;';
		var html = '<table style="border-collapse:collapse;width:' + TITLE_WIDTH + 'px;font-size:9px;table-layout:fixed;">' +
			'<colgroup><col style="width:8%"><col style="width:14%"><col style="width:51%"><col style="width:9%">' +
			'<col style="width:9%"><col style="width:9%"></colgroup>';

		// Newest revision on top, header next to the title block
		for (var i = revs.length - 1; i >= 0; i--)
		{
			var r = revs[i];
			html += '<tr><td style="' + TD + 'text-align:center;font-weight:bold;">' + esc(r.rev) + '</td><td style="' + TD +
				'">' + esc(r.date) + '</td><td style="' + TD + '">' + esc(r.description) + '</td><td style="' + TD +
				'text-align:center;">' + esc(r.by) + '</td><td style="' + TD + 'text-align:center;">' + esc(r.chk) +
				'</td><td style="' + TD + 'text-align:center;">' + esc(r.app) + '</td></tr>';
		}

		return html + '<tr><td style="' + th + '">REV</td><td style="' + th + '">DATE</td><td style="' + th +
			'">DESCRIPTION</td><td style="' + th + '">BY</td><td style="' + th + '">CHK</td><td style="' + th +
			'">APP</td></tr></table>';
	};

	// ---------------------------------------------------------------- Frame

	function findSheetCells(ui)
	{
		var graph = ui.editor.graph;
		var result = {};
		var cells = graph.model.getDescendants(graph.model.getRoot());

		for (var i = 0; i < cells.length; i++)
		{
			var cls = Tags.attr(cells[i], 'pd_class');

			if (cls == 'frame' || cls == 'titleblock' || cls == 'revtable')
			{
				result[cls] = cells[i];
			}
		}

		return result;
	};

	function makeCell(cls, label, geo, style)
	{
		var value = mxUtils.createXmlDocument().createElement('object');
		value.setAttribute('pd_class', cls);
		value.setAttribute('pd_type', 'sheet.' + cls);
		value.setAttribute('label', label);
		var cell = new mxCell(value, geo, style);
		cell.vertex = true;

		return cell;
	};

	/**
	 * Inner frame rectangle (inside the grid reference zone) in model units.
	 */
	function innerRect(graph, frame)
	{
		var geo = frame.geometry;
		var st = graph.getCellStyle(frame);
		var ml = parseFloat(mxUtils.getValue(st, 'pdMarginLeft', 79));
		var mt = parseFloat(mxUtils.getValue(st, 'pdMarginTop', 39));
		var mr = parseFloat(mxUtils.getValue(st, 'pdMarginRight', 39));
		var mb = parseFloat(mxUtils.getValue(st, 'pdMarginBottom', 39));
		var zone = parseFloat(mxUtils.getValue(st, 'pdZone', 20));

		return new mxRectangle(geo.x + ml + zone, geo.y + mt + zone, geo.width - ml - mr - 2 * zone,
			geo.height - mt - mb - 2 * zone);
	};

	/**
	 * Sets the page size and puts a frame, title block and revision table on the
	 * current page (replacing an existing frame).
	 */
	function insertFrame(ui, size)
	{
		var graph = ui.editor.graph;
		var mm = SIZES[size] || SIZES.A3;
		var w = Math.round(mm[0] * PX_PER_MM);
		var h = Math.round(mm[1] * PX_PER_MM);
		var old = findSheetCells(ui);
		var parent = graph.getDefaultParent();

		graph.model.beginUpdate();
		try
		{
			for (var key in old)
			{
				graph.model.remove(old[key]);
			}

			if (typeof ChangePageSetup === 'function')
			{
				var change = new ChangePageSetup(ui, null, null, new mxRectangle(0, 0, w, h));
				change.ignoreColor = true;
				change.ignoreImage = true;
				graph.model.execute(change);
			}

			var frame = makeCell('frame', '', new mxGeometry(0, 0, w, h), 'shape=pd_frame;html=1;fillColor=none;' +
				'strokeColor=default;pointerEvents=0;pdMarginLeft=' + Math.round(20 * PX_PER_MM) + ';pdMarginTop=' +
				Math.round(10 * PX_PER_MM) + ';pdMarginRight=' + Math.round(10 * PX_PER_MM) + ';pdMarginBottom=' +
				Math.round(10 * PX_PER_MM) + ';pdZone=' + Math.round(5 * PX_PER_MM) + ';pdField=' +
				Math.round(50 * PX_PER_MM) + ';' + LOCKED);
			var textStyle = 'text;html=1;whiteSpace=nowrap;overflow=visible;align=left;verticalAlign=top;spacing=0;' +
				'strokeColor=none;fillColor=none;autosize=1;' + LOCKED;
			var title = makeCell('titleblock', '', new mxGeometry(0, 0, TITLE_WIDTH, 120), textStyle);
			var revs = makeCell('revtable', '', new mxGeometry(0, 0, TITLE_WIDTH, 30), textStyle);

			graph.model.add(parent, frame, 0);
			graph.model.add(parent, revs, 1);
			graph.model.add(parent, title, 2);
			Tags.setPageAttributes(ui, ui.currentPage, {pd_sheet_size: size + ' (' + mm[0] + ' x ' + mm[1] + ' mm)'});
			refresh(ui, true);
		}
		finally
		{
			graph.model.endUpdate();
		}
	};

	var refreshing = false;

	/**
	 * Rebuilds the title block and revision table of the current page and puts
	 * them in the bottom-right corner of the frame.
	 */
	function refresh(ui, force)
	{
		if (refreshing)
		{
			return;
		}

		var graph = ui.editor.graph;
		var cells = findSheetCells(ui);

		if (cells.frame == null || (cells.titleblock == null && cells.revtable == null))
		{
			return;
		}

		refreshing = true;
		graph.model.beginUpdate();
		try
		{
			var inner = innerRect(graph, cells.frame);
			var bottom = inner.y + inner.height;
			var right = inner.x + inner.width;

			if (cells.titleblock != null)
			{
				var html = buildTitleBlockHtml(ui);

				if (force || Tags.attr(cells.titleblock, 'label') != html || Tags.attr(cells.titleblock, 'pd_refresh') == '1')
				{
					Tags.setAttributes(graph, cells.titleblock, {label: html, pd_refresh: null});
					graph.updateCellSize(cells.titleblock, true);
				}

				var geo = cells.titleblock.geometry;

				if (geo.x != right - geo.width || geo.y != bottom - geo.height)
				{
					geo = geo.clone();
					geo.x = right - geo.width;
					geo.y = bottom - geo.height;
					graph.model.setGeometry(cells.titleblock, geo);
				}

				bottom = geo.y;
			}

			if (cells.revtable != null)
			{
				var rhtml = buildRevisionTableHtml(ui);

				if (force || Tags.attr(cells.revtable, 'label') != rhtml || Tags.attr(cells.revtable, 'pd_refresh') == '1')
				{
					Tags.setAttributes(graph, cells.revtable, {label: rhtml, pd_refresh: null});
					graph.updateCellSize(cells.revtable, true);
				}

				var rgeo = cells.revtable.geometry;

				if (rgeo.x != right - rgeo.width || rgeo.y != bottom - rgeo.height)
				{
					rgeo = rgeo.clone();
					rgeo.x = right - rgeo.width;
					rgeo.y = bottom - rgeo.height;
					graph.model.setGeometry(cells.revtable, rgeo);
				}
			}
		}
		finally
		{
			graph.model.endUpdate();
			refreshing = false;
		}
	};

	// ---------------------------------------------------------------- Dialog

	function showDialog(ui)
	{
		var page = ui.currentPage;
		var revs = getRevisions(ui).map(function(r) { return Object.assign({}, r); });
		var cells = findSheetCells(ui);
		var div = document.createElement('div');
		div.style.fontSize = '12px';

		function title(text, size)
		{
			var t = document.createElement('div');
			t.style.fontWeight = 'bold';
			t.style.fontSize = size || '12px';
			t.style.margin = '10px 0 4px 0';
			mxUtils.write(t, text);
			div.appendChild(t);
		};

		function row(caption, input)
		{
			var r = document.createElement('div');
			r.style.cssText = 'display:flex;align-items:center;margin:3px 0;';
			var l = document.createElement('label');
			l.style.flex = '0 0 32%';
			mxUtils.write(l, caption);
			r.appendChild(l);
			input.style.flex = '1 1 auto';
			r.appendChild(input);
			div.appendChild(r);

			return input;
		};

		function text(value)
		{
			var i = document.createElement('input');
			i.setAttribute('type', 'text');
			i.value = value || '';

			return i;
		};

		function select(values, value)
		{
			var s = document.createElement('select');

			for (var i = 0; i < values.length; i++)
			{
				var o = document.createElement('option');
				o.value = values[i];
				mxUtils.write(o, values[i] || '(none)');
				s.appendChild(o);
			}

			s.value = value;

			return s;
		};

		var sheetName = (ProcessDraw.Project != null) ? ProcessDraw.Project.getSheetLabel(ui, page) : '';
		title('Drawing Sheet' + ((sheetName) ? ': ' + sheetName : ''), '14px');

		var currentSize = (attr(ui, 'pd_sheet_size') || '').split(' ')[0];
		var size = row('Frame', select(['', 'A4', 'A3', 'A2', 'A1', 'A0'], (cells.frame != null) ? currentSize : 'A3'));
		var sizeNote = document.createElement('div');
		sizeNote.style.cssText = 'opacity:0.65;font-size:11px;margin:0 0 4px 32%;';
		mxUtils.write(sizeNote, (cells.frame != null) ? 'Changing the size replaces the frame.' :
			'Adds a landscape frame with title block and sets the page size.');
		div.appendChild(sizeNote);

		var status = row('Status', select([''].concat(STATUSES), attr(ui, 'pd_sheet_status')));
		var scale = row('Scale', text(attr(ui, 'pd_sheet_scale') || 'NTS'));
		var drawn = row('Drawn', text(attr(ui, 'pd_drawn_by') || Tags.getSettings(ui).preparedBy));
		var checked = row('Checked', text(attr(ui, 'pd_checked_by')));
		var approved = row('Approved', text(attr(ui, 'pd_approved_by')));

		title('Revisions');
		var table = document.createElement('table');
		table.style.borderCollapse = 'collapse';
		table.style.width = '100%';
		div.appendChild(table);
		var keys = ['rev', 'date', 'description', 'by', 'chk', 'app'];
		var widths = ['40px', '90px', '', '44px', '44px', '44px'];

		function renderRevisions()
		{
			table.innerText = '';
			var head = document.createElement('tr');
			['Rev', 'Date', 'Description', 'By', 'Chk', 'App', ''].forEach(function(h)
			{
				var th = document.createElement('th');
				th.style.textAlign = 'left';
				th.style.fontSize = '11px';
				mxUtils.write(th, h);
				head.appendChild(th);
			});
			table.appendChild(head);

			revs.forEach(function(r, index)
			{
				var tr = document.createElement('tr');

				keys.forEach(function(k, j)
				{
					var td = document.createElement('td');
					var input = text(r[k]);
					input.style.width = widths[j] || '100%';
					input.style.boxSizing = 'border-box';
					mxEvent.addListener(input, 'input', function() { r[k] = input.value; });
					td.appendChild(input);
					tr.appendChild(td);
				});

				var tdDel = document.createElement('td');
				var del = mxUtils.button('×', function()
				{
					revs.splice(index, 1);
					renderRevisions();
				});
				del.setAttribute('title', 'Remove revision');
				del.className = 'geBtn';
				del.style.minWidth = '0';
				del.style.padding = '0 6px';
				tdDel.appendChild(del);
				tr.appendChild(tdDel);
				table.appendChild(tr);
			});
		};

		renderRevisions();

		var add = mxUtils.button('Add revision', function()
		{
			var st = status.value;
			revs.push({rev: nextRevision(revs, st), date: today(), description: (st) ?
				st.charAt(0) + st.substring(1).toLowerCase() : '', by: drawn.value, chk: checked.value, app: approved.value});
			renderRevisions();
		});
		add.className = 'geBtn';
		add.style.marginTop = '6px';
		div.appendChild(add);

		var dlg = new CustomDialog(ui, div, function()
		{
			var graph = ui.editor.graph;
			graph.model.beginUpdate();
			try
			{
				Tags.setPageAttributes(ui, page, {pd_sheet_status: status.value, pd_sheet_scale: scale.value.trim(),
					pd_drawn_by: drawn.value.trim(), pd_checked_by: checked.value.trim(),
					pd_approved_by: approved.value.trim(), pd_revisions: JSON.stringify(revs.filter(function(r)
					{
						return String(r.rev || '').trim() != '' || String(r.description || '').trim() != '';
					}))});

				if (size.value != '' && (cells.frame == null || size.value != currentSize))
				{
					insertFrame(ui, size.value);
				}
				else if (size.value == '' && cells.frame != null)
				{
					var existing = findSheetCells(ui);

					for (var key in existing)
					{
						graph.model.remove(existing[key]);
					}
				}

				refresh(ui);
			}
			finally
			{
				graph.model.endUpdate();
			}
		}, null, mxResources.get('apply'));

		ui.showDialog(dlg.container, 560, Math.min(window.innerHeight - 60, 470 + revs.length * 30), true, true);
	};

	// ---------------------------------------------------------------- Install

	function affectsSheet(ui, edit)
	{
		var root = ui.editor.graph.model.getRoot();

		for (var i = 0; i < edit.changes.length; i++)
		{
			var change = edit.changes[i];

			if ((change instanceof mxValueChange && change.cell == root) ||
				(change instanceof mxChildChange && Tags.attr(change.child, 'pd_class') == 'frame'))
			{
				return true;
			}
		}

		return false;
	};

	function install(ui)
	{
		var graph = ui.editor.graph;

		graph.model.addListener(mxEvent.BEFORE_UNDO, function(sender, evt)
		{
			try
			{
				if (!refreshing && affectsSheet(ui, evt.getProperty('edit')))
				{
					refresh(ui);
				}
			}
			catch (e)
			{
				console.error('ProcessDraw: title block refresh failed', e);
			}
		});

		// Files from the MCP server: title block and revision table are sized when first shown
		ui.editor.addListener('fileLoaded', function()
		{
			window.setTimeout(function()
			{
				try
				{
					refresh(ui);
				}
				catch (e)
				{
					console.error('ProcessDraw: title block refresh failed', e);
				}
			}, 0);
		});

		// Project data, page count or sheet order may have changed elsewhere
		ui.editor.addListener('pageSelected', function()
		{
			window.setTimeout(function()
			{
				try
				{
					refresh(ui);
				}
				catch (e)
				{
					console.error('ProcessDraw: title block refresh failed', e);
				}
			}, 0);
		});

		// New stamps get today's date, new revision triangles the sheet's revision
		graph.addListener(mxEvent.CELLS_ADDED, function(sender, evt)
		{
			var cells = evt.getProperty('cells') || [];

			for (var i = 0; i < cells.length; i++)
			{
				var cls = Tags.attr(cells[i], 'pd_class');

				if (cls == 'stamp' && Tags.attr(cells[i], 'date') == '')
				{
					Tags.setAttributes(graph, cells[i], {date: today()});
				}
				else if (cls == 'revision' && Tags.attr(cells[i], 'rev') == '')
				{
					var rev = currentRevision(ui);
					Tags.setAttributes(graph, cells[i], {rev: (rev != null) ? rev.rev : 'A'});
				}
			}
		});

		var graphDblClick = graph.dblClick;

		graph.dblClick = function(evt, cell)
		{
			var cls = Tags.attr(cell || {}, 'pd_class');

			if (this.isEnabled() && (cls == 'titleblock' || cls == 'revtable' || cls == 'frame'))
			{
				mxEvent.consume(evt);
				showDialog(ui);
			}
			else
			{
				graphDblClick.apply(this, arguments);
			}
		};

		ui.actions.addAction('pdDrawingSheet', function()
		{
			showDialog(ui);
		});

		ui.actions.addAction('pdExportSheetsPdf', function()
		{
			var action = ui.actions.get('exportPdf');

			if (action != null)
			{
				action.funct();
			}
		});
	};

	ProcessDraw.Sheet =
	{
		SIZES: SIZES,
		STATUSES: STATUSES,
		getRevisions: getRevisions,
		nextRevision: nextRevision,
		currentRevision: currentRevision,
		buildTitleBlockHtml: buildTitleBlockHtml,
		buildRevisionTableHtml: buildRevisionTableHtml,
		findSheetCells: findSheetCells,
		insertFrame: insertFrame,
		refresh: refresh,
		showDialog: showDialog,
		install: install
	};
})();
