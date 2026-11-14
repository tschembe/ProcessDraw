/**
 * Headless diagram model for the ProcessDraw MCP tools: cells with XML-element
 * values (the same shape as in the editor, so ProcessDraw's own modules can
 * read them), parsing of draw.io page XML and serialization back to XML.
 */

/**
 * Minimal stand-in for an XML element as used for cell values (object
 * elements with attributes). Keeps attribute order like the DOM does.
 */
export class XmlValue
{
	constructor(nodeName)
	{
		this.nodeName = nodeName || 'object';
		this.nodeType = 1;
		this._names = [];
		this._values = {};
	}

	setAttribute(name, value)
	{
		if (!Object.prototype.hasOwnProperty.call(this._values, name))
		{
			this._names.push(name);
		}

		this._values[name] = String(value);
	}

	getAttribute(name)
	{
		return Object.prototype.hasOwnProperty.call(this._values, name) ? this._values[name] : null;
	}

	hasAttribute(name)
	{
		return Object.prototype.hasOwnProperty.call(this._values, name);
	}

	removeAttribute(name)
	{
		if (this.hasAttribute(name))
		{
			delete this._values[name];
			this._names.splice(this._names.indexOf(name), 1);
		}
	}

	get attributes()
	{
		var self = this;

		return this._names.map(function(n) { return {name: n, value: self._values[n]}; });
	}

	cloneNode()
	{
		var c = new XmlValue(this.nodeName);

		for (var i = 0; i < this._names.length; i++)
		{
			c.setAttribute(this._names[i], this._values[this._names[i]]);
		}

		return c;
	}
}

export class Cell
{
	constructor(id, value, style)
	{
		this.id = id;
		this.value = value;
		this.style = style || '';
		this.vertex = false;
		this.edge = false;
		this.parent = null;
		this.children = [];
		this.edges = [];
		this.source = null;
		this.target = null;
		this.geometry = null;
		this.connectable = null;
	}

	getEdgeCount()
	{
		return this.edges.length;
	}

	getEdgeAt(i)
	{
		return this.edges[i];
	}

	getTerminal(source)
	{
		return source ? this.source : this.target;
	}

	getId()
	{
		return this.id;
	}
}

export class Page
{
	constructor(id, name)
	{
		this.id = id;
		this.name = name;
		this.attrs = {};
		this.cells = {};
		this.root = new Cell('0', new XmlValue('object'));
		this.root.value.setAttribute('label', '');
		this.layer = new Cell('1', null);
		this.add(this.root, null);
		this.add(this.layer, this.root);
	}

	getName()
	{
		return this.name;
	}

	getId()
	{
		return this.id;
	}

	add(cell, parent)
	{
		this.cells[cell.id] = cell;

		if (parent != null)
		{
			cell.parent = parent;
			parent.children.push(cell);
		}

		return cell;
	}

	connect(edge, source, target)
	{
		edge.source = source;
		edge.target = target;

		if (source != null)
		{
			source.edges.push(edge);
		}

		if (target != null && target !== source)
		{
			target.edges.push(edge);
		}
	}

	remove(cell)
	{
		if (cell.parent != null)
		{
			cell.parent.children.splice(cell.parent.children.indexOf(cell), 1);
		}

		var all = [cell].concat(descendants(cell));

		for (var i = 0; i < all.length; i++)
		{
			delete this.cells[all[i].id];
		}
	}
}

export function descendants(cell)
{
	var result = [];

	for (var i = 0; i < cell.children.length; i++)
	{
		result.push(cell.children[i]);
		result = result.concat(descendants(cell.children[i]));
	}

	return result;
}

// ---------------------------------------------------------------- XML helpers

export function esc(s)
{
	return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;').replace(/\n/g, '&#xa;');
}

export function decode(s)
{
	return String(s).replace(/&(#x[0-9a-fA-F]+|#\d+|lt|gt|amp|quot|apos);/g, function(m, e)
	{
		if (e.charAt(0) == '#')
		{
			return String.fromCodePoint((e.charAt(1) == 'x') ? parseInt(e.substring(2), 16) : parseInt(e.substring(1), 10));
		}

		return {lt: '<', gt: '>', amp: '&', quot: '"', apos: "'"}[e];
	});
}

export function parseAttrs(text)
{
	var result = [];
	var re = /([\w:.-]+)\s*=\s*"([^"]*)"/g;
	var m;

	while ((m = re.exec(text)) != null)
	{
		result.push([m[1], decode(m[2])]);
	}

	return result;
}

function num(v)
{
	return (v == null || v === '') ? 0 : parseFloat(v);
}

// ---------------------------------------------------------------- Parsing

