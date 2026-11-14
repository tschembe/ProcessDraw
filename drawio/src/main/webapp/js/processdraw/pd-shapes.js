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

	/**
	 * Drawing frame (ISO 5457 style): outer border, grid reference zone with
	 * ticks, numbers along the top/bottom and letters along the sides.
	 * Style: pdMarginLeft/Top/Right/Bottom (px), pdZone (px), pdField (px per field).
	 */
	function FrameShape()
	{
		mxShape.call(this);
	};

	mxUtils.extend(FrameShape, mxShape);

	FrameShape.prototype.paintVertexShape = function(c, x, y, w, h)
	{
		var st = this.style;
		var ml = parseFloat(mxUtils.getValue(st, 'pdMarginLeft', 79));
		var mt = parseFloat(mxUtils.getValue(st, 'pdMarginTop', 39));
		var mr = parseFloat(mxUtils.getValue(st, 'pdMarginRight', 39));
		var mb = parseFloat(mxUtils.getValue(st, 'pdMarginBottom', 39));
		var zone = parseFloat(mxUtils.getValue(st, 'pdZone', 20));
		var field = parseFloat(mxUtils.getValue(st, 'pdField', 197));

		var ox = x + ml;
		var oy = y + mt;
		var ow = w - ml - mr;
		var oh = h - mt - mb;

		if (ow <= 2 * zone || oh <= 2 * zone)
		{
			return;
		}

		var ix = ox + zone;
		var iy = oy + zone;
		var iw = ow - 2 * zone;
		var ih = oh - 2 * zone;
		var cols = Math.max(1, Math.round(iw / field));
		var rows = Math.max(1, Math.round(ih / field));
		var letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

		c.setShadow(false);
		c.setStrokeWidth(this.strokewidth * 2);
		c.rect(ox, oy, ow, oh);
		c.stroke();
		c.setStrokeWidth(this.strokewidth);
		c.rect(ix, iy, iw, ih);
		c.stroke();

		c.setFontColor(this.stroke);
		c.setFontSize(Math.max(6, zone * 0.5));
		c.setFontFamily('Helvetica');

		for (var i = 0; i < cols; i++)
		{
			var cx = ix + (i + 0.5) * iw / cols;

			if (i > 0)
			{
				var tx = ix + i * iw / cols;
				c.begin(); c.moveTo(tx, oy); c.lineTo(tx, iy); c.stroke();
				c.begin(); c.moveTo(tx, iy + ih); c.lineTo(tx, oy + oh); c.stroke();
			}

			c.text(cx, oy + zone / 2, 0, 0, String(i + 1), mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE,
				false, '', null, false, 0, null);
			c.text(cx, iy + ih + zone / 2, 0, 0, String(i + 1), mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE,
				false, '', null, false, 0, null);
		}

		for (var j = 0; j < rows; j++)
		{
			var cy = iy + (j + 0.5) * ih / rows;
			var letter = letters.charAt(j % letters.length);

			if (j > 0)
			{
				var ty = iy + j * ih / rows;
				c.begin(); c.moveTo(ox, ty); c.lineTo(ix, ty); c.stroke();
				c.begin(); c.moveTo(ix + iw, ty); c.lineTo(ox + ow, ty); c.stroke();
			}

			c.text(ox + zone / 2, cy, 0, 0, letter, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE,
				false, '', null, false, 0, null);
			c.text(ix + iw + zone / 2, cy, 0, 0, letter, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE,
				false, '', null, false, 0, null);
		}
	};

	mxCellRenderer.registerShape('pd_frame', FrameShape);

	/**
	 * Revision cloud: scalloped rectangle with scallops of constant size
	 * (style pdScallop, default 14) at any size.
	 */
	function RevisionCloudShape()
	{
		mxShape.call(this);
	};

	mxUtils.extend(RevisionCloudShape, mxShape);

	RevisionCloudShape.prototype.paintVertexShape = function(c, x, y, w, h)
	{
		var size = Math.max(4, parseFloat(mxUtils.getValue(this.style, 'pdScallop', 14)));
		var corners = [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]];

		c.begin();
		c.moveTo(x, y);

		// Clockwise with sweep 1: every scallop bulges outwards
		for (var i = 0; i < 4; i++)
		{
			var a = corners[i];
			var b = corners[i + 1];
			var len = Math.sqrt(Math.pow(b[0] - a[0], 2) + Math.pow(b[1] - a[1], 2));
			var n = Math.max(1, Math.round(len / size));

			for (var k = 1; k <= n; k++)
			{
				var r = len / n * 0.6;
				c.arcTo(r, r, 0, 0, 1, a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n);
			}
		}

		c.close();
		c.fillAndStroke();
	};

	mxCellRenderer.registerShape('pd_revcloud', RevisionCloudShape);
})();
