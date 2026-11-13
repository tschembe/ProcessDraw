/**
 * ProcessDraw - PFD and P&ID extension for the draw.io editor.
 *
 * Entry point, loaded from js/PostConfig.js. All ProcessDraw code lives in
 * js/processdraw/ so the upstream draw.io sources stay as untouched as possible.
 */
(function()
{
	var ProcessDraw = window.ProcessDraw = window.ProcessDraw || {};

	ProcessDraw.VERSION = '0.1.0';
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

		console.log(ProcessDraw.NAME + ' ' + ProcessDraw.VERSION + ' loaded');
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

	register();
})();
