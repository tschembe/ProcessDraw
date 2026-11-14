/**
 * ProcessDraw symbol library registry and engineering data templates.
 *
 * Symbol files (pd-symbols-*.js) call ProcessDraw.Library.addPalette(...).
 * Every symbol carries engineering data as cell attributes (Edit Data, Ctrl+M):
 *
 *   pd_class       equipment | valve | instrument | special | fitting | line | signal |
 *                  offpage | annotation (fitting, line, signal, offpage, annotation have no tag)
 *   pd_type        symbol type, e.g. pump.centrifugal
 *   pd_standard    symbol standard, e.g. ISO 10628-2
 *   pd_tag_prefix  prefix for automatic tag numbering (phase 2)
 *   tag            item tag, e.g. P-101 ("???" = not yet numbered)
 *   ...            class-specific fields (see templates below)
 */
(function()
{
	var ProcessDraw = window.ProcessDraw = window.ProcessDraw || {};

	var EQUIPMENT_COMMON = ['service', 'material', 'operating_pressure', 'operating_temperature',
		'design_pressure', 'design_temperature'];

	/**
	 * Field lists per data template. Field order is the order shown in Edit Data.
	 */
	var TEMPLATES =
	{
		vessel: EQUIPMENT_COMMON.concat(['diameter', 'length_tt', 'volume']),
		column: EQUIPMENT_COMMON.concat(['diameter', 'height_tt', 'internals', 'number_of_trays']),
		tank: EQUIPMENT_COMMON.concat(['diameter', 'height', 'volume', 'roof_type']),
		heat_exchanger: EQUIPMENT_COMMON.concat(['duty', 'area', 'tema_type',
			'shell_side_fluid', 'tube_side_fluid']),
		fired_heater: EQUIPMENT_COMMON.concat(['duty', 'fuel']),
		pump: EQUIPMENT_COMMON.concat(['flow_rate', 'differential_head', 'npsh_required',
			'power', 'driver']),
		compressor: EQUIPMENT_COMMON.concat(['flow_rate', 'suction_pressure',
			'discharge_pressure', 'power', 'driver']),
		fan: ['service', 'flow_rate', 'differential_pressure', 'power', 'driver'],
		driver: ['service', 'power', 'voltage', 'speed'],
		filter: EQUIPMENT_COMMON.concat(['flow_rate', 'filtration_rating']),
		agitator: ['service', 'power', 'speed', 'impeller_type'],
		equipment: EQUIPMENT_COMMON.concat(['capacity']),
		valve: ['size', 'pipe_class', 'end_connection', 'normal_position'],
		control_valve: ['service', 'size', 'pipe_class', 'cv', 'fail_position', 'actuator'],
		safety_valve: ['service', 'set_pressure', 'inlet_size', 'outlet_size', 'orifice', 'discharge_to'],
		instrument: ['function', 'loop', 'service', 'location', 'range', 'units'],
		fitting: ['size'],
		special: ['service', 'size', 'pipe_class'],
		line: ['line_number', 'size', 'service_code', 'sequence', 'pipe_class', 'insulation', 'fluid', 'from', 'to'],
		signal: ['signal_type'],
		offpage: ['direction', 'sheet', 'connector_id', 'description'],
		stream: ['description', 'temperature', 'pressure', 'vapour_fraction', 'mass_flow', 'molar_flow',
			'vol_flow', 'std_gas_flow', 'molecular_weight', 'density', 'viscosity'],
		annotation: []
	};

	var palettes = [];

	/**
	 * Creates the cell value (XML element with attributes) for a symbol.
	 */
	function createValue(sym)
	{
		var doc = mxUtils.createXmlDocument();
		var obj = doc.createElement('object');

		obj.setAttribute('label', (sym.label != null) ? sym.label : '%tag%');
		obj.setAttribute('placeholders', '1');
		obj.setAttribute('pd_class', sym.cls);
		obj.setAttribute('pd_type', sym.type);

		if (sym.standard != null)
		{
			obj.setAttribute('pd_standard', sym.standard);
		}

		if (sym.prefix != null)
		{
			obj.setAttribute('pd_tag_prefix', sym.prefix);
		}

		var untagged = {line: 1, signal: 1, fitting: 1, annotation: 1, offpage: 1, stream: 1, hmb: 1, summary: 1,
			stamp: 1, revision: 1, frame: 1, titleblock: 1, revtable: 1};

		if (!untagged[sym.cls])
		{
			obj.setAttribute('tag', (sym.tag != null) ? sym.tag :
				((sym.prefix != null && sym.prefix.length > 0) ? sym.prefix + '-???' : ''));
		}

		var fields = TEMPLATES[sym.template || sym.cls] || [];

		for (var i = 0; i < fields.length; i++)
		{
			obj.setAttribute(fields[i], '');
		}

		// Symbol-specific defaults
		for (var key in sym.data)
		{
			obj.setAttribute(key, sym.data[key]);
		}

		return obj;
	};

	ProcessDraw.Library =
	{
		TEMPLATES: TEMPLATES,

		palettes: palettes,

		createValue: createValue,

		/**
		 * Adds a palette. Items are symbol definitions (see pd-stencil.js for draw).
		 * Common item keys: id, name, w, h, draw, nozzles, cls, type, prefix,
		 * template, data, style, label, tags, edge (true for line symbols).
		 */
		addPalette: function(id, title, items, expanded)
		{
			palettes.push({id: id, title: title, items: items, expanded: expanded == true});
		},

		/**
		 * Returns the symbol with the given id.
		 */
		getSymbol: function(id)
		{
			for (var i = 0; i < palettes.length; i++)
			{
				for (var j = 0; j < palettes[i].items.length; j++)
				{
					if (palettes[i].items[j].id == id)
					{
						return palettes[i].items[j];
					}
				}
			}

			return null;
		},

		/**
		 * Returns the complete cell style for a symbol.
		 */
		getStyle: function(sym)
		{
			if (sym.edge || sym.rawStyle != null)
			{
				return (sym.edge) ? sym.style : sym.rawStyle;
			}

			var labelStyle = (sym.labelInside) ?
				'verticalAlign=middle;align=center;' :
				'verticalLabelPosition=bottom;verticalAlign=top;align=center;';

			return ProcessDraw.Stencil.getShapeStyle(sym) + 'html=1;whiteSpace=wrap;' +
				'pointerEvents=1;dashed=0;' + labelStyle +
				((sym.aspect) ? 'aspect=fixed;' : '') + (sym.style || '');
		},

		/**
		 * Creates the cell for a symbol.
		 */
		createCell: function(sym)
		{
			var cell = new mxCell(createValue(sym), new mxGeometry(0, 0, sym.w, sym.h),
				ProcessDraw.Library.getStyle(sym));

			if (sym.edge)
			{
				cell.geometry.setTerminalPoint(new mxPoint(0, sym.h / 2), true);
				cell.geometry.setTerminalPoint(new mxPoint(sym.w, sym.h / 2), false);
				cell.geometry.relative = true;
				cell.edge = true;
			}
			else
			{
				cell.vertex = true;
			}

			return cell;
		}
	};
})();
