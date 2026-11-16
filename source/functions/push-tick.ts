// Sends due web-push notifications from each user's kv "push/q" queue. Called every 15 s by pg_cron.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
let cfg: Record<string, string> | null = null;
async function C() {
  if (cfg) return cfg;
  const { data } = await sb.from('private_cfg').select('k,v');
  cfg = Object.fromEntries((data || []).map((r: any) => [r.k, r.v]));
  webpush.setVapidDetails('mailto:noreply@dylans-system.app', cfg.vapid_pub, cfg.vapid_priv);
  return cfg;
}
Deno.serve(async (req) => {
  const c = await C();
  if (req.headers.get('x-cron') !== c.cron_secret) return new Response('no', { status: 401 });
  const now = Date.now();
  const { data: qs } = await sb.from('kv').select('user_id,data').eq('path', 'push/q');
  let sent = 0;
  for (const row of qs || []) {
    const items: any[] = (row.data && row.data.items) || [];
    const due = items.filter((i) => new Date(i.at).getTime() <= now);
    if (!due.length) continue;
    const { data: subRow } = await sb.from('kv').select('data').eq('user_id', row.user_id).eq('path', 'push/subs').maybeSingle();
    const subs: any[] = (subRow && subRow.data && subRow.data.list) || [];
    const dead = new Set<string>();
    for (const it of due) {
      if (now - new Date(it.at).getTime() > 20 * 60e3) continue; // too late to be useful
      for (const s of subs) {
        try {
          await webpush.sendNotification(s.sub, JSON.stringify({ title: it.title, body: it.body || '', tag: it.tag || '', url: it.url || './' }), { TTL: 900, urgency: 'high' });
          sent++;
        } catch (e: any) { if (e && (e.statusCode === 404 || e.statusCode === 410)) dead.add(s.sub.endpoint); }
      }
    }
    // re-read so we don't clobber items the app added in the meantime
    const { data: fresh } = await sb.from('kv').select('data').eq('user_id', row.user_id).eq('path', 'push/q').maybeSingle();
    const ids = new Set(due.map((d) => d.id));
    const left = ((fresh && fresh.data && fresh.data.items) || []).filter((i: any) => !ids.has(i.id));
    await sb.from('kv').update({ data: { items: left }, updated_at: new Date().toISOString() }).eq('user_id', row.user_id).eq('path', 'push/q');
    if (dead.size) await sb.from('kv').update({ data: { list: subs.filter((s) => !dead.has(s.sub.endpoint)) }, updated_at: new Date().toISOString() }).eq('user_id', row.user_id).eq('path', 'push/subs');
  }
  return new Response(JSON.stringify({ sent }), { headers: { 'Content-Type': 'application/json' } });
});
