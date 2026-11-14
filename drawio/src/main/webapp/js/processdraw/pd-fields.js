/**
 * ProcessDraw field definitions: labels, units and suggested values for the
 * engineering data fields. Values are stored as plain text in the project's
 * unit system (Project settings > Units); the unit is only shown, not stored.
 */
(function()
{
	var ProcessDraw = window.ProcessDraw = window.ProcessDraw || {};

	var UNITS =
	{
		metric:
		{
			pressure: 'barg', dp: 'bar', temperature: '°C', flow: 'm³/h', length: 'm', dimension: 'mm',
			volume: 'm³', area: 'm²', power: 'kW', duty: 'kW', head: 'm', speed: 'rpm', voltage: 'V',
			size: 'DN', micron: 'µm', mass_flow: 'kg/h', molar_flow: 'kmol/h', vol_flow: 'm³/h',
			std_gas_flow: 'Sm³/h', mw: 'kg/kmol', density: 'kg/m³', viscosity: 'cP'
		},
		imperial:
		{
			pressure: 'psig', dp: 'psi', temperature: '°F', flow: 'gpm', length: 'ft', dimension: 'in',
			volume: 'gal', area: 'ft²', power: 'hp', duty: 'MMBtu/h', head: 'ft', speed: 'rpm', voltage: 'V',
			size: 'in', micron: 'µm', mass_flow: 'lb/h', molar_flow: 'lbmol/h', vol_flow: 'ft³/h',
			std_gas_flow: 'MMSCFD', mw: 'lb/lbmol', density: 'lb/ft³', viscosity: 'cP'
		}
	};

	var MATERIALS = ['CS', 'LTCS', 'SS304', 'SS304L', 'SS316', 'SS316L', 'Duplex SS', 'Super Duplex', 'Alloy 20',
		'Hastelloy C-276', 'Inconel 625', 'Monel', 'Titanium', 'Copper', 'PP', 'PVC', 'PVDF', 'HDPE', 'FRP / GRP',
		'Glass-lined CS', 'Rubber-lined CS'];

	/**
	 * q: quantity for the unit, options: suggested values, label: field caption.
	 */
	var FIELDS =
	{
		service: {label: 'Service'},
		material: {label: 'Material', options: MATERIALS},
		operating_pressure: {label: 'Operating pressure', q: 'pressure'},
		operating_temperature: {label: 'Operating temperature', q: 'temperature'},
		design_pressure: {label: 'Design pressure', q: 'pressure'},
		design_temperature: {label: 'Design temperature', q: 'temperature'},
		diameter: {label: 'Diameter', q: 'dimension'},
		length_tt: {label: 'Length T/T', q: 'dimension'},
		height_tt: {label: 'Height T/T', q: 'dimension'},
		height: {label: 'Height', q: 'length'},
		volume: {label: 'Volume', q: 'volume'},
		orientation: {label: 'Orientation', options: ['vertical', 'horizontal']},
		internals: {label: 'Internals', options: ['trays', 'structured packing', 'random packing', 'none']},
		number_of_trays: {label: 'Number of trays / beds'},
		roof_type: {label: 'Roof type', options: ['cone', 'dome', 'floating', 'open', 'sphere', 'bullet', 'silo']},
		capacity: {label: 'Capacity'},
		duty: {label: 'Duty', q: 'duty'},
		area: {label: 'Heat transfer area', q: 'area'},
		tema_type: {label: 'TEMA type', options: ['AES', 'AEU', 'AEM', 'BEM', 'BEU', 'BKU', 'AKT', 'NEN',
			'plate', 'air cooled']},
		shell_side_fluid: {label: 'Shell side fluid'},
		tube_side_fluid: {label: 'Tube side fluid'},
		fuel: {label: 'Fuel', options: ['fuel gas', 'fuel oil', 'dual fuel']},
		flow_rate: {label: 'Flow rate', q: 'flow'},
		differential_head: {label: 'Differential head', q: 'head'},
		npsh_required: {label: 'NPSH required', q: 'head'},
		power: {label: 'Power', q: 'power'},
		driver: {label: 'Driver', options: ['electric motor', 'steam turbine', 'gas turbine', 'diesel engine',
			'hydraulic motor', 'none']},
		suction_pressure: {label: 'Suction pressure', q: 'pressure'},
		discharge_pressure: {label: 'Discharge pressure', q: 'pressure'},
		differential_pressure: {label: 'Differential pressure', q: 'dp'},
		voltage: {label: 'Voltage', q: 'voltage', options: ['230', '400', '690', '3300', '6600', '11000']},
		speed: {label: 'Speed', q: 'speed'},
		filtration_rating: {label: 'Filtration rating', q: 'micron'},
		impeller_type: {label: 'Impeller type', options: ['pitched blade', 'Rushton turbine', 'anchor',
			'propeller', 'helical ribbon']},
		size: {label: 'Size', q: 'size'},
		pipe_class: {label: 'Pipe class'},
		end_connection: {label: 'End connection', options: ['flanged RF', 'flanged RTJ', 'butt weld',
			'socket weld', 'threaded', 'wafer', 'lug']},
		normal_position: {label: 'Normal position', options: ['NO', 'NC', 'LO', 'LC', 'CSO', 'CSC']},
		cv: {label: 'Cv'},
		fail_position: {label: 'Fail position', options: ['FC', 'FO', 'FL', 'FI']},
		actuator: {label: 'Actuator', options: ['pneumatic diaphragm', 'pneumatic piston', 'electric motor',
			'solenoid', 'hydraulic', 'self-acting', 'manual']},
		set_pressure: {label: 'Set pressure', q: 'pressure'},
		inlet_size: {label: 'Inlet size', q: 'size'},
		outlet_size: {label: 'Outlet size', q: 'size'},
		orifice: {label: 'Orifice letter', options: ['D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P',
			'Q', 'R', 'T']},
		discharge_to: {label: 'Discharge to', options: ['atmosphere', 'flare', 'closed drain', 'vent header']},
		'function': {label: 'Function letters'},
		loop: {label: 'Loop number'},
		location: {label: 'Location', options: ['field', 'control room', 'local panel', 'behind panel']},
		range: {label: 'Range'},
		units: {label: 'Engineering units'},
		meter_type: {label: 'Meter type', options: ['magnetic', 'coriolis', 'vortex', 'turbine', 'ultrasonic',
			'DP', 'thermal', 'variable area']},
		line_number: {label: 'Line number'},
		service_code: {label: 'Service code'},
		sequence: {label: 'Sequence'},
		insulation: {label: 'Insulation', options: ['H|hot conservation', 'C|cold', 'P|personnel protection',
			'A|acoustic', 'ET|electric traced', 'ST|steam traced', 'J|jacketed']},
		fluid: {label: 'Fluid'},
		from: {label: 'From'},
		to: {label: 'To'},
		signal_type: {label: 'Signal type', options: ['process connection', 'electric', 'pneumatic', 'hydraulic',
			'capillary', 'data link']},
		direction: {label: 'Direction', options: ['to', 'from']},
		sheet: {label: 'Sheet'},
		connector_id: {label: 'Connector ID'},
		description: {label: 'Description'},
		stream_number: {label: 'Stream number'},
		temperature: {label: 'Temperature', q: 'temperature'},
		pressure: {label: 'Pressure', q: 'pressure'},
		vapour_fraction: {label: 'Vapour fraction'},
		mass_flow: {label: 'Mass flow', q: 'mass_flow'},
		molar_flow: {label: 'Molar flow', q: 'molar_flow'},
		vol_flow: {label: 'Actual volume flow', q: 'vol_flow'},
		std_gas_flow: {label: 'Std gas flow', q: 'std_gas_flow'},
		molecular_weight: {label: 'Molecular weight', q: 'mw'},
		density: {label: 'Density', q: 'density'},
		viscosity: {label: 'Viscosity', q: 'viscosity'},
		hmb_scope: {label: 'Streams shown', options: ['page|streams on this sheet', 'all|streams on all sheets']},
		hmb_layout: {label: 'Layout', options: ['columns|one column per stream', 'rows|one row per stream']},
		hmb_hide_empty: {label: 'Hide empty rows', options: ['1|yes', '0|no']},
		status: {label: 'Status', options: ['PRELIMINARY', 'ISSUED FOR REVIEW', 'ISSUED FOR APPROVAL',
			'ISSUED FOR DESIGN', 'ISSUED FOR CONSTRUCTION', 'AS-BUILT', 'HOLD', 'VOID']},
		date: {label: 'Date'},
		rev: {label: 'Revision'}
	};

	// Readable names for pd_class values
	var CLASSES =
	{
		equipment: 'Equipment', valve: 'Valve', instrument: 'Instrument', special: 'Special Item',
		fitting: 'Fitting', line: 'Process Line', signal: 'Signal Line', offpage: 'Off-Page Connector',
		annotation: 'Annotation', stream: 'Stream', hmb: 'Heat & Material Balance',
		summary: 'Equipment Summary', stamp: 'Stamp', revision: 'Revision Marker', frame: 'Drawing Frame',
		titleblock: 'Title Block', revtable: 'Revision Table'
	};

	ProcessDraw.Fields =
	{
		FIELDS: FIELDS,
		UNITS: UNITS,
		CLASSES: CLASSES,

		getLabel: function(key)
		{
			if (FIELDS[key] != null)
			{
				return FIELDS[key].label;
			}

			// Stream composition: "comp_n_Butane" -> "n Butane"
			if (key.substring(0, 5) == 'comp_')
			{
				return key.substring(5).replace(/_/g, ' ');
			}

			// Custom fields: "heat_tracing" -> "Heat tracing"
			var s = String(key).replace(/_/g, ' ');

			return s.charAt(0).toUpperCase() + s.substring(1);
		},

		getUnit: function(key, system)
		{
			var q = (FIELDS[key] != null) ? FIELDS[key].q : null;
			var units = UNITS[system] || UNITS.metric;

			return (q != null) ? (units[q] || '') : '';
		},

		/**
		 * Suggested values; "value|description" entries show the description.
		 * Service codes and pipe classes come from the project lists.
		 */
		getOptions: function(key, ui)
		{
			if (ui != null && ProcessDraw.Lines != null && (key == 'service_code' || key == 'pipe_class'))
			{
				return ProcessDraw.Lines.getCodeOptions(ui, key);
			}

			return (FIELDS[key] != null) ? FIELDS[key].options : null;
		}
	};
})();
