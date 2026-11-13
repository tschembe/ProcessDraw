// Builds a .drawio sheet with every ProcessDraw symbol, straight from the symbol files.
// Used to check symbols visually without starting the editor:
//
//   node tools/symbol-sheet.cjs drawio/src/main/webapp/js/processdraw symbols.drawio [pdValves,pdLines]
//   npx electron . -x -f png -s 1.5 -o symbols.png symbols.drawio
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');

const [dir, out, only] = process.argv.slice(2);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '&#xa;');

function FakeEl(name) { this.nodeName = name; this.attrs = {}; }
FakeEl.prototype.setAttribute = function(k, v) { this.attrs[k] = String(v); };

const ctx = {
	console,
	mxUtils: {
		htmlEntities: esc,
		indexOf: (a, o) => a.indexOf(o),
		createXmlDocument: () => ({ createElement: n => new FakeEl(n) })
	},
	Graph: { compress: d => zlib.deflateRawSync(Buffer.from(encodeURIComponent(d))).toString('base64') },
	mxCell: function(v, g, s) { this.value = v; this.geometry = g; this.style = s; },
	mxGeometry: function(x, y, w, h) { this.x = x; this.y = y; this.width = w; this.height = h; this.setTerminalPoint = function() {}; },
	mxPoint: function(x, y) { this.x = x; this.y = y; }
};
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['pd-stencil.js', 'pd-library.js', 'pd-symbols-equipment.js', 'pd-symbols-piping.js', 'pd-symbols-instruments.js'])
	vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });

const L = ctx.ProcessDraw.Library;
let cells = '', id = 2, x = 20, y = 20, rowH = 0, count = 0;
const pals = only ? L.palettes.filter(p => only.split(',').includes(p.id)) : L.palettes;

for (const pal of pals) {
	cells += `<mxCell id="${id++}" value="${esc(pal.title)}" style="text;fontStyle=1;fontSize=14;" vertex="1" parent="1"><mxGeometry x="${20}" y="${y}" width="400" height="20" as="geometry"/></mxCell>`;
	y += 30; x = 20; rowH = 0;
	for (const sym of pal.items) {
		count++;
		const v = L.createValue(sym);
		const attrs = Object.entries(v.attrs).map(([k, val]) => `${k}="${esc(val)}"`).join(' ');
		const style = esc(L.getStyle(sym));
		if (sym.edge) {
			cells += `<object id="${id++}" ${attrs}><mxCell style="${style}" edge="1" parent="1"><mxGeometry relative="1" as="geometry"><mxPoint x="${x}" y="${y + 20}" as="sourcePoint"/><mxPoint x="${x + 100}" y="${y + 20}" as="targetPoint"/></mxGeometry></mxCell></object>`;
			cells += `<mxCell id="${id++}" value="${esc(sym.name)}" style="text;fontSize=8;align=center;" vertex="1" parent="1"><mxGeometry x="${x}" y="${y + 30}" width="100" height="14" as="geometry"/></mxCell>`;
			x += 140; rowH = Math.max(rowH, 50);
		} else {
			cells += `<object id="${id++}" ${attrs}><mxCell style="${style}" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${sym.w}" height="${sym.h}" as="geometry"/></mxCell></object>`;
			cells += `<mxCell id="${id++}" value="${esc(sym.name)}" style="text;fontSize=8;align=center;verticalAlign=top;whiteSpace=wrap;" vertex="1" parent="1"><mxGeometry x="${x + sym.w / 2 - 45}" y="${y + sym.h + 18}" width="90" height="24" as="geometry"/></mxCell>`;
			x += Math.max(sym.w, 90) + 30; rowH = Math.max(rowH, sym.h + 50);
		}
		if (x > 1000) { x = 20; y += rowH + 10; rowH = 0; }
	}
	y += rowH + 30;
}

fs.writeFileSync(out, `<mxfile><diagram name="Symbols" id="s1"><mxGraphModel grid="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells}</root></mxGraphModel></diagram></mxfile>`);
console.log('symbols', count, 'palettes', pals.length, '->', out);
