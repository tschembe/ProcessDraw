/**
 * ProcessDraw stencil compiler.
 *
 * Symbols are written in a small drawing language and compiled to mxStencil XML,
 * which is embedded in the cell style as shape=stencil(<compressed xml>). The
 * diagram then renders in any draw.io and in PDF/SVG export without ProcessDraw.
 *
 * Drawing language: commands separated by ';', coordinates in the symbol's own
 * w x h units.
 *
 *   e x y w h          ellipse
 *   r x y w h          rectangle
 *   rr x y w h a       rounded rectangle (arc size a)
 *   p <path>           path: M x y | L x y | Q x1 y1 x y | C x1 y1 x2 y2 x y |
 *                      A rx ry rot large sweep x y | Z
 *   fs | s | f         fill+stroke | stroke | fill the current shape
 *   F                  fill+stroke with the stroke color (solid black parts)
 *   d 0|1              dashed off/on (pattern from style)
 *   dp a b ...         dash pattern
 *   t x y size text    text centered at x,y in the stroke color
 */
(function()
{
	var ProcessDraw = window.ProcessDraw = window.ProcessDraw || {};

	function num(v)
	{
		var n = parseFloat(v);

		if (isNaN(n))
		{
			throw new Error('ProcessDraw stencil: number expected, got "' + v + '"');
		}

		return n;
	};

	function attr(name, value)
	{
		return ' ' + name + '="' + mxUtils.htmlEntities(String(value)) + '"';
	};

	function compilePath(tokens)
	{
		var out = '<path>';
		var i = 0;

		while (i < tokens.length)
		{
			var op = tokens[i++];

			if (op == 'M' || op == 'L')
			{
				out += '<' + ((op == 'M') ? 'move' : 'line') + attr('x', num(tokens[i])) +
					attr('y', num(tokens[i + 1])) + '/>';
				i += 2;
			}
			else if (op == 'Q')
			{
				out += '<quad' + attr('x1', num(tokens[i])) + attr('y1', num(tokens[i + 1])) +
					attr('x2', num(tokens[i + 2])) + attr('y2', num(tokens[i + 3])) + '/>';
				i += 4;
			}
			else if (op == 'C')
			{
				out += '<curve' + attr('x1', num(tokens[i])) + attr('y1', num(tokens[i + 1])) +
					attr('x2', num(tokens[i + 2])) + attr('y2', num(tokens[i + 3])) +
					attr('x3', num(tokens[i + 4])) + attr('y3', num(tokens[i + 5])) + '/>';
				i += 6;
			}
			else if (op == 'A')
			{
				out += '<arc' + attr('rx', num(tokens[i])) + attr('ry', num(tokens[i + 1])) +
					attr('x-axis-rotation', num(tokens[i + 2])) +
					attr('large-arc-flag', num(tokens[i + 3])) +
					attr('sweep-flag', num(tokens[i + 4])) +
					attr('x', num(tokens[i + 5])) + attr('y', num(tokens[i + 6])) + '/>';
				i += 7;
			}
			else if (op == 'Z')
			{
				out += '<close/>';
			}
			else
			{
				throw new Error('ProcessDraw stencil: unknown path command "' + op + '"');
			}
		}

		return out + '</path>';
	};

	function compileDrawing(src)
	{
		var out = '';
		var cmds = src.split(';');

		for (var i = 0; i < cmds.length; i++)
		{
			var cmd = cmds[i].trim();

			if (cmd.length == 0)
			{
				continue;
			}

			var tokens = cmd.split(/\s+/);
			var op = tokens[0];
			var a = tokens.slice(1);

			switch (op)
			{
				case 'e':
				case 'r':
					out += '<' + ((op == 'e') ? 'ellipse' : 'rect') + attr('x', num(a[0])) +
						attr('y', num(a[1])) + attr('w', num(a[2])) + attr('h', num(a[3])) + '/>';
					break;
				case 'rr':
					out += '<roundrect' + attr('x', num(a[0])) + attr('y', num(a[1])) +
						attr('w', num(a[2])) + attr('h', num(a[3])) + attr('arcsize', num(a[4])) + '/>';
					break;
				case 'p':
					out += compilePath(a);
					break;
				case 'fs':
					out += '<fillstroke/>';
					break;
				case 's':
					out += '<stroke/>';
					break;
				case 'f':
					out += '<fill/>';
					break;
				case 'F':
					out += '<fillcolor color="stroke"/><fillstroke/><fillcolor color="fill"/>';
					break;
				case 'd':
					out += '<dashed' + attr('dashed', (a[0] == '1') ? 1 : 0) + '/>';
					break;
				case 'dp':
					out += '<dashpattern' + attr('pattern', a.join(' ')) + '/>';
					break;
				case 't':
					out += '<fontsize' + attr('size', num(a[2])) + '/><fontcolor color="stroke"/>' +
						'<text' + attr('str', a.slice(3).join(' ')) + attr('x', num(a[0])) +
						attr('y', num(a[1])) + ' align="center" valign="middle"/>';
					break;
				default:
					throw new Error('ProcessDraw stencil: unknown command "' + op + '"');
			}
		}

		return out;
	};

	/**
	 * Compiles a symbol definition to stencil XML. Nozzles are [x, y, name] in
	 * drawing units and become named connection points.
	 */
	function compile(sym)
	{
		var xml = '<shape' + attr('name', sym.id) + attr('w', sym.w) + attr('h', sym.h) +
			' aspect="variable" strokewidth="inherit"><connections>';
		var nozzles = sym.nozzles || [];

		for (var i = 0; i < nozzles.length; i++)
		{
			var n = nozzles[i];
			xml += '<constraint' + attr('x', Math.round(n[0] / sym.w * 10000) / 10000) +
				attr('y', Math.round(n[1] / sym.h * 10000) / 10000) + ' perimeter="0"' +
				attr('name', n[2] || ('N' + (i + 1))) + '/>';
		}

		return xml + '</connections><foreground>' + compileDrawing(sym.draw) +
			'</foreground></shape>';
	};

	var cache = {};

	ProcessDraw.Stencil =
	{
		compile: compile,

		/**
		 * Returns the shape=stencil(...) style value for the given symbol.
		 */
		getShapeStyle: function(sym)
		{
			if (cache[sym.id] == null)
			{
				cache[sym.id] = 'shape=stencil(' + Graph.compress(compile(sym)) + ');';
			}

			return cache[sym.id];
		}
	};
})();
