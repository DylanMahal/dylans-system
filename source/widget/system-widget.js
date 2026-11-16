// Dylan's System — home-screen and lock-screen widget for the Scriptable app.
// First run: open this script inside Scriptable once and sign in. After that, add a Scriptable
// widget, tap it while editing the home screen, and pick this script.
const SUPA_URL = '__URL__';
const SUPA_KEY = '__KEY__';
const APP_URL = '__APP__';
const PINK = new Color('#ff2a6d'), CYAN = new Color('#05d9e8'), OK = new Color('#57f5a8'), BG = new Color('#050505'), DIM = new Color('#7a7a7a'), FG = new Color('#e6e6e6');
const mono = (s, b) => b ? Font.boldMonospacedSystemFont(s) : Font.regularMonospacedSystemFont(s);

async function signIn() {
  const a = new Alert(); a.title = "Dylan's System"; a.message = 'Sign in once so the widget can read today.';
  a.addTextField('email'); a.addSecureTextField('password'); a.addAction('Sign in'); a.addCancelAction('Cancel');
  if ((await a.present()) === -1) throw new Error('cancelled');
  return auth('password', { email: a.textFieldValue(0).trim(), password: a.textFieldValue(1) });
}
async function auth(grant, body) {
  const r = new Request(`${SUPA_URL}/auth/v1/token?grant_type=${grant}`);
  r.method = 'POST'; r.headers = { apikey: SUPA_KEY, 'Content-Type': 'application/json' }; r.body = JSON.stringify(body);
  const j = await r.loadJSON();
  if (!j.access_token) throw new Error(j.error_description || j.msg || 'sign-in failed');
  Keychain.set('ds_rt', j.refresh_token); return j.access_token;
}
async function token() {
  if (Keychain.contains('ds_rt')) { try { return await auth('refresh_token', { refresh_token: Keychain.get('ds_rt') }) } catch (e) { if (config.runsInWidget) throw e } }
  if (config.runsInWidget) throw new Error('Open the script in Scriptable to sign in');
  return signIn();
}
async function today() {
  const t = await token();
  const r = new Request(`${SUPA_URL}/rest/v1/kv?select=data&path=eq.widget%2Ftoday`);
  r.headers = { apikey: SUPA_KEY, Authorization: `Bearer ${t}` };
  const rows = await r.loadJSON(); const d = rows && rows[0] && rows[0].data;
  if (d) Keychain.set('ds_last', JSON.stringify(d)); return d;
}
function nowMin() { const n = new Date(); let m = n.getHours() * 60 + n.getMinutes(); if (m < 300) m += 1440; return m }
function toMin(t) { const [h, m] = t.split(':').map(Number); let v = h * 60 + m; if (v < 300) v += 1440; return v }
function bar(pct, w, h) {
  const c = new DrawContext(); c.size = new Size(w, h); c.opaque = false; c.respectScreenScale = true;
  c.setFillColor(new Color('#1c1c1c')); c.fillRect(new Rect(0, 0, w, h));
  c.setFillColor(pct >= 80 ? OK : PINK); c.fillRect(new Rect(0, 0, Math.max(2, w * pct / 100), h));
  c.setFillColor(OK); c.fillRect(new Rect(w * .8 - 1, 0, 2, h));
  return c.getImage();
}
function txt(stack, s, size, color, bold) { const t = stack.addText(s); t.font = mono(size, bold); t.textColor = color || FG; t.lineLimit = 1; t.minimumScaleFactor = .6; return t }

async function build() {
  const fam = config.widgetFamily || 'medium';
  let d = null, err = null;
  try { d = await today() } catch (e) { err = e.message; if (Keychain.contains('ds_last')) d = JSON.parse(Keychain.get('ds_last')) }
  const w = new ListWidget(); w.backgroundColor = BG; w.url = APP_URL; w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
  if (!d) { txt(w, 'SYSTEM', 14, PINK, true); w.addSpacer(4); txt(w, err || 'no data yet', 10, DIM); return w }
  const m = nowMin(); const up = d.items.filter(i => toMin(i.t) > m && !i.d); const nxt = up[0];
  const mins = nxt ? toMin(nxt.t) - m : null; const eta = mins == null ? '' : mins >= 60 ? `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, '0')}` : `${mins}m`;

  if (fam === 'accessoryCircular') { w.addAccessoryWidgetBackground = true; const s = w.addStack(); s.layoutVertically(); s.centerAlignContent(); txt(s, `${d.pct}%`, 14, Color.white(), true); txt(s, 'day', 9, Color.white()); return w }
  if (fam === 'accessoryRectangular') { txt(w, `${d.pct}% · ${d.done}/${d.total}`, 12, Color.white(), true); if (nxt) { txt(w, `${nxt.t} ${nxt.n}`, 11, Color.white()); txt(w, `in ${eta}`, 10, Color.white()) } return w }
  if (fam === 'accessoryInline') { txt(w, nxt ? `${d.pct}% · ${nxt.t} ${nxt.n}` : `${d.pct}% today`, 12, Color.white()); return w }

  w.setPadding(12, 14, 12, 14);
  const top = w.addStack(); top.centerAlignContent(); txt(top, 'dylan@stack', 9, PINK, true); top.addSpacer(); txt(top, d.date.slice(5).replace('-', '/'), 9, DIM);
  w.addSpacer(6);
  const row = w.addStack(); row.topAlignContent();
  const left = row.addStack(); left.layoutVertically();
  txt(left, `${d.pct}%`, fam === 'small' ? 34 : 38, d.pct >= 80 ? OK : FG, true);
  left.addSpacer(2); const b = left.addImage(bar(d.pct, fam === 'small' ? 120 : 130, 5)); b.imageSize = new Size(fam === 'small' ? 120 : 130, 5);
  left.addSpacer(3); txt(left, `${d.done}/${d.total} ticked`, 9, DIM);
  if (fam === 'small') {
    w.addSpacer();
    if (nxt) { txt(w, `NEXT · ${eta}`, 9, PINK, true); txt(w, nxt.n, 11, FG) } else txt(w, 'nothing left today', 10, DIM);
    return w;
  }
  row.addSpacer(14);
  const right = row.addStack(); right.layoutVertically();
  txt(right, nxt ? `NEXT · ${eta}` : 'DONE FOR TODAY', 9, PINK, true); right.addSpacer(3);
  up.slice(0, fam === 'large' ? 14 : 4).forEach(i => { const r = right.addStack(); txt(r, i.t + ' ', 10, i.c ? CYAN : DIM); txt(r, i.n, 10, FG) });
  w.addSpacer();
  const hb = w.addStack(); hb.spacing = 6;
  (d.habits || []).slice(0, fam === 'large' ? 8 : 6).forEach(h => { const s = hb.addStack(); s.centerAlignContent(); const dot = s.addText(h.d ? '■' : '□'); dot.font = mono(9, true); dot.textColor = h.d ? OK : DIM; s.addSpacer(2); txt(s, h.l, 8, h.d ? FG : DIM) });
  if (fam === 'large') {
    w.addSpacer(6);
    const st = w.addStack(); st.spacing = 14;
    txt(st, `water ${d.water}/${d.waterTarget}`, 10, CYAN); txt(st, `deep work ${Math.floor(d.dw / 60)}h${String(d.dw % 60).padStart(2, '0')}`, 10, FG); txt(st, `leetcode ${d.lc}/8`, 10, FG);
  }
  return w;
}

const widget = await build();
if (config.runsInWidget) Script.setWidget(widget);
else { await widget.presentMedium(); }
Script.complete();