/**
 * Parses one page's mxGraphModel XML into a Page. Unknown elements are kept
 * only as far as cells, values, styles and geometry go.
 */
export function parsePage(xml, id, name)
{
	var page = new Page(id, name);
	var model = /<mxGraphModel\b([^>]*)>/.exec(xml);

	if (model != null)
	{
		parseAttrs(model[1]).forEach(function(a) { page.attrs[a[0]] = a[1]; });
	}

	page.cells = {};
	var entries = [];
	var re = /<(object|UserObject)\b([^>]*)>\s*(<mxCell\b[^>]*?(?:\/>|>[\s\S]*?<\/mxCell>))\s*<\/\1>|(<mxCell\b[^>]*?(?:\/>|>[\s\S]*?<\/mxCell>))/g;
	var m;

	while ((m = re.exec(xml)) != null)
	{
		var wrapperAttrs = (m[1] != null) ? parseAttrs(m[2]) : null;
		var cellXml = (m[1] != null) ? m[3] : m[4];
		var head = /<mxCell\b([^>]*?)\/?>/.exec(cellXml);
		var attrs = {};
		parseAttrs(head[1]).forEach(function(a) { attrs[a[0]] = a[1]; });
		var value = null;
		var cid = attrs.id;

		if (wrapperAttrs != null)
		{
			value = new XmlValue(m[1]);

			wrapperAttrs.forEach(function(a)
			{
				if (a[0] == 'id')
				{
					cid = a[1];
				}
				else
				{
					value.setAttribute(a[0], a[1]);
				}
			});
		}
		else if (attrs.value != null)
		{
			value = attrs.value;
		}

		var cell = new Cell(cid, value, attrs.style || '');
		cell.vertex = attrs.vertex == '1';
		cell.edge = attrs.edge == '1';
		cell.connectable = attrs.connectable;
		var g = /<mxGeometry\b([^>]*?)(\/>|>([\s\S]*?)<\/mxGeometry>)/.exec(cellXml);

		if (g != null)
		{
			var ga = {};
			parseAttrs(g[1]).forEach(function(a) { ga[a[0]] = a[1]; });
			cell.geometry = {x: num(ga.x), y: num(ga.y), width: num(ga.width), height: num(ga.height),
				relative: ga.relative == '1', points: [], offset: null, sourcePoint: null, targetPoint: null};
			var inner = g[3] || '';
			var arr = /<Array\b[^>]*as="points"[^>]*>([\s\S]*?)<\/Array>/.exec(inner);

			if (arr != null)
			{
				var pr = /<mxPoint\b([^>]*?)\/>/g;
				var pm;

				while ((pm = pr.exec(arr[1])) != null)
				{
					var pa = {};
					parseAttrs(pm[1]).forEach(function(a) { pa[a[0]] = a[1]; });
					cell.geometry.points.push({x: num(pa.x), y: num(pa.y)});
				}
			}

			var single = /<mxPoint\b([^>]*?)\/>/g;
			var sm;
			var rest = inner.replace(/<Array\b[\s\S]*?<\/Array>/g, '');

			while ((sm = single.exec(rest)) != null)
			{
				var sa = {};
				parseAttrs(sm[1]).forEach(function(a) { sa[a[0]] = a[1]; });
				var pt = {x: num(sa.x), y: num(sa.y)};

				if (sa.as == 'offset')
				{
					cell.geometry.offset = pt;
				}
				else if (sa.as == 'sourcePoint')
				{
					cell.geometry.sourcePoint = pt;
				}
				else if (sa.as == 'targetPoint')
				{
					cell.geometry.targetPoint = pt;
				}
			}
		}

		entries.push({cell: cell, parent: attrs.parent, source: attrs.source, target: attrs.target});
		page.cells[cid] = cell;
	}

	page.root = null;
	page.layer = null;

	for (var i = 0; i < entries.length; i++)
	{
		var e = entries[i];
		var parent = (e.parent != null) ? page.cells[e.parent] : null;

		if (parent != null)
		{
			e.cell.parent = parent;
			parent.children.push(e.cell);
		}
		else if (page.root == null)
		{
			page.root = e.cell;
		}
	}

	if (page.root != null && page.root.value == null)
	{
		page.root.value = new XmlValue('object');
		page.root.value.setAttribute('label', '');
	}

	page.layer = (page.root != null) ? page.root.children[0] || null : null;

	for (var i = 0; i < entries.length; i++)
	{
		var e = entries[i];

		if (e.cell.edge)
		{
			page.connect(e.cell, page.cells[e.source] || null, page.cells[e.target] || null);
		}
	}

	return page;
}

