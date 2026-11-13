/**
 * ProcessDraw edge shapes for ISA 5.1 instrument signal lines.
 *
 * Standalone: only needs mxGraph, so export3.html loads it too and exports show
 * the marks. In an editor without this file the lines fall back to plain lines.
 *
 * Shapes (style shape=...):
 *   pd_signal_pneumatic  line with // marks
 *   pd_signal_hydraulic  line with L marks
 *   pd_signal_capillary  line with X marks
 *   pd_signal_data       line with small circles (software / data link)
 *
 * Style pdMarkSpacing sets the distance between marks (default 24).
 */
(function()
{
	if (typeof mxConnector === 'undefined' || typeof mxCellRenderer === 'undefined')
	{
		return;
	}

	function SignalShape()
	{
		mxConnector.call(this);
	};

	mxUtils.extend(SignalShape, mxConnector);

	SignalShape.prototype.markType = null;

	SignalShape.prototype.paintEdgeShape = function(c, pts)
	{
		mxConnector.prototype.paintEdgeShape.apply(this, arguments);

		var spacing = Math.max(8, parseFloat(mxUtils.getValue(this.style, 'pdMarkSpacing', 24)));
		var total = 0;

		for (var i = 1; i < pts.length; i++)
		{
			total += Math.sqrt(Math.pow(pts[i].x - pts[i - 1].x, 2) + Math.pow(pts[i].y - pts[i - 1].y, 2));
		}

		if (total < 12)
		{
			return;
		}

		// Centres the marks on the line and keeps them away from the ends
		var count = Math.max(1, Math.floor((total - 12) / spacing));
		var start = (total - (count - 1) * spacing) / 2;

		c.setShadow(false);
		c.setDashed(false);

		for (var k = 0; k < count; k++)
		{
			var pos = this.pointAt(pts, start + k * spacing);

			if (pos != null)
			{
				this.paintMark(c, pos.x, pos.y, pos.dx, pos.dy);
			}
		}
	};

	/**
	 * Returns the point and unit direction at the given distance along the polyline.
	 */
	SignalShape.prototype.pointAt = function(pts, dist)
	{
		for (var i = 1; i < pts.length; i++)
		{
			var dx = pts[i].x - pts[i - 1].x;
			var dy = pts[i].y - pts[i - 1].y;
			var len = Math.sqrt(dx * dx + dy * dy);

			if (len > 0 && dist <= len)
			{
				return {x: pts[i - 1].x + dx * dist / len, y: pts[i - 1].y + dy * dist / len,
					dx: dx / len, dy: dy / len};
			}

			dist -= len;
		}

		return null;
	};

	SignalShape.prototype.paintMark = function(c, x, y, dx, dy)
	{
		// Normal to the line
		var nx = -dy;
		var ny = dx;
		var t = this.markType;

		function line(ax, ay, bx, by)
		{
			c.begin();
			c.moveTo(ax, ay);
			c.lineTo(bx, by);
			c.stroke();
		};

		if (t == 'pneumatic')
		{
			for (var s = -1; s <= 1; s += 2)
			{
				var ox = x + dx * s * 2.5;
				var oy = y + dy * s * 2.5;
				line(ox + nx * 5 - dx * 2.5, oy + ny * 5 - dy * 2.5,
					ox - nx * 5 + dx * 2.5, oy - ny * 5 + dy * 2.5);
			}
		}
		else if (t == 'hydraulic')
		{
			line(x + nx * 5, y + ny * 5, x - nx * 5, y - ny * 5);
			line(x - nx * 5, y - ny * 5, x - nx * 5 + dx * 5, y - ny * 5 + dy * 5);
		}
		else if (t == 'capillary')
		{
			line(x + (nx + dx) * 4, y + (ny + dy) * 4, x - (nx + dx) * 4, y - (ny + dy) * 4);
			line(x + (nx - dx) * 4, y + (ny - dy) * 4, x - (nx - dx) * 4, y - (ny - dy) * 4);
		}
		else if (t == 'data')
		{
			c.ellipse(x - 3, y - 3, 6, 6);
			c.stroke();
		}
	};

	function register(name, type)
	{
		var Shape = function()
		{
			SignalShape.call(this);
		};

		mxUtils.extend(Shape, SignalShape);
		Shape.prototype.markType = type;
		mxCellRenderer.registerShape(name, Shape);
	};

	register('pd_signal_pneumatic', 'pneumatic');
	register('pd_signal_hydraulic', 'hydraulic');
	register('pd_signal_capillary', 'capillary');
	register('pd_signal_data', 'data');
})();
