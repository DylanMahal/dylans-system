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
  const w = new ListWidget(), f = FAM();
  if (f === 'accessoryCircular') {
    w.addAccessoryWidgetBackground = true;
    const c = ctx(60, 60); if (o.p != null) { arc(c, 30, 30, 25, 0, Math.PI * 2, 5, new Color('#ffffff', .25)); arc(c, 30, 30, 25, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, o.p)), 5, Color.white()) }
    text(c, o.v, 0, o.l ? 15 : 20, 60, 20, Font.boldRoundedSystemFont(o.v.length > 3 ? 13 : 16), Color.white(), 'c');
    if (o.l) text(c, o.l, 6, 33, 48, 12, Font.mediumSystemFont(8), Color.white(), 'c');
    w.backgroundImage = c.getImage(); return w
  }
  if (f === 'accessoryInline') { sf(w, o.inline || o.lines[0], Font.mediumSystemFont(12), Color.white()); return w }
  o.lines.slice(0, 3).forEach((l, i) => sf(w, l, i ? Font.systemFont(12) : Font.boldSystemFont(13), Color.white()));
  return w
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
  else { c.setStrokeColor(od ? RED : new Color('#d1d1d6')); c.setLineWidth(1.8); c.strokeEllipse(new Rect(2, 2, 18, 18)) }
  return c.getImage();
}
function wTasks(d) {
  const f = FAM();
  if (acc(f)) return lock({ p: null, v: String(d.open), l: 'tasks', lines: [`${d.open} task${d.open === 1 ? '' : 's'} left`, ...d.items.filter(i => !i.done).slice(0, 2).map(i => i.n)], inline: d.open ? `${d.open} left · ${d.items[0].n}` : 'tasks clear' });
  const w = base('journal'), max = { small: 4, medium: 5, large: 11 }[f] || 5, fs = f === 'small' ? 13 : 15;
  w.setPadding(f === 'small' ? 12 : 14, 18, 12, 18);
  if (!d.items.length) { w.addSpacer(); sf(w, 'All clear', Font.semiboldSystemFont(17)); sf(w, 'nothing due today', Font.systemFont(12), GREY); w.addSpacer(); return w }
  d.items.slice(0, max).forEach((t, i) => {
    if (i) w.addSpacer(f === 'large' ? 11 : 8);
    const r = w.addStack(); r.centerAlignContent(); pic(r, circ(t.done, t.od), fs + 4, fs + 4); r.addSpacer(10);
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
function gaugeImg(d, s) {
  const c = ctx(s, s), cx = s / 2, cy = s / 2, w = s * .085, r = s / 2 - w / 2 - s * .04, a0 = Math.PI * .75, span = Math.PI * 1.5;
  arc(c, cx, cy, r, a0, a0 + span, w, TRK);
  const fr = Math.min(1, d.eat / d.allow);
  if (fr > 0) arc(c, cx, cy, r, a0, a0 + span * fr, w, d.left < 0 ? RED : new Color('#d1d1d6'));
  /* marker where today stands, sitting just outside the arc */
  const a = a0 + span * fr, r0 = r - w / 2 + 1, r1 = r + w / 2 + s * .035, p = new Path();
  p.move(new Point(cx + r0 * Math.cos(a), cy + r0 * Math.sin(a))); p.addLine(new Point(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a)));
  c.addPath(p); c.setStrokeColor(new Color('#e5e5ea')); c.setLineWidth(s * .022); c.strokePath();
  return c.getImage();
}
function dayBar(x) {
  const W = 40, H = 200, c = ctx(W, H), line = H * .2;
  rr(c, 0, 0, W, H, 9, TRK);
  if (x.eat > 0) {
    const fr = x.eat / x.allow, fh = Math.min(H, (H - line) * fr);
    rr(c, 0, H - fh, W, fh, 9, new Color('#8e8e93'));
    if (fr > 1) { const oh = Math.min(fh, (H - line) * (fr - 1)); rr(c, 0, H - fh, W, oh, 9, RED) }
  }
  c.setFillColor(new Color('#d1d1d6')); c.fillRect(new Rect(3, line - 2, W - 6, 4));
  return c.getImage();
}
function capLine(st, num, word) { const r = st.addStack(); r.centerAlignContent(); lbl(r, num, 13, 'b', T2); lbl(r, ' ' + word, 13, 'm', T2); return r }
function gaugeBox(st, d, s) {
  const b = st.addStack(); b.size = new Size(s, s); b.backgroundImage = gaugeImg(d, s); b.layoutVertically(); b.addSpacer();
  centred(b, x => lbl(x, Math.abs(d.left).toLocaleString('en-GB'), s * .2, 'rh', d.left < 0 ? RED : new Color('#d1d1d6')));
  centred(b, x => lbl(x, d.left < 0 ? 'OVER' : 'UNDER', s * .095, 's', T2));
  b.addSpacer(); return b;
}
function wCals(d) {
  const f = FAM();
  if (acc(f)) return lock({ p: d.eat / d.allow, v: Math.abs(d.left) >= 1000 ? (Math.abs(d.left) / 1000).toFixed(1) + 'k' : String(Math.abs(d.left)), l: d.left < 0 ? 'over' : 'left', lines: [`${Math.abs(d.left)} kcal ${d.left < 0 ? 'over' : 'left'}`, `${d.eat} eaten of ${d.allow}`], inline: `${Math.abs(d.left)} kcal ${d.left < 0 ? 'over' : 'left'}` });
  const w = base('food');
  if (f === 'small') { w.setPadding(12, 12, 12, 12); centred(w, x => gaugeBox(x, d, 112)); w.addSpacer(); centred(w, x => capLine(x, d.eat.toLocaleString('en-GB'), 'CALS')); return w }
  w.setPadding(14, 16, 12, 18);
  const row = w.addStack(); row.centerAlignContent();
  const L = row.addStack(); L.layoutVertically(); gaugeBox(L, d, 112); L.addSpacer(4); centred(L, x => capLine(x, d.eat.toLocaleString('en-GB'), 'CALS'));
  row.addSpacer(18);
  const R = row.addStack(); R.layoutVertically();
  const bars = R.addStack(); const N = ['M', 'Tu', 'W', 'Th', 'F', 'Sa', 'Su'];
  d.D.forEach((x, i) => {
    if (i) bars.addSpacer();
    const col = bars.addStack(); col.layoutVertically(); col.size = new Size(26, 0);
    centred(col, y => pic(y, dayBar(x), 20, 100)); col.addSpacer(5);
    centred(col, y => lbl(y, N[i], 12, x.k === d.k ? 'b' : 'r', x.k === d.k ? T1 : T2));
  });
  R.addSpacer(8);
  centred(R, x => capLine(x, Math.abs(d.prior).toLocaleString('en-GB'), (d.prior > 0 ? 'OVER' : 'UNDER') + ' PRIOR TO TODAY'));
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
  return { score: sScore(n, S), asleep: n.asleep, goal: S.goal * 60, start: n.start, end: n.end, deep: n.deep || 0, rem: n.rem || 0, core: n.core || 0, awake: n.awake || 0, old: !o['sleep/w-' + t] };
}
const sCol = s => new Color(s >= 80 ? '#57f5a8' : s >= 60 ? '#ffb000' : '#ff453a');
function wSleep(d) {
  const f = FAM();
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
    rr(c, wk * (cell + gap), dy * (cell + gap), cell, cell, cell * .28, ch === '1' ? on : ch === '0' ? new Color('#2a2a2c') : ch === 'f' ? new Color('#191919') : new Color('#202022'));
  }
  return c.getImage();
}
function iconBox(stack, ic, s) { const b = stack.addStack(); b.size = new Size(s, s); b.cornerRadius = s * .26; b.backgroundColor = new Color('#2a2a2c'); b.centerAlignContent(); sf(b, ic || '✓', Font.systemFont(s * .5)); return b }
const unitW = h => h.unit === 'wk' ? 'week' : 'day';
function wHabit(s, q, mode) {
  const h = pickHabit(s, q), f = FAM();
  if (!h) { const w = base('streaks'); sf(w, 'No habits yet', Font.systemFont(13), GREY); return w }
  if (acc(f)) return lock({ p: h.t ? Math.min(1, h.c / h.t) : 0, v: String(h.streak), l: h.ic || unitW(h), lines: [`${h.ic || ''} ${h.n}`, `${h.streak} ${unitW(h)} streak`, h.done ? 'done today' : h.due ? `${h.c}/${h.t} today` : 'rest day'], inline: `${h.ic || ''} ${h.n} · ${h.streak}${h.unit === 'wk' ? 'w' : 'd'}${h.done ? ' ✓' : ''}` });
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
    w.setPadding(14, 14, 14, 14);
    const t = w.addStack(); t.centerAlignContent(); iconBox(t, h.ic, 30); t.addSpacer(8); sf(t, h.n, Font.mediumSystemFont(15), GREY);
    w.addSpacer(); const g = w.addStack(); g.addSpacer(); pic(g, grid(h, 11, 9, 2.5), 11 * 11.5 - 2.5, 7 * 11.5 - 2.5); g.addSpacer();
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
  const f = FAM(), L = s.items.filter(h => h.due), done = L.filter(h => h.done).length;
  if (acc(f)) return lock({ p: L.length ? done / L.length : 0, v: `${done}/${L.length}`, l: 'habits', lines: [`Habits ${done}/${L.length}`, L.filter(h => !h.done).slice(0, 2).map(h => `${h.ic || ''} ${h.n}`).join('  ')], inline: `habits ${done}/${L.length}` });
  const w = base('streaks'), left = L.filter(h => !h.done), order = [...left, ...L.filter(h => h.done)];
  if (f === 'small') {
    const h = w.addStack(); lbl(h, 'HABITS', 11, 's', T2); h.addSpacer();
    w.addSpacer(); const b = centred(w, x => { const rb = ringBox(x, 84, L.length ? done / L.length : 0, GOOD, 8); centred(rb, y => lbl(y, done, 22, 'rb')); centred(rb, y => lbl(y, `of ${L.length}`, 10, 'm', T2)) });
    w.addSpacer(); if (left[0]) lbl(w, `Next: ${left[0].n}`, 12, 's', T2); return w;
  }
  const h = w.addStack(); h.centerAlignContent(); lbl(h, 'Habits', 15, 's'); h.addSpacer(); lbl(h, `${done} of ${L.length}`, 13, 's', T2);
  w.addSpacer(6); const pb = w.addStack(); hbar(pb, L.length ? done / L.length : 0, GOOD);
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
  const days = [...Array(7)].map((_, i) => addD(mon, i)).map(key => {
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
  const w = base('gym'); w.setPadding(16, 16, 14, 16);
  const g = new LinearGradient(); g.colors = [new Color('#0b0b0b'), new Color('#120604'), new Color('#7a2412')]; g.locations = [0, .55, 1]; w.backgroundGradient = g;
  sf(w, 'Next Goal', new Font('Baskerville-Italic', f === 'small' ? 19 : 22), new Color('#c9c9c9'));
  w.addSpacer(4); sf(w, `${d.target}kg ${name}`, Font.semiboldSystemFont(f === 'small' ? 17 : 22), WHITE);
  if (f !== 'small') { w.addSpacer(2); sf(w, d.best ? `best ${d.bestKg}kg × ${d.bestR} · e1RM ${d.best}kg` : 'no sets logged yet', Font.systemFont(11), GREY) }
  w.addSpacer();
  const gb = w.addStack(); { const c = ctx(600, 10); rr(c, 0, 0, 600, 10, 5, new Color('#ffffff', .15)); if (d.pct) rr(c, 0, 0, Math.max(10, 6 * d.pct), 10, 5, WHITE); const i = gb.addImage(c.getImage()); i.resizable = true }
  w.addSpacer(8);
  const b = w.addStack(); b.centerAlignContent(); sf(b, `${d.pct}%`, Font.semiboldSystemFont(f === 'small' ? 15 : 17), WHITE); b.addSpacer();
  if (d.left != null) sf(b, d.left >= 0 ? `${d.left} DAYS LEFT` : `${-d.left} DAYS OVER`, Font.semiboldSystemFont(9), GREY);
  return w;
}

/* =============================== router =============================== */
function errW(e) { const w = base(''); sf(w, "Dylan's System", Font.semiboldSystemFont(13)); w.addSpacer(4); sf(w, e, Font.systemFont(11), GREY, 4); return w }
async function load(mode, fn) { try { return cache(mode, await fn()) } catch (e) { const c = cache(mode); if (c) return c; throw e } }
async function build(param) {
  const [mode, ...a] = String(param || 'today').split('|').map(s => s.trim()); const m = mode.toLowerCase();
  try {
    if (m === 'tasks') return wTasks(await load(m, dTasks));
    if (m === 'cals' || m === 'calories' || m === 'food') return wCals(await load('cals', dCals));
    if (m === 'sleep') return wSleep(await load(m, dSleep));
    if (m === 'week' || m === 'cal' || m === 'calendar') return wWeek(await load('week', dWeek));
    if (m === 'habits') return wHabits(await load('habits', dHabits));
    if (m === 'habit' || m === 'streak') return wHabit(await load('habits', dHabits), a[0], m);
    if (m === 'goal') { if (!a[0] || !a[1]) return errW('Set the parameter like goal|bench|120|2027-01-19'); return wGoal(await load('goal-' + a.join('-'), () => dGoal(a[0], a[1], a[2]))) }
    return await wToday();
  } catch (e) { return errW(e.message) }
}

module.exports = async function main() {
  let p = args.widgetParameter;
  if (!config.runsInWidget) {
    /* run inside Scriptable: sign in if needed, then preview any widget */
    await token();
    const opts = ['today', 'tasks', 'cals', 'sleep', 'week', 'habits', 'habit', 'streak', 'goal|bench|120'];
    const a = new Alert(); a.title = 'Preview widget'; opts.forEach(o => a.addAction(o)); a.addCancelAction('Done');
    const i = await a.presentSheet(); if (i === -1) return Script.complete(); p = opts[i];
    const w = await build(p), big = ['week', 'tasks'].includes(p);
    big ? await w.presentLarge() : p === 'sleep' || p === 'streak' || p.startsWith('goal') ? await w.presentSmall() : await w.presentMedium();
    return Script.complete();
  }
  Script.setWidget(await build(p)); Script.complete();
};
