/**
 * ProcessDraw developer self-test. Loaded only with the URL parameter pdtest=1
 * (DRAWIO_ENV=dev and {"pdtest": "1"} in urlParams.json in the working folder).
 * Runs on an empty diagram and logs "PDTEST PASS/FAIL ..." lines to the console.
 */
(function()
{
	async function run(ui)
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

			// ProcessDraw in the menubar, in front of Help, with one submenu per feature area
			if (ui.menubar != null)
			{
				var mb = Array.prototype.map.call(ui.menubar.container.children, function(e) { return e.innerText; });
				ok(mb.indexOf('ProcessDraw') >= 0 && mb.indexOf('ProcessDraw') == mb.indexOf(mxResources.get('help')) - 1,
					'ProcessDraw menu before Help', mb.join('|'));
				var pdItem = ui.menubar.container.children[mb.indexOf('ProcessDraw')];
				var helpItem = ui.menubar.container.children[mb.indexOf(mxResources.get('help'))];
				var pr = pdItem.getBoundingClientRect();
				var hr = helpItem.getBoundingClientRect();
				ok(pdItem.className == helpItem.className && Math.abs(pr.top - hr.top) < 2 && pr.right <= hr.left + 1 &&
					pr.width > 20 && pr.width < 200, 'ProcessDraw menu visible next to Help',
					JSON.stringify([pdItem.className, pr.left, pr.top, pr.width, hr.left, hr.top]));
			}

			ok(['pdMenuTags', 'pdMenuLines', 'pdMenuPfd', 'pdMenuSheets', 'pdMenuLists', 'pdMenuSettings']
				.every(function(n) { return ui.menus.get(n) != null; }) && ui.actions.get('pdQuickGuide') != null,
				'feature submenus and quick guide');

			// Menus and actions exist
			ok(ui.menus.get('processdraw') != null && ui.actions.get('pdRenumber') != null &&
				ui.actions.get('pdCheckTags') != null, 'menu and actions registered');

			// ---------------------------------------------------------- Line numbering (phase 3)
			var Ln = ProcessDraw.Lines;
			var parent = graph.getDefaultParent();

			function line(src, trg)
			{
				// Layer of the page that is shown now
				return graph.addEdge(L.createCell(L.getSymbol('pd_line_main')), graph.getDefaultParent(), src, trg);
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

			// ---------------------------------------------------------- PFD streams and H&MB (phase 5)
			var PF = ProcessDraw.PFD;
			ui.selectPage(page2);
			var pumpS = insert('pd_pump_centrifugal', 100, 400);
			var drumS = insert('pd_vessel_vertical', 400, 350);
			var eS1 = line(pumpS, drumS);
			var eS2 = line(drumS, pumpS);
			var m1 = PF.addMarkers(ui, [eS1])[0];
			var m2 = PF.addMarkers(ui, [eS2])[0];
			ok(T.attr(m1, 'stream_number') == '1' && T.attr(m2, 'stream_number') == '2', 'streams numbered 1, 2',
				T.attr(m1, 'stream_number') + ',' + T.attr(m2, 'stream_number'));
			ok(graph.model.getParent(m1) == eS1, 'marker sits on the line');
			T.setAttributes(graph, m1, {temperature: '45', pressure: '12.5', mass_flow: '25000'});
			var tbl = graph.importCells([L.createCell(L.getSymbol('pd_hmb_table'))], 0, 0, graph.getDefaultParent())[0];
			var html = T.attr(tbl, 'label');
			ok(html.indexOf('HEAT AND MATERIAL BALANCE') >= 0 && html.indexOf('25000') >= 0 && html.indexOf('°C') >= 0,
				'table filled on insert', [html.indexOf('HEAT AND MATERIAL BALANCE'), html.indexOf('25000'), html.indexOf('°C'), html.match(/Temperature<\/td><td[^>]*>([^<]*)/)].join(' | '));
			ok(html.indexOf('Viscosity') < 0, 'empty rows hidden');
			T.setAttributes(graph, m1, {temperature: '60'});
			ok(T.attr(tbl, 'label').indexOf('>60<') >= 0, 'table follows stream change');
			ui.editor.undoManager.undo();
			ok(T.attr(m1, 'temperature') == '45' && T.attr(tbl, 'label').indexOf('>45<') >= 0 &&
				T.attr(tbl, 'label').indexOf('>60<') < 0, 'undo restores stream and table together');
			var dupM = graph.moveCells([m1], 10, 10, true, eS1)[0];
			ok(T.attr(dupM, 'stream_number') == '3', 'copied marker gets new number', T.attr(dupM, 'stream_number'));
			graph.removeCells([dupM]);

			T.setSettings(ui, {components: 'Methane\nEthane'});
			PF.ensureComponents(ui, m1);
			ok(m1.value.hasAttribute('comp_Methane'), 'component fields added');
			T.setAttributes(graph, m1, {comp_Methane: '0.85'});
			ok(T.attr(tbl, 'label').indexOf('Methane') >= 0 && T.attr(tbl, 'label').indexOf('mol frac') >= 0,
				'component row in table');
			ok(!graph.isCellEditable(tbl), 'table not editable in place');

			// H&MB editor: paste a block from Excel into the first cell
			PF.openEditor(ui, tbl);
			var first = document.querySelector('.geDialog input[data-row="0"][data-col="0"]');
			var dt = new DataTransfer();
			dt.setData('text/plain', 'Feed\tReturn\n50\t35\n');
			first.dispatchEvent(new ClipboardEvent('paste', {clipboardData: dt, bubbles: true, cancelable: true}));
			var okBtn = Array.prototype.filter.call(document.querySelectorAll('.geDialog button'),
				function(b) { return b.innerText == mxResources.get('apply'); })[0];
			okBtn.click();
			ok(T.attr(m1, 'description') == 'Feed' && T.attr(m2, 'description') == 'Return' &&
				T.attr(m1, 'temperature') == '50' && T.attr(m2, 'temperature') == '35', 'paste block into editor',
				[T.attr(m1, 'description'), T.attr(m2, 'description'), T.attr(m1, 'temperature'), T.attr(m2, 'temperature')].join(','));
			ok(T.attr(tbl, 'label').indexOf('Return') >= 0, 'table updated after editor');

			// Equipment summary follows the equipment data
			T.setAttributes(graph, drumS, {service: 'Flash Drum', diameter: '1200', length_tt: '3600',
				design_pressure: '12', design_temperature: '120'});
			var sum = PF.addSummaries(ui, [drumS])[0];
			var sl = T.attr(sum, 'label');
			ok(sl.indexOf(tag(drumS)) >= 0 && sl.indexOf('FLASH DRUM') >= 0 && sl.indexOf('ID 1200 x 3600') >= 0 &&
				sl.indexOf('12 barg @ 120') >= 0, 'equipment summary text', sl);
			T.setAttributes(graph, drumS, {design_pressure: '16'});
			ok(T.attr(sum, 'label').indexOf('16 barg') >= 0, 'summary follows equipment change');
			ui.selectPage(page1);

			// ---------------------------------------------------------- Lists and project check (phase 6)
			var LS = ProcessDraw.Lists;
			var sheets = LS.getSheets(ui);
			var names = sheets.map(function(s) { return s.name; });
			ok(names.join(',') == 'Equipment,Lines,Instruments,Valves,Specials,Streams,Check', 'workbook sheets', names.join(','));
			var eqList = sheets[0];
			ok(eqList.rows.some(function(r) { return r[0] == tag(p1); }) &&
				eqList.columns.some(function(c) { return c.header == 'Design pressure [barg]'; }), 'equipment list with units');
			var lineRows = sheets[1].rows.filter(function(r) { return r[0] == ln(e1); });
			ok(lineRows.length == 1 && lineRows[0][12] == Ln.getSegments(ui, ln(e1)).length && lineRows[0][12] >= 2,
				'line list merges segments', JSON.stringify(lineRows));
			ok(lineRows.length == 1 && lineRows[0][9] == tag(pumpL), 'line list From', lineRows.length ? lineRows[0][9] : '');
			var instRows = sheets[2].rows;
			ok(instRows.some(function(r) { return r[0] == 'PDIT-205' && r[3] == 'Pressure Differential Indicating Transmitter'; }),
				'instrument index with ISA description');
			ok(instRows.some(function(r) { return r[0] == tag(cv); }), 'control valve in instrument index');
			ok(sheets[3].rows.some(function(r) { return r[0] == '' && r[1] == 'Gate Valve'; }), 'untagged gate valve in valve list');

			var issues = LS.runChecks(ui);
			var has = function(cell, text) { return issues.some(function(i) { return i.cell == cell && i.problem.indexOf(text) >= 0; }); };
			ok(has(loose, 'Line end not connected'), 'check: dangling line');
			ok(has(lonely, 'Not linked'), 'check: unlinked connector');
			ok(has(cv, 'Fail position missing') && has(gv, 'ends connected'), 'check: valve data and open ends');
			ok(has(e3, 'incomplete'), 'check: incomplete line number');

			var wnd = LS.showCheckWindow(ui);
			var rowsShown = wnd.window.div.querySelectorAll('span[title], div[title="Show this item"]').length;
			ok(wnd.window.isVisible() && rowsShown == issues.length, 'check window lists issues', rowsShown + ' / ' + issues.length);
			var firstRow = wnd.window.div.querySelector('div[title="Show this item"]');
			firstRow.click();
			ok(graph.getSelectionCell() == issues[0].cell, 'click selects the item');
			wnd.window.setVisible(false);

			await new Promise(function(resolve)
			{
				ProcessDraw.Xlsx.toBase64(sheets, {title: 'selftest'}, function(data)
				{
					ok(atob(data).substring(0, 2) == 'PK', 'xlsx zipped');
					console.log('PDTEST XLSX ' + data);
					resolve();
				}, function(e)
				{
					ok(false, 'xlsx zipped', e.message);
					resolve();
				});
			});

			// ---------------------------------------------------------- Drawing sheets (phase 7)
			var SH = ProcessDraw.Sheet;
			ui.selectPage(page1);
			SH.insertFrame(ui, 'A3');
			var sc = SH.findSheetCells(ui);
			ok(graph.pageFormat.width == 1654 && graph.pageFormat.height == 1169, 'A3 page format',
				graph.pageFormat.width + 'x' + graph.pageFormat.height);
			ok(sc.frame != null && sc.titleblock != null && sc.revtable != null, 'frame, title block, revision table');
			var tb = T.attr(sc.titleblock, 'label');
			ok(tb.indexOf('1234-PID-001') >= 0 && tb.indexOf('1 OF ' + ui.pages.length) >= 0 && tb.indexOf('FEED') >= 0,
				'title block filled', tb.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').substring(0, 200));
			var fstyle = graph.getCellStyle(sc.frame);
			var innerRight = 1654 - parseFloat(fstyle.pdMarginRight) - parseFloat(fstyle.pdZone);
			var innerBottom = 1169 - parseFloat(fstyle.pdMarginBottom) - parseFloat(fstyle.pdZone);
			var tg = sc.titleblock.geometry;
			ok(Math.abs(tg.x + tg.width - innerRight) < 1 && Math.abs(tg.y + tg.height - innerBottom) < 1 && tg.height > 60,
				'title block in bottom-right corner', JSON.stringify([tg.x, tg.y, tg.width, tg.height, innerRight, innerBottom]));
			ok(Math.abs(sc.revtable.geometry.y + sc.revtable.geometry.height - tg.y) < 1, 'revision table above title block');
			ok(graph.isCellLocked(sc.frame) && !graph.isCellMovable(sc.titleblock), 'frame locked');

			ok(SH.nextRevision([], '') == 'A' && SH.nextRevision([{rev: 'H'}], '') == 'J' &&
				SH.nextRevision([{rev: 'B'}], 'ISSUED FOR CONSTRUCTION') == '0' && SH.nextRevision([{rev: '0'}], '') == '1',
				'next revision A, J (no I), 0 at IFC, 1');
			T.setPageAttributes(ui, page1, {pd_revisions: JSON.stringify([{rev: 'A', date: '2026-11-01',
				description: 'Issued for review', by: 'FN', chk: 'AB', app: 'CD'}]), pd_sheet_status: 'ISSUED FOR REVIEW'});
			var rt = T.attr(sc.revtable, 'label');
			ok(rt.indexOf('Issued for review') >= 0 && T.attr(sc.titleblock, 'label').indexOf('ISSUED FOR REVIEW') >= 0,
				'revision table and status follow sheet data');
			var revH = sc.revtable.geometry.height;
			T.setPageAttributes(ui, page1, {pd_revisions: JSON.stringify([{rev: 'A', date: '2026-11-01', description: 'Issued for review'},
				{rev: 'B', date: '2026-11-14', description: 'Issued for approval'}])});
			ok(sc.revtable.geometry.height > revH && Math.abs(sc.revtable.geometry.y + sc.revtable.geometry.height - tg.y) < 1,
				'revision table grows upwards');
			ui.editor.undoManager.undo();
			ok(T.attr(sc.revtable, 'label').indexOf('Issued for approval') < 0 && sc.revtable.geometry.height == revH,
				'undo restores revision table');
			T.setSettings(ui, {projectName: 'Stabiliser Revamp'});
			ok(T.attr(sc.titleblock, 'label').indexOf('Stabiliser Revamp') >= 0, 'title block follows project data');

			var tri = insert('pd_revtriangle', 300, 300);
			ok(T.attr(tri, 'rev') == 'A', 'revision triangle gets current revision', T.attr(tri, 'rev'));
			var stp = insert('pd_stamp_ifc', 400, 300);
			ok(T.attr(stp, 'date') == new Date().toISOString().substring(0, 10), 'stamp dated today', T.attr(stp, 'date'));
			ok(graph.view.getState(insert('pd_revcloud', 500, 300)).shape.constructor !== mxRectangleShape, 'revision cloud shape');

			graph.dblClick(new MouseEvent('dblclick'), sc.titleblock);
			ok(document.querySelector('.geDialog') != null && document.querySelector('.geDialog').innerText.indexOf('Revisions') >= 0,
				'double-click title block opens sheet dialog');
			ui.hideDialog();

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
