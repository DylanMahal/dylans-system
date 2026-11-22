// Dylan's System — home-screen and lock-screen widgets for the Scriptable app.
// This file is served by the app and loaded by the small loader script (widget/loader.js).
// Pick what a widget shows with its Parameter (long-press the widget → Edit Widget → Parameter):
//   today · tasks · cals · sleep · week · habits · habit|<name> · streak|<name> · goal|<exercise>|<kg>|<YYYY-MM-DD>
const SUPA_URL = 'https://ucnwefjblxqbmmwdbqhw.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjbndlZmpibHhxYm1td2RicWh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ1NzczMDEsImV4cCI6MjExMDE1MzMwMX0.6jv9kXXMt6h2SmBA_zcPRQ23b7lAMw0DvVcaPB4DrVk';
const APP_URL = 'https://dylanmahal.github.io/dylans-system/';

const PINK = new Color('#ff2a6d'), CYAN = new Color('#05d9e8'), OK = new Color('#57f5a8'), BG = new Color('#050505'), DIM = new Color('#7a7a7a'), FG = new Color('#e6e6e6');
const CARD = new Color('#141414'), WHITE = new Color('#f2f2f2'), GREY = new Color('#8e8e93'), TRACK = new Color('#2c2c2e'), RED = new Color('#ff453a');
const mono = (s, b) => b ? Font.boldMonospacedSystemFont(s) : Font.regularMonospacedSystemFont(s);
const NAMED = { pink: '#ff2a6d', cyan: '#05d9e8', ok: '#57f5a8', green: '#57f5a8', amber: '#ffb000', purple: '#9b5cff', orange: '#ff6b3d', blue: '#4da3ff', fg: '#e6e6e6' };
const colHex = (c, f) => { c = String(c || ''); if (/^#[0-9a-f]{3,8}$/i.test(c)) return c; const m = c.match(/--([a-z]+)/i); return (m && NAMED[m[1]]) || f || '#e6e6e6' };
const col = (c, f, a) => new Color(colHex(c, f), a == null ? 1 : a);
const CAL_COL = { job: '#3d4a5c', study: '#52637a', gym: '#6b7d96', fun: '#8392a8', other: '#666a71' };

/* ---------------- auth: one refresh at a time, access token reused until it expires ---------------- */
async function signIn() {
  const a = new Alert(); a.title = "Dylan's System"; a.message = 'Sign in once so the widgets can read your data.';
  a.addTextField('email'); a.addSecureTextField('password'); a.addAction('Sign in'); a.addCancelAction('Cancel');
  if ((await a.present()) === -1) throw new Error('cancelled');
  return auth('password', { email: a.textFieldValue(0).trim(), password: a.textFieldValue(1) });
}
async function auth(grant, body) {
  const r = new Request(`${SUPA_URL}/auth/v1/token?grant_type=${grant}`);
  r.method = 'POST'; r.headers = { apikey: SUPA_KEY, 'Content-Type': 'application/json' }; r.body = JSON.stringify(body);
  const j = await r.loadJSON();
  if (!j.access_token) throw new Error(j.error_description || j.msg || 'sign-in failed');
  Keychain.set('ds_rt', j.refresh_token);
  Keychain.set('ds_at', JSON.stringify({ t: j.access_token, exp: Date.now() + ((j.expires_in || 3600) - 120) * 1000 }));
  return j.access_token;
}
async function token() {
  if (Keychain.contains('ds_at')) { try { const a = JSON.parse(Keychain.get('ds_at')); if (a.exp > Date.now()) return a.t } catch (e) { } }
  if (Keychain.contains('ds_rt')) {
    const rt = Keychain.get('ds_rt');
    try { return await auth('refresh_token', { refresh_token: rt }) } catch (e) {
      /* another widget may have just rotated the token — use what it stored */
      if (Keychain.contains('ds_rt') && Keychain.get('ds_rt') !== rt) { try { const a = JSON.parse(Keychain.get('ds_at')); if (a.exp > Date.now()) return a.t } catch (_) { } }
      if (config.runsInWidget) throw e
    }
  }
  if (config.runsInWidget) throw new Error('Open the script in Scriptable to sign in');
  return signIn();
}
async function rows(q) {
  const t = await token();
  const r = new Request(`${SUPA_URL}/rest/v1/kv?select=path,data&${q}`);
  r.headers = { apikey: SUPA_KEY, Authorization: `Bearer ${t}` };
  const j = await r.loadJSON(); if (!Array.isArray(j)) throw new Error((j && j.message) || 'read failed'); return j;
}
async function docs(paths) { const j = await rows('path=in.(' + encodeURIComponent(paths.map(p => `"${p}"`).join(',')) + ')'); const o = {}; j.forEach(x => o[x.path] = x.data); return o }
const prefix = p => rows('path=like.' + encodeURIComponent(p + '*'));

/* ---------------- dates (the app's day rolls over at 5am) ---------------- */
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayK = () => ymd(new Date(Date.now() - 5 * 36e5));
const addD = (k, n) => { const x = new Date(k + 'T12:00'); x.setDate(x.getDate() + n); return ymd(x) };
const monOf = k => { const x = new Date(k + 'T12:00'); return addD(k, -((x.getDay() + 6) % 7)) };
const hm = m => `${Math.floor(m / 60)}h ${pad(Math.round(m % 60))}m`;
const clock = iso => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}` };

/* ---------------- drawing helpers ---------------- */
function ctx(w, h) { const c = new DrawContext(); c.size = new Size(w, h); c.opaque = false; c.respectScreenScale = true; return c }
function rr(c, x, y, w, h, r, color) { const p = new Path(); p.addRoundedRect(new Rect(x, y, w, h), r, r); c.addPath(p); c.setFillColor(color); c.fillPath() }
function arc(c, cx, cy, r, a0, a1, w, color) {
  if (a1 - a0 < 0.001) return;
  const p = new Path(), n = Math.max(8, Math.ceil((a1 - a0) * 40));
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n, pt = new Point(cx + r * Math.cos(a), cy + r * Math.sin(a)); i ? p.addLine(pt) : p.move(pt) }
  c.addPath(p); c.setStrokeColor(color); c.setLineWidth(w); c.strokePath();
  c.setFillColor(color); [a0, a1].forEach(a => c.fillEllipse(new Rect(cx + r * Math.cos(a) - w / 2, cy + r * Math.sin(a) - w / 2, w, w)));
}
function ring(size, frac, color, w, track) {
  const c = ctx(size, size), r = size / 2 - w / 2 - 1;
  arc(c, size / 2, size / 2, r, 0, Math.PI * 2, w, track || TRACK);
  arc(c, size / 2, size / 2, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, frac)), w, color);
  return c.getImage();
}
function text(c, s, x, y, w, h, font, color, align) { c.setFont(font); c.setTextColor(color); align === 'c' ? c.setTextAlignedCenter() : align === 'r' ? c.setTextAlignedRight() : c.setTextAlignedLeft(); c.drawTextInRect(String(s), new Rect(x, y, w, h)) }
function txt(stack, s, size, color, bold) { const t = stack.addText(String(s)); t.font = mono(size, bold); t.textColor = color || FG; t.lineLimit = 1; t.minimumScaleFactor = .6; return t }
function sf(stack, s, font, color, lines) { const t = stack.addText(String(s)); t.font = font; t.textColor = color || WHITE; t.lineLimit = lines || 1; t.minimumScaleFactor = .7; return t }
function pic(stack, img, w, h) { const i = stack.addImage(img); i.imageSize = new Size(w, h); return i }
const FAM = () => config.widgetFamily || 'medium';
const SIZE = { small: [158, 158], medium: [338, 158], large: [338, 354], extraLarge: [715, 354] };
const acc = f => f.startsWith('accessory');
function base(url) { const w = new ListWidget(); w.backgroundColor = SURF; w.url = APP_URL + (url ? '#' + url : ''); w.refreshAfterDate = new Date(Date.now() + 15 * 6e4); w.setPadding(16, 16, 16, 16); return w }
function cache(mode, d) { const fm = FileManager.local(), p = fm.joinPath(fm.cacheDirectory(), 'ds-' + mode.replace(/[^a-z0-9]/gi, '_') + '.json'); if (d !== undefined) { fm.writeString(p, JSON.stringify(d)); return d } return fm.fileExists(p) ? JSON.parse(fm.readString(p)) : null }
/* lock-screen widgets: every mode hands back {p: 0..1, v, l, lines, inline} */
function lock(o) {
  /* lock-screen widgets ignore background images, so the drawing goes in as content */
  const w = new ListWidget(), f = FAM(), wh = a => new Color('#ffffff', a);
  if (f === 'accessoryInline') { sf(w, o.inline || o.lines[0], Font.mediumSystemFont(12), Color.white()); return w }
  w.setPadding(0, 0, 0, 0);
  if (f === 'accessoryCircular') {
    w.addAccessoryWidgetBackground = true;
    const S = 76, c = ctx(S, S), v = String(o.v);
    if (o.p != null) { arc(c, S / 2, S / 2, S / 2 - 6, 0, Math.PI * 2, 6, wh(.28)); if (o.p > .001) arc(c, S / 2, S / 2, S / 2 - 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, o.p), 6, wh(1)) }
    const vs = v.length > 4 ? 13 : v.length > 3 ? 15 : 20;
    T(c, v, S / 2, S / 2 - vs * .62 - (o.l ? 5 : 0), vs, 'rh', wh(1), 'c', 1);
    if (o.l) T(c, String(o.l).slice(0, 7).toUpperCase(), S / 2, S / 2 + vs * .38, 8.5, 'b', wh(.75), 'c');
    const im = w.addImage(c.getImage()); im.resizable = true; im.centerAlignImage(); return w;
  }
  const c = ctx(170, 72); let tx = 0;
  if (o.p != null) { arc(c, 33, 36, 27, 0, Math.PI * 2, 5.5, wh(.28)); if (o.p > .001) arc(c, 33, 36, 27, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, o.p), 5.5, wh(1)); T(c, o.v, 33, 36 - (String(o.v).length > 3 ? 7.5 : 9.5), String(o.v).length > 3 ? 12 : 15, 'rh', wh(1), 'c', 1); tx = 70 }
  const L = o.lines.filter(Boolean).slice(0, 3), y0 = 36 - (L.length * 17) / 2;
  L.forEach((l, i) => T(c, fit(l, i ? 12.5 : 15, 170 - tx - 2, i ? 'm' : 'b'), tx, y0 + i * 17 - (i ? 0 : 1), i ? 12.5 : 15, i ? 'm' : 'b', wh(i ? .78 : 1)));
  const im = w.addImage(c.getImage()); im.resizable = true; im.leftAlignImage(); return w;
}


/* =============================== shared look (iOS widget conventions) =============================== */
const SURF = new Color('#1c1c1e'), T1 = Color.white(), T2 = new Color('#8e8e93'), T3 = new Color('#48484a'), TRK = new Color('#3a3a3c'), GOOD = new Color('#30d158');
const F = { r: Font.systemFont, m: Font.mediumSystemFont, s: Font.semiboldSystemFont, b: Font.boldSystemFont, rb: Font.boldRoundedSystemFont, rh: Font.heavyRoundedSystemFont, rs: Font.semiboldRoundedSystemFont };
function lbl(st, s, size, wt, color, lines) { const t = st.addText(String(s)); t.font = F[wt || 'r'](size); t.textColor = color || T1; t.lineLimit = lines || 1; t.minimumScaleFactor = .75; return t }
/* content width of the current widget, so rows can split into even columns */
function cw() { const f = FAM(), s = Device.screenSize(), sw = Math.min(s.width, s.height); const small = Device.isPad() ? 155 : Math.round(sw * .43); const full = Device.isPad() ? 340 : Math.round(sw * .86); return (f === 'small' ? small : full) - 32 }
/* horizontal bar drawn wide and thin; added without a size so it stretches to the row */
function hbar(st, frac, color, h) { const c = ctx(600, 12); rr(c, 0, 0, 600, 12, 6, TRK); if (frac > 0) rr(c, 0, 0, Math.max(12, 600 * Math.min(1, frac)), 12, 6, color); const i = st.addImage(c.getImage()); i.resizable = true; return i }
/* a square with a drawn ring as its background and real text on top */
function ringBox(st, size, frac, color, w) { const b = st.addStack(); b.size = new Size(size, size); b.backgroundImage = ring(size, frac, color, w); b.layoutVertically(); b.centerAlignContent(); return b }
const centred = (st, fn) => { const r = st.addStack(); r.addSpacer(); fn(r); r.addSpacer(); return r };

/* =============================== TODAY =============================== */
function nowMin() { const n = new Date(); let m = n.getHours() * 60 + n.getMinutes(); if (m < 300) m += 1440; return m }
function toMin(t) { const [h, m] = t.split(':').map(Number); let v = h * 60 + m; if (v < 300) v += 1440; return v }
async function wToday() {
  const fam = FAM(); let d = null, err = null;
  try { d = (await docs(['widget/today']))['widget/today']; if (d) cache('today', d) } catch (e) { err = e.message; d = cache('today') }
  if (!d) return errW(err || 'no data yet');
  const m = nowMin(), up = d.items.filter(i => toMin(i.t) > m && !i.d), nxt = up[0];
  const mins = nxt ? toMin(nxt.t) - m : null, eta = mins == null ? '' : mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
  if (acc(fam)) return lock({ p: d.pct / 100, v: `${d.pct}%`, l: 'day', lines: [`${d.pct}% · ${d.done}/${d.total}`, ...(nxt ? [`${nxt.t} ${nxt.n}`, `in ${eta}`] : [])], inline: nxt ? `${d.pct}% · ${nxt.t} ${nxt.n}` : `${d.pct}% today` });
  if (!LOCKBG) return done(base('today'), cvToday(d, fam));
  const w = base('today'), pc = d.pct >= 80 ? GOOD : T1;
  const day = new Date(d.date + 'T12:00').toLocaleDateString('en-GB', { weekday: 'long' }).toUpperCase();
  if (fam === 'small') {
    const h = w.addStack(); h.centerAlignContent(); lbl(h, 'TODAY', 11, 's', T2); h.addSpacer(); lbl(h, `${d.done}/${d.total}`, 11, 's', T2);
    w.addSpacer(6);
    const r = w.addStack(); r.centerAlignContent(); const b = ringBox(r, 58, d.pct / 100, pc, 6); centred(b, x => lbl(x, `${d.pct}%`, 15, 'rb'));
    w.addSpacer();
    if (nxt) { lbl(w, `NEXT · ${eta.toUpperCase()}`, 10, 's', T2); w.addSpacer(2); lbl(w, nxt.n, 14, 's', T1, 2) } else lbl(w, 'All done today', 14, 's', T2);
    return w;
  }
  const top = w.addStack(); top.centerAlignContent();
  const b = ringBox(top, fam === 'large' ? 84 : 72, d.pct / 100, pc, 7);
  centred(b, x => lbl(x, `${d.pct}%`, fam === 'large' ? 20 : 17, 'rb')); centred(b, x => lbl(x, `${d.done}/${d.total}`, 10, 'm', T2));
  top.addSpacer(14);
  const R = top.addStack(); R.layoutVertically();
  lbl(R, day, 11, 's', T2); R.addSpacer(2);
  lbl(R, nxt ? nxt.n : 'All done today', 16, 's', nxt ? T1 : T2, 2);
  if (nxt) { R.addSpacer(2); lbl(R, `${nxt.t} · in ${eta}`, 12, 'm', T2) }
  top.addSpacer();
  if (fam === 'medium') {
    w.addSpacer();
    const rest = up.slice(1, 3); rest.forEach((i, k) => { if (k) w.addSpacer(4); const r = w.addStack(); r.centerAlignContent(); const t = lbl(r, i.t, 12, 'm', T2); t.font = Font.regularMonospacedSystemFont(12); r.addSpacer(10); lbl(r, i.n, 13, 'm') });
    return w;
  }
  w.addSpacer(14); lbl(w, 'UP NEXT', 11, 's', T2); w.addSpacer(6);
  up.slice(1, 10).forEach((i, k) => { if (k) w.addSpacer(7); const r = w.addStack(); r.centerAlignContent(); const t = lbl(r, i.t, 13, 'm', T2); t.font = Font.regularMonospacedSystemFont(13); r.addSpacer(12); lbl(r, i.n, 14, 'm'); r.addSpacer() });
  w.addSpacer();
  return w;
}

/* =============================== TASKS =============================== */
async function dTasks() {
  const k = dayK(), T = ((await docs(['tasks/all']))['tasks/all'] || {}).list || [];
  const key = t => (t.d < k ? '0' : '1') + (t.tm || '99:99') + (9 - (+t.p || 0));
  const open = T.filter(t => !t.done && t.d && t.d <= k).sort((a, b) => key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0);
  const done = T.filter(t => t.done && t.d === k);
  return { k, items: [...open.map(t => ({ n: t.t, od: t.d < k, tm: t.tm || '' })), ...done.map(t => ({ n: t.t, done: 1 }))], open: open.length };
}
function circ(done, od) {
  const c = ctx(22, 22);
  if (done) { c.setFillColor(GREY); c.fillEllipse(new Rect(2, 2, 18, 18)); text(c, '✓', 2, 3, 18, 16, Font.boldSystemFont(11), CARD, 'c') }
  else { c.setStrokeColor(od ? RED : new Color('#d1d1d6')); c.setLineWidth(2.2); c.strokeEllipse(new Rect(2, 2, 18, 18)) }
  return c.getImage();
}
function wTasks(d) {
  const f = FAM();
  if (acc(f)) return lock({ p: null, v: String(d.open), l: 'tasks', lines: [`${d.open} task${d.open === 1 ? '' : 's'} left`, ...d.items.filter(i => !i.done).slice(0, 2).map(i => i.n)], inline: d.open ? `${d.open} left · ${d.items[0].n}` : 'tasks clear' });
  if (!LOCKBG) return done(base('journal'), cvTasks(d, f));
  const w = base('journal'), max = { small: 3, medium: 3, large: 8 }[f] || 3, fs = f === 'small' ? 13 : f === 'large' ? 17 : 15;
  w.setPadding(14, 16, 12, 16);
  w.backgroundColor = Color.clear();
  { const h = w.addStack(); h.centerAlignContent(); sf(h, 'TASKS', Font.semiboldSystemFont(11), GREY); h.addSpacer(); const n = d.items.filter(i => !i.done).length; sf(h, n ? `${n} left` : 'Clear', Font.semiboldSystemFont(11), GREY); w.addSpacer(f === 'small' ? 8 : 10) }
  if (!d.items.length) { w.addSpacer(); sf(w, 'All clear', Font.semiboldSystemFont(17)); sf(w, 'nothing due today', Font.systemFont(12), GREY); w.addSpacer(); return w }
  d.items.slice(0, max).forEach((t, i) => {
    if (i) w.addSpacer(f === 'large' ? 22 : f === 'small' ? 9 : 10);
    const r = w.addStack(); r.centerAlignContent(); { const sy = SFSymbol.named(t.done ? 'checkmark.circle.fill' : 'circle'); sy.applyFont(Font.systemFont(fs + 2)); const im = r.addImage(sy.image); im.imageSize = new Size(fs + 3, fs + 3); im.tintColor = t.done ? GREY : t.od ? RED : WHITE } r.addSpacer(f === 'large' ? 14 : 11);
    sf(r, t.n, Font.mediumSystemFont(fs), t.done ? GREY : WHITE); r.addSpacer();
    if (t.tm && f !== 'small') sf(r, t.tm, Font.systemFont(12), GREY);
  });
  w.addSpacer();
  if (d.items.length > max) sf(w, `+${d.items.length - max} more`, Font.systemFont(11), GREY);
  return w;
}

/* =============================== CALORIES =============================== */
function fNum(e, k) { return e.quick ? +e['q' + k] || 0 : (+e[k] || 0) * (+e.g || 0) / 100 }
async function dCals() {
  const k = dayK(), mon = monOf(k), days = [...Array(7)].map((_, i) => addD(mon, i));
  const o = await docs(['food/profile', 'body/wt', ...days.map(x => 'food/d-' + x)]);
  const P = o['food/profile'] || {}, wr = (o['body/wt'] || {}).r || [];
  const kg = wr.length ? +wr[wr.length - 1].kg : +P.kg || 80;
  let B; if (P.override) B = +P.override; else { const bmr = 10 * kg + 6.25 * (+P.hcm || 178) - 5 * (+P.age || 22) + (P.sex === 'f' ? -161 : 5); B = Math.round(Math.max(P.sex === 'f' ? 1200 : 1500, bmr * (+P.act || 1.375) + (+P.rate || 0) * 7700 / 7) / 10) * 10 }
  const D = days.map(x => { const f = o['food/d-' + x], m = (f && f.m) || {}; const eat = ['b', 'l', 'd', 's'].flatMap(q => m[q] || []).reduce((t, e) => t + fNum(e, 'k'), 0); const ex = ((f && f.ex) || []).reduce((t, e) => t + (+e.k || 0), 0); return { k: x, eat: Math.round(eat), allow: B + ex, logged: !!(f && eat > 0) } });
  const today = D.find(x => x.k === k), prior = D.filter(x => x.k < k && x.logged).reduce((t, x) => t + x.eat - x.allow, 0);
  return { k, B, D, eat: today.eat, allow: today.allow, left: today.allow - today.eat, prior: Math.round(prior) };
}
/* Calories — drawn as one canvas to Lose It's proportions (measured from its medium widget: 709×314 units) */
const C_TRK = new Color('#3a3a3c'), C_TXT = new Color('#d6d6d6'), C_SUB = new Color('#b3b3b6'), C_LINE = new Color('#c9c9cc');
/* rough SF text widths, so a bold number and a regular word can sit side by side, centred together */
const tw = (s, size, bold) => [...String(s)].reduce((t, ch) => t + size * (ch === ' ' ? .26 : /[0-9]/.test(ch) ? (bold ? .62 : .58) : ch === ',' ? .26 : /[A-Z]/.test(ch) ? .64 : .52), 0);
function ctr(c, s, cx, cy, size, font, color) { text(c, s, cx - 400, cy - size * .62, 800, size * 1.4, font, color, 'c') }
function pair(c, num, word, cx, cy, size) {
  const a = tw(num, size, 1), b = tw(' ' + word, size), x0 = cx - (a + b) / 2;
  text(c, num, x0, cy - size * .62, a + 4, size * 1.4, Font.boldSystemFont(size), C_SUB);
  text(c, ' ' + word, x0 + a, cy - size * .62, b + 40, size * 1.4, Font.systemFont(size), C_SUB);
}
function calGauge(c, d, cx, cy, R, sw, numSize) {
  const a0 = Math.PI * .75, span = Math.PI * 1.5, fr = Math.max(0, Math.min(1, d.eat / d.allow));
  arc(c, cx, cy, R, a0, a0 + span, sw, C_TRK);
  if (fr > 0) arc(c, cx, cy, R, a0, a0 + span * fr, sw, d.left < 0 ? RED : new Color('#aeaeb2'));
  /* pace marker: how far through the day you are */
  const n = new Date(), pace = Math.max(0, Math.min(1, (n.getHours() + n.getMinutes() / 60) / 24)), a = a0 + span * pace, p = new Path();
  p.move(new Point(cx + (R - sw * .82) * Math.cos(a), cy + (R - sw * .82) * Math.sin(a))); p.addLine(new Point(cx + (R + sw / 2) * Math.cos(a), cy + (R + sw / 2) * Math.sin(a)));
  c.addPath(p); c.setStrokeColor(C_LINE); c.setLineWidth(sw * .13); c.strokePath();
  [0, .4, -.4].forEach(dx => ctr(c, Math.abs(d.left), cx + dx, cy - numSize * .22, numSize, Font.heavyRoundedSystemFont(numSize), d.left < 0 ? RED : C_TXT));
  ctr(c, d.left < 0 ? 'OVER' : 'UNDER', cx, cy + numSize * .5, numSize * .36, Font.semiboldSystemFont(numSize * .36), C_SUB);
}
function calBar(c, x, top, w, h, day) {
  rr(c, x, top, w, h, w * .22, C_TRK);
  const line = top + h * .23;
  if (day.eat > 0) {
    const fr = day.eat / day.allow, fh = Math.min(h, (h - h * .23) * fr);
    rr(c, x, top + h - fh, w, fh, w * .22, fr > 1 ? RED : new Color('#8e8e93'));
  }
  c.setFillColor(C_LINE); c.fillRect(new Rect(x + w * .06, line - w * .045, w * .88, w * .09));
}
function calsMedium(d) {
  const H = 157, W = Device.isPad() ? 355 : 336, c = ctx(W, H), u = H / 314;   /* u: one Lose It unit */
  calGauge(c, d, 138 * u, 137 * u, 103 * u, 30 * u, 56 * u);
  pair(c, d.eat, 'CALS', 138 * u, 285 * u, 21 * u);
  const right = W - 47 * u, bw0 = 35 * u, pitch0 = 56 * u, room = right - 262 * u;
  const k = Math.min(1, room / (pitch0 * 6 + bw0)), bw = bw0 * k, pitch = pitch0 * k, x0 = right - (pitch * 6 + bw), N = ['M', 'Tu', 'W', 'Th', 'F', 'Sa', 'Su'];
  d.D.forEach((x, i) => {
    const bx = x0 + i * pitch; calBar(c, bx, 37 * u, bw, 174 * u, x);
    const t = x.k === d.k; ctr(c, N[i], bx + bw / 2, 236 * u, 19 * u, t ? Font.boldSystemFont(19 * u) : Font.systemFont(19 * u), t ? Color.white() : C_SUB);
  });
  pair(c, Math.abs(d.prior), (d.prior > 0 ? 'OVER' : 'UNDER') + ' PRIOR TO TODAY', x0 + (pitch * 6 + bw) / 2, 285 * u, 21 * u);
  return c.getImage();
}
function calsSmall(d) {
  const S = 158, c = ctx(S, S), u = S / 314;
  calGauge(c, d, S / 2, 140 * u, 116 * u, 33 * u, 64 * u);
  pair(c, d.eat, 'CALS', S / 2, 284 * u, 24 * u);
  return c.getImage();
}
function wCals(d) {
  const f = FAM();
  if (acc(f)) return lock({ p: d.eat / d.allow, v: Math.abs(d.left) >= 1000 ? (Math.abs(d.left) / 1000).toFixed(1) + 'k' : String(Math.abs(d.left)), l: d.left < 0 ? 'over' : 'left', lines: [`${Math.abs(d.left)} kcal ${d.left < 0 ? 'over' : 'left'}`, `${d.eat} eaten of ${d.allow}`], inline: `${Math.abs(d.left)} kcal ${d.left < 0 ? 'over' : 'left'}` });
  if (LOCKBG && f === 'small') return nCals(d);
  const w = base('food'); w.setPadding(0, 0, 0, 0);
  const im = w.addImage(f === 'small' ? calsSmall(d) : calsMedium(d)); im.resizable = true; im.centerAlignImage();
  return w;
}

/* =============================== SLEEP =============================== */
const cl = x => Math.max(0, Math.min(1, x));
function sNorm(segs) {
  const g = (segs || []).map(([a, b, st]) => [+new Date(a), +new Date(b), st]).filter(x => x[1] > x[0]); if (!g.length) return [];
  const P = { deep: 4, rem: 3, awake: 2, core: 1 }; const bs = [...new Set(g.flatMap(x => [x[0], x[1]]))].sort((a, b) => a - b); const out = [];
  for (let i = 0; i < bs.length - 1; i++) { const a = bs[i], b = bs[i + 1]; let best = null; for (const x of g) if (x[0] <= a && x[1] >= b && (!best || (P[x[2]] || 0) > (P[best] || 0))) best = x[2]; const st = best || 'awake'; const l = out[out.length - 1]; if (l && l[2] === st && l[1] === a) l[1] = b; else out.push([a, b, st]) }
  for (let k = 0; k < 3; k++) for (let i = out.length - 1; i >= 0; i--) { if (out.length < 2) break; if (out[i][1] - out[i][0] < 18e4) { const prev = out[i - 1], next = out[i + 1]; if (prev) { prev[1] = out[i][1]; out.splice(i, 1); if (next && next[2] === prev[2]) { prev[1] = next[1]; out.splice(i, 1) } } else if (next) { next[0] = out[i][0]; out.splice(i, 1) } } }
  return out
}
function sWakes(n) { const g = sNorm(n.segs); const sl = g.filter(x => x[2] !== 'awake'); if (!sl.length) return null; const t0 = sl[0][0], t1 = sl[sl.length - 1][1]; let c = 0, end = -1; g.forEach(([a, b, st]) => { if (st !== 'awake' || a < t0 || b > t1) return; if (a - end > 6e4) c++; end = b }); return c }
function sScore(n, S) {
  /* same formula as the app's Sleep page */
  if (!n || !n.asleep) return 0; const hasSt = (n.deep || 0) + (n.rem || 0) + (n.core || 0) > 0;
  const g = (S.goal || 8) * 60, a = n.asleep, r = a / g;
  const dur = r >= 1 ? (r > 1.35 ? Math.max(.85, 1 - (r - 1.35)) : 1) : Math.pow(cl((r - .4) / .6), 1.1);
  const deep = cl((n.deep || 0) / (g * .16)), rem = cl((n.rem || 0) / (g * .1875));
  const bed = n.start && n.end ? (new Date(n.end) - new Date(n.start)) / 6e4 : 0;
  const eff = bed > a ? cl((a / bed - .75) / .17) : 1; const wk = sWakes(n);
  const aw = wk != null ? cl(1 - (wk - 2) / 10) : cl(1 - ((n.awake || 0) - 20) / 70);
  let tim = 1; if (n.start) { const [h, m] = S.wake.split(':').map(Number); const bt = ((h * 60 + m - S.goal * 60) % 1440 + 1440) % 1440; const d = new Date(n.start); let off = Math.abs(d.getHours() * 60 + d.getMinutes() - bt); off = Math.min(off, 1440 - off); tim = cl(1 - (off - 30) / 120) }
  const P = [[dur, 40], ...(hasSt ? [[deep, 15], [rem, 15]] : []), [eff, 10], [aw, 10], [tim, 10]];
  return Math.round(P.reduce((t, x) => t + x[0] * x[1], 0) / P.reduce((t, x) => t + x[1], 0) * 100)
}
async function dSleep() {
  const t = ymd(new Date()), y = addD(t, -1), o = await docs(['sleep/settings', 'sleep/w-' + t, 'sleep/w-' + y]);
  const S = { wake: '07:30', goal: 8, ...(o['sleep/settings'] || {}) }, n = o['sleep/w-' + t] || o['sleep/w-' + y];
  if (!n || !n.asleep) return { none: 1 };
  return { score: sScore(n, S), asleep: n.asleep, goal: S.goal * 60, start: n.start, end: n.end, deep: n.deep || 0, rem: n.rem || 0, core: n.core || 0, awake: n.awake || 0, segs: sNorm(n.segs), old: !o['sleep/w-' + t] };
}
const sCol = s => new Color(s >= 80 ? '#57f5a8' : s >= 60 ? '#ffb000' : '#ff453a');
function wSleep(d) {
  const f = FAM();
  if (!acc(f) && !LOCKBG) return done(base('sleep'), cvSleep(d, f));
  if (d.none) { if (acc(f)) return lock({ p: null, v: '–', l: 'sleep', lines: ['No sleep data yet'], inline: 'no sleep data' }); const w = base('sleep'); lbl(w, 'SLEEP', 11, 's', T2); w.addSpacer(); lbl(w, 'No data for last night yet', 14, 's', T2, 2); return w }
  if (acc(f)) return lock({ p: d.score / 100, v: String(d.score), l: 'sleep', lines: [`Sleep ${d.score}% · ${hm(d.asleep)}`, d.start ? `${clock(d.start)} → ${clock(d.end)}` : '', `deep ${hm(d.deep)} · rem ${hm(d.rem)}`], inline: `sleep ${d.score}% · ${hm(d.asleep)}` });
  const w = base('sleep');
  const h = w.addStack(); h.centerAlignContent(); lbl(h, d.old ? 'NIGHT BEFORE' : 'LAST NIGHT', 11, 's', T2); h.addSpacer(); lbl(h, '☾', 12, 's', new Color('#5e5ce6'));
  w.addSpacer(6);
  const r = w.addStack(); r.centerAlignContent();
  const b = ringBox(r, 56, d.score / 100, sCol(d.score), 6); centred(b, x => lbl(x, d.score, 18, 'rb'));
  r.addSpacer(10); const v = r.addStack(); v.layoutVertically();
  const t = v.addStack(); t.bottomAlignContent(); lbl(t, Math.floor(d.asleep / 60), 22, 'rb'); lbl(t, 'h ', 13, 's', T2); lbl(t, Math.round(d.asleep % 60), 22, 'rb'); lbl(t, 'm', 13, 's', T2);
  lbl(v, `of ${d.goal / 60}h goal`, 11, 'm', T2);
  w.addSpacer();
  /* stage strip, stretched to the row */
  const tot = d.deep + d.rem + d.core + d.awake || 1, c = ctx(600, 12); let x = 0;
    [[d.deep, '#5e5ce6'], [d.core, '#0a84ff'], [d.rem, '#64d2ff'], [d.awake, '#ff9f0a']].forEach(([val, cc], i, a) => { const ww = 600 * val / tot; if (ww > 0) { rr(c, x, 0, Math.min(600 - x, ww + (i < a.length - 1 ? 12 : 0)), 12, 6, new Color(cc)) } x += ww });
  const im = w.addImage(c.getImage()); im.resizable = true;
  w.addSpacer(6);
  if (d.start) { const s = w.addStack(); s.centerAlignContent(); lbl(s, clock(d.start), 12, 's'); s.addSpacer(); lbl(s, clock(d.end), 12, 's') }
  return w;
}

/* =============================== HABITS =============================== */
async function dHabits() { const s = (await docs(['widget/streaks']))['widget/streaks']; if (!s) throw new Error('Open the app once to publish habits'); return s }
function pickHabit(s, q) { q = String(q || '').toLowerCase().trim(); return s.items.find(h => h.n.toLowerCase() === q) || s.items.find(h => h.n.toLowerCase().includes(q)) || s.items[0] }
function grid(h, weeks, cell, gap) {
  const g = (h.g || '').slice(-(weeks * 7)), c = ctx(weeks * (cell + gap) - gap, 7 * (cell + gap) - gap), on = col(h.col, '#e6e6e6');
  for (let i = 0; i < g.length; i++) {
    const wk = Math.floor(i / 7), dy = i % 7, ch = g[i];
    rr(c, wk * (cell + gap), dy * (cell + gap), cell, cell, cell * .26, ch === '1' ? on : ch === '0' ? new Color('#2a2a2c') : ch === 'f' ? new Color('#191919') : new Color('#202022'));
  }
  return c.getImage();
}
function iconBox(stack, ic, s) { const b = stack.addStack(); b.size = new Size(s, s); b.cornerRadius = s * .24; b.backgroundColor = new Color('#2c2c2e'); b.centerAlignContent(); sf(b, ic || '✓', Font.systemFont(s * .5)); return b }
const unitW = h => h.unit === 'wk' ? 'week' : 'day';
function wHabit(s, q, mode) {
  const h = pickHabit(s, q), f = FAM();
  if (!h) { const w = base('streaks'); sf(w, 'No habits yet', Font.systemFont(13), GREY); return w }
  if (acc(f)) return lock({ p: h.t ? Math.min(1, h.c / h.t) : 0, v: String(h.streak), l: h.ic || unitW(h), lines: [`${h.ic || ''} ${h.n}`, `${h.streak} ${unitW(h)} streak`, h.done ? 'done today' : h.due ? `${h.c}/${h.t} today` : 'rest day'], inline: `${h.ic || ''} ${h.n} · ${h.streak}${h.unit === 'wk' ? 'w' : 'd'}${h.done ? ' ✓' : ''}` });
  if (!LOCKBG) return done(base('streaks'), cvHabit(s, q, mode, f));
  const w = base('streaks');
  if (mode === 'streak') {
    w.setPadding(14, 16, 14, 16);
    const t = w.addStack(); t.centerAlignContent(); iconBox(t, h.ic, 34); t.addSpacer(); const rs = 26; pic(t, ring(rs, h.t ? h.c / h.t : 0, col(h.col), 4), rs, rs);
    w.addSpacer();
    const n = w.addStack(); n.bottomAlignContent(); sf(n, String(h.streak), Font.heavyRoundedSystemFont(42)); n.addSpacer(4); sf(n, h.done ? '🔥' : '', Font.systemFont(22));
    sf(w, `${unitW(h)} streak · ${h.n}`, Font.mediumSystemFont(12), GREY);
    return w;
  }
  if (f === 'small') {
    w.setPadding(11, 15, 15, 15);
    const t = w.addStack(); t.centerAlignContent(); iconBox(t, h.ic, 36); t.addSpacer(9); sf(t, h.n, Font.systemFont(16), new Color('#9a9a9a'));
    w.addSpacer(); const g = w.addStack(); g.addSpacer(); pic(g, grid(h, 11, 8, 3.5), 11 * 11.5 - 3.5, 7 * 11.5 - 3.5); g.addSpacer();
    return w;
  }
  const r = w.addStack(); r.centerAlignContent();
  const L = r.addStack(); L.layoutVertically(); L.size = new Size(f === 'large' ? 0 : 96, 0);
  iconBox(L, h.ic, 32); L.addSpacer(8); sf(L, h.n, Font.semiboldSystemFont(14)); L.addSpacer(2);
  sf(L, String(h.streak), Font.heavyRoundedSystemFont(28), col(h.col)); sf(L, `${unitW(h)} streak`, Font.systemFont(10), GREY);
  r.addSpacer();
  const weeks = f === 'large' ? 12 : 12, cell = f === 'large' ? 20 : 13.5, gap = f === 'large' ? 4 : 3;
  if (f === 'large') { w.addSpacer(10); const g = w.addStack(); g.addSpacer(); pic(g, grid(h, weeks, cell, gap), weeks * (cell + gap) - gap, 7 * (cell + gap) - gap); g.addSpacer() }
  else pic(r, grid(h, weeks, cell, gap), weeks * (cell + gap) - gap, 7 * (cell + gap) - gap);
  return w;
}
function habitRow(st, h, W) {
  const r = st.addStack(); r.size = new Size(W, 32); r.centerAlignContent();
  const ic = r.addStack(); ic.size = new Size(28, 28); ic.cornerRadius = 14; ic.backgroundColor = col(h.col, null, .22); ic.centerAlignContent(); lbl(ic, h.ic || '•', 14);
  r.addSpacer(8);
  const v = r.addStack(); v.layoutVertically();
  lbl(v, h.n, 13, 's', h.done ? T2 : T1);
  lbl(v, h.done ? 'Done' : h.t > 1 ? `${h.c} of ${h.t}` : h.streak ? `${h.streak}${h.unit === 'wk' ? 'w' : 'd'} streak` : 'Not yet', 10, 'm', T2);
  r.addSpacer();
  if (h.done) { const c = ctx(20, 20); c.setFillColor(GOOD); c.fillEllipse(new Rect(1, 1, 18, 18)); const p = new Path(); p.move(new Point(6, 10.5)); p.addLine(new Point(9, 13.5)); p.addLine(new Point(14.5, 7)); c.addPath(p); c.setStrokeColor(Color.black()); c.setLineWidth(2.2); c.strokePath(); pic(r, c.getImage(), 18, 18) }
  else pic(r, ring(20, h.t ? h.c / h.t : 0, col(h.col), 2.5), 18, 18);
  return r;
}
function wHabits(s) {
  const f = FAM(), L = s.items.filter(h => h.due), nDone = L.filter(h => h.done).length;
  if (acc(f)) return lock({ p: L.length ? nDone / L.length : 0, v: `${nDone}/${L.length}`, l: 'habits', lines: [`Habits ${nDone}/${L.length}`, L.filter(h => !h.done).slice(0, 2).map(h => `${h.ic || ''} ${h.n}`).join('  ')], inline: `habits ${nDone}/${L.length}` });
  if (!LOCKBG) return done(base('streaks'), cvHabits(s, f));
  const w = base('streaks'), left = L.filter(h => !h.done), order = [...left, ...L.filter(h => h.done)];
  if (f === 'small') {
    const h = w.addStack(); lbl(h, 'HABITS', 11, 's', T2); h.addSpacer();
    w.addSpacer(); const b = centred(w, x => { const rb = ringBox(x, 84, L.length ? nDone / L.length : 0, GOOD, 8); centred(rb, y => lbl(y, done, 22, 'rb')); centred(rb, y => lbl(y, `of ${L.length}`, 10, 'm', T2)) });
    w.addSpacer(); if (left[0]) lbl(w, `Next: ${left[0].n}`, 12, 's', T2); return w;
  }
  const h = w.addStack(); h.centerAlignContent(); lbl(h, 'Habits', 15, 's'); h.addSpacer(); lbl(h, `${done} of ${L.length}`, 13, 's', T2);
  w.addSpacer(6); const pb = w.addStack(); hbar(pb, L.length ? nDone / L.length : 0, GOOD);
  w.addSpacer(10);
  if (!L.length) { lbl(w, 'Nothing due today', 13, 'm', T2); w.addSpacer(); return w }
  const W = cw(), cell = Math.floor((W - 14) / 2), rowsN = f === 'large' ? 7 : 2, show = order.slice(0, rowsN * 2);
  for (let i = 0; i < show.length; i += 2) {
    if (i) w.addSpacer(f === 'large' ? 8 : 6);
    const r = w.addStack(); habitRow(r, show[i], cell); r.addSpacer(14); if (show[i + 1]) habitRow(r, show[i + 1], cell); else r.addSpacer(cell);
  }
  w.addSpacer();
  if (order.length > show.length) lbl(w, `${left.length - show.filter(x => !x.done).length > 0 ? `+${left.length - show.filter(x => !x.done).length} more to do` : `+${order.length - show.length} more`}`, 11, 'm', T2);
  return w;
}

/* =============================== WEEK CALENDAR =============================== */
async function dWeek() {
  const C = (await docs(['cal/week']))['cal/week'] || {}, k = dayK(), mon = monOf(k), ex = C.ex || {};
  const mn = t => { const [h, m] = String(t || '0:0').split(':'); return +h * 60 + +m };
  const span = Math.max(7, Math.round((new Date(addD(k, 2) + 'T12:00') - new Date(mon + 'T12:00')) / 864e5) + 1);
  const days = [...Array(span)].map((_, i) => addD(mon, i)).map(key => {
    const dow = String((new Date(key + 'T12:00').getDay() + 6) % 7 + 1), out = [];
    const mk = x => { const m = x[7] && typeof x[7] === 'object' ? x[7] : {}; return { t: x[0], c: x[1], ad: !!m.ad, s: m.ad ? 0 : mn(x[3]), e: m.ad ? 1440 : (mn(x[4]) || 1440) } };
    (C.ev || []).forEach(x => { const m = x[7] && typeof x[7] === 'object' ? x[7] : {}; if (String(x[2]).includes(dow) && (!m.from || key >= m.from) && (!m.until || key <= m.until) && !(ex[x[6]] || []).includes(key)) out.push(mk(x)) });
    (C.one || []).forEach(x => { if (x[2] === key) out.push(mk(x)) });
    return { k: key, ev: out.sort((a, b) => a.s - b.s) };
  });
  return { k, days };
}
function wWeek(d) {
  const f = FAM(), now = new Date(), nm = now.getHours() * 60 + now.getMinutes(), today = d.days.find(x => x.k === d.k) || d.days[0];
  const t2 = d.days[d.days.indexOf(today) + 1];
  const up = [...today.ev.filter(e => !e.ad && e.e > nm).map(e => ({ ...e, day: 'Today' })), ...((t2 && t2.ev.filter(e => !e.ad).map(e => ({ ...e, day: 'Tomorrow' }))) || [])];
  const tm = m => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
  if (!acc(f) && !LOCKBG) return done(base('week'), cvWeek(d, f));
  if (acc(f)) { const n = up[0]; return lock({ p: null, v: n ? tm(n.s) : '–', l: 'next', lines: n ? [n.t, `${n.day} ${tm(n.s)}–${tm(n.e)}`] : ['Nothing coming up'], inline: n ? `${tm(n.s)} ${n.t}` : 'calendar clear' }) }
  const w = base('week');
  if (f !== 'large' && f !== 'extraLarge') {
    w.setPadding(14, 16, 14, 16);
    const hd = w.addStack(); sf(hd, now.toLocaleDateString('en-GB', { weekday: 'long' }).toUpperCase(), Font.semiboldSystemFont(10), RED); hd.addSpacer(); sf(hd, String(now.getDate()), Font.semiboldSystemFont(10), GREY);
    w.addSpacer(6);
    const show = up.slice(0, f === 'small' ? 3 : 4); if (!show.length) sf(w, 'Nothing coming up', Font.systemFont(13), GREY);
    show.forEach((e, i) => {
      if (i) w.addSpacer(5);
      const r = w.addStack(); r.centerAlignContent(); const b = r.addStack(); b.size = new Size(3, f === 'small' ? 26 : 28); b.cornerRadius = 1.5; b.backgroundColor = new Color({ job: '#6f8bb3', study: '#8aa0c2', gym: '#a9bcd6', fun: '#c9d3e3', other: '#9a9ea6' }[e.c] || '#9a9ea6');
      r.addSpacer(7); const v = r.addStack(); v.layoutVertically(); sf(v, e.t, Font.semiboldSystemFont(f === 'small' ? 12 : 13));
      sf(v, `${e.day === 'Tomorrow' ? 'Tmrw ' : ''}${tm(e.s)}–${tm(e.e)}`, Font.systemFont(10), GREY);
    });
    w.addSpacer(); return w;
  }
  /* large: the whole week as a time grid */
  w.setPadding(12, 10, 10, 12);
  const W = 336, H = 340, c = ctx(W, H), timed = d.days.flatMap(x => x.ev.filter(e => !e.ad));
  let h0 = Math.min(8, ...timed.map(e => Math.floor(e.s / 60))), h1 = Math.max(22, ...timed.map(e => Math.ceil(Math.min(e.e, 1440) / 60)));
  const lx = 22, top = 34, cw = (W - lx) / 7, ph = (H - top) / ((h1 - h0) * 60), L = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const anyAd = d.days.some(x => x.ev.some(e => e.ad)), y0 = top + (anyAd ? 14 : 0), ph2 = (H - y0) / ((h1 - h0) * 60);
  d.days.forEach((x, i) => {
    const cx = lx + i * cw, isT = x.k === d.k, dt = new Date(x.k + 'T12:00').getDate();
    text(c, L[i], cx, 0, cw, 12, Font.semiboldSystemFont(9), isT ? RED : GREY, 'c');
    if (isT) { c.setFillColor(RED); c.fillEllipse(new Rect(cx + cw / 2 - 10, 12, 20, 20)) }
    text(c, dt, cx, 14, cw, 18, Font.semiboldSystemFont(12), WHITE, 'c');
    x.ev.filter(e => e.ad).slice(0, 1).forEach(e => { rr(c, cx + 1, top, cw - 2, 12, 3, new Color(CAL_COL[e.c] || CAL_COL.other)); text(c, e.t, cx + 3, top, cw - 5, 12, Font.mediumSystemFont(7.5), WHITE) });
  });
  for (let h = h0; h <= h1; h += 2) { const y = y0 + (h - h0) * 60 * ph2; c.setFillColor(new Color('#ffffff', .06)); c.fillRect(new Rect(lx, y, W - lx, .7)); text(c, h % 24, 0, y - 6, lx - 4, 12, Font.systemFont(8), GREY, 'r') }
  d.days.forEach((x, i) => {
    const cx = lx + i * cw;
    x.ev.filter(e => !e.ad).forEach(e => {
      const y = y0 + (Math.max(e.s, h0 * 60) - h0 * 60) * ph2, hh = Math.max(9, (Math.min(e.e, h1 * 60) - Math.max(e.s, h0 * 60)) * ph2 - 1);
      rr(c, cx + 1, y, cw - 2, hh, 3, new Color(CAL_COL[e.c] || CAL_COL.other));
      if (hh >= 10) text(c, e.t, cx + 3, y + 1, cw - 5, Math.min(hh - 1, 30), Font.mediumSystemFont(7.5), WHITE);
    });
  });
  const ti = d.days.findIndex(x => x.k === d.k), nmin = nm < 300 ? nm + 1440 : nm;
  if (ti >= 0 && nmin >= h0 * 60 && nmin <= h1 * 60) { const y = y0 + (nmin - h0 * 60) * ph2; c.setFillColor(RED); c.fillRect(new Rect(lx + ti * cw, y - .75, cw, 1.5)); c.fillEllipse(new Rect(lx + ti * cw - 3, y - 3, 6, 6)) }
  pic(w, c.getImage(), W, H);
  return w;
}

/* =============================== GOAL =============================== */
async function dGoal(q, target, by) {
  const L = await prefix('gym/w-'), qq = q.toLowerCase(); let best = 0, bestKg = 0, bestR = 0;
  L.forEach(r => ((r.data && r.data.ex) || []).forEach(x => {
    const nm = String(x.n || x.id || '').replace(/[_-]+/g, ' ').toLowerCase(); if (!nm.includes(qq)) return;
    (x.sets || []).forEach(s => { if (s.t === 'w' || s.done === false) return; const kg = +s.kg || 0, rp = Math.min(10, +s.r || 0); if (!kg || !rp) return; const e = rp > 1 ? kg * (1 + rp / 30) : kg; if (e > best) { best = e; bestKg = kg; bestR = +s.r } });
  }));
  const left = by ? Math.ceil((new Date(by + 'T23:59') - Date.now()) / 864e5) : null;
  return { q, target: +target, best: Math.round(best * 10) / 10, bestKg, bestR, pct: target ? Math.min(100, Math.round(best / target * 100)) : 0, left };
}
function wGoal(d) {
  const f = FAM(), name = d.q.replace(/\b\w/g, c => c.toUpperCase());
  if (acc(f)) return lock({ p: d.pct / 100, v: `${d.pct}%`, l: name.slice(0, 6), lines: [`${d.target}kg ${name}`, `${d.pct}% · best ${d.bestKg}×${d.bestR}`, d.left != null ? `${d.left} days left` : ''], inline: `${d.target}kg ${name} · ${d.pct}%` });
  if (LOCKBG && f === 'small') return nGoal(d);
  { const w = base('gym'); const g = new LinearGradient(); g.colors = [new Color('#0a0a0a'), new Color('#0d0605'), new Color('#3a1209'), new Color('#7a2a14')]; g.locations = [0, .45, .78, 1]; w.backgroundGradient = g; return done(w, cvGoal(d, f)) }
  const w = base('gym'); w.setPadding(f === 'small' ? 20 : 18, 15, f === 'small' ? 13 : 14, 15);
  const g = new LinearGradient(); g.colors = [new Color('#0a0a0a'), new Color('#0d0605'), new Color('#3a1209'), new Color('#7a2a14')]; g.locations = [0, .45, .78, 1]; w.backgroundGradient = g;
  sf(w, 'Next Goal', new Font('Baskerville-Italic', f === 'small' ? 16 : 19), new Color('#bdbdbd'));
  w.addSpacer(f === 'small' ? 12 : 8); sf(w, `${d.target}kg ${name}`, Font.semiboldSystemFont(f === 'small' ? 15 : 19), WHITE);
  if (f !== 'small') { w.addSpacer(2); sf(w, d.best ? `best ${d.bestKg}kg × ${d.bestR} · e1RM ${d.best}kg` : 'no sets logged yet', Font.systemFont(11), GREY) }
  w.addSpacer();
  const gb = w.addStack(); { const c = ctx(600, 10); rr(c, 0, 0, 600, 10, 5, new Color('#ffffff', .12)); if (d.pct) rr(c, 0, 0, Math.max(10, 6 * d.pct), 10, 5, WHITE); const i = gb.addImage(c.getImage()); i.resizable = true }
  w.addSpacer(7);
  const b = w.addStack(); b.centerAlignContent(); sf(b, `${d.pct}%`, Font.semiboldSystemFont(f === 'small' ? 12 : 14), WHITE); b.addSpacer();
  if (d.left != null) sf(b, d.left >= 0 ? `${d.left} DAYS LEFT` : `${-d.left} DAYS OVER`, Font.semiboldSystemFont(f === 'small' ? 8.5 : 10), new Color('#9a9a9a'));
  return w;
}

/* =====================================================================================
   DESIGNS — every widget is drawn as one canvas at the widget's exact shape, so spacing is
   exact on any device. Built to read in tinted/greyscale home screens: hierarchy comes from
   brightness and weight, not colour.
   ===================================================================================== */
const K = { t1: new Color('#ffffff'), t2: new Color('#ebebf5', .62), t3: new Color('#ebebf5', .32), trk: new Color('#ffffff', .13), trk2: new Color('#ffffff', .08), card: new Color('#ffffff', .07) };
const FW = { r: Font.systemFont, m: Font.mediumSystemFont, s: Font.semiboldSystemFont, b: Font.boldSystemFont, h: Font.heavySystemFont, rb: Font.boldRoundedSystemFont, rh: Font.heavyRoundedSystemFont, rs: Font.semiboldRoundedSystemFont, mono: Font.mediumMonospacedSystemFont, serif: z => new Font('Baskerville-Italic', z) };
function dims(f) { const pad = Device.isPad(); if (f === 'small') return [158, 158]; if (f === 'extraLarge') return [758, 357]; if (f === 'large') return pad ? [357, 357] : [338, 354]; return pad ? [357, 158] : [338, 158] }
function canvas(f) { const [W, H] = dims(f), c = ctx(W, H); return { c, W, H } }
let LOCKBG = false;   /* set by the Parameter "lock": iPad lock-screen small widgets need a solid card, not a transparent one */
function done(w, c) {
  w.setPadding(0, 0, 0, 0); let img = c.getImage();
  if (LOCKBG) { const z = c.size, o = ctx(z.width, z.height); rr(o, 0, 0, z.width, z.height, 22, new Color('#1c1c1e')); o.drawImageInRect(img, new Rect(0, 0, z.width, z.height)); img = o.getImage() }
  const i = w.addImage(img); i.resizable = true; i.centerAlignImage(); return w }
/* text: y is the top of the line box; align l/c/r with x as left edge / centre / right edge */
function T(c, s, x, y, size, wt, color, align, faux) {
  s = String(s); const W = 1200, f = (FW[wt] || FW.r)(size); const rx = align === 'c' ? x - W / 2 : align === 'r' ? x - W : x;
  const draw = dx => text(c, s, rx + dx, y, W, size * 1.35, f, color || K.t1, align === 'c' ? 'c' : align === 'r' ? 'r' : 'l');
  draw(0); if (faux) { draw(.35); draw(-.35) }
}
const tws = (s, size, wt) => tw(s, size, /^(b|h|rb|rh)$/.test(wt)) * (/^(rh|h)$/.test(wt) ? 1.0 : /^(b|s)$/.test(wt) ? 1.04 : 1);
function fit(s, size, maxW, wt) { s = String(s); if (tws(s, size, wt) <= maxW) return s; while (s.length > 1 && tws(s + '…', size, wt) > maxW) s = s.slice(0, -1); return s.trimEnd() + '…' }
function ringAt(c, cx, cy, r, sw, frac, color, track) { arc(c, cx, cy, r, 0, Math.PI * 2, sw, track || K.trk); if (frac > .001) arc(c, cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, frac), sw, color || K.t1) }
function cap(c, s, x, y, color, align) { T(c, String(s).toUpperCase(), x, y, 11, 's', color || K.t2, align) }
function check(c, x, y, s, fill, ink) { c.setFillColor(fill); c.fillEllipse(new Rect(x, y, s, s)); const p = new Path(); p.move(new Point(x + s * .29, y + s * .52)); p.addLine(new Point(x + s * .44, y + s * .67)); p.addLine(new Point(x + s * .72, y + s * .35)); c.addPath(p); c.setStrokeColor(ink); c.setLineWidth(s * .11); c.strokePath() }
function circle(c, x, y, s, color, lw) { c.setStrokeColor(color); c.setLineWidth(lw); c.strokeEllipse(new Rect(x + lw / 2, y + lw / 2, s - lw, s - lw)) }
function dur(c, mins, x, y, big, align) {
  /* "7h 32m" with heavy numbers and small units, measured so it can sit left or right aligned */
  const h = Math.floor(mins / 60), m = Math.round(mins % 60), sm = big * .5;
  const parts = [[h, big, 'rh', K.t1], ['h ', sm, 's', K.t2], [pad(m), big, 'rh', K.t1], ['m', sm, 's', K.t2]];
  const wsum = parts.reduce((t, p) => t + tws(p[0], p[1], p[2]), 0); let cx = align === 'r' ? x - wsum : x;
  parts.forEach(([s, sz, wt, col]) => { T(c, s, cx, y + (big - sz) * 1.02, sz, wt, col, 'l', wt === 'rh'); cx += tws(s, sz, wt) + (wt === 'rh' ? .5 : -1) });
  return wsum;
}

/* ---------- TODAY ---------- */
function cvToday(d, f) {
  const { c, W, H } = canvas(f), P = 16, m = nowMin(), up = d.items.filter(i => toMin(i.t) > m && !i.d), nx = up[0];
  const mins = nx ? toMin(nx.t) - m : 0, eta = !nx ? '' : mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
  const day = new Date(d.date + 'T12:00').toLocaleDateString('en-GB', { weekday: 'long' });
  if (f === 'small') {
    cap(c, 'Today', P, P); T(c, `${d.done}/${d.total}`, W - P, P, 11, 's', K.t2, 'r');
    ringAt(c, P + 29, 66, 25, 7, d.pct / 100); T(c, d.pct + '%', P + 29, 58, 14, 'rh', K.t1, 'c', 1);
    T(c, d.done, P + 66, 44, 28, 'rh', K.t1, 'l', 1); T(c, `of ${d.total} done`, P + 67, 76, 11, 'm', K.t2);
    if (nx) { cap(c, `Next · ${eta}`, P, 106, K.t2); T(c, fit(nx.n, 15, W - 2 * P, 's'), P, 122, 15, 's') } else T(c, 'All done today', P, 116, 15, 's', K.t2);
    return c;
  }
  const R = 46, cx = P + R + 2, cy = 79;
  ringAt(c, cx, cy, R, 10, d.pct / 100); T(c, d.pct + '%', cx, cy - 15, 22, 'rh', K.t1, 'c', 1); T(c, `${d.done} of ${d.total}`, cx, cy + 9, 10, 'm', K.t2, 'c');
  const x = cx + R + 22, rw = W - P - x;
  cap(c, day, x, P + 2);
  if (nx) {
    T(c, fit(nx.n, 18, rw, 'b'), x, P + 20, 18, 'b');
    T(c, `${nx.t}  ·  in ${eta}`, x, P + 44, 12, 'm', K.t2);
  } else T(c, 'All done today', x, P + 20, 18, 'b', K.t2);
  const rows = up.slice(1, f === 'large' ? 1 : 3); c.setFillColor(K.trk2); c.fillRect(new Rect(x, P + 68, rw, 1));
  rows.forEach((i, k) => { const y = P + 80 + k * 24; T(c, i.t, x, y, 12, 'mono', K.t2); T(c, fit(i.n, 13, rw - 52, 'm'), x + 50, y, 13, 'm', K.t1) });
  if (f === 'large') {
    const y0 = 156; c.setFillColor(K.trk2); c.fillRect(new Rect(P, y0 - 12, W - 2 * P, 1)); cap(c, 'Up next', P, y0);
    const list = up.slice(1, 9); if (!list.length) T(c, 'Nothing else today', P, y0 + 22, 14, 'm', K.t2);
    list.forEach((i, k) => { const y = y0 + 22 + k * 22; T(c, i.t, P, y, 13, 'mono', K.t2); T(c, fit(i.n, 14, W - 2 * P - 58, 'm'), P + 56, y, 14, 'm') });
  }
  return c;
}

/* ---------- TASKS ---------- */
function cvTasks(d, f) {
  const { c, W, H } = canvas(f), P = 16, open = d.items.filter(i => !i.done).length;
  const small = f === 'small', fs = small ? 13 : 15, rowH = small ? 27 : f === 'large' ? 34 : 29, max = small ? 4 : f === 'large' ? 8 : 3;
  let y = P;
  cap(c, 'Tasks', P, y); T(c, open ? `${open} left` : 'Clear', W - P, y, 11, 's', K.t2, 'r');
  y += small ? 22 : 24;
  if (!d.items.length) { T(c, 'Nothing due today', P, y + 6, 15, 's', K.t2); return c }
  const cols = 1, colW = (W - 2 * P - (cols - 1) * 14) / cols, per = f === 'medium' ? 3 : max;
  d.items.slice(0, per * cols).forEach((t, i) => {
    const col = Math.floor(i / per), r = i % per, x = P + col * (colW + 14), yy = y + r * rowH, s = small ? 15 : 17;
    if (t.done) check(c, x, yy + 1, s, K.t3, new Color('#1c1c1e')); else circle(c, x, yy + 1, s, t.od ? new Color('#ff453a') : K.t2, 1.8);
    const tx = x + s + 10, right = t.tm && !small && cols === 1 ? 58 : 0;
    T(c, fit(t.n, fs, colW - (tx - x) - right, 'm'), tx, yy + (s - fs * 1.2) / 2 + 1, fs, 'm', t.done ? K.t3 : K.t1);
    if (right) T(c, t.tm, P + colW, yy + 3, 12, 'mono', K.t2, 'r');
  });
  const more = d.items.length - per * cols; if (more > 0 && !small) T(c, `+${more} more`, W - P, H - P - 13, 11, 'm', K.t3, 'r');
  return c;
}

/* ---------- SLEEP ---------- */
const ST = { awake: [0, new Color('#ffffff', .9)], rem: [1, new Color('#ffffff', .66)], core: [2, new Color('#ffffff', .42)], deep: [3, new Color('#ffffff', .24)] };
/* the app's sleep graph: one smooth line stepping between stage lanes, tinted from awake (warm) to deep (cool) */
const WAVE = [[0, [255, 176, 122]], [.34, [255, 122, 156]], [.68, [143, 168, 216]], [1, [79, 179, 200]]];
function waveCol(t) { for (let i = 1; i < WAVE.length; i++) if (t <= WAVE[i][0]) { const [a, ca] = WAVE[i - 1], [b, cb] = WAVE[i], k = (t - a) / (b - a); return new Color('#' + ca.map((v, j) => Math.round(v + (cb[j] - v) * k).toString(16).padStart(2, '0')).join('')) } return new Color('#4fb3c8') }
function hypno(c, segs, x, y, w, h, labels, lw) {
  if (!segs || !segs.length) { T(c, 'No stage data', x, y + h / 2 - 7, 11, 'm', K.t3); return }
  const t0 = segs[0][0], t1 = segs[segs.length - 1][1], pt = Math.max(3, h * .08), L = { awake: 0, rem: 1, core: 2, deep: 3 };
  const Y = st => y + pt + (L[st] ?? 2) * (h - 2 * pt) / 3, X = t => x + (t - t0) / (t1 - t0 || 1) * w;
  for (let i = 0; i < 4; i++) { c.setFillColor(K.trk2); c.fillRect(new Rect(x, y + pt + i * (h - 2 * pt) / 3 - .5, w, 1)) }
  if (labels) ['Awake', 'REM', 'Core', 'Deep'].forEach((l, i) => T(c, l, x - 8, y + pt + i * (h - 2 * pt) / 3 - 6, 9, 'm', K.t3, 'r'));
  const m = []; segs.forEach(s => { const l = m[m.length - 1]; if (l && l[2] === s[2] && s[0] - l[1] < 12e4) l[1] = Math.max(l[1], s[1]); else m.push([...s]) });
  /* build the line as points (curves sampled), same shape as the app */
  const pts = [[x, Y(m[0][2])], [X(m[0][0]), Y(m[0][2])]], bz = (p0, p1, p2, p3, t) => { const u = 1 - t; return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]] };
  const s1000 = w / 1000;
  m.forEach((sg, i) => {
    const x0 = X(sg[0]), x1 = X(sg[1]), nx = m[i + 1], ya = Y(sg[2]);
    if (!nx) { pts.push([x + w, ya]); return }
    const nw = X(nx[1]) - X(nx[0]), r = Math.max(.5 * s1000, Math.min(42 * s1000, (x1 - x0) * .45, nw * .45)), xb = X(nx[0]), yb = Y(nx[2]);
    const a = [x1 - r, ya], b = [x1 + r * .1, ya], cc = [xb - r * .1, yb], d = [xb + r, yb]; pts.push(a);
    for (let k = 1; k <= 12; k++) pts.push(bz(a, b, cc, d, k / 12));
  });
  const lwid = lw || Math.max(1.6, h / 40);
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i]; if (Math.abs(bx - ax) < .01 && Math.abs(by - ay) < .01) continue;
    const p = new Path(); p.move(new Point(ax, ay)); p.addLine(new Point(bx, by)); c.addPath(p);
    c.setStrokeColor(waveCol(((ay + by) / 2 - y - pt) / (h - 2 * pt))); c.setLineWidth(lwid); c.strokePath();
  }
  /* round the joins and ends */
  pts.forEach(([px, py], i) => { if (i % 3 && i !== pts.length - 1) return; c.setFillColor(waveCol((py - y - pt) / (h - 2 * pt))); c.fillEllipse(new Rect(px - lwid / 2, py - lwid / 2, lwid, lwid)) });
}
function cvSleep(d, f) {
  const { c, W, H } = canvas(f), P = 16;
  if (d.none) { cap(c, 'Sleep', P, P); T(c, 'No data for', P, H / 2 - 18, 15, 's', K.t2); T(c, 'last night yet', P, H / 2, 15, 's', K.t2); return c }
  const bed = d.start ? clock(d.start) : '', wake = d.end ? clock(d.end) : '';
  if (f === 'small') {
    cap(c, d.old ? 'Night before' : 'Last night', P, P);
    ringAt(c, W - P - 17, P + 17, 15, 4.5, d.score / 100); T(c, d.score, W - P - 17, P + 10, 11, 'rh', K.t1, 'c', 1);
    dur(c, d.asleep, P, 36, 28);
    hypno(c, d.segs, P, 76, W - 2 * P, H - P - 22 - 76);
    T(c, bed, P, H - P - 13, 11, 's', K.t2); T(c, wake, W - P, H - P - 13, 11, 's', K.t2, 'r');
    return c;
  }
  /* medium / large: summary on the left, hypnogram on the right */
  cap(c, d.old ? 'Night before' : 'Last night', P, P);
  dur(c, d.asleep, P, f === 'large' ? 36 : 42, 30);
  ringAt(c, P + 22, H - P - 30 - (f === 'large' ? 196 : 0), 20, 5.5, d.score / 100); T(c, d.score, P + 22, H - P - 39 - (f === 'large' ? 196 : 0), 14, 'rh', K.t1, 'c', 1);
  T(c, 'SCORE', P + 50, H - P - 40 - (f === 'large' ? 196 : 0), 9, 's', K.t3); T(c, d.score >= 80 ? 'Great' : d.score >= 60 ? 'Okay' : 'Poor', P + 50, H - P - 28 - (f === 'large' ? 196 : 0), 13, 's');
  const hx = 160, hw = W - P - hx, hy = P + 4, hh = f === 'large' ? 138 : H - P - hy - 24;
  hypno(c, d.segs, hx, hy, hw, hh, true);
  T(c, bed, hx, hy + hh + 8, 11, 's', K.t2); T(c, wake, hx + hw, hy + hh + 8, 11, 's', K.t2, 'r');
  if (f === 'large') {
    const y0 = 196, tot = d.deep + d.rem + d.core + d.awake || 1; c.setFillColor(K.trk2); c.fillRect(new Rect(P, y0 - 12, W - 2 * P, 1));
    [['Deep', d.deep, 'deep'], ['Core', d.core, 'core'], ['REM', d.rem, 'rem'], ['Awake', d.awake, 'awake']].forEach(([l, v, k], i) => {
      const y = y0 + i * 32; T(c, l, P, y, 13, 's'); T(c, `${Math.floor(v / 60) ? Math.floor(v / 60) + 'h ' : ''}${Math.round(v % 60)}m`, W - P, y, 13, 's', K.t2, 'r');
      rr(c, P, y + 19, W - 2 * P, 5, 2.5, K.trk2); rr(c, P, y + 19, Math.max(5, (W - 2 * P) * v / tot), 5, 2.5, ST[k][1]);
    });
  }
  return c;
}

/* ---------- HABITS ---------- */
function hIcon(c, h, x, y, s) { c.setFillColor(K.card); c.fillEllipse(new Rect(x, y, s, s)); T(c, h.ic || '•', x + s / 2, y + s * .2, s * .46, 'r', K.t1, 'c') }
function cvHabits(s, f) {
  const { c, W, H } = canvas(f), P = 16, L = s.items.filter(h => h.due), n = L.filter(h => h.done).length, order = [...L.filter(h => !h.done), ...L.filter(h => h.done)];
  if (f === 'small') {
    cap(c, 'Habits', P, P);
    ringAt(c, W / 2, 78, 36, 8.5, L.length ? n / L.length : 0); T(c, n, W / 2, 61, 24, 'rh', K.t1, 'c', 1); T(c, `of ${L.length}`, W / 2, 90, 10, 'm', K.t2, 'c');
    if (order[0] && !order[0].done) T(c, fit(order[0].n, 12, W - 2 * P, 's'), W / 2, H - P - 14, 12, 's', K.t2, 'c');
    return c;
  }
  T(c, 'Habits', P, P - 2, 17, 'b'); T(c, `${n}/${L.length}`, W - P, P - 2, 17, 'rh', K.t2, 'r', 1);
  rr(c, P, P + 26, W - 2 * P, 5, 2.5, K.trk); if (n) rr(c, P, P + 26, Math.max(5, (W - 2 * P) * n / L.length), 5, 2.5, K.t1);
  const rowsN = f === 'large' ? 7 : 2, colW = (W - 2 * P - 16) / 2, y0 = P + 46, rh = f === 'large' ? 40 : 38;
  if (!L.length) { T(c, 'Nothing due today', P, y0, 14, 'm', K.t2); return c }
  order.slice(0, rowsN * 2).forEach((h, i) => {
    const x = P + (i % 2) * (colW + 16), y = y0 + Math.floor(i / 2) * rh;
    hIcon(c, h, x, y, 28);
    T(c, fit(h.n, 13, colW - 60, 's'), x + 36, y - 1, 13, 's', h.done ? K.t3 : K.t1);
    T(c, h.done ? 'Done' : h.t > 1 ? `${h.c} of ${h.t}` : h.streak ? `${h.streak}${h.unit === 'wk' ? 'w' : 'd'} streak` : 'Not yet', x + 36, y + 16, 10, 'm', K.t3);
    if (h.done) check(c, x + colW - 18, y + 5, 18, K.t1, new Color('#1c1c1e')); else ringAt(c, x + colW - 9, y + 14, 8, 2.2, h.t ? h.c / h.t : 0);
  });
  const left = order.length - rowsN * 2; if (left > 0 && f === 'large') T(c, `+${left} more`, P, H - P - 12, 11, 'm', K.t3);
  return c;
}
function cvGrid(c, g, x, y, weeks, cell, gap) {
  g = (g || '').slice(-(weeks * 7));
  for (let i = 0; i < weeks * 7; i++) { const ch = g[i] || 'f', X = x + Math.floor(i / 7) * (cell + gap), Y = y + (i % 7) * (cell + gap); rr(c, X, Y, cell, cell, cell * .26, ch === '1' ? K.t1 : ch === '0' ? K.trk : ch === 'f' ? new Color('#ffffff', .03) : K.trk2) }
}
function cvHabit(s, q, mode, f) {
  const h = pickHabit(s, q), { c, W, H } = canvas(f), P = 16;
  if (!h) { T(c, 'No habits yet', P, P, 14, 'm', K.t2); return c }
  const unit = h.unit === 'wk' ? 'week' : 'day', sub = h.done ? 'Done today' : h.due ? (h.t > 1 ? `${h.c} of ${h.t} today` : 'Not done yet') : 'Rest day';
  if (mode === 'streak') {
    hIcon(c, h, P, P, 34); ringAt(c, W - P - 13, P + 17, 11, 3.5, h.done ? 1 : h.t ? h.c / h.t : 0);
    T(c, h.streak, P - 1, 62, 46, 'rh', K.t1, 'l', 1); T(c, `${unit} streak`, P, 114, 12, 's', K.t2); T(c, fit(h.n, 12, W - 2 * P, 'm'), P, 130, 12, 'm', K.t3);
    return c;
  }
  if (f === 'small') {
    c.setFillColor(K.card); rr(c, P, P - 3, 34, 34, 9, K.card); T(c, h.ic || '•', P + 17, P + 4, 16, 'r', K.t1, 'c');
    T(c, fit(h.n, 16, W - 2 * P - 44, 'r'), P + 44, P + 5, 16, 'r', K.t2);
    const cell = 8.2, gap = 3.4, gw = 11 * cell + 10 * gap; cvGrid(c, h.g, (W - gw) / 2, H - P - (7 * cell + 6 * gap), 11, cell, gap);
    return c;
  }
  const weeks = f === 'large' ? 12 : 15, cell = f === 'large' ? 21 : 11.6, gap = f === 'large' ? 4.6 : 3.4, gw = weeks * cell + (weeks - 1) * gap, gh = 7 * cell + 6 * gap;
  if (f === 'large') {
    hIcon(c, h, P, P, 36); T(c, fit(h.n, 17, W - 2 * P - 120, 'b'), P + 46, P + 1, 17, 'b'); T(c, sub, P + 46, P + 21, 11, 'm', K.t2);
    T(c, h.streak, W - P, P - 2, 28, 'rh', K.t1, 'r', 1); T(c, `${unit} streak`, W - P, P + 31, 10, 'm', K.t2, 'r');
    const gy = P + 58; cvGrid(c, h.g, (W - gw) / 2, gy, weeks, cell, gap);
    const g = (h.g || ''), due = [...g].filter(x => x === '1' || x === '0'), pc = due.length ? Math.round(due.filter(x => x === '1').length / due.length * 100) : 0;
    const wk = [...g.slice(-7)].filter(x => x === '1').length, sy = gy + gh + 22, sw = (W - 2 * P) / 3;
    c.setFillColor(K.trk2); c.fillRect(new Rect(P, sy - 10, W - 2 * P, 1));
    [[`${wk}/7`, 'This week'], [`${pc}%`, 'Last 12 weeks'], [h.done ? 'Done' : h.due ? 'To do' : 'Rest', 'Today']].forEach(([v, l], i) => { T(c, v, P + sw * i, sy, 22, 'rh', K.t1, 'l', 1); T(c, l, P + sw * i, sy + 28, 10, 'm', K.t2) });
    return c;
  }
  const gx = W - P - gw; cvGrid(c, h.g, gx, (H - gh) / 2, weeks, cell, gap);
  hIcon(c, h, P, P, 30); T(c, fit(h.n, 14, gx - P - 12, 's'), P, P + 40, 14, 's');
  T(c, h.streak, P - 1, H - P - 46, 30, 'rh', K.t1, 'l', 1); T(c, `${unit} streak`, P, H - P - 12, 10, 'm', K.t2);
  return c;
}

/* ---------- WEEK ---------- */
const CALK = { job: .9, study: .7, gym: .55, fun: .42, other: .32 };
function cvWeek(d, f) {
  const { c, W, H } = canvas(f), P = 16, now = new Date(), nm = now.getHours() * 60 + now.getMinutes(), ti = Math.max(0, d.days.findIndex(x => x.k === d.k));
  const today = d.days[ti], t2 = d.days[ti + 1], tm = m => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
  const up = [...today.ev.filter(e => !e.ad && e.e > nm).map(e => ({ ...e, tm: 0 })), ...((t2 && t2.ev.filter(e => !e.ad).map(e => ({ ...e, tm: 1 }))) || [])];
  const wd = now.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase();
  if (f !== 'large' && f !== 'extraLarge') {
    const lw = f === 'small' ? 0 : 74;
    if (f === 'small') { T(c, wd, P, P, 11, 'b', new Color('#ff453a')); T(c, now.getDate(), W - P, P - 4, 20, 'rh', K.t1, 'r', 1) }
    else { T(c, wd, P, P, 12, 'b', new Color('#ff453a')); T(c, now.getDate(), P - 1, P + 14, 34, 'rh', K.t1, 'l', 1); T(c, up.length ? `${today.ev.filter(e => !e.ad && e.e > nm).length} today` : 'Free', P, H - P - 13, 11, 'm', K.t2) }
    const x = P + lw, cwid = W - P - x, n = f === 'small' ? 3 : 3, ch = f === 'small' ? 34 : 38, gp = 5, y0 = f === 'small' ? P + 24 : P;
    const show = up.slice(0, n); if (!show.length) T(c, 'Nothing coming up', x, y0 + 8, 13, 'm', K.t2);
    show.forEach((e, i) => {
      const y = y0 + i * (ch + gp); rr(c, x, y, cwid, ch, 8, K.card); rr(c, x, y, 3.5, ch, 1.75, new Color('#ffffff', CALK[e.c] || .32));
      T(c, fit(e.t, f === 'small' ? 12 : 13, cwid - 18, 's'), x + 11, y + (f === 'small' ? 4 : 5), f === 'small' ? 12 : 13, 's');
      T(c, `${e.tm ? 'Tomorrow ' : ''}${tm(e.s)}–${tm(e.e)}`, x + 11, y + (f === 'small' ? 19 : 21), 10, 'm', K.t2);
    });
    return c;
  }
  /* large / extra-large: three days from today, with room to read each event */
  const D3 = d.days.slice(ti, ti + 3), timed = D3.flatMap(x => x.ev.filter(e => !e.ad)), xl = f === 'extraLarge';
  const h0 = Math.min(8, ...timed.map(e => Math.floor(e.s / 60))), h1 = Math.min(24, Math.max(22, ...timed.map(e => Math.ceil(Math.min(e.e, 1440) / 60))));
  const lx = P + 22, top = P + 34, colW = (W - P - lx) / 3, ph = (H - P - top) / ((h1 - h0) * 60), red = new Color('#ff453a');
  /* hour lines (faint every hour, labelled every two) */
  for (let h = h0; h < h1; h += 2) { const y = top + (h - h0) * 60 * ph; T(c, h, lx - 6, y - 6, 9.5, 'm', K.t3, 'r') }
  D3.forEach((x, i) => {
    const X0 = lx + i * colW, dt = new Date(x.k + 'T12:00');
    if (i) { c.setFillColor(K.trk2); c.fillRect(new Rect(X0, top - 4, 1, H - P - top + 4)) }
    const lab = i === 0 ? 'Today' : `${dt.toLocaleDateString('en-GB', { weekday: 'long' })} ${dt.getDate()}`, hs = xl ? 14 : 13;
    T(c, fit(lab, hs, colW - 10, 'b'), X0 + 6, P, hs, 'b', i === 0 ? red : K.t1);
    const ev = x.ev.filter(e => !e.ad).map(e => ({ ...e })).sort((a, b) => a.s - b.s || b.e - a.e); let grp = [], end = -1;
    const flush = () => { const cols = []; grp.forEach(e => { let k = cols.findIndex(t => t <= e.s); if (k < 0) { k = cols.length; cols.push(0) } cols[k] = e.e; e.col = k }); grp.forEach(e => e.n = cols.length); grp = [] };
    ev.forEach(e => { if (e.s >= end) { flush(); end = -1 } grp.push(e); end = Math.max(end, e.e) }); flush();
    ev.forEach(e => {
      const y = top + (Math.max(e.s, h0 * 60) - h0 * 60) * ph + .75, hh = Math.max(8, (Math.min(e.e, h1 * 60) - Math.max(e.s, h0 * 60)) * ph - 1.5);
      const sub = (colW - 8) / e.n, X = X0 + 4 + e.col * sub, cw2 = sub - (e.n > 1 ? 2 : 0), tx = X + 8, tw2 = cw2 - 12, t = tm(e.s);
      rr(c, X, y, cw2, hh, 5, new Color('#ffffff', .13 + (CALK[e.c] || .32) * .16)); rr(c, X, y, 3, hh, 1.5, new Color('#ffffff', .85));
      const fs = xl ? 11.5 : 10.5;
      if (hh >= fs * 2.6) { T(c, fit(e.t, fs, tw2, 's'), tx, y + 3, fs, 's'); T(c, fit(tws(`${t}–${tm(e.e)}`, fs - 1.5, 'm') <= tw2 ? `${t}–${tm(e.e)}` : t, fs - 1.5, tw2, 'm'), tx, y + 4 + fs * 1.25, fs - 1.5, 'm', K.t2) }
      else if (hh >= fs + 3) { const tl = tws('  ' + t, fs - 1.5, 'm'), nm = fit(e.t, fs, tw2 - (tw2 > 110 ? tl : 0), 's'); T(c, nm, tx, y + (hh - fs * 1.25) / 2, fs, 's'); if (tw2 > 110) T(c, t, X + cw2 - 6, y + (hh - fs * 1.1) / 2, fs - 1.5, 'm', K.t2, 'r') }
    });
  });
  if (nm >= h0 * 60 && nm <= h1 * 60) { const y = top + (nm - h0 * 60) * ph; c.setFillColor(red); c.fillRect(new Rect(lx, y - .75, colW, 1.5)); c.fillEllipse(new Rect(lx - 3.5, y - 3.5, 7, 7)) }
  return c;
}

/* ---------- GOAL ---------- */
function cvGoal(d, f) {
  const { c, W, H } = canvas(f), P = 18, name = d.q.replace(/\b\w/g, x => x.toUpperCase()), sm = f === 'small';
  T(c, 'Next Goal', P, P + 2, sm ? 18 : 21, 'serif', new Color('#ffffff', .72));
  T(c, `${d.target}kg ${name}`, P, P + (sm ? 30 : 34), sm ? 19 : 24, 'b', K.t1);
  if (!sm) T(c, d.best ? `Best ${d.bestKg}kg × ${d.bestR}  ·  e1RM ${d.best}kg` : 'No sets logged yet', P, P + 66, 12, 'm', K.t2);
  if (f === 'large') { T(c, d.pct + '%', P - 2, H / 2 - 30, 72, 'rh', K.t1, 'l', 1); T(c, d.best ? `${Math.max(0, Math.round((d.target - d.best) * 10) / 10)}kg to go` : '', P, H / 2 + 52, 15, 's', K.t2) }
  const by = H - P - 32; rr(c, P, by, W - 2 * P, 5, 2.5, new Color('#ffffff', .14)); if (d.pct) rr(c, P, by, Math.max(5, (W - 2 * P) * d.pct / 100), 5, 2.5, K.t1);
  if (f !== 'large') T(c, d.pct + '%', P, by + 13, sm ? 15 : 17, 'rh', K.t1, 'l', 1); else T(c, 'Progress', P, by + 15, 10, 's', K.t2);
  if (d.left != null) T(c, d.left >= 0 ? `${d.left} DAYS LEFT` : `${-d.left} DAYS OVER`, W - P, by + (sm ? 16 : 18), 10, 's', K.t2, 'r');
  return c;
}

/* ---------- YEAR: three habits as year-long grids (iPad extra-large) ---------- */
async function raw(q) { const t = await token(), r = new Request(`${SUPA_URL}/rest/v1/kv?${q}`); r.headers = { apikey: SUPA_KEY, Authorization: `Bearer ${t}` }; const j = await r.loadJSON(); if (!Array.isArray(j)) throw new Error((j && j.message) || 'read failed'); return j }
const WEEKS = 51;
async function dYear() {
  const k = dayK(), from = addD(monOf(k), -(WEEKS - 1) * 7), old = cache('year-sleep') || { at: '', n: {} }, enc = encodeURIComponent;
  /* sleep nights only change for the last few days, so older scores are kept from the last run */
  const sFrom = old.at && old.at > from ? addD(old.at, -3) : from;
  const [gym, days, sl, lt, set] = await Promise.all([
    raw('select=path,d:data->>date&path=like.' + enc('gym/w-*')),
    raw('select=path,n:data->names&path=like.' + enc('days/d-*') + '&path=gte.' + enc('days/d-' + from)),
    raw('select=path,data&path=like.' + enc('sleep/w-*') + '&path=gte.' + enc('sleep/w-' + sFrom)),
    docs(['tools/leet']), docs(['sleep/settings'])]);
  const S = { wake: '07:30', goal: 8, ...(set['sleep/settings'] || {}) };
  const wo = {}, lc = {}, sp = { ...old.n };
  gym.forEach(r => { if (r.d) wo[String(r.d).slice(0, 10)] = 1 });
  days.forEach(r => { if ((r.n || []).some(x => /gym|cardio|workout|\brun\b|lift/i.test(String(x)))) wo[r.path.slice(7)] = 1 });
  sl.forEach(r => { if (r.data && r.data.asleep) sp[r.path.slice(8)] = sScore(r.data, S) >= 80 ? 1 : 0 });
  Object.values(((lt['tools/leet'] || {}).items) || {}).forEach(it => (it.attempts || []).forEach(a => { if (a.ok && a.d) lc[String(a.d).slice(0, 10)] = 1 }));
  cache('year-sleep', { at: k, n: sp });
  return { k, from, rows: [['Workout', wo], ['Sleep', sp], ['LeetCode', lc]] };
}
function cvYear(d, f) {
  const { c, W, H } = canvas('extraLarge'), P = 18, MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], on = new Color('#5fd38d');
  T(c, 'Habits', P, P - 2, 17, 'b'); T(c, 'Last 12 months', W - P, P + 1, 11, 'm', K.t2, 'r');
  const gx = P + 134, cell = 9, gap = 2.4, step = cell + gap, top0 = P + 30, bh = (H - P - top0 + 6) / 3;
  d.rows.forEach(([name, set], r) => {
    const y0 = top0 + r * bh, gy = y0 + 13;
    /* left: name, 30-day count, current run */
    let n30 = 0; for (let i = 0; i < 30; i++) if (set[addD(d.k, -i)]) n30++;
    let run = 0, i = set[d.k] ? 0 : 1; while (set[addD(d.k, -i)]) { run++; i++ }
    T(c, name, P, gy - 2, 14, 'b');
    T(c, n30, P, gy + 17, 22, 'rh', K.t1, 'l', 1); T(c, 'of last 30 days', P + tws(String(n30), 22, 'rh') + 5, gy + 26, 9.5, 'm', K.t2);
    T(c, run ? `${run}-day run` : 'No current run', P, gy + 47, 10, 'm', K.t3);
    ['M', '', 'W', '', 'F', '', ''].forEach((l, j) => l && T(c, l, gx - 7, gy + j * step - 1.5, 8, 'm', K.t3, 'r'));
    let lastM = -1;
    for (let w = 0; w < WEEKS; w++) for (let dd = 0; dd < 7; dd++) {
      const key = addD(d.from, w * 7 + dd), x = gx + w * step, y = gy + dd * step;
      if (dd === 0) { const m = new Date(key + 'T12:00').getMonth(); if (m !== lastM && w < WEEKS - 1) { if (lastM !== -1 || new Date(key + 'T12:00').getDate() <= 7) T(c, MON[m], x, y0, 8.5, 'm', K.t3); lastM = m } }
      if (key > d.k) continue;
      rr(c, x, y, cell, cell, 2.4, set[key] ? on : K.trk2);
      if (key === d.k) { c.setStrokeColor(K.t1); c.setLineWidth(1.2); const p = new Path(); p.addRoundedRect(new Rect(x - .6, y - .6, cell + 1.2, cell + 1.2), 3, 3); c.addPath(p); c.strokePath() }
    }
  });
  return c;
}

/* the same three habits for the large square: one shared month axis, a header line per habit, ~7 months of weeks */
function cvYearL(d, f) {
  const { c, W, H } = canvas(f), P = 16, MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], on = new Color('#5fd38d');
  const cell = 7.5, gap = 2.1, step = cell + gap, weeks = Math.floor((W - 2 * P - 12 + gap) / step), gx = W - P - (weeks * step - gap), start = addD(monOf(d.k), -(weeks - 1) * 7);
  T(c, 'Habits', P, P - 2, 17, 'b');
  const ax = P + 28; let lastM = -1;
  for (let w = 0; w < weeks; w++) { const key = addD(start, w * 7), m = new Date(key + 'T12:00').getMonth(); if (m !== lastM) { if (lastM !== -1 || new Date(key + 'T12:00').getDate() <= 7) if (w < weeks - 2) T(c, MON[m], gx + w * step, ax, 9, 'm', K.t3); lastM = m } }
  const top0 = ax + 17, bh = (H - P - top0 + 8) / 3;
  d.rows.forEach(([name, set], r) => {
    const y0 = top0 + r * bh, gy = y0 + 19;
    let n30 = 0; for (let i = 0; i < 30; i++) if (set[addD(d.k, -i)]) n30++;
    let run = 0, i = set[d.k] ? 0 : 1; while (set[addD(d.k, -i)]) { run++; i++ }
    T(c, name, P, y0, 13, 'b');
    ['M', '', 'W', '', 'F', '', ''].forEach((l, j) => l && T(c, l, gx - 5, gy + j * step - 1.8, 7.5, 'm', K.t3, 'r'));
    for (let w = 0; w < weeks; w++) for (let dd = 0; dd < 7; dd++) {
      const key = addD(start, w * 7 + dd); if (key > d.k) continue; const x = gx + w * step, y = gy + dd * step;
      rr(c, x, y, cell, cell, 2.2, set[key] ? on : K.trk2);
      if (key === d.k) { c.setStrokeColor(K.t1); c.setLineWidth(1.1); const p = new Path(); p.addRoundedRect(new Rect(x - .55, y - .55, cell + 1.1, cell + 1.1), 2.6, 2.6); c.addPath(p); c.strokePath() }
    }
  });
  return c;
}
/* =====================================================================================
   SCREEN TIME · GYM · BUDGET · DOSES — each built from a summary block (head), a chart (A) and a list (B),
   arranged per size: small = compact head, medium = head | A, large = head / A / B, extra-large = head+B | A
   ===================================================================================== */
const GOODC = new Color('#5fd38d'), BADC = new Color('#ff453a');
const hmS = m => { m = Math.round(m); return m >= 60 ? `${Math.floor(m / 60)}h ${pad(m % 60)}m` : `${m}m` };
const gbp = v => '£' + Math.round(Math.abs(v)).toLocaleString('en-GB');
const ago = k => { const n = Math.round((new Date(dayK() + 'T12:00') - new Date(k + 'T12:00')) / 864e5); return n <= 0 ? 'Today' : n === 1 ? 'Yesterday' : `${n} days ago` };
function pill(c, s, xr, y, col) { const w = tws(s, 9.5, 's') + 14; rr(c, xr - w, y - 1, w, 17, 8.5, new Color(col.hex || 'ffffff', .18)); T(c, s, xr - 7, y + 2, 9.5, 's', col, 'r') }
function stat(c, v, l, x, y, big) { T(c, v, x, y, big || 20, 'rh', K.t1, 'l', 1); T(c, l, x, y + (big || 20) * 1.28, 10, 'm', K.t2) }
function bars(c, vals, labels, x, y, w, h, opt) {
  /* vertical bars with an optional target line; opt: {goal, max, today, colOf} */
  const n = vals.length, gap = Math.min(10, w / n * .28), bw = (w - gap * (n - 1)) / n, lh = labels ? 16 : 0, bh = h - lh;
  const mx = opt.max || Math.max(1, ...vals, (opt.goal || 0) * 1.25);
  vals.forEach((v, i) => {
    const bx = x + i * (bw + gap); rr(c, bx, y, bw, bh, Math.min(5, bw / 3), K.trk2);
    const fh = v ? Math.max(bw > 8 ? 6 : 3, bh * Math.min(1, v / mx)) : 0; if (fh) rr(c, bx, y + bh - fh, bw, fh, Math.min(5, bw / 3), opt.colOf ? opt.colOf(v, i) : K.t1);
    if (labels) T(c, labels[i], bx + bw / 2, y + bh + 4, 9.5, i === opt.today ? 'b' : 'm', i === opt.today ? K.t1 : K.t3, 'c');
  });
  if (opt.goal) { const gy = y + bh - bh * Math.min(1, opt.goal / mx); c.setFillColor(new Color('#ffffff', .7)); for (let gx = x; gx < x + w; gx += 6) c.fillRect(new Rect(gx, gy - .6, 3, 1.2)) }
}
function frame(f) { const { c, W, H } = canvas(f); return { c, W, H, P: 16 } }
function layout(f, d, head, A, B, small) {
  const { c, W, H, P } = frame(f);
  if (f === 'small') { small(c, d, P, P, W - 2 * P, H - 2 * P); return c }
  if (f === 'medium') { const lw = 150; head(c, d, P, P, lw - 10, H - 2 * P, 'm'); A(c, d, P + lw, P, W - 2 * P - lw, H - 2 * P, 'm'); return c }
  if (f === 'extraLarge') { const lw = 300; head(c, d, P, P, lw, 120, 'l'); B(c, d, P, H - P - 40, lw, 40, 'x'); A(c, d, P + lw + 32, P, W - 2 * P - lw - 32, H - 2 * P, 'x'); c.setFillColor(K.trk2); c.fillRect(new Rect(P + lw + 16, P, 1, H - 2 * P)); return c }
  head(c, d, P, P, W - 2 * P, 88, 'l'); A(c, d, P, P + 96, W - 2 * P, H - 2 * P - 96 - 66, 'l'); c.setFillColor(K.trk2); c.fillRect(new Rect(P, H - P - 52, W - 2 * P, 1)); B(c, d, P, H - P - 40, W - 2 * P, 40, 'l');
  return c;
}

/* ---------- SCREEN TIME ---------- */
async function dScreen() {
  const k = dayK(), enc = encodeURIComponent, [rowsS, b] = await Promise.all([raw('select=path,a:data->screentime,b:data->screen&path=like.' + enc('health/d-*') + '&path=gte.' + enc('health/d-' + addD(k, -15))), docs(['tools/brick'])]);
  const B = b['tools/brick'] || {}, m = {}; rowsS.forEach(r => { const v = +(r.a ?? r.b); if (v > 0) m[addD(r.path.slice(9), -1)] = v / 60 });   /* the morning Shortcut reports the day before */
  const days = [...Array(7)].map((_, i) => addD(k, i - 7)), last = days[6], wk = monOf(k);
  const ss = (B.sessions || []).filter(s => s.d >= addD(k, -6));
  return { k, days, m, goal: (B.goalH == null ? 2 : +B.goalH) * 60, last, y: m[last], on: !!B.on, until: B.until, since: B.since, bricks: ss.length, brickMin: ss.reduce((a, s) => a + (+s.min || 0), 0) };
}
const stCol = (d) => (v) => v > d.goal ? BADC : GOODC;
function stHead(c, d, x, y, w, h, sz) {
  cap(c, 'Screen time', x, y);
  if (sz === 'm') { if (d.on) { c.setFillColor(BADC); c.fillEllipse(new Rect(x + w - 8, y + 3, 8, 8)) } }
  else if (d.on) pill(c, d.until ? `BRICKED · ${hmS(Math.max(0, (new Date(d.until) - Date.now()) / 6e4))}` : 'BRICKED', x + w, y - 1, BADC); else T(c, 'Yesterday', x + w, y, 11, 'm', K.t2, 'r');
  if (d.y == null) { T(c, 'No data yet', x, y + 24, 20, 'b', K.t2); T(c, 'Add screen time to your morning Shortcut', x, y + 52, 11, 'm', K.t3); return }
  dur(c, d.y, x, y + 20, sz === 'm' ? 28 : 32);
  const df = d.y - d.goal; T(c, sz === 'm' ? `${df > 0 ? '+' : '−'}${hmS(Math.abs(df))} vs goal` : `${hmS(Math.abs(df))} ${df > 0 ? 'over' : 'under'} your ${hmS(d.goal)} goal`, x, y + (sz === 'm' ? 58 : 62), 11, 's', df > 0 ? BADC : GOODC);
  if (sz === 'm') { const v = d.days.map(k => d.m[k]).filter(Boolean); if (v.length) { T(c, hmS(v.reduce((a, b) => a + b, 0) / v.length), x, y + h - 30, 15, 'rh', K.t1, 'l', 1); T(c, '7-day average', x, y + h - 12, 10, 'm', K.t2) } }
}
function stBars(c, d, x, y, w, h) { const D = ['M', 'T', 'W', 'T', 'F', 'S', 'S']; bars(c, d.days.map(k => d.m[k] || 0), d.days.map(k => D[(new Date(k + 'T12:00').getDay() + 6) % 7]), x, y, w, h, { goal: d.goal, today: 6, colOf: stCol(d) }) }
function stStats(c, d, x, y, w, h) {
  const v = d.days.map(k => d.m[k]).filter(Boolean), sw = w / 3;
  stat(c, v.length ? hmS(v.reduce((a, b) => a + b, 0) / v.length) : '–', '7-day average', x, y);
  stat(c, `${v.filter(m => m <= d.goal).length}/7`, 'Days under goal', x + sw, y);
  stat(c, d.bricks ? hmS(d.brickMin) : '0', `Bricked · ${d.bricks} session${d.bricks === 1 ? '' : 's'}`, x + sw * 2, y);
}
function stSmall(c, d, x, y, w, h) {
  cap(c, 'Screen time', x, y); if (d.on) { c.setFillColor(BADC); c.fillEllipse(new Rect(x + w - 8, y + 3, 8, 8)) }
  if (d.y == null) { T(c, 'No data yet', x, y + 30, 16, 'b', K.t2); return }
  dur(c, d.y, x, y + 20, 26); const df = d.y - d.goal; T(c, `${df > 0 ? '+' : '−'}${hmS(Math.abs(df))} vs goal`, x, y + 54, 11, 's', df > 0 ? BADC : GOODC);
  stBars(c, d, x, y + 72, w, h - 72);
}
const cvScreen = (d, f) => layout(f, d, stHead, (c, d, x, y, w, h) => stBars(c, d, x, y + (h > 140 ? 6 : 0), w, h - (h > 140 ? 6 : 0)), stStats, stSmall);

/* ---------- GYM ---------- */
async function dGym() {
  const L = (await prefix('gym/w-')).map(r => r.data).filter(w => w && w.date && (w.ex || []).length).sort((a, b) => (b.startedAt || b.date) < (a.startedAt || a.date) ? -1 : 1);
  const k = dayK(), mon = monOf(k), set = new Set(L.map(w => w.date)), vol = w => (w.ex || []).reduce((t, x) => t + (x.sets || []).reduce((a, s) => a + (s.t === 'w' || s.done === false ? 0 : (+s.kg || 0) * (+s.r || 0)), 0), 0);
  const nm = x => String(x.n || x.id || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, m => m.toUpperCase()).trim();
  const top = w => { let b = null; (w.ex || []).forEach(x => (x.sets || []).forEach(s => { if (s.t === 'w' || s.done === false || !+s.kg || !+s.r) return; const e = +s.kg * (1 + Math.min(10, +s.r) / 30); if (!b || e > b.e) b = { e, n: nm(x), kg: +s.kg, r: +s.r } })); return b };
  const weeks = [...Array(8)].map((_, i) => addD(mon, (i - 7) * 7)).map(ws => ({ ws, v: L.filter(w => w.date >= ws && w.date < addD(ws, 7)).reduce((t, w) => t + vol(w), 0) }));
  const best = {}; L.forEach(w => (w.ex || []).forEach(x => { const n = nm(x); (x.sets || []).forEach(s => { if (s.t === 'w' || s.done === false || !+s.kg || !+s.r) return; const e = +s.kg * (1 + Math.min(10, +s.r) / 30); best[n] = best[n] || { n, e: 0, c: 0 }; best[n].c++; if (e > best[n].e) best[n].e = e }) }));
  const lifts = Object.values(best).sort((a, b) => b.c - a.c).slice(0, 6);
  const w0 = L[0], last = w0 ? { name: w0.name || 'Workout', date: w0.date, min: w0.endedAt && w0.startedAt ? Math.round((new Date(w0.endedAt) - new Date(w0.startedAt)) / 6e4) : null, vol: vol(w0), sets: (w0.ex || []).reduce((t, x) => t + (x.sets || []).filter(s => s.t !== 'w' && s.done !== false).length, 0), top: top(w0) } : null;
  return { k, mon, week: [...Array(7)].map((_, i) => ({ k: addD(mon, i), on: set.has(addD(mon, i)) })), n: [...Array(7)].filter((_, i) => set.has(addD(mon, i))).length, last, weeks, lifts };
}
const tonnes = v => v >= 1000 ? (v / 1000).toFixed(1) + 't' : Math.round(v) + 'kg';
function weekDots(c, d, x, y, w) { const D = ['M', 'T', 'W', 'T', 'F', 'S', 'S'], s = Math.min(22, (w - 6 * 6) / 7), g = (w - 7 * s) / 6; d.week.forEach((x0, i) => { const cx = x + i * (s + g); if (x0.on) { c.setFillColor(K.t1); c.fillEllipse(new Rect(cx, y, s, s)) } else { c.setFillColor(K.trk2); c.fillEllipse(new Rect(cx, y, s, s)) } if (x0.k === d.k) circle(c, cx - 2.5, y - 2.5, s + 5, K.t2, 1.4); T(c, D[i], cx + s / 2, y + s / 2 - 5.5, 9, 'b', x0.on ? new Color('#1c1c1e') : K.t3, 'c') }) }
function gyHead(c, d, x, y, w, h, sz) {
  cap(c, 'Gym', x, y); T(c, 'This week', x + w, y, 11, 'm', K.t2, 'r');
  T(c, d.n, x - 1, y + 18, 34, 'rh', K.t1, 'l', 1); T(c, d.n === 1 ? 'session' : 'sessions', x + tws(String(d.n), 34, 'rh') + 6, y + 36, 12, 's', K.t2);
  weekDots(c, d, x, y + (sz === 'm' ? h - 22 : 70), Math.min(w, 220));
}
function gyLast(c, d, x, y, w, h, sz) {
  cap(c, 'Last workout', x, y); if (!d.last) { T(c, 'No workouts logged yet', x, y + 22, 14, 'm', K.t2); return }
  const L = d.last; T(c, ago(L.date), x + w, y, 11, 'm', K.t2, 'r');
  T(c, fit(L.name, 17, w, 'b'), x, y + 18, 17, 'b'); T(c, [new Date(L.date + 'T12:00').toLocaleDateString('en-GB', { weekday: 'long' }), L.min ? hmS(L.min) : ''].filter(Boolean).join('  ·  '), x, y + 40, 11, 'm', K.t2);
  const yy = y + h - 36, sw = w / 3; stat(c, tonnes(L.vol), 'Volume', x, yy, 18); stat(c, L.sets, 'Sets', x + sw, yy, 18);
  if (L.top) { T(c, `${L.top.kg}×${L.top.r}`, x + sw * 2, yy, 18, 'rh', K.t1, 'l', 1); T(c, fit(L.top.n, 10, sw, 'm'), x + sw * 2, yy + 23, 10, 'm', K.t2) }
}
function gyMore(c, d, x, y, w, h, sz) {
  if (sz === 'x') {
    cap(c, 'Top lifts · est. 1RM', x, y); d.lifts.slice(0, Math.floor((h - 20) / 26)).forEach((l, i) => { const yy = y + 22 + i * 26; T(c, fit(l.n, 13, w - 70, 's'), x, yy, 13, 's'); T(c, Math.round(l.e) + 'kg', x + w, yy, 13, 'rh', K.t1, 'r', 1) }); return
  }
  cap(c, 'Weekly volume', x, y); T(c, tonnes(d.weeks[7].v) + ' this week', x + w, y, 11, 'm', K.t2, 'r');
  bars(c, d.weeks.map(z => z.v), d.weeks.map((z, i) => i === 7 ? 'Now' : new Date(z.ws + 'T12:00').getDate() + ''), x, y + 20, w, h - 20, { today: 7, colOf: (v, i) => i === 7 ? K.t1 : new Color('#ffffff', .45) });
}
function gySmall(c, d, x, y, w, h) {
  cap(c, 'Gym', x, y); T(c, d.n, x - 1, y + 16, 30, 'rh', K.t1, 'l', 1); T(c, 'this week', x + tws(String(d.n), 30, 'rh') + 5, y + 32, 11, 's', K.t2);
  weekDots(c, d, x, y + 60, w);
  if (d.last) { T(c, fit(d.last.name, 13, w, 's'), x, y + h - 30, 13, 's'); T(c, ago(d.last.date), x, y + h - 13, 10.5, 'm', K.t2) }
}
const cvGym = (d, f) => f === 'large' ? (() => { const { c, W, H, P } = frame(f); gyHead(c, d, P, P, W - 2 * P, 96, 'l'); c.setFillColor(K.trk2); c.fillRect(new Rect(P, P + 104, W - 2 * P, 1)); gyLast(c, d, P, P + 116, W - 2 * P, 104); c.setFillColor(K.trk2); c.fillRect(new Rect(P, P + 232, W - 2 * P, 1)); gyMore(c, d, P, P + 244, W - 2 * P, H - 2 * P - 244, 'l'); return c })() : f === 'extraLarge' ? (() => { const { c, W, H, P } = frame(f), lw = 300; gyHead(c, d, P, P, lw, 120, 'l'); gyMore(c, d, P, P + 130, lw, H - 2 * P - 130, 'x'); c.setFillColor(K.trk2); c.fillRect(new Rect(P + lw + 16, P, 1, H - 2 * P)); const rx = P + lw + 32, rw = W - P - rx; gyLast(c, d, rx, P, rw, 120); gyMore(c, d, rx, P + 150, rw, H - 2 * P - 150, 'l'); return c })()
  : layout(f, d, gyHead, gyLast, gyMore, gySmall);

/* ---------- BUDGET ---------- */
async function dMoney() {
  const o = await docs(['widget/today', 'money/actuals']), cats = (o['widget/today'] || {}).cats || {}, A = (o['money/actuals'] || {}).months || {};
  const n = new Date(), mk = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, key = mk(n), mon = A[key] || {};
  const list = Object.entries(cats).map(([c, b]) => ({ c: c === 'Personal & Other' ? 'Personal' : c, b: +b || 0, a: mon[c] == null || mon[c] === '' ? null : +mon[c] })).sort((a, b) => b.b - a.b);
  const tb = list.reduce((t, x) => t + x.b, 0), ta = list.reduce((t, x) => t + (x.a || 0), 0), logged = list.some(x => x.a != null);
  const hist = [...Array(6)].map((_, i) => { const d = new Date(n.getFullYear(), n.getMonth() - 5 + i, 1), m = A[mk(d)] || {}; return { l: d.toLocaleDateString('en-GB', { month: 'short' }), v: Object.keys(cats).reduce((s, c) => s + (+m[c] || 0), 0) } });
  const dim = new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate();
  return { month: n.toLocaleDateString('en-GB', { month: 'long' }), list, tb, ta, logged, hist, prog: n.getDate() / dim, left: tb - ta, none: !Object.keys(cats).length };
}
function mnHead(c, d, x, y, w, h, sz) {
  cap(c, `Budget · ${d.month}`, x, y);
  if (d.none) { T(c, 'Open the app once', x, y + 24, 16, 'b', K.t2); return }
  T(c, gbp(d.left), x - 1, y + 18, sz === 'm' ? 30 : 34, 'rh', d.left < 0 ? BADC : K.t1, 'l', 1);
  T(c, d.logged ? `${d.left < 0 ? 'over' : 'left'} of ${gbp(d.tb)}` : `budget · nothing logged yet`, x, y + (sz === 'm' ? 56 : 60), 11, 's', K.t2);
  const by = y + (sz === 'm' ? h - 22 : 84); rr(c, x, by, w, 7, 3.5, K.trk2); const fr = d.tb ? Math.min(1, d.ta / d.tb) : 0; if (fr) rr(c, x, by, Math.max(7, w * fr), 7, 3.5, d.ta > d.tb ? BADC : K.t1);
  const tx = x + w * d.prog; c.setFillColor(K.t2); c.fillRect(new Rect(tx - .75, by - 4, 1.5, 15));
  if (sz === 'l') T(c, `${Math.round(d.prog * 100)}% through the month`, x, by + 13, 10, 'm', K.t3);
}
function mnCats(c, d, x, y, w, h, sz) {
  const rows = d.list.slice(0, Math.max(1, Math.floor((h + 6) / (sz === 'm' ? 31 : 34)))), rh = sz === 'm' ? 31 : 34;
  if (sz !== 'm') cap(c, 'Categories', x, y);
  const y0 = sz === 'm' ? y : y + 20;
  rows.slice(0, Math.floor((h - (y0 - y) + 6) / rh)).forEach((r, i) => {
    const yy = y0 + i * rh; T(c, fit(r.c, 12, w - 90, 's'), x, yy, 12, 's'); T(c, r.a == null ? `${gbp(r.b)}` : `${gbp(r.a)} / ${gbp(r.b)}`, x + w, yy, 11, 'm', r.a > r.b ? BADC : K.t2, 'r');
    rr(c, x, yy + 18, w, 5, 2.5, K.trk2); if (r.a) rr(c, x, yy + 18, Math.max(5, w * Math.min(1, r.a / (r.b || 1))), 5, 2.5, r.a > r.b ? BADC : K.t1);
  });
}
function mnHist(c, d, x, y, w, h) { cap(c, 'Last 6 months', x, y); bars(c, d.hist.map(z => z.v), d.hist.map(z => z.l), x, y + 20, w, h - 20, { goal: d.tb, today: 5, colOf: v => v > d.tb ? BADC : K.t1 }) }
function mnSmall(c, d, x, y, w, h) {
  cap(c, `Budget · ${d.month.slice(0, 3)}`, x, y); if (d.none) { T(c, 'Open the app once', x, y + 26, 14, 'b', K.t2); return }
  T(c, gbp(d.left), x - 1, y + 20, 30, 'rh', d.left < 0 ? BADC : K.t1, 'l', 1); T(c, `${d.left < 0 ? 'over' : 'left'} of ${gbp(d.tb)}`, x, y + 56, 11, 's', K.t2); T(c, `${gbp(d.ta)} spent`, x, y + 74, 11, 'm', K.t3);
  const by = y + h - 10; rr(c, x, by, w, 7, 3.5, K.trk2); const fr = d.tb ? Math.min(1, d.ta / d.tb) : 0; if (fr) rr(c, x, by, Math.max(7, w * fr), 7, 3.5, d.ta > d.tb ? BADC : K.t1); c.setFillColor(K.t2); c.fillRect(new Rect(x + w * d.prog - .75, by - 4, 1.5, 15));
}
const cvMoney = (d, f) => f === 'extraLarge' ? (() => { const { c, W, H, P } = frame(f), lw = 300; mnHead(c, d, P, P, lw, 120, 'l'); mnHist(c, d, P, P + 140, lw, H - 2 * P - 140); c.setFillColor(K.trk2); c.fillRect(new Rect(P + lw + 16, P, 1, H - 2 * P)); mnCats(c, d, P + lw + 32, P, W - P - (P + lw + 32), H - 2 * P, 'l'); return c })()
  : f === 'large' ? (() => { const { c, W, H, P } = frame(f); mnHead(c, d, P, P, W - 2 * P, 104, 'k'); mnCats(c, d, P, P + 116, W - 2 * P, 98, 'l'); c.setFillColor(K.trk2); c.fillRect(new Rect(P, P + 214, W - 2 * P, 1)); mnHist(c, d, P, P + 226, W - 2 * P, H - 2 * P - 226); return c })()
  : layout(f, d, mnHead, (c, d, x, y, w, h) => mnCats(c, d, x, y + 2, w, h, 'm'), mnHist, mnSmall);

/* ---------- DOSES ---------- */
async function dDoses() { const t = (await docs(['widget/today']))['widget/today']; if (!t) throw new Error('Open the app once to publish doses'); return { items: t.doses || [], date: t.date } }
function doseState(d) { const m = nowMin(), L = d.items.map(i => ({ ...i, m: toMin(i.t) })); const next = L.filter(i => !i.d && i.m >= m - 15); const missed = L.filter(i => !i.d && i.m < m - 15); return { L, next, missed, taken: L.filter(i => i.d).length, m } }
const inT = mins => mins <= 0 ? 'now' : mins >= 60 ? `in ${Math.floor(mins / 60)}h ${mins % 60}m` : `in ${mins}m`;
function dsHead(c, d, x, y, w, h, sz) {
  const s = doseState(d), nx = s.next[0]; cap(c, 'Next dose', x, y); if (nx) T(c, inT(nx.m - s.m), x + w, y, 11, 's', K.t1, 'r');
  if (!d.items.length) { T(c, 'No doses today', x, y + 26, 16, 'b', K.t2); return }
  if (nx) { T(c, fit(nx.n, sz === 'm' ? 19 : 22, w, 'b'), x, y + 20, sz === 'm' ? 19 : 22, 'b'); T(c, [nx.t, nx.dose].filter(Boolean).join('  ·  '), x, y + (sz === 'm' ? 46 : 50), 12, 'm', K.t2) }
  else T(c, 'All taken', x, y + 20, 22, 'b', GOODC);
  const by = y + (sz === 'm' ? h - 26 : 78); T(c, `${s.taken} of ${s.L.length} taken${s.missed.length ? '' : ''}`, x, by, 11, 's', K.t2); if (s.missed.length) T(c, `${s.missed.length} missed`, x + w, by, 11, 's', BADC, 'r');
  rr(c, x, by + 17, w, 6, 3, K.trk2); if (s.taken) rr(c, x, by + 17, Math.max(6, w * s.taken / s.L.length), 6, 3, K.t1);
}
function dsList(c, d, x, y, w, h, sz) {
  const s = doseState(d), rh = 27, n = Math.max(1, Math.floor((h + 4) / rh)), cut = sz === 'm' ? s.L.filter(i => !i.d).slice(0, n) : (() => { const i0 = Math.max(0, s.L.findIndex(i => !i.d && i.m >= s.m - 60)); const st = Math.max(0, Math.min(i0 - 1, s.L.length - n)); return s.L.slice(st, st + n) })();
  if (!cut.length) { T(c, 'Nothing left today', x, y + 4, 13, 'm', K.t2); return }
  cut.forEach((i, k) => {
    const yy = y + k * rh, miss = !i.d && i.m < s.m - 15;
    if (i.d) check(c, x, yy, 17, K.t3, new Color('#1c1c1e')); else circle(c, x, yy, 17, miss ? BADC : K.t2, 1.7);
    T(c, i.t, x + 26, yy + 1.5, 12, 'mono', K.t2); const dw = i.dose ? Math.min(90, tws(i.dose, 11, 'm') + 8) : 0;
    T(c, fit(i.n, 13, w - 82 - dw, 's'), x + 70, yy + 1, 13, 's', i.d ? K.t3 : K.t1); if (dw) T(c, fit(i.dose, 11, dw, 'm'), x + w, yy + 2.5, 11, 'm', K.t3, 'r');
  });
}
function dsSmall(c, d, x, y, w, h) {
  const s = doseState(d), nx = s.next[0]; cap(c, 'Next dose', x, y);
  if (!d.items.length) { T(c, 'No doses today', x, y + 26, 14, 'b', K.t2); return }
  if (nx) { T(c, inT(nx.m - s.m), x, y + 18, 12, 's', K.t1); T(c, fit(nx.n, 18, w, 'b'), x, y + 36, 18, 'b'); if (nx.dose) T(c, fit(nx.dose, 11, w, 'm'), x, y + 60, 11, 'm', K.t2) } else T(c, 'All taken', x, y + 26, 18, 'b', GOODC);
  T(c, `${s.taken}/${s.L.length} taken`, x, y + h - 22, 10.5, 's', s.missed.length ? BADC : K.t2); rr(c, x, y + h - 6, w, 6, 3, K.trk2); if (s.taken) rr(c, x, y + h - 6, Math.max(6, w * s.taken / s.L.length), 6, 3, K.t1);
}
const cvDoses = (d, f) => f === 'extraLarge' ? (() => { const { c, W, H, P } = frame(f), lw = 300; dsHead(c, d, P, P, lw, 120, 'l'); { const s = doseState(d), sw = lw / 3; stat(c, s.taken, 'Taken', P, H - P - 40); stat(c, s.next.length, 'To go', P + sw, H - P - 40); stat(c, s.missed.length, 'Missed', P + sw * 2, H - P - 40) } c.setFillColor(K.trk2); c.fillRect(new Rect(P + lw + 16, P, 1, H - 2 * P)); dsList(c, d, P + lw + 32, P + 2, W - P - (P + lw + 32), H - 2 * P, 'x'); return c })()
  : f === 'large' ? (() => { const { c, W, H, P } = frame(f); dsHead(c, d, P, P, W - 2 * P, 110, 'l'); c.setFillColor(K.trk2); c.fillRect(new Rect(P, P + 118, W - 2 * P, 1)); cap(c, 'Today', P, P + 130); dsList(c, d, P, P + 152, W - 2 * P, H - 2 * P - 152, 'l'); return c })()
  : layout(f, d, dsHead, (c, d, x, y, w, h) => dsList(c, d, x, y + 2, w, h, 'm'), dsList, dsSmall);

/* lock-screen content for the four new widgets */
function wScreen(d) { const f = FAM(); if (!acc(f)) return LOCKBG && f === 'small' ? nScreen(d) : done(base('tools'), cvScreen(d, f)); if (d.y == null) return lock({ p: null, v: '–', l: 'screen', lines: ['Screen time', 'No data yet'], inline: 'screen time: no data' }); const df = d.y - d.goal; return lock({ p: Math.min(1, d.y / (d.goal * 1.5)), v: d.y >= 60 ? Math.floor(d.y / 60) + 'h' : Math.round(d.y) + 'm', l: 'screen', lines: [`Screen ${hmS(d.y)}`, `${hmS(Math.abs(df))} ${df > 0 ? 'over' : 'under'} goal`, d.on ? 'Bricked now' : 'Yesterday'], inline: `📱 ${hmS(d.y)} yesterday` }) }
function wGym(d) { const f = FAM(); if (!acc(f)) return LOCKBG && f === 'small' ? nGym(d) : done(base('gym'), cvGym(d, f)); return lock({ p: Math.min(1, d.n / 5), v: String(d.n), l: 'gym', lines: [`${d.n} session${d.n === 1 ? '' : 's'}`, d.last ? d.last.name : 'No workouts yet', d.last ? ago(d.last.date) : ''], inline: `🏋 ${d.n} this week${d.last ? ' · ' + ago(d.last.date).toLowerCase() : ''}` }) }
function wMoney(d) { const f = FAM(); if (!acc(f)) return LOCKBG && f === 'small' ? nMoney(d) : done(base('money'), cvMoney(d, f)); const L = Math.abs(d.left), v = L >= 1000 ? '£' + (L / 1000).toFixed(1) + 'k' : '£' + Math.round(L); return lock({ p: d.tb ? Math.min(1, d.ta / d.tb) : 0, v, l: d.left < 0 ? 'over' : 'left', lines: [`${gbp(d.left)} ${d.left < 0 ? 'over' : 'left'}`, `${gbp(d.ta)} of ${gbp(d.tb)}`, d.month], inline: `£ ${gbp(d.left).slice(1)} ${d.left < 0 ? 'over' : 'left'} this month` }) }
function wDoses(d) { const f = FAM(); if (!acc(f)) return LOCKBG && f === 'small' ? nDoses(d) : done(base('stack'), cvDoses(d, f)); const s = doseState(d), nx = s.next[0]; return lock({ p: s.L.length ? s.taken / s.L.length : 0, v: nx ? nx.t : '✓', l: 'dose', lines: nx ? [nx.n, `${nx.t} · ${inT(nx.m - s.m)}`, `${s.taken}/${s.L.length} taken${s.missed.length ? ` · ${s.missed.length} missed` : ''}`] : ['All doses taken', `${s.taken}/${s.L.length} today`], inline: nx ? `💊 ${nx.t} ${nx.n}` : '💊 all taken' }) }

/* ---------- native small layouts for the iPad lock screen (Parameter "lock"): text and stacks render cleanly there ---------- */
function nBase(url) { const w = base(url); w.backgroundColor = Color.clear(); w.setPadding(14, 16, 14, 16); return w }
function nCap(w, a, b) { const h = w.addStack(); h.centerAlignContent(); sf(h, a.toUpperCase(), Font.semiboldSystemFont(11), GREY); h.addSpacer(); if (b) sf(h, b, Font.semiboldSystemFont(11), WHITE); return h }
function nBig(w, v, unit) { const r = w.addStack(); r.bottomAlignContent(); sf(r, v, Font.heavyRoundedSystemFont(30)); if (unit) { r.addSpacer(4); const t = sf(r, unit, Font.semiboldSystemFont(12), GREY); } return r }
function nBar(w, frac) { const W = 124, b = w.addStack(); b.size = new Size(W, 6); b.cornerRadius = 3; b.backgroundColor = new Color('#ffffff', .22); b.layoutHorizontally(); const f = Math.max(0, Math.min(1, frac || 0)); if (f > 0) { const i = b.addStack(); i.size = new Size(Math.max(6, W * f), 6); i.cornerRadius = 3; i.backgroundColor = Color.white() } b.addSpacer(); return b }
function nSmall(url, cap, capR, big, unit, line1, line2, frac) {
  const w = nBase(url); nCap(w, cap, capR); w.addSpacer(6); nBig(w, big, unit);
  if (line1) sf(w, line1, Font.semiboldSystemFont(12), WHITE, 1); w.addSpacer();
  if (line2) { sf(w, line2, Font.mediumSystemFont(11), GREY, 1); w.addSpacer(5) }
  if (frac != null) nBar(w, frac); return w;
}
const nScreen = d => d.y == null ? nSmall('tools', 'Screen time', '', '–', '', 'No data yet', 'Add it to your morning Shortcut', null)
  : nSmall('tools', 'Screen time', d.on ? 'BRICKED' : '', hmS(d.y), '', `${d.y > d.goal ? '+' : '−'}${hmS(Math.abs(d.y - d.goal))} vs goal`, 'Yesterday', Math.min(1, d.y / (d.goal * 1.5)));
const nGym = d => nSmall('gym', 'Gym', '', String(d.n), 'this week', d.last ? d.last.name : 'No workouts yet', d.last ? ago(d.last.date) : '', Math.min(1, d.n / 5));
const nMoney = d => nSmall('money', `Budget · ${d.month.slice(0, 3)}`, '', gbp(d.left), '', `${d.left < 0 ? 'over' : 'left'} of ${gbp(d.tb)}`, `${gbp(d.ta)} spent`, d.tb ? d.ta / d.tb : 0);
function nDoses(d) { const s = doseState(d), nx = s.next[0]; return nx ? nSmall('stack', 'Next dose', inT(nx.m - s.m), nx.t, '', nx.n, `${s.taken}/${s.L.length} taken${s.missed.length ? ` · ${s.missed.length} missed` : ''}`, s.L.length ? s.taken / s.L.length : 0) : nSmall('stack', 'Doses', '', '✓', '', d.items.length ? 'All taken' : 'No doses today', `${s.taken}/${s.L.length} taken`, 1) }
const nCals = d => nSmall('food', 'Calories', '', Math.abs(d.left).toLocaleString('en-GB'), d.left < 0 ? 'over' : 'left', `${d.eat.toLocaleString('en-GB')} eaten`, `of ${d.allow.toLocaleString('en-GB')}`, d.eat / d.allow);
const nGoal = d => nSmall('gym', 'Next goal', d.left != null ? `${d.left}d` : '', `${d.pct}%`, '', `${d.target}kg ${d.q.replace(/\b\w/g, x => x.toUpperCase())}`, d.best ? `e1RM ${d.best}kg` : 'No sets yet', d.pct / 100);

/* =============================== router =============================== */
function errW(e) { const w = base(''); sf(w, "Dylan's System", Font.semiboldSystemFont(13)); w.addSpacer(4); sf(w, e, Font.systemFont(11), GREY, 4); return w }
async function load(mode, fn) { try { return cache(mode, await fn()) } catch (e) { const c = cache(mode); if (c) return c; throw e } }
async function build(param) {
  const [mode, ...a] = String(param || 'today').split('|').map(s => s.trim()); const m = mode.toLowerCase();
  try {
    if (m === 'screen' || m === 'screentime') return wScreen(await load('screen', dScreen));
    if (m === 'gym') return wGym(await load('gym', dGym));
    if (m === 'money' || m === 'budget') return wMoney(await load('money', dMoney));
    if (m === 'doses' || m === 'dose') return wDoses(await load('doses', dDoses));
    if (m === 'tasks') return wTasks(await load(m, dTasks));
    if (m === 'cals' || m === 'calories' || m === 'food') return wCals(await load('cals', dCals));
    if (m === 'sleep') return wSleep(await load(m, dSleep));
    if (m === 'week' || m === 'cal' || m === 'calendar') return wWeek(await load('week', dWeek));
    if (['habit', 'streak', 'habits'].includes(m) && FAM() === 'extraLarge') return done(base('streaks'), cvYear(await load('year', dYear), 'extraLarge'));
    if (['habit', 'habits'].includes(m) && FAM() === 'large') return done(base('streaks'), cvYearL(await load('year', dYear), 'large'));
    if (m === 'habits') return wHabits(await load('habits', dHabits));
    if (m === 'habit' || m === 'streak') return wHabit(await load('habits', dHabits), a[0], m);
    if (m === 'goal') { if (!a[0] || !a[1]) return errW('Run Next Goal in Scriptable once to set your lift and target'); return wGoal(await load('goal-' + a.join('-'), () => dGoal(a[0], a[1], a[2]))) }
    return await wToday();
  } catch (e) { return errW(e.message) }
}

/* one script per widget type, so the type is picked from Scriptable's Script dropdown */
const TYPES = [['Today', 'today', 'sun.max'], ['Tasks', 'tasks', 'check-circle'], ['Calories', 'cals', 'utensils'], ['Sleep', 'sleep', 'moon'], ['Week', 'week', 'calendar-alt'],
  ['Habits', 'habits', 'tasks'], ['Habit Grid', 'habit', 'th'], ['Streak', 'streak', 'fire'], ['Next Goal', 'goal', 'dumbbell'], ['Screen Time', 'screen', 'mobile-alt'], ['Gym', 'gym', 'running'], ['Budget', 'money', 'pound-sign'], ['Doses', 'doses', 'pills']];
function scriptsDir() {
  try { const ic = FileManager.iCloud(), d = ic.documentsDirectory(); if (ic.fileExists(ic.joinPath(d, Script.name() + '.js'))) return [ic, d] } catch (e) { }
  const lf = FileManager.local(); return [lf, lf.documentsDirectory()];
}
function installScripts() {
  const [fm, dir] = scriptsDir(); let n = 0;
  TYPES.forEach(([name, mode, glyph]) => {
    const body = `// Variables used by Scriptable.\n// These must be at the top of the file. Do not edit.\n// icon-color: deep-gray; icon-glyph: ${glyph};\n// Dylan's System — ${name} widget. Run it here to set it up; add it from the widget's Script list.\nconst fm = FileManager.local(), path = fm.joinPath(fm.documentsDirectory(), 'ds-widget.js');\ntry { const r = new Request('${APP_URL}widget.js?t=' + Date.now()); r.timeoutInterval = 8; const code = await r.loadString(); if (r.response.statusCode === 200 && code.includes('module.exports')) fm.writeString(path, code) } catch (e) { }\nawait importModule(path)('${mode}');\n`;
    const f = fm.joinPath(dir, name + '.js'); if (!fm.fileExists(f) || fm.readString(f) !== body) { fm.writeString(f, body); n++ }
  });
  return n;
}
/* remembered choices for the widgets that need one */
const PICK = m => { const fm = FileManager.local(), f = fm.joinPath(fm.documentsDirectory(), 'ds-pick-' + m + '.txt'); return { get: () => fm.fileExists(f) ? fm.readString(f) : '', set: v => fm.writeString(f, v) } };
async function choose(mode) {
  if (mode === 'habit' || mode === 'streak') {
    const s = await load('habits', dHabits), a = new Alert(); a.title = mode === 'streak' ? 'Which habit’s streak?' : 'Which habit’s grid?';
    s.items.forEach(h => a.addAction(`${h.ic || ''} ${h.n}`.trim())); a.addCancelAction('Cancel');
    const i = await a.presentSheet(); if (i >= 0) PICK(mode).set(mode + '|' + s.items[i].n);
  }
  if (mode === 'goal') {
    const old = (PICK('goal').get() || 'goal|bench|120|').split('|'), a = new Alert(); a.title = 'Next Goal'; a.message = 'Exercise name (as logged), target kg, and an optional deadline.';
    a.addTextField('exercise, e.g. bench', old[1] || ''); a.addTextField('target kg', old[2] || ''); a.addTextField('deadline YYYY-MM-DD (optional)', old[3] || ''); a.addAction('Save'); a.addCancelAction('Cancel');
    if ((await a.present()) === 0) PICK('goal').set(['goal', a.textFieldValue(0).trim(), a.textFieldValue(1).trim(), a.textFieldValue(2).trim()].join('|'));
  }
}
async function preview(p) {
  const w = await build(p), m = String(p).split('|')[0], big = ['week', 'tasks'].includes(m);
  big ? await w.presentLarge() : ['sleep', 'streak', 'goal'].includes(m) ? await w.presentSmall() : await w.presentMedium();
}

module.exports = async function main(mode) {
  const saved = mode ? PICK(mode).get() : '';
  let wp = String(args.widgetParameter || '').trim(); if (/^lock$/i.test(wp)) { LOCKBG = true; wp = '' }
  if (config.runsInWidget) { Script.setWidget(await build(wp || saved || mode)); return Script.complete() }
  await token();
  if (mode) { await choose(mode); await preview(PICK(mode).get() || mode); return Script.complete() }
  /* the System script itself: install/refresh the per-type scripts, then offer previews */
  const n = installScripts();
  const a = new Alert(); a.title = "Dylan's System widgets";
  a.message = (n ? `Added ${TYPES.length} widget scripts: ${TYPES.map(t => t[0]).join(', ')}.\n\n` : '') + 'Add a Scriptable widget, edit it, and pick one of these from the Script list. Leave Parameter empty.';
  TYPES.forEach(t => a.addAction('Preview ' + t[0])); a.addCancelAction('Done');
  const i = await a.presentSheet(); if (i >= 0) { const m = TYPES[i][1]; await choose(m); await preview(PICK(m).get() || m) }
  Script.complete();
};
