/**
 * ProcessDraw simulator import: reads a stream table exported or copied from
 * a process simulator (Aspen HYSYS workbook, DWSIM stream table, any CSV / TSV /
 * XLSX with one column per stream) and writes the values into the stream markers.
 *
 * Properties are recognised by name (temperature, pressure, flows, vapour
 * fraction, MW, density, viscosity, component fractions), units are read from
 * a unit column or from the label ("Temperature [C]") and converted to the
 * project unit system (pressure to gauge). Streams are matched by number or
 * name. Everything can be corrected in the preview before it is applied.
 *
 * The pure functions (convert, matchRow, analyse, formatValue) are covered by
 * tools/test-simimport.cjs.
 */
(function()
{
	var ProcessDraw = window.ProcessDraw = window.ProcessDraw || {};

	var ATM_BAR = 1.01325;
	var PSI_BAR = 0.0689476;

	// Unit -> factor to the base unit (and offset for temperatures)
	var UNITS =
	{
		temperature: {c: [1, 0], degc: [1, 0], celsius: [1, 0], k: [1, -273.15], kelvin: [1, -273.15],
			f: [5 / 9, -32 * 5 / 9], degf: [5 / 9, -32 * 5 / 9], r: [5 / 9, -273.15]},
		// Base: bar absolute; gauge units are marked with g
		pressure: {bar: 1, bara: 1, barg: 'g1', mbar: 0.001, kpa: 0.01, kpaa: 0.01, kpag: 'g0.01', mpa: 10, mpaa: 10,
			mpag: 'g10', pa: 1e-5, psi: PSI_BAR, psia: PSI_BAR, psig: 'g' + PSI_BAR, atm: ATM_BAR,
			kgcm2: 0.980665, kgcm2a: 0.980665, kgcm2g: 'g0.980665', torr: 0.00133322, mmhg: 0.00133322},
		mass_flow: {kgh: 1, kgs: 3600, kgmin: 60, kgd: 1 / 24, th: 1000, td: 1000 / 24, lbh: 0.453592,
			lbs: 1632.93, gs: 3.6, tonneh: 1000},
		molar_flow: {kmolh: 1, kgmoleh: 1, kgmolh: 1, kmols: 3600, mols: 3.6, molh: 0.001, kmold: 1 / 24,
			lbmolh: 0.453592, lbmoleh: 0.453592, lbmolhr: 0.453592},
		vol_flow: {m3h: 1, m3s: 3600, m3d: 1 / 24, ls: 3.6, lmin: 0.06, lh: 0.001, ft3h: 0.0283168,
			ft3s: 101.941, cfm: 1.69901, gpm: 0.227125, usgpm: 0.227125, bbld: 0.00662447, barreld: 0.00662447},
		std_gas_flow: {sm3h: 1, sm3d: 1 / 24, nm3h: 1, nm3d: 1 / 24, mmscfd: 1179.87, mscfd: 1.17987,
			scfd: 1.17987e-3, scfh: 0.0283168, scfm: 1.69901},
		density: {kgm3: 1, gcm3: 1000, gl: 1, gml: 1000, lbft3: 16.0185},
		viscosity: {cp: 1, mpas: 1, pas: 1000, p: 100, poise: 100, cpoise: 1},
		fraction: {'': 1, frac: 1, fraction: 1, '%': 0.01, pct: 0.01, percent: 0.01}
	};

	// Target unit per system, as factor from the base unit
	var TARGET =
	{
		metric: {temperature: [1, 0], pressure: 1, mass_flow: 1, molar_flow: 1, vol_flow: 1, std_gas_flow: 1,
			density: 1, viscosity: 1},
		imperial: {temperature: [9 / 5, 32], pressure: 1 / PSI_BAR, mass_flow: 1 / 0.453592,
			molar_flow: 1 / 0.453592, vol_flow: 1 / 0.0283168, std_gas_flow: 1 / 1179.87, density: 1 / 16.0185,
			viscosity: 1}
	};

	var QUANTITY =
	{
		temperature: 'temperature', pressure: 'pressure', mass_flow: 'mass_flow', molar_flow: 'molar_flow',
		vol_flow: 'vol_flow', std_gas_flow: 'std_gas_flow', density: 'density', viscosity: 'viscosity',
		vapour_fraction: 'fraction'
	};

	var SYNONYMS =
	{
		methane: ['c1', 'ch4'], ethane: ['c2', 'c2h6'], propane: ['c3', 'c3h8'], nbutane: ['nc4', 'butane', 'n-c4'],
		ibutane: ['ic4', 'isobutane', 'i-c4'], npentane: ['nc5', 'pentane'], ipentane: ['ic5', 'isopentane'],
		nhexane: ['nc6', 'hexane', 'c6'], water: ['h2o'], nitrogen: ['n2'], carbondioxide: ['co2'],
		hydrogensulfide: ['h2s', 'hydrogensulphide'], hydrogen: ['h2'], oxygen: ['o2'], carbonmonoxide: ['co']
	};

	function norm(s)
	{
		return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
	};

	function unitKey(u)
	{
		return String(u || '').toLowerCase().replace(/°/g, 'deg').replace(/\^/g, '').replace(/³/g, '3')
			.replace(/²/g, '2').replace(/\(g\)/g, 'g').replace(/\(a\)/g, 'a').replace(/hr\b/g, 'h')
			.replace(/kgmole/g, 'kmol').replace(/[^a-z0-9%]/g, '');
	};

	/**
	 * Converts value from unit to the project unit system. Returns null if the
	 * unit is unknown. Pressures become gauge.
	 */
	function convert(value, unit, quantity, system)
	{
		var v = (typeof value === 'number') ? value : parseFloat(String(value).replace(/\s/g, '').replace(',', '.'));
		var table = UNITS[quantity];

		if (isNaN(v) || table == null)
		{
			return null;
		}

		var key = unitKey(unit);

		// Common spellings
		key = {degcelsius: 'c', degk: 'k', degf: 'f', centipoise: 'cp', kgm3h: 'kgh'}[key] || key;

		if (quantity == 'pressure' && key == '' )
		{
			return null;
		}

		var f = table[key];

		if (f == null)
		{
			return null;
		}

		if (quantity == 'fraction')
		{
			return v * f;
		}

		var target = TARGET[system] || TARGET.metric;

		if (quantity == 'temperature')
		{
			var c = v * f[0] + f[1];

			return c * target.temperature[0] + target.temperature[1];
		}

		if (quantity == 'pressure')
		{
			var gauge = typeof f === 'string';
			var bar = v * parseFloat((gauge) ? f.substring(1) : f);
			var barg = (gauge) ? bar : bar - ATM_BAR;

			return barg * target.pressure;
		}

		return v * f * target[quantity];
	};

	/**
	 * Engineering rounding: fractions with 4 decimals, others 4-5 significant digits.
	 */
	function formatValue(v, quantity)
	{
		if (v == null || isNaN(v))
		{
			return '';
		}

		var a = Math.abs(v);
		var d = (quantity == 'fraction') ? 4 : ((a >= 1000) ? 0 : ((a >= 100) ? 1 : ((a >= 10) ? 2 : 3)));
		var s = v.toFixed(d);

		if (s.indexOf('.') >= 0)
		{
			s = s.replace(/0+$/, '').replace(/\.$/, '');
		}

		return (s == '-0') ? '0' : s;
	};

	/**
	 * True for unit texts: anything with "/" or a known unit ("C", "kPa", "barg", "%", ...).
	 */
	function isUnit(u)
	{
		var t = String(u || '').trim();

		if (t.length == 0 || t.length > 14)
		{
			return false;
		}

		if (t.indexOf('/') >= 0 || /^°/.test(t))
		{
			return true;
		}

		var key = unitKey(t);

		for (var q in UNITS)
		{
			if (key != '' && UNITS[q][key] != null)
			{
				return true;
			}
		}

		return /^(cp|degc|degf|degk|deg[cfk])$/.test(key);
	};

	/**
	 * Splits "Temperature [C]", "Temperature (C)" or "Temperature, C" into label and unit.
	 */
	function splitUnit(label)
	{
		var s = String(label || '').trim();
		var m = /^(.*?)\s*[\[(]\s*([^\])]*)\s*[\])]\s*$/.exec(s);

		if (m != null && isUnit(m[2]))
		{
			return {label: m[1], unit: m[2]};
		}

		m = /^(.*?),\s*([^,]{1,12})$/.exec(s);

		if (m != null && isUnit(m[2]))
		{
			return {label: m[1], unit: m[2]};
		}

		return {label: s, unit: ''};
	};

	/**
	 * Component name in a row label: "Comp Mole Frac (Methane)", "Molar Fraction / Methane",
	 * "Methane". Returns the matching project component or null.
	 */
	function matchComponent(label, components)
	{
		var s = String(label || '');
		var candidates = [s];
		var m = /\(([^()]+)\)\s*$/.exec(s);

		if (m != null)
		{
			candidates.unshift(m[1]);
		}

		if (s.indexOf('/') >= 0)
		{
			candidates.unshift(s.substring(s.lastIndexOf('/') + 1));
		}

		for (var i = 0; i < candidates.length; i++)
		{
			var n = norm(candidates[i]);

			for (var j = 0; j < components.length; j++)
			{
				var cn = norm(components[j].name);

				if (n == cn || (SYNONYMS[cn] || []).map(norm).indexOf(n) >= 0 ||
					Object.keys(SYNONYMS).some(function(k) { return k == n && SYNONYMS[k].map(norm).indexOf(cn) >= 0; }))
				{
					return components[j];
				}
			}
		}

		return null;
	};

	/**
	 * Recognises a row label. Returns {key, quantity, unit, label, component, basis} or null.
	 * components: [{name, key}] of the project.
	 */
	function matchRow(rawLabel, unitCell, components)
	{
		var su = splitUnit(rawLabel);
		var unit = String((unitCell != null && String(unitCell).trim() != '') ? unitCell : su.unit).trim();
		var l = su.label.toLowerCase();
		var comp = matchComponent(rawLabel, components || []);

		if (comp != null && !/flow|temperature|pressure/.test(l))
		{
			return {key: comp.key, quantity: 'fraction', unit: unit, label: su.label, component: comp.name,
				basis: (/mass|weight|wt/.test(l)) ? 'mass fraction' : 'mole fraction'};
		}

		var rules =
		[
			[/std|standard|normal|mmscf|scf|sm3|nm3/, /gas|vol|flow/, 'std_gas_flow'],
			[/act(ual)?\s*vol|volumetric flow|actual flow/, null, 'vol_flow'],
			[/mass\s*flow/, null, 'mass_flow'],
			[/mol(e|ar)?\s*flow/, null, 'molar_flow'],
			[/vapou?r.*frac|frac\w*\s*\(?\s*vapou?r|^vf$/, null, 'vapour_fraction'],
			[/mol(ecular)?\.?\s*w(eigh)?t|^mw$|molar mass/, null, 'molecular_weight'],
			[/^temp|temperature/, null, 'temperature'],
			[/pressure/, null, 'pressure', /vapou?r pressure|\bt?vp\b|rvp|reid/],
			[/density/, null, 'density', /std|standard|molar/],
			[/viscosity/, null, 'viscosity', /kinematic/],
			[/^(description|name|stream name)$/, null, 'description']
		];

		for (var i = 0; i < rules.length; i++)
		{
			var r = rules[i];

			if (r[0].test(l) && (r[1] == null || r[1].test(l)) && (r[3] == null || !r[3].test(l)))
			{
				return {key: r[2], quantity: QUANTITY[r[2]] || null, unit: unit, label: su.label};
			}
		}

		return {key: null, quantity: null, unit: unit, label: su.label};
	};

	function looksLikeUnit(v)
	{
		var s = String(v || '').trim();

		return s.length > 0 && s.length <= 12 && isNaN(parseFloat(s)) &&
			(/\/|^(c|k|f|%|cp|pa|kpa|bar|bara|barg|psia|psig|atm)$/i.test(s) || unitKey(s) in UNITS.pressure ||
			unitKey(s) in UNITS.temperature);
	};

	/**
	 * Analyses a table: returns {streams: [{name, index}], rows: [{index, raw, match}], unitColumn,
	 * transposed}. Streams are columns (simulator default) unless the header row holds the property names.
	 */
	function analyse(table, components)
	{
		var rows = table.filter(function(r) { return r.some(function(v) { return String(v).trim() != ''; }); });

		if (rows.length < 2)
		{
			throw new Error('The table needs a header row with the stream names and at least one property row.');
		}

		var header = rows[0].map(function(v) { return String(v).trim(); });
		var propsInHeader = header.slice(1).filter(function(h) { return matchRow(h, null, components).key != null; }).length;

		if (propsInHeader >= 2 && propsInHeader >= (header.length - 1) / 2)
		{
			// Streams are rows: transpose
			var t = [];

			for (var c = 0; c < header.length; c++)
			{
				t.push(rows.map(function(r) { return (r[c] != null) ? r[c] : ''; }));
			}

			var result = analyse(t, components);
			result.transposed = true;

			return result;
		}

		// A second column with units (DWSIM, HYSYS with unit column)?
		var unitHits = 0;

		for (var i = 1; i < rows.length; i++)
		{
			unitHits += (looksLikeUnit(rows[i][1])) ? 1 : 0;
		}

		var unitColumn = (unitHits >= 2 && unitHits >= (rows.length - 1) / 3) ? 1 : -1;
		var first = (unitColumn >= 0) ? 2 : 1;
		var streams = [];

		for (var c = first; c < header.length; c++)
		{
			if (header[c] != '' || rows.some(function(r) { return String(r[c] || '').trim() != ''; }))
			{
				streams.push({name: header[c] || ('Column ' + (c + 1)), index: c});
			}
		}

		return {streams: streams, unitColumn: unitColumn, transposed: false, rows: rows.slice(1).map(function(r, i)
		{
			return {index: i + 1, raw: r, label: String(r[0] || ''),
				match: matchRow(r[0], (unitColumn >= 0) ? r[unitColumn] : null, components)};
		}).filter(function(r) { return r.label.trim() != ''; }), table: rows};
	};

	/**
	 * Proposes a ProcessDraw stream for a source column: same number, else same description.
	 */
	function matchStream(name, streams, attr)
	{
		var n = String(name || '').trim();
		var m = /^\D*?(\d+)\s*$/.exec(n);

		for (var i = 0; i < streams.length; i++)
		{
			if (m != null && attr(streams[i], 'stream_number') == String(parseInt(m[1], 10)))
			{
				return streams[i];
			}
		}

		for (var i = 0; i < streams.length; i++)
		{
			if (n != '' && norm(attr(streams[i], 'description')) == norm(n))
			{
				return streams[i];
			}
		}

		return null;
	};

	// ---------------------------------------------------------------- Dialog (editor)

	function showDialog(ui)
	{
		var Tags = ProcessDraw.Tags;
		var PF = ProcessDraw.PFD;
		var streams = PF.getStreams(ui, true);

		if (streams.length == 0)
		{
			ui.alert('There are no stream markers yet. Select the lines and use ProcessDraw > Add Stream Marker first.');
			return;
		}

		var div = document.createElement('div');
		div.style.fontSize = '12px';
		var head = document.createElement('div');
		head.style.cssText = 'font-weight:bold;font-size:14px;margin-bottom:4px;';
		mxUtils.write(head, 'Import Stream Data');
		div.appendChild(head);

		var hint = document.createElement('div');
		hint.style.cssText = 'opacity:0.75;margin-bottom:6px;';
		mxUtils.write(hint, 'Open a stream table (CSV, TXT or XLSX exported from HYSYS, DWSIM or Excel) or paste ' +
			'the cells copied from the simulator workbook: one column per stream, property names in the first column.');
		div.appendChild(hint);

		var bar = document.createElement('div');
		bar.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:6px;';
		var openBtn = mxUtils.button('Open file...', function()
		{
			ProcessDraw.Roundtrip.pickFile('.csv,.txt,.tsv,.xlsx', false, function(data, file)
			{
				if (/\.xlsx$/i.test(file.name))
				{
					ProcessDraw.Xlsx.readWorkbook(data).then(function(sheets)
					{
						var best = sheets.slice().sort(function(a, b) { return b.rows.length - a.rows.length; })[0];
						load(best.rows, file.name + ' / ' + best.name);
					}).catch(function(e) { ui.handleError(e); });
				}
				else
				{
					load(ProcessDraw.Xlsx.parseDelimited(new TextDecoder().decode(data)), file.name);
				}
			});
		});
		openBtn.className = 'geBtn';
		bar.appendChild(openBtn);
		var source = document.createElement('span');
		source.style.opacity = '0.7';
		bar.appendChild(source);
		div.appendChild(bar);

		var paste = document.createElement('textarea');
		paste.setAttribute('placeholder', 'or paste here (Ctrl+V)');
		paste.style.cssText = 'width:100%;height:60px;box-sizing:border-box;font-family:monospace;font-size:11px;';
		mxEvent.addListener(paste, 'keydown', function(evt) { evt.stopPropagation(); });
		mxEvent.addListener(paste, 'paste', function()
		{
			window.setTimeout(function() { load(ProcessDraw.Xlsx.parseDelimited(paste.value), 'pasted data'); }, 0);
		});
		div.appendChild(paste);

		var mapping = document.createElement('div');
		mapping.style.cssText = 'max-height:' + Math.max(220, window.innerHeight - 480) + 'px;overflow:auto;margin-top:6px;';
		div.appendChild(mapping);

		var current = null;
		var streamSelects = [];
		var rowSelects = [];
		var settings = Tags.getSettings(ui);
		var comps = PF.getComponents(ui);
		var fieldOptions = [['', '(skip)'], ['description', 'Description']].concat(PF.PROPS.map(function(k)
		{
			return [k, ProcessDraw.Fields.getLabel(k) + ((ProcessDraw.Fields.getUnit(k, settings.units)) ?
				' [' + ProcessDraw.Fields.getUnit(k, settings.units) + ']' : '')];
		})).concat(comps.map(function(c) { return [c.key, c.name + ' (' + settings.compBasis + ')']; }));

		function select(options, value)
		{
			var s = document.createElement('select');
			s.style.maxWidth = '230px';

			options.forEach(function(o)
			{
				var opt = document.createElement('option');
				opt.value = o[0];
				mxUtils.write(opt, o[1]);
				s.appendChild(opt);
			});

			s.value = value || '';

			return s;
		};

		function load(table, name)
		{
			try
			{
				current = analyse(table, comps);
			}
			catch (e)
			{
				ui.handleError(e);
				return;
			}

			source.innerText = name + (current.transposed ? ' (streams in rows)' : '');
			mapping.innerText = '';
			streamSelects = [];
			rowSelects = [];

			var t1 = document.createElement('div');
			t1.style.cssText = 'font-weight:bold;margin:6px 0 2px 0;';
			mxUtils.write(t1, 'Streams');
			mapping.appendChild(t1);
			var streamOptions = [['', '(skip)']].concat(streams.map(function(s, i)
			{
				return [String(i), 'Stream ' + Tags.attr(s.cell, 'stream_number') +
					((Tags.attr(s.cell, 'description')) ? ' – ' + Tags.attr(s.cell, 'description') : '')];
			}));

			current.streams.forEach(function(src)
			{
				var found = matchStream(src.name, streams, function(s, k) { return Tags.attr(s.cell, k); });
				var row = document.createElement('div');
				row.style.cssText = 'display:flex;gap:8px;align-items:center;margin:2px 0;';
				var l = document.createElement('span');
				l.style.cssText = 'flex:0 0 40%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
				mxUtils.write(l, src.name);
				row.appendChild(l);
				var sel = select(streamOptions, (found != null) ? String(streams.indexOf(found)) : '');
				row.appendChild(sel);
				mapping.appendChild(row);
				streamSelects.push({src: src, select: sel});
			});

			var t2 = document.createElement('div');
			t2.style.cssText = 'font-weight:bold;margin:8px 0 2px 0;';
			mxUtils.write(t2, 'Properties');
			mapping.appendChild(t2);

			current.rows.forEach(function(r)
			{
				var row = document.createElement('div');
				row.style.cssText = 'display:flex;gap:8px;align-items:center;margin:2px 0;';
				var l = document.createElement('span');
				l.style.cssText = 'flex:0 0 40%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
				l.setAttribute('title', r.label);
				mxUtils.write(l, r.match.label + ((r.match.unit) ? ' [' + r.match.unit + ']' : ''));
				row.appendChild(l);
				var wrongBasis = r.match.basis != null && r.match.basis != settings.compBasis;
				var sel = select(fieldOptions, (wrongBasis) ? '' : r.match.key);
				row.appendChild(sel);
				var note = document.createElement('span');
				note.style.cssText = 'opacity:0.65;font-size:11px;';

				function updateNote()
				{
					var key = sel.value;
					var q = QUANTITY[key] || ((key.substring(0, 5) == 'comp_') ? 'fraction' : null);
					var sample = r.raw[(current.streams[0] || {}).index];
					var conv = (q != null && sample != null && String(sample) !== '') ? convert(sample, r.match.unit, q,
						settings.units) : null;
					note.innerText = (key == '') ? ((wrongBasis) ? r.match.basis + ', project uses ' + settings.compBasis : '') :
						((q != null && conv == null && String(sample || '') !== '') ? 'unit "' + r.match.unit + '" unknown' :
						((conv != null) ? sample + ' → ' + formatValue(conv, q) : ''));
				};

				mxEvent.addListener(sel, 'change', updateNote);
				updateNote();
				row.appendChild(note);
				mapping.appendChild(row);
				rowSelects.push({row: r, select: sel});
			});
		};

		var dlg = new CustomDialog(ui, div, function()
		{
			if (current == null)
			{
				return;
			}

			var graph = ui.editor.graph;
			var count = 0;
			var skipped = 0;

			graph.model.beginUpdate();
			try
			{
				streamSelects.forEach(function(ss)
				{
					if (ss.select.value === '')
					{
						return;
					}

					var target = streams[parseInt(ss.select.value, 10)];
					var values = {};

					rowSelects.forEach(function(rs)
					{
						var key = rs.select.value;

						if (key === '')
						{
							return;
						}

						var raw = rs.row.raw[ss.src.index];

						if (raw == null || String(raw).trim() === '')
						{
							return;
						}

						var q = QUANTITY[key] || ((key.substring(0, 5) == 'comp_') ? 'fraction' : null);

						if (key == 'description' || key == 'molecular_weight' || q == null)
						{
							var num = (typeof raw === 'number') ? raw : parseFloat(raw);
							values[key] = (key == 'molecular_weight' && !isNaN(num)) ? formatValue(num, null) : String(raw).trim();
						}
						else
						{
							var v = convert(raw, rs.row.match.unit, q, settings.units);

							if (v == null)
							{
								skipped++;
								return;
							}

							values[key] = formatValue(v, q);
						}

						count++;
					});

					PF.ensureComponents(ui, target.cell);
					Tags.setAttributes(graph, target.cell, values);
				});

				PF.refreshPage(ui);
			}
			finally
			{
				graph.model.endUpdate();
			}

			ui.editor.setStatus(count + ' value(s) imported' + ((skipped > 0) ? ', ' + skipped + ' skipped (unknown unit)' : ''));
		}, null, 'Import');

		ui.showDialog(dlg.container, 620, Math.min(window.innerHeight - 40, 640), true, true);
		ProcessDraw.SimImport._load = load;
	};

	ProcessDraw.SimImport =
	{
		convert: convert,
		formatValue: formatValue,
		splitUnit: splitUnit,
		matchRow: matchRow,
		matchComponent: matchComponent,
		analyse: analyse,
		matchStream: matchStream,
		showDialog: showDialog,

		install: function(ui)
		{
			mxResources.parse('pdImportStreams=Import Stream Data (HYSYS, DWSIM, CSV)...\n');

			ui.actions.addAction('pdImportStreams', function()
			{
				showDialog(ui);
			});
		}
	};
})();