// ---------------------------------------------------------------- Serialization

function geometryXml(geo, isEdge)
{
	if (geo == null)
	{
		return '';
	}

	var a = '';

	if (!geo.relative || !isEdge)
	{
		if (geo.x) a += ' x="' + round(geo.x) + '"';
		if (geo.y) a += ' y="' + round(geo.y) + '"';
		if (geo.width) a += ' width="' + round(geo.width) + '"';
		if (geo.height) a += ' height="' + round(geo.height) + '"';
	}

	if (geo.relative)
	{
		a += ' relative="1"';
	}

	var inner = '';

	if (geo.sourcePoint != null)
	{
		inner += '<mxPoint x="' + round(geo.sourcePoint.x) + '" y="' + round(geo.sourcePoint.y) + '" as="sourcePoint"/>';
	}

	if (geo.targetPoint != null)
	{
		inner += '<mxPoint x="' + round(geo.targetPoint.x) + '" y="' + round(geo.targetPoint.y) + '" as="targetPoint"/>';
	}

	if (geo.points != null && geo.points.length > 0)
	{
		inner += '<Array as="points">' + geo.points.map(function(p)
		{
			return '<mxPoint x="' + round(p.x) + '" y="' + round(p.y) + '"/>';
		}).join('') + '</Array>';
	}

	if (geo.offset != null)
	{
		inner += '<mxPoint x="' + round(geo.offset.x) + '" y="' + round(geo.offset.y) + '" as="offset"/>';
	}

	return '<mxGeometry' + a + ' as="geometry"' + ((inner) ? '>' + inner + '</mxGeometry>' : '/>');
}

function round(v)
{
	return Math.round(v * 100) / 100;
}

function cellXml(cell)
{
	var attrs = '';

	if (cell.value != null && typeof cell.value !== 'object')
	{
		attrs += ' value="' + esc(cell.value) + '"';
	}

	if (cell.style)
	{
		attrs += ' style="' + esc(cell.style) + '"';
	}

	if (cell.vertex)
	{
		attrs += ' vertex="1"';
	}

	if (cell.edge)
	{
		attrs += ' edge="1"';
	}

	if (cell.connectable != null)
	{
		attrs += ' connectable="' + esc(cell.connectable) + '"';
	}

	if (cell.parent != null)
	{
		attrs += ' parent="' + esc(cell.parent.id) + '"';
	}

	if (cell.source != null)
	{
		attrs += ' source="' + esc(cell.source.id) + '"';
	}

	if (cell.target != null)
	{
		attrs += ' target="' + esc(cell.target.id) + '"';
	}

	var geo = geometryXml(cell.geometry, cell.edge);
	var mx = (cell.value != null && typeof cell.value === 'object') ?
		'<mxCell' + attrs + ((geo) ? '>' + geo + '</mxCell>' : '/>') :
		'<mxCell id="' + esc(cell.id) + '"' + attrs + ((geo) ? '>' + geo + '</mxCell>' : '/>');

	if (cell.value != null && typeof cell.value === 'object')
	{
		var va = cell.value.attributes.map(function(a) { return ' ' + a.name + '="' + esc(a.value) + '"'; }).join('');

		return '<' + cell.value.nodeName + va + ' id="' + esc(cell.id) + '">' + mx + '</' + cell.value.nodeName + '>';
	}

	return mx;
}

/**
 * Serializes a page to mxGraphModel XML (cells in tree order).
 */
export function pageXml(page)
{
	var attrs = Object.assign({dx: '0', dy: '0', grid: '1', gridSize: '10', guides: '1', tooltips: '1', connect: '1',
		arrows: '1', fold: '1', page: '1', pageScale: '1', pageWidth: '1654', pageHeight: '1169', math: '0',
		shadow: '0'}, page.attrs);
	var out = [];

	function visit(cell)
	{
		out.push(cellXml(cell));

		for (var i = 0; i < cell.children.length; i++)
		{
			visit(cell.children[i]);
		}
	}

	if (page.root != null)
	{
		visit(page.root);
	}

	return '<mxGraphModel' + Object.keys(attrs).map(function(k) { return ' ' + k + '="' + esc(attrs[k]) + '"'; }).join('') +
		'><root>' + out.join('') + '</root></mxGraphModel>';
}

/**
 * Serializes pages to an uncompressed mxfile.
 */
export function fileXml(pages)
{
	return '<mxfile host="ProcessDraw MCP" type="device">' + pages.map(function(p)
	{
		return '<diagram id="' + esc(p.id) + '" name="' + esc(p.name) + '">' + pageXml(p) + '</diagram>';
	}).join('') + '</mxfile>';
}
