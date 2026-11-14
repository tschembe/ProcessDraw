/**
 * ProcessDraw engineering properties: the "Engineering" tab in the Format panel
 * and the data sheet dialog (double-click on a symbol). Both use createForm.
 */
(function()
{
	var ProcessDraw = window.ProcessDraw = window.ProcessDraw || {};
	var Tags = ProcessDraw.Tags;
	var Fields = ProcessDraw.Fields;

	// Attributes that are not shown as data fields
	var HIDDEN = {label: 1, placeholders: 1, tag: 1, id: 1, tooltip: 1, link: 1};
	var CSS = '.pdForm{padding:8px 12px 12px 12px;font-size:12px;line-height:1.3;}' +
		'.pdForm .pdHead{font-weight:bold;font-size:13px;}' +
		'.pdForm .pdSub{opacity:0.6;font-size:11px;margin:2px 0 8px 0;}' +
		'.pdForm .pdRow{display:flex;align-items:center;margin:3px 0;}' +
		'.pdForm .pdRow label{flex:0 0 40%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-right:4px;' +
			'box-sizing:border-box;}' +
		'.pdForm .pdRow input{flex:1 1 0px;width:0;min-width:0;max-width:none;box-sizing:border-box;height:22px;}' +
		'.pdForm .pdUnit{flex:0 0 34px;margin-left:4px;opacity:0.6;font-size:11px;white-space:nowrap;}' +
		'.pdForm .pdNote{font-size:11px;margin:1px 0 4px 40%;white-space:normal;overflow-wrap:anywhere;}' +
		'.pdForm .pdRow.pdWide{flex-wrap:wrap;}' +
		'.pdForm .pdRow.pdWide label{flex:0 0 100%;margin-bottom:2px;}' +
		'.pdForm .pdRow.pdWide input{flex:1 1 auto;width:auto;}' +
		'.pdForm .pdRow.pdWide .pdUnit{display:none;}' +
		'.pdForm .pdNote.pdFull{margin-left:0;}' +
		'.pdForm .pdWarn{color:#d32f2f;}' +
		'.pdForm .pdInfo{opacity:0.65;}' +
		'.pdForm input.pdError{border-color:#d32f2f;outline-color:#d32f2f;}' +
		'.pdForm .pdSection{font-weight:bold;margin:10px 0 4px 0;padding-top:8px;' +
			'border-top:1px solid rgba(128,128,128,0.3);}' +
		'.pdForm .pdButtons{margin-top:10px;display:flex;flex-wrap:wrap;gap:6px;}' +
		'.pdForm .pdButtons button{padding:3px 8px;}';
	var cssAdded = false;
	var listCounter = 0;

	function addCss()
	{
		if (!cssAdded)
		{
			var style = document.createElement('style');
			style.textContent = CSS;
			document.head.appendChild(style);
			cssAdded = true;
		}
	};

	function humanType(type)
	{
		var s = String(type || '').split('.').reverse().join(' ').replace(/_/g, ' ');

		return s.charAt(0).toUpperCase() + s.substring(1);
	};

	function pageName(ui, page)
	{
		return (page != null && typeof page.getName === 'function') ? page.getName() : '';
	};

	/**
	 * Creates the properties form for a ProcessDraw cell. In the dialog the
	 * form redraws itself after each change; in the Format panel the panel
	 * refresh does this.
	 */
	function createForm(ui, cell, inDialog)
	{
		addCss();
		var graph = ui.editor.graph;
		var form = document.createElement('div');
		form.className = 'pdForm';

		function commit(fn)
		{
			try
			{
				graph.model.beginUpdate();
				try
				{
					fn();
				}
				finally
				{
					graph.model.endUpdate();
				}
			}
			catch (e)
			{
				ui.handleError(e);
			}

			if (inDialog)
			{
				var focused = (document.activeElement != null) ?
					document.activeElement.getAttribute('data-pd-field') : null;
				render();

				if (focused != null)
				{
					focusField(form, focused);
				}
			}
		};

		function addRow(parent, key, caption, value, onCommit, onInput)
		{
			var row = document.createElement('div');
			row.className = 'pdRow';
			var label = document.createElement('label');
			mxUtils.write(label, caption);
			label.setAttribute('title', caption + ' (' + key + ')');
			row.appendChild(label);

			var input = document.createElement('input');
			input.setAttribute('type', 'text');
			input.setAttribute('data-pd-field', key);
			input.setAttribute('spellcheck', 'false');
			input.value = value;
			input.setAttribute('title', value);
			row.appendChild(input);

			var options = Fields.getOptions(key, ui);

			if (options != null)
			{
				var list = document.createElement('datalist');
				list.id = 'pdOptions' + (listCounter++);

				for (var i = 0; i < options.length; i++)
				{
					var opt = document.createElement('option');
					var parts = String(options[i]).split('|');
					opt.value = parts[0];

					if (parts.length > 1)
					{
						opt.label = parts[1];
					}
					list.appendChild(opt);
				}

				row.appendChild(list);
				input.setAttribute('list', list.id);
			}

			var unit = document.createElement('span');
			unit.className = 'pdUnit';
			mxUtils.write(unit, Fields.getUnit(key, Tags.getSettings(ui).units));
			row.appendChild(unit);

			mxEvent.addListener(input, 'change', function()
			{
				if (input.value != value)
				{
					onCommit(input.value);
				}
			});

			mxEvent.addListener(input, 'keydown', function(evt)
			{
				// Keeps Delete/Backspace and arrow keys away from the diagram
				evt.stopPropagation();

				if (evt.keyCode == 13)
				{
					input.blur();
				}
				else if (evt.keyCode == 27)
				{
					input.value = value;
					input.blur();
				}
			});

			if (onInput != null)
			{
				mxEvent.addListener(input, 'input', function()
				{
					onInput(input.value, input);
				});
			}

			parent.appendChild(row);

			return input;
		};

		function addNote(parent, text, className)
		{
			var note = document.createElement('div');
			note.className = 'pdNote ' + className;
			mxUtils.write(note, text);
			parent.appendChild(note);

			return note;
		};

		function addButton(parent, caption, title, fn)
		{
			var btn = mxUtils.button(caption, fn);
			btn.className = 'geBtn';
			btn.setAttribute('title', title);
			parent.appendChild(btn);
		};

		function render()
		{
			form.innerText = '';
			var value = cell.value;
			var cls = value.getAttribute('pd_class');
			var isInstrument = cls == 'instrument';

			var head = document.createElement('div');
			head.className = 'pdHead';
			mxUtils.write(head, (Fields.CLASSES[cls] || cls) + ': ' + humanType(value.getAttribute('pd_type')));
			form.appendChild(head);

			var sub = document.createElement('div');
			sub.className = 'pdSub';
			mxUtils.write(sub, (value.getAttribute('pd_standard') || '') +
				((value.getAttribute('pd_tag_prefix')) ? ' · tag prefix ' + value.getAttribute('pd_tag_prefix') : ''));
			form.appendChild(sub);

			// Tag
			if (value.hasAttribute('tag'))
			{
				var warn = null;
				var tagInput = addRow(form, 'tag', 'Tag', value.getAttribute('tag'), function(v)
				{
					commit(function()
					{
						Tags.setTag(ui, cell, v);
					});
				}, function(v, input)
				{
					var dupes = Tags.findTag(ui, v, cell);
					input.classList.toggle('pdError', dupes.length > 0);
					warn.innerText = (dupes.length > 0) ? 'Already used' +
						((pageName(ui, dupes[0].page)) ? ' on page "' + pageName(ui, dupes[0].page) + '"' : '') : '';
				});

				tagInput.style.fontWeight = 'bold';
				warn = addNote(form, '', 'pdWarn');
				var dupes = Tags.findTag(ui, value.getAttribute('tag'), cell);

				if (dupes.length > 0)
				{
					tagInput.classList.add('pdError');
					warn.innerText = 'Already used' + ((pageName(ui, dupes[0].page)) ?
						' on page "' + pageName(ui, dupes[0].page) + '"' : '');
				}

				if (isInstrument)
				{
					var settings = Tags.getSettings(ui);
					var updateInstrument = function(fn, loop)
					{
						var p = Tags.parseInstrument(value.getAttribute('tag'));

						commit(function()
						{
							Tags.setAttributes(graph, cell, {'function': fn.trim().toUpperCase(),
								loop: loop.trim().toUpperCase(), tag: Tags.formatInstrument((p != null) ? p.area : '',
								fn.trim().toUpperCase(), loop.trim().toUpperCase(), settings)});
						});
					};

					var meaning = null;
					addRow(form, 'function', 'Function letters', value.getAttribute('function') || '', function(v)
					{
						updateInstrument(v, value.getAttribute('loop') || '');
					}, function(v)
					{
						meaning.innerText = Tags.decodeIsa(v);
					});
					meaning = addNote(form, Tags.decodeIsa(value.getAttribute('function')), 'pdInfo');
					addRow(form, 'loop', 'Loop number', value.getAttribute('loop') || '', function(v)
					{
						updateInstrument(value.getAttribute('function') || '', v);
					});
				}
			}

			// Line number of process lines
			var isLine = cls == 'line' && ProcessDraw.Lines != null;
			var Lines = ProcessDraw.Lines;

			if (isLine)
			{
				var settings = Tags.getSettings(ui);
				var manual = value.getAttribute('pd_line_manual') == '1';
				var segments = Lines.getSegments(ui, value.getAttribute('line_number'));
				var numberInput = addRow(form, 'line_number', 'Line number', value.getAttribute('line_number') || '',
					function(v)
					{
						commit(function()
						{
							Lines.setManualNumber(ui, cell, v, ProcessDraw.Properties.applyToSegments);
						});
					});
				numberInput.style.fontWeight = 'bold';
				numberInput.parentNode.classList.add('pdWide');
				addNote(form, (manual) ? 'Typed in (pattern not used)' : ((value.getAttribute('sequence')) ?
					'From pattern ' + settings.linePattern : 'Numbered when the line is connected'), 'pdInfo pdFull');

				if (segments.length > 1)
				{
					var row = document.createElement('div');
					row.className = 'pdNote pdFull';
					var cb = document.createElement('input');
					cb.setAttribute('type', 'checkbox');
					cb.checked = ProcessDraw.Properties.applyToSegments;
					cb.style.margin = '0 4px 0 0';
					cb.style.verticalAlign = 'middle';
					mxEvent.addListener(cb, 'change', function()
					{
						ProcessDraw.Properties.applyToSegments = cb.checked;
					});
					row.appendChild(cb);
					mxUtils.write(row, 'Changes apply to all ' + segments.length + ' segments');
					form.appendChild(row);
				}
			}

			// Data fields in stored order
			var section = document.createElement('div');
			section.className = 'pdSection';
			mxUtils.write(section, 'Data');
			form.appendChild(section);
			var count = 0;

			for (var i = 0; i < value.attributes.length; i++)
			{
				var key = value.attributes[i].name;

				if (HIDDEN[key] || key.substring(0, 3) == 'pd_' ||
					(isInstrument && (key == 'function' || key == 'loop')) ||
					(isLine && key == 'line_number'))
				{
					continue;
				}

				(function(key)
				{
					addRow(form, key, Fields.getLabel(key), value.getAttribute(key), function(v)
					{
						commit(function()
						{
							var values = {};
							values[key] = v;

							if (isLine && mxUtils.indexOf(Lines.LINE_KEYS, key) >= 0)
							{
								Lines.update(ui, cell, values, ProcessDraw.Properties.applyToSegments);
							}
							else
							{
								Tags.setAttributes(graph, cell, values);
							}
						});
					});
				})(key);

				count++;
			}

			if (count == 0)
			{
				addNote(form, 'No data fields', 'pdInfo').style.marginLeft = '0';
			}

			// Buttons
			var buttons = document.createElement('div');
			buttons.className = 'pdButtons';

			if (!inDialog)
			{
				addButton(buttons, 'Data sheet...', 'Show all data in a dialog (double-click)', function()
				{
					ProcessDraw.Properties.openDataSheet(ui, cell);
				});
			}

			if ((cls == 'frame' || cls == 'titleblock' || cls == 'revtable') && ProcessDraw.Sheet != null)
			{
				addButton(buttons, 'Drawing sheet...', 'Title block data, status and revisions (double-click)', function()
				{
					if (inDialog)
					{
						ui.hideDialog();
					}

					ProcessDraw.Sheet.showDialog(ui);
				});
			}

			if (cls == 'hmb' && ProcessDraw.PFD != null)
			{
				addButton(buttons, 'Edit values...', 'Edit the stream data in a table (double-click)', function()
				{
					if (inDialog)
					{
						ui.hideDialog();
					}

					ProcessDraw.PFD.openEditor(ui, cell);
				});
			}

			if (isLine && value.getAttribute('pd_line_manual') == '1')
			{
				addButton(buttons, 'Use pattern', 'Build the line number from the project pattern again', function()
				{
					commit(function()
					{
						Lines.useAutoNumber(ui, cell, ProcessDraw.Properties.applyToSegments);
					});
				});
			}

			if (isLine)
			{
				addButton(buttons, 'New line (split)', 'Give this segment a new sequence number', function()
				{
					commit(function()
					{
						Lines.split(ui, [cell]);
					});
				});
			}

			if (value.hasAttribute('tag') && value.getAttribute('pd_tag_prefix'))
			{
				addButton(buttons, 'Next free tag', 'Give this item the next free number', function()
				{
					commit(function()
					{
						Tags.assignNext(ui, cell, Tags.buildIndex(ui), Tags.getSettings(ui));
					});
				});
			}

			if (cls == 'equipment' && Tags.parse(value.getAttribute('tag')) != null)
			{
				addButton(buttons, 'Add spare (A/B)', 'Duplicate as installed spare, e.g. P-101A / P-101B', function()
				{
					if (inDialog)
					{
						ui.hideDialog();
					}

					ProcessDraw.Actions.addSpare(ui, cell);
				});
			}

			addButton(buttons, 'Add field...', 'Add or remove custom data fields (Edit Data)', function()
			{
				if (inDialog)
				{
					ui.hideDialog();
				}

				graph.setSelectionCell(cell);
				ui.actions.get('editData').funct();
			});

			form.appendChild(buttons);
		};

		render();

		return form;
	};

	function focusField(container, key)
	{
		var input = container.querySelector('input[data-pd-field="' + key + '"]');

		if (input != null)
		{
			input.focus();
			input.setSelectionRange(input.value.length, input.value.length);
		}
	};

	function getSelectedPdCell(graph)
	{
		var cell = (graph.getSelectionCount() == 1) ? graph.getSelectionCell() : null;

		return (Tags.isPd(cell) && !graph.isEditing()) ? cell : null;
	};

	/**
	 * Adds the Engineering tab to the Format panel for a single selected
	 * ProcessDraw cell. It is the active tab until another tab is chosen.
	 */
	function installFormatTab(ui)
	{
		var formatRefresh = Format.prototype.immediateRefresh;
		var showTab = true;

		Format.prototype.immediateRefresh = function()
		{
			var active = document.activeElement;
			var focused = (active != null && this.container.contains(active)) ?
				active.getAttribute('data-pd-field') : null;

			formatRefresh.apply(this, arguments);

			var graph = this.editorUi.editor.graph;
			var cell = getSelectedPdCell(graph);
			var tabs = this.container.querySelector('.geFormatTitleContainer');

			if (cell == null || tabs == null || this.container.offsetWidth == 0)
			{
				return;
			}

			var labels = Array.prototype.slice.call(tabs.children);
			var panels = Array.prototype.filter.call(this.container.children, function(c)
			{
				return c != tabs;
			});

			var label = (labels.length > 0) ? labels[0].cloneNode(false) : document.createElement('div');
			label.className = 'geFormatTitle';
			label.innerText = '';
			var title = document.createElement('div');
			mxUtils.write(title, 'Data');
			label.appendChild(title);
			label.setAttribute('title', 'Engineering data');
			label.setAttribute('role', 'tab');
			tabs.insertBefore(label, tabs.firstChild);

			var panel = document.createElement('div');
			panel.className = 'geFormatContent';
			panel.style.display = 'none';
			panel.appendChild(createForm(this.editorUi, cell, false));
			this.container.appendChild(panel);

			function activate()
			{
				showTab = true;

				for (var i = 0; i < labels.length; i++)
				{
					labels[i].classList.remove('geActiveFormatTitle');
					labels[i].setAttribute('aria-selected', 'false');
				}

				for (var i = 0; i < panels.length; i++)
				{
					panels[i].style.display = 'none';
				}

				label.classList.add('geActiveFormatTitle');
				label.setAttribute('aria-selected', 'true');
				panel.style.display = '';
			};

			mxEvent.addListener(label, 'click', activate);

			// Other tabs: hide the Engineering tab and show their own panel
			for (var i = 0; i < labels.length; i++)
			{
				(function(index)
				{
					mxEvent.addListener(labels[index], 'click', function()
					{
						if (panel.style.display != 'none')
						{
							showTab = false;
							panel.style.display = 'none';
							label.classList.remove('geActiveFormatTitle');
							label.setAttribute('aria-selected', 'false');
							labels[index].classList.add('geActiveFormatTitle');
							labels[index].setAttribute('aria-selected', 'true');

							if (panels[index] != null)
							{
								panels[index].style.display = '';
							}
						}
					});
				})(i);
			}

			if (showTab)
			{
				activate();

				if (focused != null)
				{
					focusField(panel, focused);
				}
			}
		};
	};

	/**
	 * Double-click on a ProcessDraw symbol opens the data sheet. Alt+double-click
	 * keeps the normal behaviour (edit the label text).
	 */
	function installDoubleClick(ui)
	{
		var graph = ui.editor.graph;
		var graphDblClick = graph.dblClick;

		graph.dblClick = function(evt, cell)
		{
			if (this.isEnabled() && cell != null && Tags.isPd(cell) && !mxEvent.isAltDown(evt) &&
				Tags.attr(cell, 'pd_class') != 'annotation')
			{
				mxEvent.consume(evt);
				ProcessDraw.Properties.openDataSheet(ui, cell);
			}
			else
			{
				graphDblClick.apply(this, arguments);
			}
		};
	};

	ProcessDraw.Properties =
	{
		createForm: createForm,

		// Line changes go to all segments with the same line number
		applyToSegments: true,

		openDataSheet: function(ui, cell)
		{
			var form = createForm(ui, cell, true);
			var maxHeight = Math.max(200, Math.min(560, window.innerHeight - 220));
			form.style.maxHeight = maxHeight + 'px';
			form.style.overflowY = 'auto';
			var rows = form.querySelectorAll('.pdRow, .pdNote, .pdSection').length;
			var dlg = new CustomDialog(ui, form, null, null, mxResources.get('close'), null, null, true);
			ui.showDialog(dlg.container, 460, Math.min(maxHeight, rows * 25 + 110) + 90, true, true);
			focusField(form, 'tag');
		},

		install: function(ui)
		{
			installFormatTab(ui);
			installDoubleClick(ui);

			if (ui.format != null)
			{
				ui.format.refresh();
			}
		}
	};
})();
