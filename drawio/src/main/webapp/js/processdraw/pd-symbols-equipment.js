/**
 * ProcessDraw equipment symbols (ISO 10628-2 / DIN EN ISO 10628-2 style).
 * Nozzles are named connection points; the drawing language is in pd-stencil.js.
 */
(function()
{
	var L = ProcessDraw.Library;
	var ISO = 'ISO 10628-2';

	// Vertical vessel body with elliptical heads of height hh
	function vbody(x, y, w, h, hh)
	{
		return 'p M ' + x + ' ' + (y + hh) + ' A ' + (w / 2) + ' ' + hh + ' 0 0 1 ' + (x + w) + ' ' + (y + hh) +
			' L ' + (x + w) + ' ' + (y + h - hh) + ' A ' + (w / 2) + ' ' + hh + ' 0 0 1 ' + x + ' ' + (y + h - hh) + ' Z;';
	};

	// Horizontal vessel body with elliptical heads of width hw
	function hbody(x, y, w, h, hw)
	{
		return 'p M ' + (x + hw) + ' ' + y + ' L ' + (x + w - hw) + ' ' + y + ' A ' + hw + ' ' + (h / 2) + ' 0 0 1 ' +
			(x + w - hw) + ' ' + (y + h) + ' L ' + (x + hw) + ' ' + (y + h) + ' A ' + hw + ' ' + (h / 2) + ' 0 0 1 ' +
			(x + hw) + ' ' + y + ' Z;';
	};

	// Nozzles at the given heights on both sides of a vertical body
	function sideNozzles(w, ys)
	{
		var result = [];

		for (var i = 0; i < ys.length; i++)
		{
			result.push([0, ys[i], 'L' + (i + 1)]);
			result.push([w, ys[i], 'R' + (i + 1)]);
		}

		return result;
	};

	// Alternating trays of a tray column
	function trays(w, y0, y1, step)
	{
		var p = 'p';

		for (var y = y0, i = 0; y <= y1; y += step, i++)
		{
			p += (i % 2 == 0) ? ' M 0 ' + y + ' L ' + (w * 0.7) + ' ' + y :
				' M ' + (w * 0.3) + ' ' + y + ' L ' + w + ' ' + y;
		}

		return p + '; s;';
	};

	// Zigzag between x0 and x1 at height yc with amplitude a
	function zigzag(x0, x1, yc, a, n)
	{
		var step = (x1 - x0) / n;
		var p = 'p M ' + x0 + ' ' + yc;

		for (var i = 1; i < n; i++)
		{
			p += ' L ' + (x0 + i * step) + ' ' + ((i % 2 == 1) ? yc - a : yc + a);
		}

		return p + ' L ' + x1 + ' ' + yc + '; s;';
	};

	function eq(def)
	{
		def.cls = 'equipment';
		def.standard = def.standard || ISO;
		return def;
	};

	// ---------------------------------------------------------------- Vessels & Columns
	L.addPalette('pdVessels', 'ProcessDraw / Vessels & Columns',
	[
		eq({id: 'pd_vessel_vertical', name: 'Vertical Vessel', type: 'vessel.vertical', prefix: 'V',
			template: 'vessel', w: 40, h: 100, draw: vbody(0, 0, 40, 100, 12) + 'fs',
			nozzles: [[20, 0, 'top'], [20, 100, 'bottom']].concat(sideNozzles(40, [25, 50, 75])),
			data: {orientation: 'vertical'}, tags: 'drum vessel vertical pressure'}),
		eq({id: 'pd_vessel_vertical_demister', name: 'Vertical Separator (Demister)', type: 'vessel.separator.vertical',
			prefix: 'V', template: 'vessel', w: 40, h: 100,
			draw: vbody(0, 0, 40, 100, 12) + 'fs; r 4 18 32 7; s; p M 4 18 L 36 25 M 4 25 L 36 18; s',
			nozzles: [[20, 0, 'gas-out'], [20, 100, 'liquid-out']].concat(sideNozzles(40, [40, 60, 80])),
			data: {orientation: 'vertical'}, tags: 'knock out drum ko separator mist eliminator demister'}),
		eq({id: 'pd_vessel_horizontal', name: 'Horizontal Vessel', type: 'vessel.horizontal', prefix: 'V',
			template: 'vessel', w: 100, h: 40, draw: hbody(0, 0, 100, 40, 12) + 'fs',
			nozzles: [[25, 0, 'T1'], [50, 0, 'T2'], [75, 0, 'T3'], [25, 40, 'B1'], [50, 40, 'B2'],
				[75, 40, 'B3'], [0, 20, 'end-left'], [100, 20, 'end-right']],
			data: {orientation: 'horizontal'}, tags: 'drum vessel horizontal accumulator'}),
		eq({id: 'pd_vessel_horizontal_boot', name: 'Horizontal Vessel with Boot', type: 'vessel.horizontal.boot',
			prefix: 'V', template: 'vessel', w: 100, h: 55,
			draw: 'r 62 30 16 25; fs; ' + hbody(0, 0, 100, 40, 12) + 'fs',
			nozzles: [[25, 0, 'T1'], [50, 0, 'T2'], [75, 0, 'T3'], [25, 40, 'B1'], [45, 40, 'B2'],
				[70, 55, 'boot'], [0, 20, 'end-left'], [100, 20, 'end-right']],
			data: {orientation: 'horizontal'}, tags: 'drum boot water reflux accumulator'}),
		eq({id: 'pd_vessel_three_phase', name: '3-Phase Separator (Weir)', type: 'vessel.separator.three_phase',
			prefix: 'V', template: 'vessel', w: 100, h: 40,
			draw: hbody(0, 0, 100, 40, 12) + 'fs; p M 70 40 L 70 22; s',
			nozzles: [[0, 20, 'inlet'], [50, 0, 'gas-out'], [25, 0, 'T1'], [85, 0, 'T2'],
				[35, 40, 'water-out'], [85, 40, 'oil-out'], [100, 20, 'end-right']],
			data: {orientation: 'horizontal'}, tags: 'separator three phase weir oil water gas'}),
		eq({id: 'pd_column_trays', name: 'Tray Column', type: 'column.trays', prefix: 'T', template: 'column',
			w: 40, h: 160, draw: vbody(0, 0, 40, 160, 10) + 'fs; ' + trays(40, 30, 130, 12),
			nozzles: [[20, 0, 'top'], [20, 160, 'bottom']].concat(sideNozzles(40, [20, 45, 80, 115, 140])),
			data: {internals: 'trays'}, tags: 'column tower distillation tray absorber stripper'}),
		eq({id: 'pd_column_packed', name: 'Packed Column', type: 'column.packed', prefix: 'T', template: 'column',
			w: 40, h: 160, draw: vbody(0, 0, 40, 160, 10) + 'fs; p M 0 30 L 40 30 M 0 70 L 40 70 M 0 30 L 40 70 ' +
				'M 40 30 L 0 70 M 0 90 L 40 90 M 0 130 L 40 130 M 0 90 L 40 130 M 40 90 L 0 130; s',
			nozzles: [[20, 0, 'top'], [20, 160, 'bottom']].concat(sideNozzles(40, [20, 80, 140])),
			data: {internals: 'packing'}, tags: 'column tower packed packing absorber scrubber'})
	], true);

	// ---------------------------------------------------------------- Tanks & Storage
	L.addPalette('pdTanks', 'ProcessDraw / Tanks & Storage',
	[
		eq({id: 'pd_tank_cone_roof', name: 'Cone Roof Tank', type: 'tank.cone_roof', prefix: 'TK', template: 'tank',
			w: 80, h: 60, draw: 'p M 0 10 L 40 0 L 80 10 L 80 60 L 0 60 Z; fs',
			nozzles: [[40, 0, 'vent'], [0, 25, 'L1'], [0, 55, 'L2'], [80, 25, 'R1'], [80, 55, 'R2'], [40, 60, 'bottom']],
			data: {roof_type: 'cone'}, tags: 'storage tank atmospheric cone roof'}),
		eq({id: 'pd_tank_dome_roof', name: 'Dome Roof Tank', type: 'tank.dome_roof', prefix: 'TK', template: 'tank',
			w: 80, h: 60, draw: 'p M 0 12 Q 40 -8 80 12 L 80 60 L 0 60 Z; fs',
			nozzles: [[40, 2, 'vent'], [0, 25, 'L1'], [0, 55, 'L2'], [80, 25, 'R1'], [80, 55, 'R2'], [40, 60, 'bottom']],
			data: {roof_type: 'dome'}, tags: 'storage tank dome roof'}),
		eq({id: 'pd_tank_floating_roof', name: 'Floating Roof Tank', type: 'tank.floating_roof', prefix: 'TK',
			template: 'tank', w: 80, h: 60,
			draw: 'r 0 0 80 60; f; p M 0 0 L 0 60 L 80 60 L 80 0; s; p M 2 14 L 78 14 L 74 20 L 6 20 Z; fs',
			nozzles: [[0, 35, 'L1'], [0, 55, 'L2'], [80, 35, 'R1'], [80, 55, 'R2'], [40, 60, 'bottom']],
			data: {roof_type: 'floating'}, tags: 'storage tank floating roof crude'}),
		eq({id: 'pd_tank_open', name: 'Open Tank / Pit', type: 'tank.open', prefix: 'TK', template: 'tank',
			w: 80, h: 50, draw: 'r 0 0 80 50; f; p M 0 0 L 0 50 L 80 50 L 80 0; s',
			nozzles: [[20, 0, 'T1'], [60, 0, 'T2'], [0, 40, 'L1'], [80, 40, 'R1'], [40, 50, 'bottom']],
			data: {roof_type: 'open'}, tags: 'open tank basin pit sump'}),
		eq({id: 'pd_tank_sphere', name: 'Spherical Tank', type: 'tank.sphere', prefix: 'TK', template: 'tank',
			w: 60, h: 72, draw: 'p M 12 52 L 8 72 M 48 52 L 52 72; s; e 0 0 60 60; fs',
			nozzles: [[30, 0, 'top'], [30, 60, 'bottom'], [0, 30, 'L1'], [60, 30, 'R1']],
			data: {roof_type: 'sphere'}, tags: 'sphere spherical tank lpg pressure storage'}),
		eq({id: 'pd_tank_bullet', name: 'Horizontal Storage (Bullet)', type: 'tank.bullet', prefix: 'TK',
			template: 'tank', w: 120, h: 48,
			draw: 'p M 25 40 L 22 48 L 38 48 L 35 40 M 85 40 L 82 48 L 98 48 L 95 40; s; ' + hbody(0, 0, 120, 40, 14) + 'fs',
			nozzles: [[30, 0, 'T1'], [60, 0, 'T2'], [90, 0, 'T3'], [60, 40, 'bottom'], [0, 20, 'end-left'],
				[120, 20, 'end-right']],
			data: {roof_type: 'bullet'}, tags: 'bullet horizontal storage lpg saddle'}),
		eq({id: 'pd_silo', name: 'Silo / Bin with Hopper', type: 'tank.silo', prefix: 'TK', template: 'tank',
			w: 50, h: 90, draw: 'p M 0 0 L 50 0 L 50 60 L 30 85 L 30 90 L 20 90 L 20 85 L 0 60 Z; fs',
			nozzles: [[25, 0, 'top'], [25, 90, 'outlet'], [0, 20, 'L1'], [50, 20, 'R1']],
			data: {roof_type: 'silo'}, tags: 'silo bin hopper bunker solids'})
	]);

	// ---------------------------------------------------------------- Heat Transfer
	L.addPalette('pdHeatTransfer', 'ProcessDraw / Heat Transfer',
	[
		eq({id: 'pd_hx_general', name: 'Heat Exchanger (general)', type: 'hx.general', prefix: 'E',
			template: 'heat_exchanger', w: 40, h: 40, aspect: true,
			draw: 'e 0 0 40 40; fs; p M 0 20 L 10 20 L 15 10 L 25 30 L 30 20 L 40 20; s',
			nozzles: [[0, 20, 'tube-in'], [40, 20, 'tube-out'], [20, 0, 'shell-in'], [20, 40, 'shell-out']],
			tags: 'heat exchanger cooler heater condenser'}),
		eq({id: 'pd_hx_shell_tube_u', name: 'Shell & Tube (U-tube)', type: 'hx.shell_tube.u', prefix: 'E',
			template: 'heat_exchanger', w: 120, h: 40,
			draw: 'p M 20 0 L 108 0 A 12 20 0 0 1 108 40 L 20 40 Z; fs; r 0 0 20 40; fs; p M 0 20 L 20 20; s; ' +
				'p M 20 12 L 100 12 A 8 8 0 0 1 100 28 L 20 28; s',
			nozzles: [[6, 0, 'tube-in'], [6, 40, 'tube-out'], [40, 0, 'shell-in'], [95, 40, 'shell-out'],
				[95, 0, 'shell-vent'], [40, 40, 'shell-drain']],
			data: {tema_type: 'BEU'}, tags: 'shell tube u-tube heat exchanger tema'}),
		eq({id: 'pd_hx_shell_tube_fixed', name: 'Shell & Tube (fixed tubesheet)', type: 'hx.shell_tube.fixed',
			prefix: 'E', template: 'heat_exchanger', w: 120, h: 40,
			draw: 'r 0 0 15 40; fs; r 105 0 15 40; fs; r 15 0 90 40; fs; p M 15 14 L 105 14 M 15 26 L 105 26; s',
			nozzles: [[7.5, 0, 'tube-in'], [112.5, 40, 'tube-out'], [0, 20, 'tube-axial-in'],
				[120, 20, 'tube-axial-out'], [30, 0, 'shell-in'], [90, 40, 'shell-out'], [90, 0, 'shell-vent'],
				[30, 40, 'shell-drain']],
			data: {tema_type: 'BEM'}, tags: 'shell tube fixed tubesheet heat exchanger condenser tema'}),
		eq({id: 'pd_hx_kettle', name: 'Kettle Reboiler', type: 'hx.kettle', prefix: 'E', template: 'heat_exchanger',
			w: 120, h: 60,
			draw: 'p M 15 15 L 30 15 L 45 0 L 108 0 A 12 30 0 0 1 108 60 L 45 60 L 30 45 L 15 45 Z; fs; ' +
				'r 0 15 15 30; fs; p M 0 30 L 15 30; s; p M 15 24 L 95 24 A 6 6 0 0 1 95 36 L 15 36; s',
			nozzles: [[7.5, 15, 'tube-in'], [7.5, 45, 'tube-out'], [60, 60, 'liquid-in'], [80, 0, 'vapour-out'],
				[108, 60, 'liquid-out']],
			data: {tema_type: 'BKU'}, tags: 'kettle reboiler vaporizer'}),
		eq({id: 'pd_hx_plate', name: 'Plate Heat Exchanger', type: 'hx.plate', prefix: 'E',
			template: 'heat_exchanger', w: 40, h: 60,
			draw: 'r 0 0 40 60; fs; p M 8 4 L 8 56 M 14 4 L 14 56 M 20 4 L 20 56 M 26 4 L 26 56 M 32 4 L 32 56; s',
			nozzles: [[8, 0, 'A-in'], [32, 0, 'B-out'], [8, 60, 'A-out'], [32, 60, 'B-in']],
			data: {tema_type: 'plate'}, tags: 'plate heat exchanger gasketed phe'}),
		eq({id: 'pd_hx_air_cooler', name: 'Air Cooler (Fin Fan)', type: 'hx.air_cooler', prefix: 'E',
			template: 'heat_exchanger', w: 80, h: 44,
			draw: 'r 0 0 80 14; fs; ' + zigzag(4, 76, 7, 4, 9) + ' e 30 18 20 20; fs; ' +
				'p M 33 21 L 47 35 M 47 21 L 33 35 M 40 38 L 40 44; s',
			nozzles: [[0, 7, 'in'], [80, 7, 'out']],
			data: {tema_type: 'air cooled'}, tags: 'air cooler fin fan aerial cooler'}),
		eq({id: 'pd_hx_coil', name: 'Heating / Cooling Coil', type: 'hx.coil', prefix: 'E',
			template: 'heat_exchanger', w: 40, h: 30,
			draw: 'p M 0 5 L 30 5 A 5 5 0 0 1 30 15 L 10 15 A 5 5 0 0 0 10 25 L 40 25; s',
			nozzles: [[0, 5, 'in'], [40, 25, 'out']], style: 'fillColor=none;',
			tags: 'coil heating cooling steam coil internal'}),
		eq({id: 'pd_hx_electric', name: 'Electric Heater', type: 'hx.electric', prefix: 'E',
			template: 'heat_exchanger', w: 40, h: 40, aspect: true,
			draw: 'r 0 0 40 40; fs; p M 4 20 L 10 20 L 13 12 L 19 28 L 25 12 L 31 28 L 34 20 L 36 20; s',
			nozzles: [[20, 0, 'in'], [20, 40, 'out']], tags: 'electric heater resistance'}),
		eq({id: 'pd_fired_heater', name: 'Fired Heater / Furnace', type: 'fired_heater', prefix: 'H',
			template: 'fired_heater', w: 70, h: 110,
			draw: 'r 28 0 14 25; fs; p M 0 50 L 20 25 L 50 25 L 70 50 Z; fs; r 0 50 70 60; fs; ' +
				'p M 10 100 L 10 60 L 20 60 L 20 100 L 30 100 L 30 60 L 40 60 L 40 100 L 50 100 L 50 60 ' +
				'L 60 60 L 60 100; s; p M 30 110 L 35 101 L 40 110 Z; F',
			nozzles: [[0, 95, 'feed-in'], [70, 65, 'outlet'], [35, 110, 'fuel'], [35, 0, 'stack']],
			tags: 'fired heater furnace reboiler heater burner'}),
		eq({id: 'pd_cooling_tower', name: 'Cooling Tower', type: 'cooling_tower', prefix: 'CT',
			template: 'equipment', w: 70, h: 80, draw: 'p M 5 80 Q 22 40 10 0 L 60 0 Q 48 40 65 80 Z; fs',
			nozzles: [[15, 40, 'water-in'], [55, 40, 'water-in-2'], [35, 80, 'basin-out'], [65, 80, 'make-up']],
			tags: 'cooling tower water'})
	]);

	// ---------------------------------------------------------------- Pumps, Compressors & Drivers
	L.addPalette('pdRotating', 'ProcessDraw / Pumps, Compressors & Drivers',
	[
		eq({id: 'pd_pump_centrifugal', name: 'Centrifugal Pump', type: 'pump.centrifugal', prefix: 'P',
			template: 'pump', w: 40, h: 44, aspect: true,
			draw: 'p M 9 35 L 5 44 L 35 44 L 31 35; s; e 0 0 40 40; fs; p M 20 0 L 40 0; s',
			nozzles: [[0, 20, 'suction'], [40, 0, 'discharge']], tags: 'pump centrifugal'}),
		eq({id: 'pd_pump_din', name: 'Pump (DIN EN ISO 10628)', type: 'pump.general', prefix: 'P',
			template: 'pump', w: 40, h: 40, aspect: true, standard: 'DIN EN ISO 10628-2',
			draw: 'e 0 0 40 40; fs; p M 20 0 L 40 20 L 20 40; s',
			nozzles: [[0, 20, 'suction'], [40, 20, 'discharge']], tags: 'pump din iso general'}),
		eq({id: 'pd_pump_gear', name: 'Gear Pump', type: 'pump.gear', prefix: 'P', template: 'pump',
			w: 40, h: 40, aspect: true, draw: 'e 0 0 40 40; fs; e 8 12 12 16; s; e 20 12 12 16; s',
			nozzles: [[0, 20, 'suction'], [40, 20, 'discharge']], tags: 'pump gear positive displacement'}),
		eq({id: 'pd_pump_screw', name: 'Screw Pump', type: 'pump.screw', prefix: 'P', template: 'pump',
			w: 40, h: 40, aspect: true,
			draw: 'e 0 0 40 40; fs; p M 6 20 L 10 14 L 14 26 L 18 14 L 22 26 L 26 14 L 30 26 L 34 20; s',
			nozzles: [[0, 20, 'suction'], [40, 20, 'discharge']], tags: 'pump screw progressive cavity'}),
		eq({id: 'pd_pump_reciprocating', name: 'Reciprocating Pump', type: 'pump.reciprocating', prefix: 'P',
			template: 'pump', w: 40, h: 40, aspect: true, draw: 'e 0 0 40 40; fs; p M 8 20 L 26 20 M 26 11 L 26 29; s',
			nozzles: [[0, 20, 'suction'], [40, 20, 'discharge']], tags: 'pump reciprocating piston plunger metering'}),
		eq({id: 'pd_pump_diaphragm', name: 'Diaphragm Pump', type: 'pump.diaphragm', prefix: 'P', template: 'pump',
			w: 40, h: 40, aspect: true, draw: 'e 0 0 40 40; fs; p M 20 5 Q 32 20 20 35; s',
			nozzles: [[0, 20, 'suction'], [40, 20, 'discharge']], tags: 'pump diaphragm membrane dosing'}),
		eq({id: 'pd_pump_vacuum', name: 'Vacuum Pump (Liquid Ring)', type: 'pump.vacuum', prefix: 'P',
			template: 'pump', w: 40, h: 40, aspect: true, draw: 'e 0 0 40 40; fs; e 4 2 28 28; s',
			nozzles: [[0, 20, 'suction'], [40, 20, 'discharge']], tags: 'vacuum pump liquid ring'}),
		eq({id: 'pd_compressor_general', name: 'Compressor (general)', type: 'compressor.general', prefix: 'K',
			template: 'compressor', w: 40, h: 40, aspect: true, draw: 'e 0 0 40 40; fs; p M 6 9 L 34 15 L 34 25 L 6 31 Z; s',
			nozzles: [[0, 20, 'suction'], [40, 20, 'discharge']], tags: 'compressor general'}),
		eq({id: 'pd_compressor_centrifugal', name: 'Centrifugal / Axial Compressor', type: 'compressor.centrifugal',
			prefix: 'K', template: 'compressor', w: 50, h: 50, draw: 'p M 0 0 L 50 12 L 50 38 L 0 50 Z; fs',
			nozzles: [[0, 25, 'suction'], [50, 25, 'discharge']], tags: 'compressor centrifugal axial turbo'}),
		eq({id: 'pd_compressor_reciprocating', name: 'Reciprocating Compressor', type: 'compressor.reciprocating',
			prefix: 'K', template: 'compressor', w: 40, h: 30,
			draw: 'r 0 0 40 30; fs; p M 14 5 L 14 25 M 14 15 L 40 15; s',
			nozzles: [[6, 0, 'suction'], [6, 30, 'discharge']], tags: 'compressor reciprocating piston'}),
		eq({id: 'pd_fan', name: 'Fan / Blower', type: 'fan', prefix: 'B', template: 'fan', w: 40, h: 40, aspect: true,
			draw: 'e 0 0 40 40; fs; p M 20 20 L 20 2 M 20 20 L 36 29 M 20 20 L 4 29; s',
			nozzles: [[0, 20, 'inlet'], [40, 20, 'outlet']], tags: 'fan blower ventilator'}),
		eq({id: 'pd_turbine', name: 'Turbine / Expander', type: 'turbine', prefix: 'TU', template: 'compressor',
			w: 50, h: 50, draw: 'p M 0 12 L 50 0 L 50 50 L 0 38 Z; fs',
			nozzles: [[0, 25, 'inlet'], [50, 25, 'exhaust']], tags: 'turbine steam gas expander'}),
		eq({id: 'pd_motor', name: 'Electric Motor', type: 'driver.motor', prefix: 'M', template: 'driver',
			w: 30, h: 30, aspect: true, draw: 'e 0 0 30 30; fs; t 15 15 14 M',
			nozzles: [[0, 15, 'shaft-1'], [30, 15, 'shaft-2']], tags: 'motor electric driver'}),
		eq({id: 'pd_ejector', name: 'Ejector / Eductor', type: 'ejector', prefix: 'J', template: 'equipment',
			w: 60, h: 24, draw: 'p M 0 4 L 20 4 L 30 10 L 40 10 L 60 0 L 60 24 L 40 14 L 30 14 L 20 20 L 0 20 Z; fs',
			nozzles: [[0, 12, 'motive'], [24, 18, 'suction'], [60, 12, 'discharge']],
			tags: 'ejector eductor jet steam jet'})
	]);

	// ---------------------------------------------------------------- Separation, Mixing & Solids
	L.addPalette('pdSeparation', 'ProcessDraw / Separation, Mixing & Solids',
	[
		eq({id: 'pd_filter', name: 'Filter (general)', type: 'filter.general', prefix: 'F', template: 'filter',
			w: 40, h: 40, draw: 'r 0 0 40 40; fs; d 1; p M 0 40 L 40 0; s; d 0',
			nozzles: [[0, 10, 'inlet'], [40, 30, 'outlet'], [20, 0, 'vent'], [20, 40, 'drain']],
			tags: 'filter strainer'}),
		eq({id: 'pd_filter_cartridge', name: 'Cartridge / Bag Filter', type: 'filter.cartridge', prefix: 'F',
			template: 'filter', w: 40, h: 80,
			draw: vbody(0, 0, 40, 80, 10) + 'fs; d 1; p M 12 18 L 12 62 M 20 18 L 20 62 M 28 18 L 28 62; s; d 0',
			nozzles: [[0, 60, 'inlet'], [40, 20, 'outlet'], [20, 0, 'vent'], [20, 80, 'drain']],
			tags: 'cartridge bag filter coalescer'}),
		eq({id: 'pd_cyclone', name: 'Cyclone', type: 'cyclone', prefix: 'CY', template: 'equipment', w: 40, h: 80,
			draw: 'p M 0 0 L 40 0 L 40 30 L 24 75 L 24 80 L 16 80 L 16 75 L 0 30 Z; fs; p M 15 0 L 15 18 M 25 0 L 25 18; s',
			nozzles: [[0, 8, 'inlet'], [20, 0, 'gas-out'], [20, 80, 'solids-out']],
			tags: 'cyclone hydrocyclone separator dust'}),
		eq({id: 'pd_centrifuge', name: 'Centrifuge', type: 'centrifuge', prefix: 'CF', template: 'equipment',
			w: 40, h: 40, aspect: true, draw: 'e 0 0 40 40; fs; e 10 10 20 20; s; p M 20 4 L 20 36; s',
			nozzles: [[0, 20, 'feed'], [40, 20, 'liquid-out'], [20, 40, 'solids-out']],
			tags: 'centrifuge decanter separator'}),
		eq({id: 'pd_reactor_jacketed', name: 'Stirred Reactor (jacketed)', type: 'reactor.stirred', prefix: 'R',
			template: 'vessel', w: 60, h: 100,
			draw: 'p M 0 30 L 0 85 A 30 15 0 0 0 60 85 L 60 30; s; ' + vbody(6, 3, 48, 91, 12) + 'fs; ' +
				'p M 30 0 L 30 72 M 18 72 L 42 72 M 18 68 L 18 76 M 42 68 L 42 76; s',
			nozzles: [[18, 4.6, 'N1'], [42, 4.6, 'N2'], [30, 100, 'bottom'], [0, 40, 'jacket-in'],
				[60, 80, 'jacket-out']],
			tags: 'reactor stirred tank cstr jacket agitated vessel'}),
		eq({id: 'pd_agitator', name: 'Agitator with Motor', type: 'agitator', prefix: 'AG', template: 'agitator',
			w: 30, h: 75,
			draw: 'p M 15 20 L 15 70 M 3 70 L 27 70 M 3 66 L 3 74 M 27 66 L 27 74; s; e 5 0 20 20; fs; t 15 10 11 M',
			nozzles: [[15, 0, 'top']], tags: 'agitator mixer stirrer impeller'}),
		eq({id: 'pd_static_mixer', name: 'Static Mixer', type: 'mixer.static', prefix: 'MX', template: 'equipment',
			w: 60, h: 20, draw: 'r 0 0 60 20; fs; p M 0 0 L 10 20 L 20 0 L 30 20 L 40 0 L 50 20 L 60 0; s',
			nozzles: [[0, 10, 'inlet'], [60, 10, 'outlet']], tags: 'static mixer inline'}),
		eq({id: 'pd_dryer_rotary', name: 'Rotary Dryer / Kiln', type: 'dryer.rotary', prefix: 'D',
			template: 'equipment', w: 100, h: 40, draw: 'r 0 5 100 30; fs; p M 20 0 L 20 40 M 80 0 L 80 40; s',
			nozzles: [[0, 20, 'feed'], [100, 20, 'product']], tags: 'dryer rotary kiln drum'}),
		eq({id: 'pd_conveyor_belt', name: 'Belt Conveyor', type: 'conveyor.belt', prefix: 'CV', template: 'equipment',
			w: 100, h: 20,
			draw: 'p M 10 0 L 90 0 A 10 10 0 0 1 90 20 L 10 20 A 10 10 0 0 1 10 0 Z; fs; e 3 3 14 14; s; e 83 3 14 14; s',
			nozzles: [[10, 0, 'feed'], [100, 10, 'discharge']], tags: 'conveyor belt solids'}),
		eq({id: 'pd_conveyor_screw', name: 'Screw Conveyor', type: 'conveyor.screw', prefix: 'CV',
			template: 'equipment', w: 100, h: 20, draw: 'r 0 0 100 20; fs; ' + zigzag(0, 100, 10, 8, 10),
			nozzles: [[10, 0, 'feed'], [90, 20, 'discharge']], tags: 'screw conveyor auger solids'}),
		eq({id: 'pd_rotary_feeder', name: 'Rotary Feeder / Airlock', type: 'feeder.rotary', prefix: 'RF',
			template: 'equipment', w: 30, h: 30, aspect: true,
			draw: 'r 0 0 30 30; fs; e 3 3 24 24; s; p M 15 3 L 15 27 M 3 15 L 27 15; s',
			nozzles: [[15, 0, 'inlet'], [15, 30, 'outlet']], tags: 'rotary feeder airlock valve star'}),
		eq({id: 'pd_flare', name: 'Flare Stack', type: 'flare', prefix: 'FL', template: 'equipment', w: 30, h: 100,
			draw: 'r 10 20 10 80; fs; p M 15 0 Q 26 10 20 18 L 10 18 Q 4 10 15 0 Z; F',
			nozzles: [[15, 100, 'inlet']], tags: 'flare stack'})
	]);
})();
