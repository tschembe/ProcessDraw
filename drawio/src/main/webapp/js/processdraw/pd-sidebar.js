/**
 * ProcessDraw sidebar: adds the ProcessDraw palettes above the General palette.
 * Hooking addGeneralPalette keeps them in place when the sidebar is refreshed
 * (theme change, Edit > Shapes).
 */
(function()
{
	var ProcessDraw = window.ProcessDraw = window.ProcessDraw || {};
	var Library = ProcessDraw.Library;

	var ORDER = ['pdVessels', 'pdTanks', 'pdHeatTransfer', 'pdRotating', 'pdSeparation', 'pdValves',
		'pdFittings', 'pdLines', 'pdInstrumentsIsa', 'pdPrimaryElements', 'pdInstrumentsIec', 'pdAnnotations', 'pdPfd'];

	function getOrderedPalettes()
	{
		var result = Library.palettes.slice();

		result.sort(function(a, b)
		{
			var ia = mxUtils.indexOf(ORDER, a.id);
			var ib = mxUtils.indexOf(ORDER, b.id);

			return ((ia < 0) ? ORDER.length : ia) - ((ib < 0) ? ORDER.length : ib);
		});

		return result;
	};

	function createEntry(sidebar, sym)
	{
		var tags = 'processdraw ' + sym.name + ' ' + (sym.tags || '') + ' ' + sym.cls + ' ' +
			(sym.prefix || '') + ' ' + (sym.standard || '');

		return sidebar.addEntry(tags.toLowerCase(), function()
		{
			var cell = Library.createCell(sym);

			if (sym.edge)
			{
				return sidebar.createEdgeTemplateFromCells([cell], sym.w, sym.h, sym.name, false);
			}
			else
			{
				return sidebar.createVertexTemplateFromCells([cell], sym.w, sym.h, sym.name,
					sym.cls == 'instrument' || sym.cls == 'offpage' || sym.labelInside == true);
			}
		});
	};

	ProcessDraw.addPalettes = function(sidebar)
	{
		var palettes = getOrderedPalettes();

		if (typeof sidebar.setCurrentSearchEntryLibrary === 'function')
		{
			sidebar.setCurrentSearchEntryLibrary();
		}

		for (var i = 0; i < palettes.length; i++)
		{
			var pal = palettes[i];
			var fns = [];

			for (var j = 0; j < pal.items.length; j++)
			{
				try
				{
					fns.push(createEntry(sidebar, pal.items[j]));
				}
				catch (e)
				{
					console.error('ProcessDraw: symbol ' + pal.items[j].id + ' failed', e);
				}
			}

			sidebar.addPaletteFunctions(pal.id, pal.title, pal.expanded, fns);
		}
	};

	/**
	 * Installs the sidebar hook. Returns true if the sidebar must be refreshed
	 * because it was created before the hook was installed.
	 */
	ProcessDraw.installSidebar = function()
	{
		if (Sidebar.prototype.pdInstalled)
		{
			return false;
		}

		Sidebar.prototype.pdInstalled = true;
		var addGeneralPalette = Sidebar.prototype.addGeneralPalette;

		Sidebar.prototype.addGeneralPalette = function()
		{
			try
			{
				ProcessDraw.addPalettes(this);
			}
			catch (e)
			{
				console.error('ProcessDraw: adding palettes failed', e);
			}

			return addGeneralPalette.apply(this, arguments);
		};

		return true;
	};
})();
