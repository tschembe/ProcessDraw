/**
 * ProcessDraw multi-sheet projects: every page is a sheet with number, drawing
 * number, title and type (stored on the page's root cell); project data lives
 * on the first page (see pd-tags.js settings). Off-page connectors are linked
 * in pairs by connector_id: their sheet labels follow the partner's sheet,
 * double-click jumps to the partner and lines continue across sheets.
 */
(function()
{
	var ProcessDraw = window.ProcessDraw = window.ProcessDraw || {};
	var Tags = ProcessDraw.Tags;
	var Library = ProcessDraw.Library;

	var SHEET_KEYS = {number: 'pd_sheet_number', drawing: 'pd_drawing_number', title: 'pd_sheet_title',
		type: 'pd_sheet_type'};
	var SHEET_TYPES = ['P&ID', 'PFD', 'UFD', 'Layout', 'Other'];

	mxResources.parse(
		'pdProjectSettings=Project Settings...\n' +
		'pdSheets=Sheets...\n' +
		'pdLinkOffpage=Link Off-Page Connector...\n' +
		'pdGoToPartner=Go to Partner Connector\n' +
		'pdUpdateOffpage=Update Off-Page Connectors\n');

	// ---------------------------------------------------------------- Sheets

	function getPages(ui)
	{
		return Tags.getPages(ui);
	};

	function getSheet(ui, page)
	{
		var result = {};

		for (var key in SHEET_KEYS)
		{
			result[key] = Tags.getPageAttribute(ui, page, SHEET_KEYS[key]);
		}

		result.name = (page != null) ? page.getName() : '';

		return result;
	};

	function setSheet(ui, page, values)
	{
		var attrs = {};

		for (var key in values)
		{
			if (SHEET_KEYS[key] != null)
			{
				attrs[SHEET_KEYS[key]] = values[key];
			}
		}

		Tags.setPageAttributes(ui, page, attrs);
	};

	/**
	 * Text for "continued on": drawing number, else "SHEET <no>", else page name.
	 */
	function getSheetLabel(ui, page)
	{
		var sheet = getSheet(ui, page);

		return (sheet.drawing) ? sheet.drawing : ((sheet.number) ? 'SHEET ' + sheet.number : sheet.name);
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

	function renamePage(ui, page, name)
	{
		if (page != null && name && page.getName() != name && typeof RenamePage === 'function')
		{
			ui.editor.graph.model.execute(new RenamePage(ui, page, name));
		}
	};

	// ---------------------------------------------------------------- Off-page connectors

	function isOffpage(cell)
	{
		return Tags.isPd(cell) && Tags.attr(cell, 'pd_class') == 'offpage';
	};

	/**
	 * Returns [{cell, page}] of the connectors linked to cell (same connector_id).
	 */
	function findPartners(ui, cell)
	{
		var id = Tags.attr(cell, 'connector_id');
		var result = [];

		if (id != '')
		{
			Tags.forEachCell(ui, function(c, page)
			{
				if (c != cell && isOffpage(c) && Tags.attr(c, 'connector_id') == id)
				{
					result.push({cell: c, page: page});
				}
			});
		}

		return result;
	};

	function findPage(ui, cell)
	{
		var found = null;

		Tags.forEachCell(ui, function(c, page)
		{
			if (c == cell)
			{
				found = page;
			}
		});

		return found;
	};

	function nextConnectorId(ui)
	{
		var max = 0;

		Tags.forEachCell(ui, function(c)
		{
			var m = /^C(\d+)$/.exec(Tags.attr(c, 'connector_id'));

			if (isOffpage(c) && m != null)
			{
				max = Math.max(max, parseInt(m[1], 10));
			}
		});

		return 'C' + pad(max + 1, 2);
	};

	/**
	 * Sets each linked connector's sheet text to its partner's sheet label.
	 */
	function updateConnectors(ui)
	{
		var graph = ui.editor.graph;
		var count = 0;
		var connectors = [];

		Tags.forEachCell(ui, function(c, page)
		{
			if (isOffpage(c))
			{
				connectors.push({cell: c, page: page});
			}
		});

		graph.model.beginUpdate();
		try
		{
			for (var i = 0; i < connectors.length; i++)
			{
				var partners = findPartners(ui, connectors[i].cell);

				if (partners.length == 1 && partners[0].page != connectors[i].page)
				{
					var label = getSheetLabel(ui, partners[0].page);

					if (Tags.attr(connectors[i].cell, 'sheet') != label)
					{
						Tags.setAttributes(graph, connectors[i].cell, {sheet: label});
						count++;
					}
				}
			}
		}
		finally
		{
			graph.model.endUpdate();
		}

		return count;
	};

	function selectCellOnPage(ui, cell, page)
	{
		if (page != null && page != ui.currentPage)
		{
			ui.selectPage(page);
		}

		var graph = ui.editor.graph;
		graph.setSelectionCell(cell);
		graph.scrollCellToVisible(cell, true);
	};

	/**
	 * Jumps to the partner of an off-page connector. Returns false if not linked.
	 */
	function goToPartner(ui, cell)
	{
		var partners = findPartners(ui, cell);

		if (partners.length == 0)
		{
			return false;
		}

		selectCellOnPage(ui, partners[0].cell, partners[0].page);

		return true;
	};

	/**
	 * Links cell to an existing connector (partner) or creates a new partner
	 * on targetPage. Shows the partner afterwards.
	 */
	function link(ui, cell, targetPage, partner)
	{
		var graph = ui.editor.graph;
		var sourcePage = ui.currentPage;
		var id = Tags.attr(cell, 'connector_id') || nextConnectorId(ui);
		var outgoing = Tags.attr(cell, 'direction') != 'from';

		graph.model.beginUpdate();
		try
		{
			Tags.setAttributes(graph, cell, {connector_id: id, sheet: getSheetLabel(ui, targetPage)});
		}
		finally
		{
			graph.model.endUpdate();
		}

		var geo = graph.getCellGeometry(cell);
		ui.selectPage(targetPage);
		graph = ui.editor.graph;

		graph.model.beginUpdate();
		try
		{
			if (partner == null)
			{
				var sym = Library.getSymbol((outgoing) ? 'pd_offpage_in' : 'pd_offpage_out');
				var created = Library.createCell(sym);
				var bounds = graph.getBoundingBoxFromGeometry(graph.model.getChildCells(graph.getDefaultParent()));
				var y = (geo != null) ? geo.y : 40;

				if (outgoing)
				{
					// Incoming connectors go on the left of the drawing
					created.geometry.x = (bounds != null) ? Math.max(0, bounds.x - sym.w - 40) : 20;
				}
				else
				{
					created.geometry.x = (bounds != null) ? bounds.x + bounds.width + 40 : 600;
				}

				created.geometry.y = y;
				partner = graph.importCells([created], 0, 0, graph.getDefaultParent())[0];
			}

			Tags.setAttributes(graph, partner, {connector_id: id, direction: (outgoing) ? 'from' : 'to',
				description: Tags.attr(partner, 'description') || ((outgoing) ? 'FROM' : 'TO'),
				sheet: getSheetLabel(ui, sourcePage)});
		}
		finally
		{
			graph.model.endUpdate();
		}

		graph.setSelectionCell(partner);
		graph.scrollCellToVisible(partner, true);

		return partner;
	};

	/**
	 * Returns [{cell, page, problem}] for connectors that are not linked
	 * correctly.
	 */
	function checkConnectors(ui)
	{
		var result = [];

		Tags.forEachCell(ui, function(c, page)
		{
			if (!isOffpage(c))
			{
				return;
			}

			var partners = findPartners(ui, c);

			if (partners.length == 0)
			{
				result.push({cell: c, page: page, problem: 'not linked'});
			}
			else if (partners.length > 1)
			{
				result.push({cell: c, page: page, problem: 'linked to ' + partners.length + ' connectors'});
			}
			else if (partners[0].page == page)
			{
				result.push({cell: c, page: page, problem: 'partner is on the same sheet'});
			}
			else if (Tags.attr(partners[0].cell, 'direction') == Tags.attr(c, 'direction'))
			{
				result.push({cell: c, page: page, problem: 'both connectors point the same way'});
			}
			else if (Tags.attr(c, 'sheet') != getSheetLabel(ui, partners[0].page))
			{
				result.push({cell: c, page: page, problem: 'sheet text out of date'});
			}
		});

		return result;
	};

	// ---------------------------------------------------------------- Dialogs

	function makeRow(caption, input, labelWidth)
	{
		var row = document.createElement('div');
		row.style.display = 'flex';
		row.style.alignItems = 'center';
		row.style.margin = '4px 0';
		var label = document.createElement('label');
		label.style.flex = '0 0 ' + (labelWidth || '40%');
		mxUtils.write(label, caption);
		row.appendChild(label);
		input.style.flex = '1 1 auto';
		input.style.minWidth = '0';
		row.appendChild(input);

		return row;
	};

	function textInput(value)
	{
		var input = document.createElement('input');
		input.setAttribute('type', 'text');
		input.value = value || '';

		return input;
	};

	function title(div, text, size)
	{
		var t = document.createElement('div');
		t.style.fontWeight = 'bold';
		t.style.fontSize = size || '12px';
		t.style.margin = '10px 0 4px 0';
		mxUtils.write(t, text);
		div.appendChild(t);
	};

	function showProjectSettings(ui)
	{
		var s = Tags.getSettings(ui);
		var div = document.createElement('div');
		div.style.fontSize = '12px';
		var fields = [['projectNumber', 'Project number'], ['projectName', 'Project name'], ['client', 'Client'],
			['site', 'Plant / site'], ['area', 'Unit / area'], ['preparedBy', 'Prepared by'],
			['docPrefix', 'Drawing number prefix (e.g. 1234-PID-)']];
		var inputs = {};

		title(div, 'Project', '14px');

		for (var i = 0; i < fields.length; i++)
		{
			inputs[fields[i][0]] = textInput(s[fields[i][0]]);
			div.appendChild(makeRow(fields[i][1], inputs[fields[i][0]]));
		}

		title(div, 'Numbering');
		var buttons = document.createElement('div');
		buttons.style.display = 'flex';
		buttons.style.gap = '6px';
		buttons.style.flexWrap = 'wrap';
		var names = ['pdSettings', 'pdLineSettings', 'pdSheets'];

		for (var i = 0; i < names.length; i++)
		{
			(function(name)
			{
				var btn = mxUtils.button(mxResources.get(name), function()
				{
					ui.hideDialog();
					ui.actions.get(name).funct();
				});
				btn.className = 'geBtn';
				buttons.appendChild(btn);
			})(names[i]);
		}

		div.appendChild(buttons);

		var note = document.createElement('div');
		note.style.opacity = '0.65';
		note.style.fontSize = '11px';
		note.style.marginTop = '10px';
		mxUtils.write(note, 'Saved in the diagram file (first page). Used in title blocks and lists.');
		div.appendChild(note);

		var dlg = new CustomDialog(ui, div, function()
		{
			var values = {};

			for (var key in inputs)
			{
				values[key] = inputs[key].value.trim();
			}

			ui.editor.graph.model.beginUpdate();
			try
			{
				Tags.setSettings(ui, values);
			}
			finally
			{
				ui.editor.graph.model.endUpdate();
			}
		}, null, mxResources.get('apply'));

		ui.showDialog(dlg.container, 480, 440, true, true);
	};

	function showSheets(ui)
	{
		var pages = getPages(ui);
		var settings = Tags.getSettings(ui);
		var div = document.createElement('div');
		div.style.fontSize = '12px';
		title(div, 'Sheets', '14px');

		var table = document.createElement('table');
		table.style.width = '100%';
		table.style.borderCollapse = 'collapse';
		var head = document.createElement('tr');
		var cols = ['Page', 'Sheet no.', 'Drawing no.', 'Title', 'Type'];

		for (var i = 0; i < cols.length; i++)
		{
			var th = document.createElement('th');
			th.style.textAlign = 'left';
			th.style.padding = '2px 4px';
			mxUtils.write(th, cols[i]);
			head.appendChild(th);
		}

		table.appendChild(head);
		var rows = [];

		for (var i = 0; i < pages.length; i++)
		{
			var sheet = getSheet(ui, pages[i]);
			var tr = document.createElement('tr');
			var row = {page: pages[i]};

			var tdName = document.createElement('td');
			tdName.style.padding = '2px 4px';
			var a = document.createElement('a');
			a.setAttribute('href', 'javascript:void(0);');
			a.setAttribute('title', 'Go to this page');
			mxUtils.write(a, sheet.name || ('Page ' + (i + 1)));
			(function(page)
			{
				mxEvent.addListener(a, 'click', function()
				{
					ui.hideDialog();

					if (page != null)
					{
						ui.selectPage(page);
					}
				});
			})(pages[i]);
			tdName.appendChild(a);
			tr.appendChild(tdName);

			var keys = ['number', 'drawing', 'title'];
			var widths = ['60px', '130px', ''];

			for (var j = 0; j < keys.length; j++)
			{
				var td = document.createElement('td');
				td.style.padding = '2px 4px';
				var input = textInput(sheet[keys[j]]);
				input.style.width = widths[j] || '100%';
				input.style.boxSizing = 'border-box';
				td.appendChild(input);
				tr.appendChild(td);
				row[keys[j]] = input;
			}

			var tdType = document.createElement('td');
			tdType.style.padding = '2px 4px';
			var select = document.createElement('select');

			for (var j = 0; j < SHEET_TYPES.length; j++)
			{
				var opt = document.createElement('option');
				opt.value = SHEET_TYPES[j];
				mxUtils.write(opt, SHEET_TYPES[j]);
				select.appendChild(opt);
			}

			select.value = sheet.type || 'P&ID';
			tdType.appendChild(select);
			tr.appendChild(tdType);
			row.type = select;

			table.appendChild(tr);
			rows.push(row);
		}

		var wrapper = document.createElement('div');
		wrapper.style.maxHeight = '300px';
		wrapper.style.overflowY = 'auto';
		wrapper.appendChild(table);
		div.appendChild(wrapper);

		var tools = document.createElement('div');
		tools.style.margin = '10px 0';
		var numberBtn = mxUtils.button('Number sheets 001, 002, ...', function()
		{
			for (var i = 0; i < rows.length; i++)
			{
				rows[i].number.value = pad(i + 1, 3);

				if (settings.docPrefix)
				{
					rows[i].drawing.value = settings.docPrefix + pad(i + 1, 3);
				}
			}
		});
		numberBtn.className = 'geBtn';
		numberBtn.setAttribute('title', 'Sheet numbers in page order; drawing numbers from the project prefix');
		tools.appendChild(numberBtn);
		div.appendChild(tools);

		var renameRow = document.createElement('label');
		renameRow.style.display = 'block';
		var rename = document.createElement('input');
		rename.setAttribute('type', 'checkbox');
		rename.checked = true;
		rename.style.marginRight = '6px';
		renameRow.appendChild(rename);
		mxUtils.write(renameRow, 'Name pages "<sheet no.> <title>"');
		div.appendChild(renameRow);

		if (pages.length == 1 && pages[0] == null)
		{
			var hint = document.createElement('div');
			hint.style.opacity = '0.65';
			mxUtils.write(hint, 'Add pages with the + button at the bottom left to create more sheets.');
			div.appendChild(hint);
		}

		var dlg = new CustomDialog(ui, div, function()
		{
			var graph = ui.editor.graph;
			graph.model.beginUpdate();
			try
			{
				for (var i = 0; i < rows.length; i++)
				{
					var values = {number: rows[i].number.value.trim(), drawing: rows[i].drawing.value.trim(),
						title: rows[i].title.value.trim(), type: rows[i].type.value};
					setSheet(ui, rows[i].page, values);

					if (rename.checked && (values.number || values.title))
					{
						renamePage(ui, rows[i].page, (values.number + ' ' + values.title).trim());
					}
				}

				var n = updateConnectors(ui);

				if (n > 0)
				{
					ui.editor.setStatus(n + ' off-page connector(s) updated');
				}
			}
			finally
			{
				graph.model.endUpdate();
			}
		}, null, mxResources.get('apply'));

		ui.showDialog(dlg.container, 640, Math.min(560, 230 + pages.length * 32), true, true);
	};

	function showLinkDialog(ui, cell)
	{
		var pages = getPages(ui).filter(function(p)
		{
			return p != null && p != ui.currentPage;
		});

		if (pages.length == 0)
		{
			ui.alert('This diagram has only one page. Add a sheet (+ at the bottom left) to link connectors.');
			return;
		}

		var outgoing = Tags.attr(cell, 'direction') != 'from';
		var div = document.createElement('div');
		div.style.fontSize = '12px';
		title(div, 'Link ' + ((outgoing) ? 'outgoing' : 'incoming') + ' connector to...', '14px');
		var list = document.createElement('div');
		list.style.maxHeight = '320px';
		list.style.overflowY = 'auto';
		list.style.lineHeight = '1.8';
		div.appendChild(list);

		function addChoice(text, fn)
		{
			var a = document.createElement('a');
			a.setAttribute('href', 'javascript:void(0);');
			a.style.display = 'block';
			mxUtils.write(a, text);
			mxEvent.addListener(a, 'click', function()
			{
				ui.hideDialog();
				fn();
			});
			list.appendChild(a);
		};

		for (var i = 0; i < pages.length; i++)
		{
			(function(page)
			{
				var label = getSheetLabel(ui, page) + ((getSheetLabel(ui, page) != page.getName()) ?
					' (' + page.getName() + ')' : '');
				var heading = document.createElement('div');
				heading.style.fontWeight = 'bold';
				heading.style.marginTop = '6px';
				mxUtils.write(heading, label);
				list.appendChild(heading);

				addChoice('Create a new ' + ((outgoing) ? 'incoming' : 'outgoing') + ' connector there', function()
				{
					link(ui, cell, page, null);
				});

				// Unlinked connectors pointing the other way on that page
				Tags.forEachCell(ui, function(c, p)
				{
					if (p == page && isOffpage(c) && findPartners(ui, c).length == 0 &&
						(Tags.attr(c, 'direction') == 'from') == outgoing)
					{
						addChoice('Link to "' + Tags.attr(c, 'description') + ' ' + Tags.attr(c, 'sheet') + '"',
							function()
						{
							link(ui, cell, page, c);
						});
					}
				});
			})(pages[i]);
		}

		var dlg = new CustomDialog(ui, div, null, null, mxResources.get('cancel'), null, null, true);
		ui.showDialog(dlg.container, 420, Math.min(440, 130 + list.childNodes.length * 26), true, true);
	};

	// ---------------------------------------------------------------- Install

	function getSelectedOffpage(graph)
	{
		var cell = (graph.getSelectionCount() == 1) ? graph.getSelectionCell() : null;

		return (isOffpage(cell)) ? cell : null;
	};

	function install(ui)
	{
		var graph = ui.editor.graph;

		ui.actions.addAction('pdProjectSettings', function()
		{
			showProjectSettings(ui);
		});

		ui.actions.addAction('pdSheets', function()
		{
			showSheets(ui);
		});

		ui.actions.addAction('pdLinkOffpage', function()
		{
			var cell = getSelectedOffpage(ui.editor.graph);

			if (cell == null)
			{
				ui.alert('Select one off-page connector.');
			}
			else
			{
				showLinkDialog(ui, cell);
			}
		});

		ui.actions.addAction('pdGoToPartner', function()
		{
			var cell = getSelectedOffpage(ui.editor.graph);

			if (cell == null || !goToPartner(ui, cell))
			{
				ui.alert('Select a linked off-page connector (ProcessDraw > Link Off-Page Connector).');
			}
		});

		ui.actions.addAction('pdUpdateOffpage', function()
		{
			var n = updateConnectors(ui);
			ui.editor.setStatus(n + ' off-page connector(s) updated');
		});

		// Double-click on a linked off-page connector jumps to its partner
		var graphDblClick = graph.dblClick;

		graph.dblClick = function(evt, cell)
		{
			if (this.isEnabled() && isOffpage(cell) && !mxEvent.isAltDown(evt) && findPartners(ui, cell).length > 0)
			{
				mxEvent.consume(evt);
				goToPartner(ui, cell);
			}
			else
			{
				graphDblClick.apply(this, arguments);
			}
		};

		// Right-click on an off-page connector
		var createPopupMenu = ui.menus.createPopupMenu;

		ui.menus.createPopupMenu = function(menu, cell, evt)
		{
			createPopupMenu.apply(this, arguments);

			if (getSelectedOffpage(ui.editor.graph) != null)
			{
				menu.addSeparator();
				this.addMenuItems(menu, ['pdLinkOffpage', 'pdGoToPartner'], null, evt);
			}
		};
	};

	ProcessDraw.Project =
	{
		SHEET_KEYS: SHEET_KEYS,
		SHEET_TYPES: SHEET_TYPES,
		getSheet: getSheet,
		setSheet: setSheet,
		getSheetLabel: getSheetLabel,
		isOffpage: isOffpage,
		findPartners: findPartners,
		findPage: findPage,
		nextConnectorId: nextConnectorId,
		updateConnectors: updateConnectors,
		goToPartner: goToPartner,
		link: link,
		checkConnectors: checkConnectors,
		selectCellOnPage: selectCellOnPage,
		install: install
	};
})();
