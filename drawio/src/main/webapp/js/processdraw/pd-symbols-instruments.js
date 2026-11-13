/**
 * ProcessDraw instrument symbols: ISA 5.1 and IEC 62424 / DIN EN 62424.
 * Instrument labels show %function% above %loop%, e.g. FIC / 101.
 */
(function()
{
	var L = ProcessDraw.Library;
	var ISA = 'ISA 5.1';
	var IEC = 'IEC 62424';
	var NOZZLES = [[20, 0, 'top'], [20, 40, 'bottom'], [0, 20, 'left'], [40, 20, 'right']];
	// Gap between the lines keeps the text clear of the location line in the middle
	var LABEL = '%function%<div style="margin-top:6px">%loop%</div>';
	var STYLE = 'fontSize=10;';
	var IEC_NOZZLES = [[30, 0, 'top'], [30, 36, 'bottom'], [0, 18, 'left'], [60, 18, 'right']];

	function instrument(def)
	{
		def.cls = 'instrument';
		def.template = 'instrument';
		def.standard = def.standard || ISA;
		def.prefix = def.prefix || def.fn;
		def.tag = def.fn + '-???';
		def.data = def.data || {};
		def.data['function'] = def.fn;
		def.data.loop = '???';
		def.label = (def.label != null) ? def.label : LABEL;
		def.labelInside = (def.labelInside != null) ? def.labelInside : true;
		def.style = STYLE + (def.style || '');
		return def;
	};

	// ISA 5.1 bubble shapes and location lines
	var SHAPES =
	[
		{key: 'discrete', name: 'Discrete Instrument', fn: 'TI', draw: 'e 0 0 40 40; fs'},
		{key: 'shared', name: 'Shared Display / Control (DCS)', fn: 'FIC', draw: 'r 0 0 40 40; fs; e 0 0 40 40; s'},
		{key: 'computer', name: 'Computer Function', fn: 'FY',
			draw: 'p M 10 0 L 30 0 L 40 20 L 30 40 L 10 40 L 0 20 Z; fs'},
		{key: 'plc', name: 'PLC Function', fn: 'US', draw: 'r 0 0 40 40; fs; p M 20 0 L 40 20 L 20 40 L 0 20 Z; s'}
	];

	var LOCATIONS =
	[
		{key: 'field', name: 'field', line: ''},
		{key: 'main', name: 'control room', line: '; p M 0 20 L 40 20; s'},
		{key: 'aux', name: 'local panel', line: '; p M 0 18 L 40 18 M 0 22 L 40 22; s'},
		{key: 'hidden', name: 'behind panel', line: '; d 1; p M 0 20 L 40 20; s; d 0'}
	];

	var isa = [];

	for (var i = 0; i < SHAPES.length; i++)
	{
		for (var j = 0; j < LOCATIONS.length; j++)
		{
			var s = SHAPES[i];
			var loc = LOCATIONS[j];

			isa.push(instrument({id: 'pd_inst_' + s.key + '_' + loc.key, name: s.name + ' (' + loc.name + ')',
				type: 'instrument.' + s.key, fn: s.fn, w: 40, h: 40, aspect: true, draw: s.draw + loc.line,
				nozzles: NOZZLES, data: {location: loc.name},
				tags: 'instrument bubble isa ' + s.key + ' ' + loc.name + ' ' + s.name.toLowerCase()}));
		}
	}

	isa.push(instrument({id: 'pd_inst_interlock', name: 'Interlock / Logic', type: 'instrument.interlock',
		fn: 'I', w: 40, h: 40, aspect: true, draw: 'p M 20 0 L 40 20 L 20 40 L 0 20 Z; fs', nozzles: NOZZLES,
		tags: 'interlock logic diamond sis'}));

	L.addPalette('pdInstrumentsIsa', 'ProcessDraw / Instruments (ISA 5.1)', isa, true);

	// ---------------------------------------------------------------- Primary elements
	L.addPalette('pdPrimaryElements', 'ProcessDraw / Primary Elements & Gauges',
	[
		instrument({id: 'pd_orifice', name: 'Orifice Plate', type: 'instrument.orifice', fn: 'FE',
			label: '%tag%', labelInside: false, w: 20, h: 30,
			draw: 'p M 7 0 L 7 30 M 13 0 L 13 30; s', nozzles: [[7, 15, 'upstream'], [13, 15, 'downstream']],
			style: 'fillColor=none;', tags: 'orifice plate flow element dp'}),
		instrument({id: 'pd_restriction_orifice', name: 'Restriction Orifice', type: 'instrument.restriction_orifice',
			fn: 'RO', label: '%tag%', labelInside: false, w: 20, h: 30,
			draw: 'p M 7 0 L 7 30 M 13 0 L 13 30; s; p M 7 15 L 13 15; s',
			nozzles: [[7, 15, 'upstream'], [13, 15, 'downstream']], style: 'fillColor=none;',
			tags: 'restriction orifice ro'}),
		instrument({id: 'pd_flowmeter_inline', name: 'In-line Flow Meter', type: 'instrument.flowmeter',
			fn: 'FE', label: '%function%', w: 30, h: 20, draw: 'r 0 0 30 20; fs',
			nozzles: [[0, 10, 'in'], [30, 10, 'out'], [15, 0, 'signal']], data: {meter_type: ''},
			tags: 'flow meter magnetic coriolis vortex turbine ultrasonic'}),
		instrument({id: 'pd_rotameter', name: 'Rotameter (Variable Area)', type: 'instrument.rotameter', fn: 'FI',
			label: '%tag%', labelInside: false, w: 16, h: 40, draw: 'p M 0 0 L 16 0 L 11 40 L 5 40 Z; fs',
			nozzles: [[8, 40, 'in'], [8, 0, 'out']], tags: 'rotameter variable area flow'}),
		instrument({id: 'pd_thermowell', name: 'Thermowell', type: 'instrument.thermowell', fn: 'TW',
			label: '%tag%', labelInside: false, w: 12, h: 20, draw: 'p M 6 0 L 6 14; s; e 1 12 10 8; fs',
			nozzles: [[6, 0, 'instrument'], [6, 20, 'process']], tags: 'thermowell temperature'}),
		instrument({id: 'pd_level_gauge', name: 'Level Gauge Glass', type: 'instrument.level_gauge', fn: 'LG',
			label: '%tag%', labelInside: false, w: 12, h: 50, draw: 'r 0 0 12 50; fs; p M 6 4 L 6 46; s',
			nozzles: [[0, 5, 'top'], [0, 45, 'bottom']], tags: 'level gauge glass sight'})
	]);

	// ---------------------------------------------------------------- IEC 62424
	L.addPalette('pdInstrumentsIec', 'ProcessDraw / Instruments (IEC 62424 / DIN)',
	[
		instrument({id: 'pd_pce_field', name: 'PCE Request (field)', type: 'instrument.pce', fn: 'TIC',
			standard: IEC, w: 60, h: 36, draw: 'e 0 0 60 36; fs', nozzles: IEC_NOZZLES,
			data: {location: 'field'}, tags: 'pce request iec 62424 din field oval'}),
		instrument({id: 'pd_pce_control_room', name: 'PCE Request (control room)', type: 'instrument.pce',
			fn: 'TIC', standard: IEC, w: 60, h: 36, draw: 'e 0 0 60 36; fs; p M 0 18 L 60 18; s',
			nozzles: IEC_NOZZLES, data: {location: 'control room'},
			tags: 'pce request iec 62424 din control room oval'}),
		instrument({id: 'pd_pce_local_panel', name: 'PCE Request (local panel)', type: 'instrument.pce',
			fn: 'TIC', standard: IEC, w: 60, h: 36, draw: 'e 0 0 60 36; fs; p M 0 16 L 60 16 M 0 20 L 60 20; s',
			nozzles: IEC_NOZZLES, data: {location: 'local panel'},
			tags: 'pce request iec 62424 din local panel oval'})
	]);
})();
