/**
 * Renders previews with the ProcessDraw desktop CLI (same renderer as its PDF/PNG
 * export, including the ProcessDraw shapes) and opens drawings in ProcessDraw.
 */
import { spawn } from 'child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { REPO_ROOT } from './runtime.js';

function electronBinary()
{
	if (process.env.PROCESSDRAW_ELECTRON)
	{
		return process.env.PROCESSDRAW_ELECTRON;
	}

	var dist = join(REPO_ROOT, 'node_modules', 'electron', 'dist');
	var bin = (process.platform == 'win32') ? join(dist, 'electron.exe') :
		((process.platform == 'darwin') ? join(dist, 'Electron.app', 'Contents', 'MacOS', 'Electron') : join(dist, 'electron'));

	return existsSync(bin) ? bin : null;
}

export function appAvailable()
{
	return electronBinary() != null;
}

function run(args, timeoutMs)
{
	return new Promise(function(resolve, reject)
	{
		var bin = electronBinary();

		if (bin == null)
		{
			reject(new Error('ProcessDraw is not installed (run npm install in ' + REPO_ROOT + ')'));
			return;
		}

		var child = spawn(bin, [REPO_ROOT].concat(args), {stdio: ['ignore', 'pipe', 'pipe']});
		var err = '';
		var timer = setTimeout(function()
		{
			child.kill('SIGKILL');
			reject(new Error('ProcessDraw export timed out'));
		}, timeoutMs || 90000);

		child.stderr.on('data', function(d) { err += d; });
		child.stdout.on('data', function() {});
		child.on('error', function(e) { clearTimeout(timer); reject(e); });
		child.on('close', function(code)
		{
			clearTimeout(timer);

			if (code == 0)
			{
				resolve();
			}
			else
			{
				reject(new Error('ProcessDraw export failed (' + code + '): ' + err.split('\n').filter(function(l)
				{
					return /error/i.test(l) && !/vaapi|gpu|dbus|DIPS|portal/i.test(l);
				}).slice(-3).join(' ')));
			}
		});
	});
}

/**
 * PNG previews of the given pages (0-based indexes). Returns [{page, data (base64)}].
 * A separate profile keeps the export from talking to a ProcessDraw that is open.
 */
export async function renderPages(file, pageIndexes, scale)
{
	var dir = mkdtempSync(join(tmpdir(), 'processdraw-preview-'));
	var result = [];

	try
	{
		for (var i = 0; i < pageIndexes.length; i++)
		{
			var out = join(dir, 'page-' + pageIndexes[i] + '.png');
			await run(['--user-data-dir=' + join(dir, 'profile'), '-x', '-f', 'png', '-s', String(scale || 0.8), '-b', '10',
				'-p', String(pageIndexes[i] + 1), '-o', out, file]);

			if (existsSync(out))
			{
				result.push({page: pageIndexes[i], data: readFileSync(out).toString('base64')});
			}
		}
	}
	finally
	{
		rmSync(dir, {recursive: true, force: true});
	}

	return result;
}

/**
 * Opens the file in ProcessDraw (a running ProcessDraw opens it in a new window).
 */
export function openInApp(file)
{
	var bin = electronBinary();

	if (bin == null || /^(off|none|0|false)$/i.test(process.env.PROCESSDRAW_OPEN || ''))
	{
		return false;
	}

	var child = spawn(bin, [REPO_ROOT, file], {detached: true, stdio: 'ignore'});
	child.unref();

	return true;
}
