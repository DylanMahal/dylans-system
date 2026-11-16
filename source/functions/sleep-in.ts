// Receives last night's Apple Health sleep samples from an iPhone Shortcut and stores them for the app.
// Body: plain text or JSON {data:"..."}; one sample per line: start|end|value  (dates in ISO 8601)
import { createClient } from 'npm:@supabase/supabase-js@2';
const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const stage = (v: string) => /deep/i.test(v) ? 'deep' : /rem/i.test(v) ? 'rem' : /awake/i.test(v) ? 'awake' : /in ?bed/i.test(v) ? 'inbed' : 'core';
Deno.serve(async (req) => {
  const { data: cf } = await sb.from('private_cfg').select('k,v');
  const cfg = Object.fromEntries((cf || []).map((r: any) => [r.k, r.v]));
  const tok = req.headers.get('x-token') || new URL(req.url).searchParams.get('token');
  if (tok !== cfg.sleep_token) return new Response('no', { status: 401 });
  let raw = await req.text();
  try { const j = JSON.parse(raw); raw = j.data ?? j.text ?? raw; if (Array.isArray(raw)) raw = raw.join('\n'); } catch (_) {}
  const lines = String(raw).split(/\n|;;/).map((l) => l.trim()).filter(Boolean);
  const metrics: Record<string, number> = {};
  for (const l of lines) { const p = l.split('|').map((x) => x.trim()); if (p.length === 2) { const k = p[0].toLowerCase().replace(/[^a-z]/g, ''); const v = parseFloat(p[1].replace(',', '.')); if (!isNaN(v)) metrics[k === 'heartratevariability' ? 'hrv' : k === 'restingheartrate' ? 'rhr' : k === 'respiratoryrate' ? 'rr' : k === 'activeenergy' ? 'kcal' : k] = v; } }
  const segs = String(raw).split(/\n|;;/).map((l) => l.trim()).filter(Boolean).map((l) => l.split('|').map((x) => x.trim()))
    .map(([s, e, v]) => [new Date(s), new Date(e), stage(v || '')] as [Date, Date, string]).filter(([s, e]) => !isNaN(+s) && !isNaN(+e) && e > s);
  if (!segs.length && !Object.keys(metrics).length) return new Response(JSON.stringify({ ok: false, why: 'no samples parsed', got: String(raw).slice(0, 200) }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  if (Object.keys(metrics).length) {
    const key = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
    const { data: prev } = await sb.from('kv').select('data').eq('user_id', cfg.owner_uid).eq('path', 'health/d-' + key).maybeSingle();
    await sb.from('kv').upsert({ user_id: cfg.owner_uid, path: 'health/d-' + key, data: { ...((prev && prev.data) || {}), ...metrics, at: new Date().toISOString() }, updated_at: new Date().toISOString() });
  }
  segs.sort((a, b) => +a[0] - +b[0]);
  // nights: split where there's a gap of more than 4 hours
  const nights: [Date, Date, string][][] = [];
  for (const s of segs) { const last = nights[nights.length - 1]; if (!last || +s[0] - Math.max(...last.map((x) => +x[1])) > 4 * 36e5) nights.push([s]); else last.push(s); }
  const out = [];
  for (const n of nights) {
    const end = new Date(Math.max(...n.map((x) => +x[1]))), start = new Date(Math.min(...n.map((x) => +x[0])));
    const key = end.toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
    const mins: Record<string, number> = { deep: 0, rem: 0, core: 0, awake: 0 };
    // count each minute once, preferring the most specific stage (watch over phone)
    const pri: Record<string, number> = { deep: 4, rem: 3, core: 2, awake: 5, inbed: 0 };
    const by = new Map<number, string>();
    for (const [s, e, st] of n) for (let t = Math.floor(+s / 60e3); t < Math.floor(+e / 60e3); t++) { const c = by.get(t); if (!c || pri[st] > pri[c]) by.set(t, st); }
    for (const st of by.values()) if (st in mins) mins[st]++;
    const asleep = mins.deep + mins.rem + mins.core;
    const doc = { src: 'watch', start: start.toISOString(), end: end.toISOString(), inBed: Math.round((+end - +start) / 6e4), asleep, ...mins,
      segs: n.filter((x) => x[2] !== 'inbed').map(([s, e, st]) => [s.toISOString(), e.toISOString(), st]), at: new Date().toISOString() };
    const { data: prev } = await sb.from('kv').select('data').eq('user_id', cfg.owner_uid).eq('path', 'sleep/w-' + key).maybeSingle();
    const keep = prev && prev.data ? { mood: prev.data.mood ?? null, tags: prev.data.tags || [], note: prev.data.note || '' } : { mood: null, tags: [], note: '' };
    await sb.from('kv').upsert({ user_id: cfg.owner_uid, path: 'sleep/w-' + key, data: { ...doc, ...keep }, updated_at: new Date().toISOString() });
    out.push({ key, asleep, deep: mins.deep, rem: mins.rem });
  }
  return new Response(JSON.stringify({ ok: true, nights: out, metrics }), { headers: { 'Content-Type': 'application/json' } });
});
