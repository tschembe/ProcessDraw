/**
 * Minimal XLSX (SpreadsheetML) writer for ProcessDraw lists. No dependency:
 * buildFiles returns the files of the workbook, ProcessDraw.Xlsx.toBase64
 * zips them with the JSZip that ships with draw.io.
 *
 * A sheet is {name, title, info: [lines], columns: [{header, width}], rows: [[values]]}.
 * Numbers in rows (type number) become numeric cells, everything else text.
 */
(function()
{
	var ProcessDraw = window.ProcessDraw = window.ProcessDraw || {};

	var NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
	var NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

	// Cell styles (index into cellXfs below)
	var S_TEXT = 0;
	var S_TITLE = 1;
	var S_HEADER = 2;
	var S_CELL = 3;
	var S_INFO = 4;

	function esc(s)
	{
		return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
	};

	function colName(index)
	{
		var name = '';
		index++;

		while (index > 0)
		{
			var rem = (index - 1) % 26;
			name = String.fromCharCode(65 + rem) + name;
			index = Math.floor((index - 1) / 26);
		}

		return name;
	};

	function cell(ref, value, style)
	{
		if (value == null || value === '')
		{
			return (style != S_TEXT) ? '<c r="' + ref + '" s="' + style + '"/>' : '';
		}

		if (typeof value === 'number' && isFinite(value))
		{
			return '<c r="' + ref + '" s="' + style + '"><v>' + value + '</v></c>';
		}

		return '<c r="' + ref + '" s="' + style + '" t="inlineStr"><is><t xml:space="preserve">' +
			esc(value) + '</t></is></c>';
	};

	/**
	 * Excel sheet names: max 31 characters, no []:*?/\ and unique.
	 */
	function sheetName(name, used)
	{
		var base = String(name || 'Sheet').replace(/[\[\]:*?\/\\]/g, ' ').substring(0, 31).trim() || 'Sheet';
		var result = base;

		for (var i = 2; used[result.toLowerCase()]; i++)
		{
			result = base.substring(0, 28) + ' ' + i;
		}

		used[result.toLowerCase()] = true;

		return result;
	};

	function buildSheet(sheet)
	{
		var rows = [];
		var r = 1;
		var cols = sheet.columns.length;
		var last = colName(Math.max(0, cols - 1));

		rows.push('<row r="' + r + '">' + cell('A' + r, sheet.title || sheet.name, S_TITLE) + '</row>');
		r++;

		for (var i = 0; i < (sheet.info || []).length; i++)
		{
			rows.push('<row r="' + r + '">' + cell('A' + r, sheet.info[i], S_INFO) + '</row>');
			r++;
		}

		r++;
		var headerRow = r;
		var header = '<row r="' + r + '">';

		for (var c = 0; c < cols; c++)
		{
			header += cell(colName(c) + r, sheet.columns[c].header, S_HEADER);
		}

		rows.push(header + '</row>');
		r++;

		for (var i = 0; i < sheet.rows.length; i++)
		{
			var row = '<row r="' + r + '">';

			for (var c = 0; c < cols; c++)
			{
				row += cell(colName(c) + r, sheet.rows[i][c], S_CELL);
			}

			rows.push(row + '</row>');
			r++;
		}

		var widths = '<cols>';

		for (var c = 0; c < cols; c++)
		{
			widths += '<col min="' + (c + 1) + '" max="' + (c + 1) + '" width="' +
				(sheet.columns[c].width || 14) + '" customWidth="1"/>';
		}

		widths += '</cols>';

		var lastRow = Math.max(headerRow, r - 1);
		sheet._filter = (cols > 0) ? '$A$' + headerRow + ':$' + last + '$' + lastRow : null;

		return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
			'<worksheet xmlns="' + NS + '" xmlns:r="' + NS_R + '">' +
			'<dimension ref="A1:' + last + lastRow + '"/>' +
			'<sheetViews><sheetView workbookViewId="0"><pane ySplit="' + headerRow + '" topLeftCell="A' +
			(headerRow + 1) + '" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
			'<sheetFormatPr defaultRowHeight="15"/>' + ((cols > 0) ? widths : '') +
			'<sheetData>' + rows.join('') + '</sheetData>' +
			((cols > 0) ? '<autoFilter ref="A' + headerRow + ':' + last + lastRow + '"/>' : '') +
			'<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>' +
			'</worksheet>';
	};

	var STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
		'<styleSheet xmlns="' + NS + '">' +
		'<fonts count="4">' +
			'<font><sz val="10"/><name val="Arial"/></font>' +
			'<font><b/><sz val="14"/><name val="Arial"/></font>' +
			'<font><b/><sz val="10"/><name val="Arial"/></font>' +
			'<font><i/><sz val="9"/><color rgb="FF666666"/><name val="Arial"/></font>' +
		'</fonts>' +
		'<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
			'<fill><patternFill patternType="solid"><fgColor rgb="FFD9E1F2"/><bgColor indexed="64"/></patternFill></fill>' +
		'</fills>' +
		'<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
			'<border><left style="thin"><color rgb="FF999999"/></left><right style="thin"><color rgb="FF999999"/></right>' +
			'<top style="thin"><color rgb="FF999999"/></top><bottom style="thin"><color rgb="FF999999"/></bottom>' +
			'<diagonal/></border>' +
		'</borders>' +
		'<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
		'<cellXfs count="5">' +
			'<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
			'<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
			'<xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" ' +
				'applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf>' +
			'<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>' +
			'<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
		'</cellXfs>' +
		'<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
		'</styleSheet>';

	/**
	 * Returns {path: content} for all files of the workbook.
	 */
	function buildFiles(sheets, properties)
	{
		var files = {};
		var used = {};
		var wbSheets = '';
		var rels = '';
		var types = '';
		var names = '';

		for (var i = 0; i < sheets.length; i++)
		{
			var name = sheetName(sheets[i].name, used);
			files['xl/worksheets/sheet' + (i + 1) + '.xml'] = buildSheet(sheets[i]);
			wbSheets += '<sheet name="' + esc(name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>';

			// Excel keeps the autofilter range in a hidden defined name
			if (sheets[i]._filter != null)
			{
				names += '<definedName name="_xlnm._FilterDatabase" localSheetId="' + i + '" hidden="1">\'' +
					esc(name.replace(/'/g, "''")) + '\'!' + sheets[i]._filter + '</definedName>';
			}
			rels += '<Relationship Id="rId' + (i + 1) + '" Type="' + NS_R + '/worksheet" Target="worksheets/sheet' +
				(i + 1) + '.xml"/>';
			types += '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="' +
				'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
		}

		rels += '<Relationship Id="rId' + (sheets.length + 1) + '" Type="' + NS_R + '/styles" Target="styles.xml"/>';

		files['[Content_Types].xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
			'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
			'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
			'<Default Extension="xml" ContentType="application/xml"/>' +
			'<Override PartName="/xl/workbook.xml" ContentType="' +
				'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
			'<Override PartName="/xl/styles.xml" ContentType="' +
				'application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
			'<Override PartName="/docProps/core.xml" ContentType="' +
				'application/vnd.openxmlformats-package.core-properties+xml"/>' + types + '</Types>';
		files['_rels/.rels'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
			'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
			'<Relationship Id="rId1" Type="' + NS_R + '/officeDocument" Target="xl/workbook.xml"/>' +
			'<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/' +
				'core-properties" Target="docProps/core.xml"/>' +
			'</Relationships>';
		files['docProps/core.xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
			'<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
			'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
			'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
			'<dc:title>' + esc((properties || {}).title || 'ProcessDraw lists') + '</dc:title>' +
			'<dc:creator>ProcessDraw</dc:creator>' +
			'<dcterms:created xsi:type="dcterms:W3CDTF">' + new Date().toISOString().replace(/\.\d+Z$/, 'Z') +
			'</dcterms:created></cp:coreProperties>';
		files['xl/workbook.xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
			'<workbook xmlns="' + NS + '" xmlns:r="' + NS_R + '"><bookViews><workbookView/></bookViews>' +
			'<sheets>' + wbSheets + '</sheets>' + ((names) ? '<definedNames>' + names + '</definedNames>' : '') +
			'</workbook>';
		files['xl/_rels/workbook.xml.rels'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
			'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rels +
			'</Relationships>';
		files['xl/styles.xml'] = STYLES;

		return files;
	};

	/**
	 * Zips the workbook and calls done(base64). JSZip ships with draw.io; it is
	 * loaded on demand where it is not bundled (dev mode).
	 */
	function toBase64(sheets, properties, done, error)
	{
		function zip()
		{
			try
			{
				var z = new JSZip();
				var files = buildFiles(sheets, properties);

				for (var path in files)
				{
					z.file(path, files[path]);
				}

				z.generateAsync({type: 'base64', compression: 'DEFLATE'}).then(done, error);
			}
			catch (e)
			{
				error(e);
			}
		};

		if (typeof JSZip !== 'undefined')
		{
			zip();
		}
		else
		{
			mxscript('js/jszip/jszip.min.js', zip, null, null, true, function()
			{
				error(new Error('Could not load JSZip'));
			});
		}
	};

	ProcessDraw.Xlsx =
	{
		colName: colName,
		sheetName: sheetName,
		buildFiles: buildFiles,
		toBase64: toBase64
	};
})();
