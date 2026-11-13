/**
 * ProcessDraw commands and menus: ProcessDraw menu (main menu in the simple
 * theme, menubar in the classic theme), right-click items, tag tools and the
 * project settings dialog.
 */
(function()
{
	var ProcessDraw = window.ProcessDraw = window.ProcessDraw || {};
	var Tags = ProcessDraw.Tags;

	mxResources.parse(
		'pdMenu=ProcessDraw\n' +
		'pdDataSheet=Data Sheet...\n' +
		'pdRenumber=Renumber Selection...\n' +
		'pdNumberAll=Number All Unnumbered Items\n' +
		'pdAddSpare=Add Spare (A/B)\n' +
		'pdCheckTags=Check Tags...\n' +
		'pdSettings=Tag Numbering & Units...\n');

	function getSelectedPdCells(graph)
	{
		return graph.getSelectionCells().filter(function(c)
		{
			return Tags.isPd(c);
		});
	};

	function info(ui, msg)
	{
		ui.alert(msg);
	};

	function selectItem(ui, cell, page)
	{
		if (page != null && page != ui.currentPage)
		{
			ui.selectPage(page);
		}

		var graph = ui.editor.graph;
		graph.setSelectionCell(cell);
		graph.scrollCellToVisible(cell);
	};

	/**
	 * Duplicates an equipment item as installed spare: P-101 becomes P-101A and
	 * the copy P-101B (or the next free letter).
	 */
	function addSpare(ui, cell)
	{
		var graph = ui.editor.graph;
		var p = Tags.parse(Tags.attr(cell, 'tag'));

		if (p == null)
		{
			info(ui, 'Give the item a numbered tag first, e.g. P-101.');
			return;
		}

		var base = p.prefix + p.sep + p.digits;
		var used = {};

		Tags.forEachCell(ui, function(c)
		{
			var q = Tags.parse(Tags.attr(c, 'tag'));

			if (q != null && (q.prefix + q.sep + q.digits).toUpperCase() == base.toUpperCase() && q.suffix)
			{
				used[q.suffix] = true;
			}
		});

		var next = 'B';

		for (var code = 66; code <= 90; code++)
		{
			next = String.fromCharCode(code);

			if (!used[next])
			{
				break;
			}
		}

		var geo = graph.getCellGeometry(cell);
		Tags.suspended = true;
		graph.model.beginUpdate();
		try
		{
			if (!p.suffix)
			{
				Tags.setAttributes(graph, cell, {tag: base + 'A'});
			}

			var clones = graph.moveCells([cell], (geo != null) ? geo.width + 40 : 60, 0, true);
			Tags.setAttributes(graph, clones[0], {tag: base + next});
			graph.setSelectionCells(clones);
		}
		finally
		{
			graph.model.endUpdate();
			Tags.suspended = false;
		}
	};

	function showCheckResult(ui)
	{
		var result = Tags.check(ui);
		var div = document.createElement('div');
		div.style.maxHeight = '360px';
		div.style.overflowY = 'auto';
		div.style.fontSize = '12px';
		div.style.lineHeight = '1.6';
		var problems = 0;

		function addHeading(text)
		{
			var h = document.createElement('div');
			h.style.fontWeight = 'bold';
			h.style.marginTop = '8px';
			mxUtils.write(h, text);
			div.appendChild(h);
		};

		function addLink(text, cell, page)
		{
			var a = document.createElement('a');
			a.setAttribute('href', 'javascript:void(0);');
			a.style.display = 'block';
			mxUtils.write(a, text + ((page != null && page.getName) ? '  (page "' + page.getName() + '")' : ''));
			mxEvent.addListener(a, 'click', function()
			{
				ui.hideDialog();
				selectItem(ui, cell, page);
			});
			div.appendChild(a);
		};

		var dupKeys = Object.keys(result.duplicates).sort();

		if (dupKeys.length > 0)
		{
			addHeading('Duplicate tags (' + dupKeys.length + ')');

			for (var i = 0; i < dupKeys.length; i++)
			{
				var items = result.duplicates[dupKeys[i]];

				for (var j = 0; j < items.length; j++)
				{
					addLink(dupKeys[i] + ' #' + (j + 1), items[j].cell, items[j].page);
					problems++;
				}
			}
		}

		if (result.unnumbered.length > 0)
		{
			addHeading('Not numbered (' + result.unnumbered.length + ')');

			for (var i = 0; i < result.unnumbered.length; i++)
			{
				var u = result.unnumbered[i];
				addLink(Tags.attr(u.cell, 'tag') + ' – ' + (Tags.attr(u.cell, 'pd_type') || ''), u.cell, u.page);
				problems++;
			}
		}

		if (problems == 0)
		{
			mxUtils.write(div, 'All tags are unique and numbered.');
		}

		var dlg = new CustomDialog(ui, div, null, null, mxResources.get('close'), null, null, true);
		var lines = div.querySelectorAll('a, div').length;
		ui.showDialog(dlg.container, 420, Math.min(440, 110 + lines * 20), true, true);
	};

	function showSettings(ui)
	{
		var settings = Tags.getSettings(ui);
		var div = document.createElement('div');
		div.style.fontSize = '12px';
		var inputs = {};

		function addRow(key, caption, input)
		{
			var row = document.createElement('div');
			row.style.display = 'flex';
			row.style.alignItems = 'center';
			row.style.margin = '6px 0';
			var label = document.createElement('label');
			label.style.flex = '0 0 55%';
			mxUtils.write(label, caption);
			row.appendChild(label);
			input.style.flex = '1 1 auto';
			row.appendChild(input);
			div.appendChild(row);
			inputs[key] = input;
		};

		function textInput(value)
		{
			var input = document.createElement('input');
			input.setAttribute('type', 'text');
			input.value = value;

			return input;
		};

		var title = document.createElement('div');
		title.style.fontWeight = 'bold';
		title.style.fontSize = '14px';
		title.style.marginBottom = '8px';
		mxUtils.write(title, 'Tag Numbering & Units');
		div.appendChild(title);

		addRow('start', 'First number', textInput(settings.start));
		addRow('step', 'Step', textInput(settings.step));
		addRow('digits', 'Minimum digits (101 → 3, 0101 → 4)', textInput(settings.digits));
		addRow('separator', 'Separator (P-101)', textInput(settings.separator));

		var auto = document.createElement('input');
		auto.setAttribute('type', 'checkbox');
		auto.checked = settings.autonumber;
		addRow('autonumber', 'Number new and copied items automatically', auto);

		var units = document.createElement('select');
		var opts = [['metric', 'Metric (barg, °C, m³/h, kW)'], ['imperial', 'Imperial (psig, °F, gpm, hp)']];

		for (var i = 0; i < opts.length; i++)
		{
			var o = document.createElement('option');
			o.value = opts[i][0];
			mxUtils.write(o, opts[i][1]);
			units.appendChild(o);
		}

		units.value = settings.units;
		addRow('units', 'Units', units);

		var note = document.createElement('div');
		note.style.opacity = '0.65';
		note.style.fontSize = '11px';
		note.style.marginTop = '10px';
		mxUtils.write(note, 'Settings are saved in the diagram (first page). Changing units does not convert ' +
			'values that are already entered.');
		div.appendChild(note);

		var dlg = new CustomDialog(ui, div, function()
		{
			function num(key, min)
			{
				var n = parseInt(inputs[key].value, 10);

				return (isNaN(n) || n < min) ? Tags.DEFAULTS[key] : n;
			};

			ui.editor.graph.model.beginUpdate();
			try
			{
				Tags.setSettings(ui, {start: num('start', 0), step: num('step', 1), digits: num('digits', 1),
					separator: inputs.separator.value, autonumber: auto.checked, units: units.value});
			}
			finally
			{
				ui.editor.graph.model.endUpdate();
			}

			if (ui.format != null)
			{
				ui.format.refresh();
			}
		}, null, mxResources.get('apply'));

		ui.showDialog(dlg.container, 420, 330, true, true);
	};

	function addActions(ui)
	{
		var graph = ui.editor.graph;

		ui.actions.addAction('pdDataSheet', function()
		{
			var cells = getSelectedPdCells(graph);

			if (cells.length == 1)
			{
				ProcessDraw.Properties.openDataSheet(ui, cells[0]);
			}
			else
			{
				info(ui, 'Select one ProcessDraw symbol.');
			}
		});

		ui.actions.addAction('pdRenumber', function()
		{
			var cells = getSelectedPdCells(graph);

			if (cells.length == 0)
			{
				info(ui, 'Select the items to renumber. They are numbered top to bottom, left to right.');
				return;
			}

			var dlg = new FilenameDialog(ui, '', mxResources.get('apply'), function(value)
			{
				var start = parseInt(value, 10);
				var count = Tags.renumber(ui, cells, (isNaN(start)) ? null : start);
				ui.editor.setStatus(count + ' item(s) renumbered');
			}, 'First number (empty: continue after the highest number in use)');
			ui.showDialog(dlg.container, 360, 90, true, true);
			dlg.init();
		});

		ui.actions.addAction('pdNumberAll', function()
		{
			var cells = [];

			Tags.forEachCell(ui, function(cell, page)
			{
				if ((page == null || page == ui.currentPage) && Tags.attr(cell, 'tag').indexOf('???') >= 0)
				{
					cells.push(cell);
				}
			});

			var count = Tags.renumber(ui, cells, null);
			ui.editor.setStatus(count + ' item(s) numbered on this page');
		});

		ui.actions.addAction('pdAddSpare', function()
		{
			var cells = getSelectedPdCells(graph);

			if (cells.length == 1 && Tags.attr(cells[0], 'pd_class') == 'equipment')
			{
				addSpare(ui, cells[0]);
			}
			else
			{
				info(ui, 'Select one equipment item, e.g. a pump.');
			}
		});

		ui.actions.addAction('pdCheckTags', function()
		{
			showCheckResult(ui);
		});

		ui.actions.addAction('pdSettings', function()
		{
			showSettings(ui);
		});
	};

	var MENU_ITEMS = ['pdDataSheet', 'pdRenumber', 'pdNumberAll', 'pdAddSpare', '-', 'pdCheckTags', '-',
		'pdSettings', '-', 'processDrawAbout'];

	function addMenus(ui)
	{
		ui.menus.put('processdraw', new Menu(function(menu, parent)
		{
			ui.menus.addMenuItems(menu, MENU_ITEMS, parent);
		}));

		// Main menu of the simple and sketch themes
		var diagramMenu = ui.menus.get('diagram');

		if (diagramMenu != null)
		{
			var diagramFunct = diagramMenu.funct;

			diagramMenu.funct = function(menu, parent)
			{
				ui.menus.addSubmenu('processdraw', menu, parent, mxResources.get('pdMenu'));
				menu.addSeparator(parent);
				diagramFunct.apply(this, arguments);
			};
		}

		// Menubar of the classic theme
		if (ui.menubar != null && ui.menubar.container != null)
		{
			ui.menubar.addMenu(mxResources.get('pdMenu'), function(menu, parent)
			{
				ui.menus.addMenuItems(menu, MENU_ITEMS, parent);
			});
		}

		// Right-click on ProcessDraw symbols
		var createPopupMenu = ui.menus.createPopupMenu;

		ui.menus.createPopupMenu = function(menu, cell, evt)
		{
			createPopupMenu.apply(this, arguments);
			var cells = getSelectedPdCells(ui.editor.graph);

			if (cells.length > 0)
			{
				menu.addSeparator();
				var items = (cells.length == 1) ? ['pdDataSheet', 'pdRenumber'] : ['pdRenumber'];

				if (cells.length == 1 && Tags.attr(cells[0], 'pd_class') == 'equipment')
				{
					items.push('pdAddSpare');
				}

				this.addMenuItems(menu, items, null, evt);
			}
		};
	};

	ProcessDraw.Actions =
	{
		addSpare: addSpare,

		install: function(ui)
		{
			addActions(ui);
			addMenus(ui);
		}
	};
})();
