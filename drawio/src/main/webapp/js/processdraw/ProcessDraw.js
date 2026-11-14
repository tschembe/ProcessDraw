/**
 * ProcessDraw - PFD and P&ID extension for the draw.io editor.
 *
 * Entry point, loaded from js/PostConfig.js. All ProcessDraw code lives in
 * js/processdraw/ so the upstream draw.io sources stay as untouched as possible.
 */
(function()
{
	var ProcessDraw = window.ProcessDraw = window.ProcessDraw || {};

	ProcessDraw.VERSION = '0.6.0';
	ProcessDraw.NAME = 'ProcessDraw';

	// Window title and other places that show the application name
	if (typeof Editor !== 'undefined')
	{
		Editor.prototype.appName = ProcessDraw.NAME;
	}

	if (typeof mxResources !== 'undefined')
	{
		mxResources.parse('processDrawAbout=About ProcessDraw...');
	}

	ProcessDraw.showAbout = function(ui)
	{
		var div = document.createElement('div');
		div.style.textAlign = 'center';
		div.style.padding = '8px';

		var title = document.createElement('h2');
		title.style.margin = '0 0 8px 0';
		mxUtils.write(title, ProcessDraw.NAME + ' ' + ProcessDraw.VERSION);
		div.appendChild(title);

		var p1 = document.createElement('p');
		mxUtils.write(p1, 'PFD and P&ID editor for process engineers.');
		div.appendChild(p1);

		var p2 = document.createElement('p');
		p2.style.fontSize = '11px';
		p2.style.color = 'gray';
		mxUtils.write(p2, 'Based on draw.io ' + EditorUi.VERSION +
			' (Apache 2.0) and drawio-desktop (GPL v3).');
		div.appendChild(p2);

		ui.showDialog(new CustomDialog(ui, div, null, null, mxResources.get('close')).container,
			360, 160, true, true);
	};

	ProcessDraw.init = function(ui)
	{
		ProcessDraw.ui = ui;
		ui.editor.appName = ProcessDraw.NAME;

		if (typeof ui.updateDocumentTitle === 'function')
		{
			ui.updateDocumentTitle();
		}

		ui.actions.addAction('processDrawAbout', function()
		{
			ProcessDraw.showAbout(ui);
		});

		var helpMenu = ui.menus.get('help');

		if (helpMenu != null)
		{
			var helpFunct = helpMenu.funct;

			helpMenu.funct = function(menu, parent)
			{
				helpFunct.apply(this, arguments);
				ui.menus.addMenuItems(menu, ['-', 'processDrawAbout'], parent);
			};
		}

		var modules = [['tags', ProcessDraw.Tags], ['lines', ProcessDraw.Lines],
			['properties', ProcessDraw.Properties], ['actions', ProcessDraw.Actions],
			['project', ProcessDraw.Project], ['pfd', ProcessDraw.PFD], ['lists', ProcessDraw.Lists]];

		for (var i = 0; i < modules.length; i++)
		{
			try
			{
				if (modules[i][1] != null)
				{
					modules[i][1].install(ui);
				}
			}
			catch (e)
			{
				console.error('ProcessDraw: ' + modules[i][0] + ' failed', e);
			}
		}

		// Sidebar was created before the palette hook was installed
		if (ui.sidebar != null && ui.sidebar.palettes['pdVessels'] == null)
		{
			ui.sidebar.refresh();
		}

		var found = 0;
		var symbols = 0;

		for (var i = 0; i < ProcessDraw.Library.palettes.length; i++)
		{
			found += (ui.sidebar != null && ui.sidebar.palettes[ProcessDraw.Library.palettes[i].id] != null) ? 1 : 0;
			symbols += ProcessDraw.Library.palettes[i].items.length;
		}

		console.log(ProcessDraw.NAME + ' ' + ProcessDraw.VERSION + ' loaded: ' + found + '/' +
			ProcessDraw.Library.palettes.length + ' palettes in sidebar, ' + symbols + ' symbols');
	};

	// Waits for the editor UI. Draw.loadPlugin queues the callback before the
	// UI exists and calls it directly afterwards.
	function register()
	{
		if (window.Draw != null && typeof window.Draw.loadPlugin === 'function')
		{
			window.Draw.loadPlugin(ProcessDraw.init);
		}
		else
		{
			window.setTimeout(register, 50);
		}
	};

	// Module files, loaded in this order (dynamic scripts have no guaranteed order)
	var MODULES = ['pd-stencil.js', 'pd-shapes.js', 'pd-library.js', 'pd-symbols-equipment.js',
		'pd-symbols-piping.js', 'pd-symbols-instruments.js', 'pd-sidebar.js', 'pd-tags.js', 'pd-fields.js',
		'pd-properties.js', 'pd-actions.js', 'pd-lines.js', 'pd-project.js', 'pd-pfd.js', 'pd-xlsx.js', 'pd-lists.js'];

	// Developer self-test: DRAWIO_ENV=dev with {"pdtest": "1"} in urlParams.json
	if (urlParams['pdtest'] == '1')
	{
		MODULES.push('pd-selftest.js');
	}

	function loadModules(index, done)
	{
		if (index >= MODULES.length)
		{
			done();
		}
		else
		{
			mxscript('js/processdraw/' + MODULES[index], function()
			{
				loadModules(index + 1, done);
			}, null, null, true, function()
			{
				console.error('ProcessDraw: could not load ' + MODULES[index]);
				loadModules(index + 1, done);
			});
		}
	};

	loadModules(0, function()
	{
		try
		{
			ProcessDraw.installSidebar();
		}
		catch (e)
		{
			console.error('ProcessDraw: sidebar hook failed', e);
		}

		register();
	});
})();
