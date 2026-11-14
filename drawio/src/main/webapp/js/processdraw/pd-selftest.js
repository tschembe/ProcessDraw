/**
 * ProcessDraw developer self-test. Loaded only with the URL parameter pdtest=1
 * (DRAWIO_ENV=dev and {"pdtest": "1"} in urlParams.json in the working folder).
 * Runs on an empty diagram and logs "PDTEST PASS/FAIL ..." lines to the console.
 */
(function()
{
	function run(ui)
	{
		var T = ProcessDraw.Tags;
		var L = ProcessDraw.Library;
		var graph = ui.editor.graph;
		var passed = 0;
		var failed = 0;

		function ok(cond, name, detail)
		{
			if (cond)
			{
				passed++;
				console.log('PDTEST PASS ' + name);
			}
			else
			{
				failed++;
				console.log('PDTEST FAIL ' + name + ((detail != null) ? ' :: ' + detail : ''));
			}
		};

		function insert(id, x, y)
		{
			var cell = L.createCell(L.getSymbol(id));
			cell.geometry.x = x;
			cell.geometry.y = y;

			return graph.importCells([cell], 0, 0, graph.getDefaultParent())[0];
		};

		function tag(cell)
		{
			return T.attr(cell, 'tag');
		};

		try
		{
			// Auto numbering on insert
			var p1 = insert('pd_pump_centrifugal', 100, 100);
			var p2 = insert('pd_pump_centrifugal', 200, 100);
			var v1 = insert('pd_vessel_vertical', 300, 100);
			ok(tag(p1) == 'P-101', 'first pump P-101', tag(p1));
			ok(tag(p2) == 'P-102', 'second pump P-102', tag(p2));
			ok(tag(v1) == 'V-101', 'vessel V-101', tag(v1));

			// Manual valve stays untagged, control valve is numbered
			var gv = insert('pd_valve_gate', 100, 300);
			var cv = insert('pd_valve_control', 200, 300);
			ok(tag(gv) == '', 'gate valve untagged', tag(gv));
			ok(tag(cv) == 'FV-101', 'control valve FV-101', tag(cv));

			// Instruments get loop numbers
			var i1 = insert('pd_inst_shared_main', 100, 400);
			ok(tag(i1) == 'FIC-101' && T.attr(i1, 'loop') == '101' && T.attr(i1, 'function') == 'FIC',
				'instrument FIC-101', tag(i1));

			// Copy / duplicate gets a new tag
			var dup = graph.duplicateCells([p1])[0];
			ok(tag(dup) == 'P-103', 'duplicate becomes P-103', tag(dup));
			ok(tag(p1) == 'P-101', 'original keeps P-101', tag(p1));

			// Typing an instrument tag splits function and loop
			T.setTag(ui, i1, 'pdit 205');
			ok(tag(i1) == 'PDIT-205' && T.attr(i1, 'function') == 'PDIT' && T.attr(i1, 'loop') == '205',
				'setTag splits instrument tag', tag(i1) + ' ' + T.attr(i1, 'function') + ' ' + T.attr(i1, 'loop'));
			var i2 = insert('pd_inst_discrete_field', 200, 400);
			ok(tag(i2) == 'TI-206', 'next loop after 205', tag(i2));

			// Duplicate detection
			T.setTag(ui, p2, 'P-101');
			ok(T.findTag(ui, 'P-101', p1).length == 1, 'findTag finds duplicate');
			var check = T.check(ui);
			ok(check.duplicates['P-101'] != null && check.duplicates['P-101'].length == 2, 'check lists duplicate');

			// Renumber selection from 201 in position order (the duplicate sits next to p1)
			var n = T.renumber(ui, [p1, p2, dup], 201);
			ok(n == 3 && tag(p1) == 'P-201' && tag(dup) == 'P-202' && tag(p2) == 'P-203', 'renumber from 201',
				[tag(p1), tag(p2), tag(dup)].join(','));

			// Spare A/B
			ProcessDraw.Actions.addSpare(ui, v1);
			var spare = graph.getSelectionCell();
			ok(tag(v1) == 'V-101A' && tag(spare) == 'V-101B', 'spare A/B', tag(v1) + ' ' + tag(spare));

			// Settings round trip and padding
			T.setSettings(ui, {digits: 4, start: 1, separator: '-'});
			var s = T.getSettings(ui);
			ok(s.digits == 4 && s.start == 1, 'settings saved', JSON.stringify(s));
			var k1 = insert('pd_compressor_centrifugal', 400, 100);
			ok(tag(k1) == 'K-0001', 'K-0001 with 4 digits from 1', tag(k1));
			T.setSettings(ui, {autonumber: false});
			var k2 = insert('pd_compressor_centrifugal', 500, 100);
			ok(tag(k2) == 'K-???', 'auto numbering off', tag(k2));
			T.setSettings(ui, {autonumber: true, digits: 3, start: 101});

			// Undo of an insert removes the cell and its numbering in one step
			var before = graph.model.getChildCount(graph.getDefaultParent());
			var p9 = insert('pd_pump_centrifugal', 600, 100);
			ui.editor.undoManager.undo();
			ok(graph.model.getChildCount(graph.getDefaultParent()) == before && graph.model.getParent(p9) == null,
				'undo insert in one step');

			// Engineering tab in the Format panel
			graph.setSelectionCell(p1);
			ui.format.immediateRefresh();
			var titles = Array.prototype.map.call(ui.format.container.querySelectorAll('.geFormatTitle'),
				function(e) { return e.innerText; });
			var tagInput = ui.format.container.querySelector('input[data-pd-field="tag"]');
			ok(titles[0] == 'Data', 'Data tab first', titles.join('|'));
			ok(tagInput != null && tagInput.value == 'P-201' && tagInput.offsetWidth > 0, 'tag field visible',
				(tagInput != null) ? tagInput.value + ' ' + tagInput.offsetWidth : 'none');
			var fields = ui.format.container.querySelectorAll('.pdForm input').length;
			ok(fields >= 8, 'pump form has data fields', fields);

			// Editing the tag field commits through the form
			tagInput.value = 'P-301';
			tagInput.dispatchEvent(new Event('change'));
			ok(tag(p1) == 'P-301', 'tag field commits', tag(p1));

			// Data sheet dialog on double-click
			graph.dblClick(new MouseEvent('dblclick'), p2);
			var dlgForm = document.querySelector('.geDialog .pdForm');
			ok(dlgForm != null, 'double-click opens data sheet');
			ui.hideDialog();

			// Menus and actions exist
			ok(ui.menus.get('processdraw') != null && ui.actions.get('pdRenumber') != null &&
				ui.actions.get('pdCheckTags') != null, 'menu and actions registered');

			// ---------------------------------------------------------- Line numbering (phase 3)
			var Ln = ProcessDraw.Lines;
			var parent = graph.getDefaultParent();

			function line(src, trg)
			{
				return graph.addEdge(L.createCell(L.getSymbol('pd_line_main')), parent, src, trg);
			};

			function ln(edge)
			{
				return T.attr(edge, 'line_number');
			};

			var pumpL = insert('pd_pump_centrifugal', 100, 700);
			var valveL = insert('pd_valve_gate', 250, 700);
			var drumL = insert('pd_vessel_vertical', 400, 650);
			var e1 = line(pumpL, valveL);
			ok(T.attr(e1, 'sequence') == '1001' && ln(e1) == '?-?-1001-?', 'new line gets sequence 1001', ln(e1));
			ok(T.attr(e1, 'from') == tag(pumpL), 'from filled with pump tag', T.attr(e1, 'from'));
			var e2 = line(valveL, drumL);
			ok(ln(e2) == ln(e1) && T.attr(e2, 'sequence') == '1001', 'line continues through valve', ln(e2));
			ok(T.attr(e2, 'to') == tag(drumL), 'to filled with vessel tag', T.attr(e2, 'to'));
			var n = Ln.update(ui, e1, {size: '4"', service_code: 'P', pipe_class: 'A1A'}, true);
			ok(n == 2 && ln(e1) == '4"-P-1001-A1A' && ln(e2) == '4"-P-1001-A1A', 'update applies to both segments',
				n + ' ' + ln(e1) + ' ' + ln(e2));
			Ln.update(ui, e1, {insulation: 'H'}, false);
			ok(ln(e1) == '4"-P-1001-A1A-H' && ln(e2) == '4"-P-1001-A1A', 'single segment update', ln(e1) + ' ' + ln(e2));
			Ln.update(ui, e1, {insulation: ''}, false);
			var e3 = line(drumL, pumpL);
			ok(T.attr(e3, 'sequence') == '1002', 'next line 1002', T.attr(e3, 'sequence'));
			Ln.split(ui, [e2]);
			ok(T.attr(e2, 'sequence') == '1003' && T.attr(e1, 'sequence') == '1001', 'split gives new sequence',
				T.attr(e2, 'sequence'));
			Ln.join(ui, [e1, e2]);
			ok(ln(e2) == ln(e1), 'join copies line', ln(e2));
			Ln.setManualNumber(ui, e3, 'XYZ-1', false);
			Ln.update(ui, e3, {size: '8"'}, false);
			ok(ln(e3) == 'XYZ-1' && T.attr(e3, 'pd_line_manual') == '1', 'typed-in number kept', ln(e3));
			Ln.useAutoNumber(ui, e3, false);
			ok(ln(e3) == '8"-?-1002-?', 'use pattern again', ln(e3));
			T.setSettings(ui, {linePattern: '{service_code}{sequence}'});
			Ln.renumberAll(ui);
			ok(ln(e1) == 'P1001', 'pattern change renumbers', ln(e1));
			T.setSettings(ui, {linePattern: T.DEFAULTS.linePattern});
			Ln.renumberAll(ui);
			ok(ln(e1) == '4"-P-1001-A1A', 'default pattern restored', ln(e1));

			// Line dropped without terminals is numbered when it gets connected
			var loose = graph.importCells([L.createCell(L.getSymbol('pd_line_secondary'))], 0, 0, parent)[0];
			ok(T.attr(loose, 'sequence') == '', 'loose line not numbered');
			graph.connectCell(loose, pumpL, true);
			ok(T.attr(loose, 'sequence') == '1003', 'numbered when connected (1003 is free again after join)', T.attr(loose, 'sequence'));

			// Data tab for a line
			graph.setSelectionCell(e1);
			ui.format.immediateRefresh();
			var lnInput = ui.format.container.querySelector('input[data-pd-field="line_number"]');
			ok(lnInput != null && lnInput.value == '4"-P-1001-A1A', 'line number field in Data tab',
				(lnInput != null) ? lnInput.value : 'none');
			var svc = ui.format.container.querySelector('input[data-pd-field="service_code"]');
			var list = (svc != null) ? document.getElementById(svc.getAttribute('list')) : null;
			ok(list != null && list.options.length == 18, 'service code suggestions', (list != null) ? list.options.length : 'none');

			// ---------------------------------------------------------- Multi-sheet project (phase 4)
			var Pr = ProcessDraw.Project;
			var page1 = ui.currentPage;
			T.setSettings(ui, {projectNumber: '1234', docPrefix: '1234-PID-'});
			ok(T.getSettings(ui).docPrefix == '1234-PID-', 'project settings saved');
			Pr.setSheet(ui, page1, {number: '001', drawing: '1234-PID-001', title: 'Feed', type: 'P&ID'});
			ok(Pr.getSheetLabel(ui, page1) == '1234-PID-001', 'sheet label from drawing number',
				Pr.getSheetLabel(ui, page1));

			var pumpX = insert('pd_pump_centrifugal', 100, 900);
			var outX = insert('pd_offpage_out', 300, 880);
			var lineX = line(pumpX, outX);
			Ln.update(ui, lineX, {size: '3"', service_code: 'P', pipe_class: 'A1A'}, true);

			var page2 = ui.insertPage();
			ok(page2 != null && ui.pages.length >= 2, 'second page created');
			Pr.setSheet(ui, page2, {number: '002', drawing: '1234-PID-002', title: 'Pumps'});
			ok(Pr.getSheet(ui, page2).title == 'Pumps', 'sheet data on other page');
			ui.selectPage(page1);

			var partner = Pr.link(ui, outX, page2, null);
			ok(ui.currentPage == page2, 'link shows partner page');
			ok(T.attr(partner, 'connector_id') == T.attr(outX, 'connector_id') && T.attr(partner, 'direction') == 'from',
				'partner linked', T.attr(partner, 'connector_id') + ' ' + T.attr(partner, 'direction'));
			ok(T.attr(partner, 'sheet') == '1234-PID-001' && T.attr(outX, 'sheet') == '1234-PID-002',
				'sheet labels filled', T.attr(partner, 'sheet') + ' / ' + T.attr(outX, 'sheet'));

			var drumY = insert('pd_vessel_vertical', 400, 100);
			var lineY = line(partner, drumY);
			ok(ln(lineY) == ln(lineX) && ln(lineY) != '', 'line continues on the next sheet', ln(lineY) + ' / ' + ln(lineX));
			ok(T.findTag(ui, tag(drumY), drumY).length == 0, 'tags stay unique across sheets', tag(drumY));

			Pr.goToPartner(ui, partner);
			ok(ui.currentPage == page1 && graph.getSelectionCell() == outX, 'double-click target: jump to partner');

			Pr.setSheet(ui, page2, {drawing: '1234-PID-010'});
			Pr.updateConnectors(ui);
			ok(T.attr(outX, 'sheet') == '1234-PID-010', 'connector follows changed drawing number', T.attr(outX, 'sheet'));
			ok(Pr.checkConnectors(ui).length == 0, 'linked pair passes check', JSON.stringify(Pr.checkConnectors(ui).map(function(c) { return c.problem; })));
			var lonely = insert('pd_offpage_in', 600, 900);
			var problems = Pr.checkConnectors(ui);
			ok(problems.length == 1 && problems[0].cell == lonely && problems[0].problem == 'not linked', 'unlinked connector reported');

			// ISA decoding
			ok(T.decodeIsa('FIC') == 'Flow Indicating Controller', 'ISA decode');
		}
		catch (e)
		{
			failed++;
			console.log('PDTEST FAIL exception :: ' + e.message + ' ' + e.stack);
		}

		console.log('PDTEST DONE passed=' + passed + ' failed=' + failed);
	};

	window.setTimeout(function()
	{
		if (ProcessDraw.ui != null)
		{
			run(ProcessDraw.ui);
		}
		else
		{
			Draw.loadPlugin(function(ui)
			{
				window.setTimeout(function() { run(ui); }, 500);
			});
		}
	}, 1500);
})();
