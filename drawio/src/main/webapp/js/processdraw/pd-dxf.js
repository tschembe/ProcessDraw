/**
 * ProcessDraw DXF export: writes the current sheet as an AutoCAD R12 DXF in
 * millimetres (1 drawing unit = 0.254 mm, so an A3 frame is 420 x 297).
 *
 * Geometry and text are taken from the rendered diagram: every shape's SVG
 * elements are flattened to polylines (getScreenCTM / getPointAtLength), HTML
 * labels are placed line by line from their client rectangles, and table
 * borders in labels (title block, H&MB) become lines. Entities go on layers by
 * ProcessDraw class (EQUIPMENT, VALVES, PROCESS_LINES, ...); text on TEXT.
 * Fills are not exported (outlines only).
 */
(function()
{
	var ProcessDraw = window.ProcessDraw = window.ProcessDraw || {};
	var Tags = ProcessDraw.Tags;

	var MM = 0.254;
	var LAYERS =
	{
		EQUIPMENT: 4, VALVES: 3, INSTRUMENTS: 6, FITTINGS: 3, SPECIALS: 3, PROCESS_LINES: 7, SIGNAL_LINES: 5,
		CONNECTORS: 2, STREAMS: 2, TABLES: 7, FRAME: 7, ANNOTATION: 1, LINES: 7, MISC: 7, TEXT: 7
	};
	var CLASS_LAYERS =
	{
		equipment: 'EQUIPMENT', valve: 'VALVES', instrument: 'INSTRUMENTS', fitting: 'FITTINGS', special: 'SPECIALS',
		line: 'PROCESS_LINES', signal: 'SIGNAL_LINES', offpage: 'CONNECTORS', stream: 'STREAMS', hmb: 'TABLES',
		summary: 'TABLES', frame: 'FRAME', titleblock: 'FRAME', revtable: 'FRAME', stamp: 'ANNOTATION',
		revision: 'ANNOTATION', annotation: 'ANNOTATION'
	};
	var ACI = [[1, 255, 0, 0], [2, 255, 255, 0], [3, 0, 255, 0], [4, 0, 255, 255], [5, 0, 0, 255], [6, 255, 0, 255],
		[8, 128, 128, 128]];

	mxResources.parse('pdExportDxf=Export Sheet to DXF...\n');

	// ---------------------------------------------------------------- DXF writer (pure)

	function fmt(n)
	{
		return (Math.round(n * 1000) / 1000).toString();
	};

	/**
	 * DXF text: degree sign as %%d, other non-ASCII characters as \U+XXXX.
	 */
	function dxfText(s)
	{
		return String(s).replace(/°/g, '%%d').replace(/[^\x20-\x7e]/g, function(ch)
		{
			var hex = ch.charCodeAt(0).toString(16).toUpperCase();

			return '\\U+' + ('0000' + hex).slice(-4);
		});
	};

	/**
	 * entities: [{type: 'polyline', layer, color, closed, points: [[x, y]]} |
	 *            {type: 'text', layer, color, x, y, height, text}] in mm, y up.
	 */
	function write(entities, layers)
	{
		var out = [];
		var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

		function g(code, value)
		{
			out.push(String(code), String(value));
		};

		entities.forEach(function(e)
		{
			var pts = (e.type == 'polyline') ? e.points : [[e.x, e.y]];

			pts.forEach(function(p)
			{
				minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
				minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
			});
		});

		if (!isFinite(minX))
		{
			minX = minY = maxX = maxY = 0;
		}

		g(0, 'SECTION'); g(2, 'HEADER');
		g(9, '$ACADVER'); g(1, 'AC1009');
		g(9, '$INSBASE'); g(10, 0); g(20, 0); g(30, 0);
		g(9, '$EXTMIN'); g(10, fmt(minX)); g(20, fmt(minY)); g(30, 0);
		g(9, '$EXTMAX'); g(10, fmt(maxX)); g(20, fmt(maxY)); g(30, 0);
		g(9, '$MEASUREMENT'); g(70, 1);
		g(0, 'ENDSEC');

		g(0, 'SECTION'); g(2, 'TABLES');
		g(0, 'TABLE'); g(2, 'LTYPE'); g(70, 1);
		g(0, 'LTYPE'); g(2, 'CONTINUOUS'); g(70, 0); g(3, 'Solid line'); g(72, 65); g(73, 0); g(40, '0.0');
		g(0, 'ENDTAB');
		var names = Object.keys(layers);
		g(0, 'TABLE'); g(2, 'LAYER'); g(70, names.length);

		names.forEach(function(name)
		{
			g(0, 'LAYER'); g(2, name); g(70, 0); g(62, layers[name]); g(6, 'CONTINUOUS');
		});

		g(0, 'ENDTAB');
		g(0, 'TABLE'); g(2, 'STYLE'); g(70, 1);
		g(0, 'STYLE'); g(2, 'STANDARD'); g(70, 0); g(40, '0.0'); g(41, '1.0'); g(50, '0.0'); g(71, 0); g(42, '2.5');
		g(3, 'txt'); g(4, '');
		g(0, 'ENDTAB');
		g(0, 'ENDSEC');

		g(0, 'SECTION'); g(2, 'ENTITIES');

		entities.forEach(function(e)
		{
			if (e.type == 'polyline' && e.points.length >= 2)
			{
				g(0, 'POLYLINE'); g(8, e.layer); g(62, e.color || 256); g(66, 1); g(10, 0); g(20, 0); g(30, 0);
				g(70, (e.closed) ? 1 : 0);

				e.points.forEach(function(p)
				{
					g(0, 'VERTEX'); g(8, e.layer); g(10, fmt(p[0])); g(20, fmt(p[1])); g(30, 0);
				});

				g(0, 'SEQEND'); g(8, e.layer);
			}
			else if (e.type == 'text' && String(e.text).trim() != '')
			{
				g(0, 'TEXT'); g(8, e.layer); g(62, e.color || 256); g(10, fmt(e.x)); g(20, fmt(e.y)); g(30, 0);
				g(40, fmt(Math.max(0.5, e.height))); g(1, dxfText(e.text)); g(7, 'STANDARD');
			}
		});

		g(0, 'ENDSEC');
		g(0, 'EOF');

		return out.join('\r\n') + '\r\n';
	};

	/**
	 * Douglas-Peucker simplification of a point list.
	 */
	function simplify(points, eps)
	{
		if (points.length < 3)
		{
			return points;
		}

		var a = points[0];
		var b = points[points.length - 1];
		var dx = b[0] - a[0];
		var dy = b[1] - a[1];
		var len = Math.sqrt(dx * dx + dy * dy);
		var maxD = -1;
		var index = 0;

		for (var i = 1; i < points.length - 1; i++)
		{
			var p = points[i];
			var d = (len > 0) ? Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / len :
				Math.sqrt(Math.pow(p[0] - a[0], 2) + Math.pow(p[1] - a[1], 2));

			if (d > maxD)
			{
				maxD = d;
				index = i;
			}
		}

		if (maxD <= eps)
		{
			return [a, b];
		}

		var left = simplify(points.slice(0, index + 1), eps);

		return left.slice(0, left.length - 1).concat(simplify(points.slice(index), eps));
	};

	function nearestAci(color)
	{
		var m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(color || '');

		if (m == null)
		{
			return 256;
		}

		var r = +m[1], gr = +m[2], b = +m[3];

		// Black, white and greys follow the layer (black on paper, white on screen)
		if (Math.max(r, gr, b) - Math.min(r, gr, b) < 40)
		{
			return 256;
		}

		var best = 256;
		var bestD = Infinity;

		ACI.forEach(function(c)
		{
			var d = Math.pow(c[1] - r, 2) + Math.pow(c[2] - gr, 2) + Math.pow(c[3] - b, 2);

			if (d < bestD)
			{
				bestD = d;
				best = c[0];
			}
		});

		return best;
	};

	// ---------------------------------------------------------------- Extraction from the view

	function layerFor(graph, cell)
	{
		var cls = Tags.attr(cell, 'pd_class');

		return CLASS_LAYERS[cls] || ((graph.model.isEdge(cell)) ? 'LINES' : 'MISC');
	};

	/**
	 * Collects DXF entities (mm, y up) for the current page.
	 */
	function collect(ui)
	{
		var graph = ui.editor.graph;
		var view = graph.view;
		var s = view.scale;
		var t = view.translate;
		var crect = graph.container.getBoundingClientRect();
		var origin = getOrigin(ui);
		var entities = [];

		// Client coordinates -> model -> mm (y up, origin at the bottom left of the frame or drawing)
		function toMm(cx, cy)
		{
			var mx = (cx - crect.left + graph.container.scrollLeft) / s - t.x;
			var my = (cy - crect.top + graph.container.scrollTop) / s - t.y;

			return [(mx - origin.x) * MM, (origin.y - my) * MM];
		};

		function visible(el)
		{
			var cs = window.getComputedStyle(el);

			if (cs.visibility == 'hidden' || cs.display == 'none' || parseFloat(cs.opacity) == 0)
			{
				return false;
			}

			var stroke = el.getAttribute('stroke') || cs.stroke;
			var fill = el.getAttribute('fill') || cs.fill;
			var strokeOn = stroke && stroke != 'none' && stroke != 'transparent' &&
				parseFloat(el.getAttribute('stroke-opacity') || cs.strokeOpacity || '1') > 0;
			var fillOn = fill && fill != 'none' && fill != 'transparent' &&
				parseFloat(el.getAttribute('fill-opacity') || cs.fillOpacity || '1') > 0;

			return strokeOn || fillOn;
		};

		function colorOf(el)
		{
			var cs = window.getComputedStyle(el);
			var stroke = cs.stroke;

			return nearestAci((stroke && stroke != 'none') ? stroke : cs.fill);
		};

		function sample(el)
		{
			var m = el.getScreenCTM();

			if (m == null)
			{
				return [];
			}

			var svg = el.ownerSVGElement;
			var pt = svg.createSVGPoint();

			function map(x, y)
			{
				pt.x = x;
				pt.y = y;
				var p = pt.matrixTransform(m);

				return toMm(p.x, p.y);
			};

			var tag = el.nodeName.toLowerCase();

			if (tag == 'line')
			{
				return [{closed: false, points: [map(+el.getAttribute('x1'), +el.getAttribute('y1')),
					map(+el.getAttribute('x2'), +el.getAttribute('y2'))]}];
			}

			if ((tag == 'polyline' || tag == 'polygon') && el.points != null)
			{
				var list = [];

				for (var i = 0; i < el.points.numberOfItems; i++)
				{
					var p = el.points.getItem(i);
					list.push(map(p.x, p.y));
				}

				return [{closed: tag == 'polygon', points: list}];
			}

			if (tag == 'rect' && !(parseFloat(el.getAttribute('rx')) > 0))
			{
				var x = +el.getAttribute('x') || 0, y = +el.getAttribute('y') || 0;
				var w = +el.getAttribute('width') || 0, h = +el.getAttribute('height') || 0;

				return (w > 0 && h > 0) ? [{closed: true, points: [map(x, y), map(x + w, y), map(x + w, y + h),
					map(x, y + h)]}] : [];
			}

			// Paths: one polyline per subpath; curves and arcs are flattened
			var parts = [el];
			var temp = [];

			if (tag == 'path')
			{
				var d = el.getAttribute('d') || '';
				var subs = d.split(/(?=M)/).filter(function(p) { return p.trim().length > 0; });

				if (subs.length > 1 && !/m/.test(d))
				{
					parts = subs.map(function(sub)
					{
						var p = document.createElementNS(mxConstants.NS_SVG, 'path');
						p.setAttribute('d', sub);

						if (el.getAttribute('transform') != null)
						{
							p.setAttribute('transform', el.getAttribute('transform'));
						}

						el.parentNode.appendChild(p);
						temp.push(p);

						return p;
					});
				}
			}

			var result = [];

			try
			{
				parts.forEach(function(part)
				{
					var len = (part.getTotalLength != null) ? part.getTotalLength() : 0;

					if (!(len > 0))
					{
						return;
					}

					var n = Math.min(600, Math.max(8, Math.ceil(len / 1.5)));
					var pts = [];

					for (var i = 0; i <= n; i++)
					{
						var p = part.getPointAtLength(len * i / n);
						pts.push(map(p.x, p.y));
					}

					var dAttr = (part.getAttribute('d') || '').trim();
					var closed = tag == 'ellipse' || tag == 'circle' || tag == 'rect' || /[zZ]\s*$/.test(dAttr);
					result.push({closed: closed, points: simplify(pts, 0.03)});
				});
			}
			finally
			{
				temp.forEach(function(p) { p.parentNode.removeChild(p); });
			}

			return result;
		};

		function addShapes(node, layer)
		{
			var els = node.querySelectorAll('path, line, polyline, polygon, rect, ellipse, circle');

			for (var i = 0; i < els.length; i++)
			{
				var el = els[i];

				if (el.closest('defs, clipPath, mask, marker, foreignObject') != null || !visible(el))
				{
					continue;
				}

				var color = colorOf(el);

				sample(el).forEach(function(part)
				{
					if (part.points.length >= 2)
					{
						entities.push({type: 'polyline', layer: layer, color: color, closed: part.closed,
							points: part.points});
					}
				});
			}

			// Plain SVG text (e.g. grid references of the frame, letters in symbols)
			var texts = node.querySelectorAll('text');

			for (var i = 0; i < texts.length; i++)
			{
				if (texts[i].closest('switch') == null)
				{
					addTextRect(texts[i].getBoundingClientRect(), texts[i].textContent, colorOf(texts[i]));
				}
			}
		};

		function addTextRect(r, str, color)
		{
			str = String(str || '').replace(/\s+/g, ' ').trim();

			if (str.length == 0 || r.width <= 0 || r.height <= 0)
			{
				return;
			}

			var h = r.height / s * MM * 0.72;
			var p = toMm(r.left, r.bottom);
			entities.push({type: 'text', layer: 'TEXT', color: color, x: p[0], y: p[1] + h * 0.28, height: h, text: str});
		};

		/**
		 * HTML label: one text entity per rendered line, table borders as lines.
		 */
		function addHtmlLabel(node, layer)
		{
			var walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null);
			var range = document.createRange();
			var tn;

			while ((tn = walker.nextNode()) != null)
			{
				var str = tn.nodeValue;

				if (str.trim().length == 0)
				{
					continue;
				}

				var parent = tn.parentNode;
				var color = nearestAci(window.getComputedStyle(parent).color);
				var re = /\S+/g;
				var m;
				var line = null;

				// Words grouped into rendered lines
				while ((m = re.exec(str)) != null)
				{
					range.setStart(tn, m.index);
					range.setEnd(tn, m.index + m[0].length);
					var r = range.getBoundingClientRect();

					if (line == null || Math.abs(r.top - line.top) > r.height * 0.5)
					{
						if (line != null)
						{
							addTextRect(line.rect, line.text, color);
						}

						line = {top: r.top, text: m[0], rect: {left: r.left, right: r.right, top: r.top,
							bottom: r.bottom, width: r.width, height: r.height}};
					}
					else
					{
						line.text += ' ' + m[0];
						line.rect.right = r.right;
						line.rect.width = r.right - line.rect.left;
					}
				}

				if (line != null)
				{
					addTextRect(line.rect, line.text, color);
				}
			}

			var boxes = node.querySelectorAll('*');

			for (var i = 0; i < boxes.length; i++)
			{
				var cs = window.getComputedStyle(boxes[i]);
				var r = boxes[i].getBoundingClientRect();

				if (r.width == 0 || r.height == 0)
				{
					continue;
				}

				var sides = [['Top', r.left, r.top, r.right, r.top], ['Bottom', r.left, r.bottom, r.right, r.bottom],
					['Left', r.left, r.top, r.left, r.bottom], ['Right', r.right, r.top, r.right, r.bottom]];

				sides.forEach(function(sd)
				{
					if (parseFloat(cs['border' + sd[0] + 'Width']) > 0 && cs['border' + sd[0] + 'Style'] != 'none')
					{
						entities.push({type: 'polyline', layer: layer, color: nearestAci(cs['border' + sd[0] + 'Color']),
							closed: false, points: [toMm(sd[1], sd[2]), toMm(sd[3], sd[4])]});
					}
				});
			}
		};

		var cells = graph.model.getDescendants(graph.model.getRoot());

		for (var i = 0; i < cells.length; i++)
		{
			var cell = cells[i];
			var state = view.getState(cell);

			if (state == null || !graph.model.isVisible(cell) || (!graph.model.isVertex(cell) && !graph.model.isEdge(cell)))
			{
				continue;
			}

			var layer = layerFor(graph, cell);

			if (state.shape != null && state.shape.node != null)
			{
				addShapes(state.shape.node, layer);
			}

			if (state.text != null && state.text.node != null)
			{
				var fo = state.text.node.querySelector('foreignObject, div');

				if (fo != null)
				{
					addHtmlLabel(fo, layer);
				}
				else
				{
					var texts = state.text.node.querySelectorAll('text');

					for (var j = 0; j < texts.length; j++)
					{
						addTextRect(texts[j].getBoundingClientRect(), texts[j].textContent, colorOf(texts[j]));
					}
				}
			}
		}

		return entities;
	};

	/**
	 * Bottom left of the drawing frame, else of the drawing, in model units.
	 */
	function getOrigin(ui)
	{
		var graph = ui.editor.graph;
		var frame = (ProcessDraw.Sheet != null) ? ProcessDraw.Sheet.findSheetCells(ui).frame : null;

		if (frame != null)
		{
			return {x: frame.geometry.x, y: frame.geometry.y + frame.geometry.height};
		}

		var b = graph.getGraphBounds();
		var s = graph.view.scale;
		var t = graph.view.translate;

		return {x: b.x / s - t.x, y: (b.y + b.height) / s - t.y};
	};

	/**
	 * Returns the DXF text of the current sheet.
	 */
	function build(ui)
	{
		var graph = ui.editor.graph;
		var selection = graph.getSelectionCells();
		graph.clearSelection();

		try
		{
			var entities = collect(ui);
			var used = {};

			entities.forEach(function(e) { used[e.layer] = LAYERS[e.layer] || 7; });

			return {dxf: write(entities, used), count: entities.length};
		}
		finally
		{
			graph.setSelectionCells(selection);
		}
	};

	function exportDxf(ui)
	{
		var result = build(ui);
		var sheet = (ProcessDraw.Project != null) ? ProcessDraw.Project.getSheetLabel(ui, ui.currentPage) : '';
		var file = ui.getCurrentFile();
		var name = (sheet || ((file != null) ? file.getTitle().replace(/\.\w+$/, '') : 'ProcessDraw'))
			.replace(/[\\\/:*?"<>|]/g, '_') + '.dxf';

		ui.saveData(name, 'dxf', result.dxf, 'application/dxf', false);
		ui.editor.setStatus('DXF written: ' + result.count + ' entities');
	};

	ProcessDraw.Dxf =
	{
		write: write,
		simplify: simplify,
		dxfText: dxfText,
		nearestAci: nearestAci,
		build: build,
		exportDxf: exportDxf,

		install: function(ui)
		{
			ui.actions.addAction('pdExportDxf', function()
			{
				exportDxf(ui);
			});
		}
	};
})();
