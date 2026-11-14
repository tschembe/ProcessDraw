/**
 * Loads ProcessDraw's own editor modules (symbols, tags, lines, sheets, H&MB,
 * lists, XLSX) headlessly, so the MCP server uses exactly the same symbol
 * definitions, numbering rules and generated labels as the editor.
 *
 * The modules run in a vm context with small stand-ins for the mxGraph globals
 * they touch at load time and a "fake ui" that exposes pages built with model.js.
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';
import zlib from 'zlib';
import { XmlValue } from './model.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = process.env.PROCESSDRAW_HOME ? resolve(process.env.PROCESSDRAW_HOME) :
	resolve(__dirname, '..', '..', '..', '..');
export const WEBAPP = join(REPO_ROOT, 'drawio', 'src', 'main', 'webapp');

const MODULES = ['pd-stencil.js', 'pd-library.js', 'pd-symbols-equipment.js', 'pd-symbols-piping.js',
	'pd-symbols-instruments.js', 'pd-tags.js', 'pd-fields.js', 'pd-lines.js', 'pd-project.js', 'pd-pfd.js',
	'pd-sheet.js', 'pd-xlsx.js', 'pd-lists.js'];

function htmlEntities(s, newline)
{
	s = String((s != null) ? s : '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
		.replace(/</g, '&lt;').replace(/>/g, '&gt;');

	return (newline == null || newline) ? s.replace(/\n/g, '&#xa;') : s;
}

let runtime = null;

/**
 * Returns the loaded ProcessDraw namespace (cached).
 */
export function getProcessDraw()
{
	if (runtime != null)
	{
		return runtime;
	}

	if (!existsSync(join(WEBAPP, 'js', 'processdraw', 'pd-library.js')))
	{
		throw new Error('ProcessDraw editor sources not found at ' + WEBAPP +
			' (set PROCESSDRAW_HOME to the ProcessDraw repository)');
	}

	var ctx = {
		console: console, setTimeout: setTimeout, clearTimeout: clearTimeout, setImmediate: setImmediate,
		Promise: Promise, Uint8Array: Uint8Array, ArrayBuffer: ArrayBuffer, TextEncoder: TextEncoder,
		TextDecoder: TextDecoder, Math: Math, JSON: JSON, Date: Date,
		mxUtils: {
			htmlEntities: htmlEntities,
			indexOf: function(a, o) { return (a != null) ? Array.prototype.indexOf.call(a, o) : -1; },
			isNode: function(v) { return v != null && v.nodeType == 1 && typeof v.getAttribute === 'function'; },
			createXmlDocument: function() { return {createElement: function(n) { return new XmlValue(n); }}; }
		},
		mxResources: {parse: function() {}, get: function(k, a, d) { return (d != null) ? d : k; }},
		mxConstants: {NONE: 'none', NS_SVG: 'http://www.w3.org/2000/svg'},
		mxEvent: {}, mxCell: function() {}, mxGeometry: function() {}, mxPoint: function() {},
		mxRectangle: function(x, y, w, h) { this.x = x; this.y = y; this.width = w; this.height = h; },
		Graph: {
			compress: function(d)
			{
				return zlib.deflateRawSync(Buffer.from(encodeURIComponent(d))).toString('base64');
			}
		}
	};
	ctx.window = ctx;
	ctx.self = ctx;
	vm.createContext(ctx);
	vm.runInContext(readFileSync(join(WEBAPP, 'js', 'jszip', 'jszip.min.js'), 'utf8'), ctx, {filename: 'jszip.min.js'});

	for (var i = 0; i < MODULES.length; i++)
	{
		vm.runInContext(readFileSync(join(WEBAPP, 'js', 'processdraw', MODULES[i]), 'utf8'), ctx,
			{filename: MODULES[i]});
	}

	runtime = ctx.ProcessDraw;
	runtime._ctx = ctx;

	return runtime;
}

/**
 * Editor stand-in over model.js pages for the ProcessDraw modules: page
 * access, the current page's root and cells, and value changes.
 */
export function createUi(pages)
{
	var ui = {
		pages: pages,
		currentPage: pages[0],
		getCurrentFile: function() { return null; },
		updatePageRoot: function() {},
		editor: {
			setStatus: function() {},
			graph: {
				model: {
					getRoot: function() { return ui.currentPage.root; },
					getCell: function(id) { return ui.currentPage.cells[id]; },
					isEdge: function(c) { return c != null && c.edge; },
					isVertex: function(c) { return c != null && c.vertex; },
					setValue: function(cell, value) { cell.value = value; },
					getParent: function(c) { return c.parent; },
					beginUpdate: function() {},
					endUpdate: function() {}
				}
			}
		}
	};

	return ui;
}
