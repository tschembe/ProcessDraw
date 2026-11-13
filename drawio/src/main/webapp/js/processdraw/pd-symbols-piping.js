/**
 * ProcessDraw valves, piping fittings & specials, lines and annotations
 * (ISO 10628-2 / ISA 5.1 style).
 */
(function()
{
	var L = ProcessDraw.Library;
	var ISO = 'ISO 10628-2';
	var ISA = 'ISA 5.1';

	// Valve body (bowtie) 40 wide, 20 high, starting at y0
	function bowtie(y0)
	{
		return 'p M 0 ' + y0 + ' L 40 ' + (y0 + 20) + ' L 40 ' + y0 + ' L 0 ' + (y0 + 20) + ' Z;';
	};

	var INLINE = [[0, 10, 'in'], [40, 10, 'out']];

	function valve(def)
	{
		def.cls = 'valve';
		def.standard = def.standard || ISO;
		def.template = def.template || 'valve';
		def.prefix = (def.prefix != null) ? def.prefix : 'HV';

		// Manual valves are not tagged by default (Renumber Selection gives them HV numbers)
		if (def.template == null || def.template == 'valve')
		{
			def.tag = (def.tag != null) ? def.tag : '';
		}

		def.aspect = (def.aspect != null) ? def.aspect : true;
		return def;
	};

	// Valve with actuator: actuator drawing above a bowtie at y 20..40
	function actuated(def, actuator)
	{
		def.w = 40;
		def.h = 40;
		def.draw = 'p M 20 10 L 20 30; s; ' + actuator + '; ' + bowtie(20) + ' fs' + (def.extra || '');
		def.nozzles = [[0, 30, 'in'], [40, 30, 'out'], [20, 0, 'signal']].concat(def.moreNozzles || []);
		def.template = 'control_valve';
		return valve(def);
	};

	function fitting(def)
	{
		def.cls = def.cls || 'fitting';
		def.standard = def.standard || ISO;
		def.template = def.template || ((def.cls == 'special') ? 'special' : 'fitting');
		def.label = (def.label != null) ? def.label : ((def.cls == 'special') ? '%tag%' : '');
		return def;
	};

	// ---------------------------------------------------------------- Valves
	L.addPalette('pdValves', 'ProcessDraw / Valves & Actuators',
	[
		valve({id: 'pd_valve_gate', name: 'Gate Valve', type: 'valve.gate', w: 40, h: 20,
			draw: bowtie(0) + ' fs', nozzles: INLINE, data: {normal_position: 'NO'},
			tags: 'gate valve isolation manual'}),
		valve({id: 'pd_valve_closed', name: 'Valve (normally closed)', type: 'valve.gate', w: 40, h: 20,
			draw: bowtie(0) + ' F', nozzles: INLINE, data: {normal_position: 'NC'},
			tags: 'valve normally closed nc'}),
		valve({id: 'pd_valve_globe', name: 'Globe Valve', type: 'valve.globe', w: 40, h: 20,
			draw: bowtie(0) + ' fs; e 16 6 8 8; F', nozzles: INLINE, data: {normal_position: 'NO'},
			tags: 'globe valve throttling manual'}),
		valve({id: 'pd_valve_ball', name: 'Ball Valve', type: 'valve.ball', w: 40, h: 20,
			draw: bowtie(0) + ' fs; e 13 3 14 14; fs', nozzles: INLINE, data: {normal_position: 'NO'},
			tags: 'ball valve quarter turn'}),
		valve({id: 'pd_valve_plug', name: 'Plug Valve', type: 'valve.plug', w: 40, h: 20,
			draw: bowtie(0) + ' fs; r 14 6 12 8; F', nozzles: INLINE, data: {normal_position: 'NO'},
			tags: 'plug valve cock'}),
		valve({id: 'pd_valve_butterfly', name: 'Butterfly Valve', type: 'valve.butterfly', w: 40, h: 20,
			draw: 'p M 0 2 L 0 18 M 40 2 L 40 18 M 0 10 L 40 10 M 8 20 L 32 0; s; e 17 7 6 6; F',
			nozzles: INLINE, data: {normal_position: 'NO'}, tags: 'butterfly valve damper'}),
		valve({id: 'pd_valve_needle', name: 'Needle Valve', type: 'valve.needle', w: 40, h: 20,
			draw: bowtie(0) + ' fs; p M 20 10 L 16 0 L 24 0 Z; F', nozzles: INLINE, data: {normal_position: 'NO'},
			tags: 'needle valve instrument'}),
		valve({id: 'pd_valve_check', name: 'Check Valve (flow →)', type: 'valve.check', w: 40, h: 20,
			draw: 'p M 0 0 L 20 10 L 0 20 Z; F; p M 40 0 L 20 10 L 40 20 Z; fs', nozzles: INLINE,
			tags: 'check valve non return nrv'}),
		valve({id: 'pd_valve_diaphragm', name: 'Diaphragm Valve', type: 'valve.diaphragm', w: 40, h: 25,
			draw: bowtie(5) + ' fs; p M 10 7 Q 20 -3 30 7; s', nozzles: [[0, 15, 'in'], [40, 15, 'out']],
			data: {normal_position: 'NO'}, tags: 'diaphragm valve weir'}),
		valve({id: 'pd_valve_angle', name: 'Angle Valve', type: 'valve.angle', w: 30, h: 30,
			draw: 'p M 0 5 L 15 15 L 0 25 Z; fs; p M 5 30 L 15 15 L 25 30 Z; fs',
			nozzles: [[0, 15, 'in'], [15, 30, 'out']], data: {normal_position: 'NO'}, tags: 'angle valve'}),
		valve({id: 'pd_valve_3way', name: 'Three-Way Valve', type: 'valve.three_way', w: 40, h: 30,
			draw: bowtie(0) + ' fs; p M 10 30 L 20 10 L 30 30 Z; fs',
			nozzles: [[0, 10, 'A'], [40, 10, 'B'], [20, 30, 'C']], tags: 'three way valve 3-way diverter'}),
		actuated({id: 'pd_valve_control', name: 'Control Valve (diaphragm)', type: 'valve.control', prefix: 'FV'},
			'p M 8 10 A 12 10 0 0 1 32 10 Z; fs'),
		actuated({id: 'pd_valve_control_piston', name: 'On/Off Valve (piston)', type: 'valve.onoff.piston',
			prefix: 'XV', data: {actuator: 'pneumatic piston'}},
			'r 8 0 24 12; fs; p M 8 6 L 32 6; s'),
		actuated({id: 'pd_valve_mov', name: 'Motor Operated Valve', type: 'valve.mov', prefix: 'MOV',
			data: {actuator: 'electric motor'}}, 'r 8 0 24 14; fs; t 20 7 10 M'),
		actuated({id: 'pd_valve_solenoid', name: 'Solenoid Valve', type: 'valve.solenoid', prefix: 'XV',
			data: {actuator: 'solenoid'}}, 'r 8 0 24 14; fs; t 20 7 10 S'),
		actuated({id: 'pd_valve_regulator', name: 'Self-acting Pressure Regulator', type: 'valve.regulator',
			prefix: 'PCV', data: {actuator: 'self-acting'}, extra: '; p M 32 10 L 40 10; s',
			moreNozzles: [[40, 10, 'sense']]}, 'p M 8 10 A 12 10 0 0 1 32 10 Z; fs'),
		valve({id: 'pd_valve_safety', name: 'Safety / Relief Valve (PSV)', type: 'valve.safety', prefix: 'PSV',
			template: 'safety_valve', standard: ISA, w: 30, h: 50, aspect: false,
			draw: 'p M 15 30 L 15 26 L 9 23 L 21 18 L 9 13 L 21 8 L 15 5 L 15 0; s; ' +
				'p M 5 50 L 15 30 L 25 50 Z; fs; p M 30 20 L 15 30 L 30 40 Z; fs',
			nozzles: [[15, 50, 'inlet'], [30, 30, 'outlet']], tags: 'safety relief valve psv prv pressure'}),
		valve({id: 'pd_rupture_disc', name: 'Rupture Disc', type: 'rupture_disc', prefix: 'PSE',
			template: 'safety_valve', standard: ISA, w: 20, h: 30, aspect: false,
			draw: 'p M 10 30 L 10 15 M 10 9 L 10 0 M 0 15 L 20 15; s; p M 2 15 Q 10 3 18 15; s',
			nozzles: [[10, 30, 'inlet'], [10, 0, 'outlet']], tags: 'rupture disc bursting disk'})
	], true);

	// ---------------------------------------------------------------- Fittings & Specials
	L.addPalette('pdFittings', 'ProcessDraw / Piping Fittings & Specials',
	[
		fitting({id: 'pd_reducer', name: 'Reducer (concentric)', type: 'fitting.reducer', w: 20, h: 20,
			draw: 'p M 0 0 L 20 6 L 20 14 L 0 20 Z; fs', nozzles: [[0, 10, 'large'], [20, 10, 'small']],
			tags: 'reducer concentric'}),
		fitting({id: 'pd_reducer_ecc', name: 'Reducer (eccentric)', type: 'fitting.reducer_eccentric', w: 20, h: 20,
			draw: 'p M 0 0 L 20 0 L 20 12 L 0 20 Z; fs', nozzles: [[0, 10, 'large'], [20, 6, 'small']],
			tags: 'reducer eccentric'}),
		fitting({id: 'pd_flange', name: 'Flange Pair', type: 'fitting.flange', w: 6, h: 20,
			draw: 'p M 0 0 L 0 20 M 6 0 L 6 20; s', nozzles: [[0, 10, 'in'], [6, 10, 'out']],
			style: 'fillColor=none;', tags: 'flange flanged joint'}),
		fitting({id: 'pd_blind_flange', name: 'Blind Flange', type: 'fitting.blind_flange', w: 6, h: 20,
			draw: 'p M 0 0 L 0 20; s; r 3 0 3 20; F', nozzles: [[0, 10, 'in']], tags: 'blind flange end'}),
		fitting({id: 'pd_spectacle_open', name: 'Spectacle Blind (open)', type: 'fitting.spectacle_open', w: 16, h: 36,
			draw: 'e 0 0 16 16; s; p M 8 16 L 8 20; s; e 0 20 16 16; F',
			nozzles: [[0, 8, 'in'], [16, 8, 'out']], style: 'fillColor=none;', tags: 'spectacle blind open figure 8'}),
		fitting({id: 'pd_spectacle_closed', name: 'Spectacle Blind (closed)', type: 'fitting.spectacle_closed',
			w: 16, h: 36, draw: 'e 0 0 16 16; F; p M 8 16 L 8 20; s; e 0 20 16 16; s',
			nozzles: [[0, 8, 'in'], [16, 8, 'out']], style: 'fillColor=none;',
			tags: 'spectacle blind closed figure 8'}),
		fitting({id: 'pd_cap', name: 'Pipe Cap', type: 'fitting.cap', w: 8, h: 20,
			draw: 'p M 0 0 L 4 0 A 4 10 0 0 1 4 20 L 0 20; s', nozzles: [[0, 10, 'in']],
			style: 'fillColor=none;', tags: 'cap end'}),
		fitting({id: 'pd_hose', name: 'Flexible Hose', type: 'fitting.hose', w: 40, h: 12,
			draw: 'p M 0 6 Q 5 0 10 6 Q 15 12 20 6 Q 25 0 30 6 Q 35 12 40 6; s',
			nozzles: [[0, 6, 'in'], [40, 6, 'out']], style: 'fillColor=none;', tags: 'flexible hose'}),
		fitting({id: 'pd_expansion_joint', name: 'Expansion Joint / Bellows', type: 'fitting.expansion_joint',
			w: 20, h: 20, draw: 'r 0 3 20 14; f; p M 0 3 L 4 0 L 8 3 L 12 0 L 16 3 L 20 0 M 0 17 L 4 20 L 8 17 ' +
				'L 12 20 L 16 17 L 20 20 M 0 0 L 0 20 M 20 0 L 20 20; s',
			nozzles: [[0, 10, 'in'], [20, 10, 'out']], tags: 'expansion joint bellows compensator'}),
		fitting({id: 'pd_vent', name: 'Vent to Atmosphere', type: 'fitting.vent', w: 14, h: 20,
			draw: 'p M 0 20 L 0 6 A 6 6 0 0 1 12 6 L 12 12; s', nozzles: [[0, 20, 'in']],
			style: 'fillColor=none;', tags: 'vent atmosphere gooseneck'}),
		fitting({id: 'pd_drain_funnel', name: 'Drain Funnel', type: 'fitting.drain', w: 20, h: 16,
			draw: 'p M 0 0 L 8 10 L 8 16 M 20 0 L 12 10 L 12 16; s', nozzles: [[10, 0, 'in'], [10, 16, 'out']],
			style: 'fillColor=none;', tags: 'drain funnel tundish'}),
		fitting({id: 'pd_strainer', name: 'Strainer (in-line)', type: 'special.strainer', cls: 'special',
			prefix: 'SP', w: 40, h: 20, draw: 'r 0 0 40 20; fs; d 1; p M 8 0 L 32 20; s; d 0',
			nozzles: INLINE, tags: 'strainer filter in-line'}),
		fitting({id: 'pd_strainer_y', name: 'Y-Strainer', type: 'special.strainer_y', cls: 'special', prefix: 'SP',
			w: 40, h: 30, draw: 'p M 14 14 L 24 30 L 34 26 L 26 14; fs; r 0 0 40 14; fs; d 1; p M 20 14 L 28 27; s; d 0',
			nozzles: [[0, 7, 'in'], [40, 7, 'out']], tags: 'y strainer y-type'}),
		fitting({id: 'pd_steam_trap', name: 'Steam Trap', type: 'special.steam_trap', cls: 'special', prefix: 'ST',
			w: 20, h: 20, aspect: true, draw: 'e 0 0 20 20; fs; t 10 10 10 T',
			nozzles: [[0, 10, 'in'], [20, 10, 'out']], tags: 'steam trap condensate'}),
		fitting({id: 'pd_sight_glass', name: 'Sight Glass', type: 'special.sight_glass', cls: 'special', prefix: 'SG',
			w: 24, h: 24, aspect: true, draw: 'e 0 0 24 24; fs; e 6 6 12 12; s',
			nozzles: [[0, 12, 'in'], [24, 12, 'out']], tags: 'sight glass flow indicator'}),
		fitting({id: 'pd_flame_arrestor', name: 'Flame Arrestor', type: 'special.flame_arrestor', cls: 'special',
			prefix: 'FA', w: 30, h: 20,
			draw: 'r 0 0 30 20; fs; p M 6 0 L 6 20 M 12 0 L 12 20 M 18 0 L 18 20 M 24 0 L 24 20; s',
			nozzles: [[0, 10, 'in'], [30, 10, 'out']], tags: 'flame arrestor arrester detonation'}),
		fitting({id: 'pd_silencer', name: 'Silencer', type: 'special.silencer', cls: 'special', prefix: 'SL',
			w: 40, h: 20, draw: 'rr 0 0 40 20 30; fs; d 1; p M 6 10 L 34 10; s; d 0',
			nozzles: [[0, 10, 'in'], [40, 10, 'out']], tags: 'silencer muffler'})
	]);

	// ---------------------------------------------------------------- Lines
	var LINE = 'html=1;rounded=0;edgeStyle=orthogonalEdgeStyle;jumpStyle=gap;jumpSize=8;' +
		'labelBackgroundColor=default;fontSize=10;';
	var PROCESS = LINE + 'endArrow=block;endFill=1;endSize=6;';
	var SIGNAL = LINE + 'endArrow=none;strokeWidth=1;';

	function line(def)
	{
		def.edge = true;
		def.cls = def.cls || 'line';
		def.template = def.template || def.cls;
		def.standard = def.standard || ((def.cls == 'signal') ? ISA : ISO);
		def.w = 80;
		def.h = 20;
		def.label = (def.label != null) ? def.label : ((def.cls == 'line') ? '%line_number%' : '');
		return def;
	};

	L.addPalette('pdLines', 'ProcessDraw / Process & Signal Lines',
	[
		line({id: 'pd_line_main', name: 'Main Process Line', type: 'line.process.main',
			style: PROCESS + 'strokeWidth=2;', tags: 'process line pipe main primary'}),
		line({id: 'pd_line_secondary', name: 'Secondary / Utility Line', type: 'line.process.secondary',
			style: PROCESS + 'strokeWidth=1;', tags: 'utility line pipe secondary'}),
		line({id: 'pd_line_future', name: 'Future Line', type: 'line.process.future',
			style: PROCESS + 'strokeWidth=1;dashed=1;dashPattern=8 4;', tags: 'future line pipe'}),
		line({id: 'pd_line_existing', name: 'Existing / By Others', type: 'line.process.existing',
			style: PROCESS + 'strokeWidth=1;dashed=1;dashPattern=12 3 3 3;', tags: 'existing line by others'}),
		line({id: 'pd_line_jacketed', name: 'Jacketed / Traced Line', type: 'line.process.jacketed',
			style: LINE + 'shape=link;width=4;endArrow=none;', tags: 'jacketed traced double line'}),
		line({id: 'pd_signal_process', name: 'Instrument Process Connection', type: 'signal.process',
			cls: 'signal', style: SIGNAL, data: {signal_type: 'process connection'},
			tags: 'instrument process connection impulse line'}),
		line({id: 'pd_signal_electric', name: 'Electric Signal', type: 'signal.electric', cls: 'signal',
			style: SIGNAL + 'dashed=1;dashPattern=6 3;', data: {signal_type: 'electric'},
			tags: 'electric signal 4-20 ma'}),
		line({id: 'pd_signal_pneumatic', name: 'Pneumatic Signal', type: 'signal.pneumatic', cls: 'signal',
			style: SIGNAL + 'shape=pd_signal_pneumatic;', data: {signal_type: 'pneumatic'},
			tags: 'pneumatic signal air'}),
		line({id: 'pd_signal_hydraulic', name: 'Hydraulic Signal', type: 'signal.hydraulic', cls: 'signal',
			style: SIGNAL + 'shape=pd_signal_hydraulic;', data: {signal_type: 'hydraulic'},
			tags: 'hydraulic signal'}),
		line({id: 'pd_signal_capillary', name: 'Capillary Tube', type: 'signal.capillary', cls: 'signal',
			style: SIGNAL + 'shape=pd_signal_capillary;', data: {signal_type: 'capillary'},
			tags: 'capillary tube filled system'}),
		line({id: 'pd_signal_data', name: 'Data Link / Software', type: 'signal.data', cls: 'signal',
			style: SIGNAL + 'shape=pd_signal_data;', data: {signal_type: 'data link'},
			tags: 'data link software fieldbus communication'})
	], true);

	// ---------------------------------------------------------------- Annotations
	L.addPalette('pdAnnotations', 'ProcessDraw / Connectors & Annotations',
	[
		{id: 'pd_flow_arrow', name: 'Flow Arrow', type: 'annotation.flow_arrow', cls: 'annotation', label: '',
			w: 20, h: 12, draw: 'p M 0 0 L 20 6 L 0 12 Z; F', nozzles: [[0, 6, 'in'], [20, 6, 'out']],
			tags: 'flow arrow direction'},
		{id: 'pd_offpage_out', name: 'Off-Page Connector (outgoing)', type: 'offpage.out', cls: 'offpage',
			label: '%description%<br><b>%sheet%</b>', labelInside: true, w: 80, h: 30,
			draw: 'p M 0 0 L 65 0 L 80 15 L 65 30 L 0 30 Z; fs', nozzles: [[0, 15, 'in']],
			data: {direction: 'to', description: 'TO', sheet: 'SHEET ?'}, style: 'fontSize=9;',
			tags: 'off page connector continuation sheet to'},
		{id: 'pd_offpage_in', name: 'Off-Page Connector (incoming)', type: 'offpage.in', cls: 'offpage',
			label: '%description%<br><b>%sheet%</b>', labelInside: true, w: 80, h: 30,
			draw: 'p M 0 0 L 65 0 L 80 15 L 65 30 L 0 30 Z; fs', nozzles: [[80, 15, 'out']],
			data: {direction: 'from', description: 'FROM', sheet: 'SHEET ?'}, style: 'fontSize=9;',
			tags: 'off page connector continuation sheet from'},
		{id: 'pd_tie_in', name: 'Tie-in Point', type: 'special.tie_in', cls: 'special', template: 'special',
			prefix: 'TP', labelInside: true, w: 40, h: 24,
			draw: 'p M 8 0 L 32 0 L 40 12 L 32 24 L 8 24 L 0 12 Z; fs',
			nozzles: [[0, 12, 'in'], [40, 12, 'out']], style: 'fontSize=9;', tags: 'tie-in tie in point'},
		{id: 'pd_battery_limit', name: 'Battery Limit', type: 'annotation.battery_limit', cls: 'annotation',
			label: 'BATTERY LIMIT', w: 20, h: 200, draw: 'd 1; dp 6 2 1.5 2; p M 10 0 L 10 200; s; d 0',
			style: 'strokeWidth=2;fontSize=9;whiteSpace=nowrap;', tags: 'battery limit boundary plot'}
	]);
})();
