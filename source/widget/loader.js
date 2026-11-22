// Dylan's System widgets — loader. Paste this into a new Scriptable script once.
// It fetches the latest widget code from the app each run, so widget updates need no re-pasting.
const SRC = '__APP__widget.js';
const fm = FileManager.local(), path = fm.joinPath(fm.documentsDirectory(), 'ds-widget.js');
try {
  const r = new Request(SRC + '?t=' + Date.now()); r.timeoutInterval = 8;
  const code = await r.loadString();
  if (r.response.statusCode === 200 && code.includes('module.exports')) fm.writeString(path, code);
} catch (e) { }
if (!fm.fileExists(path)) throw new Error('Could not download the widget code — check your connection and run again');
await importModule(path)();
