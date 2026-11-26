"""Smoke test: build the app, open it in a headless phone-sized browser against fake data,
visit every tab and sub-tab, and fail on any JS error, blank page or sideways overflow.

    python source/test/smoke.py            # build first, then test
    python source/test/smoke.py --no-build # test the existing source/dist

Supabase is mocked with an in-memory kv, so nothing touches the real account.
Needs Playwright once:  pip install playwright  (uses your installed Chrome; otherwise also run: python -m playwright install chromium)
"""
import asyncio, datetime, functools, http.server, json, os, shutil, socket, subprocess, sys, tempfile, threading, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.dirname(HERE)
ROOT = os.path.dirname(SRC)
UID = 'ea7f3c24-4af3-4b0c-a96b-10ea7c85bd40'
# a fake, already-expired-in-2100 session: the app only reads the user id from it
SESS = {'access_token': 'x.eyJzdWIiOiJlYTdmM2MyNC00YWYzLTRiMGMtYTk2Yi0xMGVhN2M4NWJkNDAiLCJleHAiOjQxMDI0NDQ4MDB9.x',
        'token_type': 'bearer', 'expires_in': 3600, 'expires_at': 4102444800, 'refresh_token': 'r',
        'user': {'id': UID, 'aud': 'authenticated', 'role': 'authenticated', 'email': 'test@example.com'}}
# sub-routes on top of every tab in the bottom bar
SUBS = ['journal/mood', 'journal/notes', 'journal/tasks', 'stack/protocols', 'stack/meds',
        'goals/trends', 'goals/review', 'career/applied', 'career/skills', 'career/projects']
KV = {}

def seed():
    """Generic fake data so the new sections have something to render."""
    dk = (datetime.datetime.now() - datetime.timedelta(hours=5)).date()
    d = lambda n: (dk - datetime.timedelta(days=n)).isoformat()
    S = {f'mood/d-{d(i)}': {'in': [{'at': d(i) + 'T13:05:00Z', 'm': 2 + i % 3, 'e': 3, 'tags': []}]} for i in range(1, 15)}
    S['goals/list'] = {'goals': [
        {'id': 'g1', 'name': 'Test lift', 'area': 'Strength', 'src': 'man', 'unit': 'kg', 'start': 100, 'target': 140,
         'from': d(60), 'due': (dk + datetime.timedelta(days=200)).isoformat(), 'status': 'active', 'log': []},
        {'id': 'g2', 'name': 'Test milestones', 'area': 'Career', 'src': 'ms', 'ms': [{'t': 'a', 'done': True}, {'t': 'b'}],
         'from': d(30), 'due': (dk + datetime.timedelta(days=90)).isoformat(), 'status': 'active'}]}
    S['career/apps'] = {'apps': [{'id': 'a1', 'co': 'Example Ltd', 'status': 'applied', 'applied': d(12)},
                                 {'id': 'a2', 'co': 'Sample Co', 'status': 'interview', 'applied': d(0), 'next': {'t': 'Prep', 'due': d(0)}}]}
    S['people/list'] = {'people': [{'id': 'p1', 'name': 'Person A', 'call': 7}, {'id': 'p2', 'name': 'Person B', 'visit': 14}]}
    S['people/log'] = {'log': [{'pid': 'p2', 'kind': 'visit', 'at': d(3) + 'T12:00:00Z', 'day': d(3)}]}
    return S

def kv_route(url, method, body):
    qs = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
    if method == 'GET':
        v = qs.get('path', [''])[0]
        if v.startswith('eq.'):
            return [{'data': KV[v[3:]]}] if v[3:] in KV else []
        if v.startswith('like.'):
            pre = v[5:].replace('\\_', '_').replace('\\%', '%').rstrip('%*')
            return [{'path': k, 'data': KV[k], 'updated_at': '2026-01-01T00:00:00Z'} for k in sorted(KV) if k.startswith(pre)]
        return []
    if method in ('POST', 'PATCH'):
        try:
            rows = json.loads(body or 'null'); rows = rows if isinstance(rows, list) else [rows]
            for r in rows:
                if r and 'path' in r: KV[r['path']] = r.get('data')
        except Exception: pass
    if method == 'DELETE':
        v = qs.get('path', [''])[0]
        if v.startswith('eq.'): KV.pop(v[3:], None)
    return []

def stage_site():
    """The live site is the repo root (data files, config.js) with the fresh build on top."""
    site = tempfile.mkdtemp(prefix='ds-smoke-')
    for f in os.listdir(ROOT):
        p = os.path.join(ROOT, f)
        if f in ('source', '.git', '.claude') or f.startswith('.'): continue
        (shutil.copytree if os.path.isdir(p) else shutil.copy)(p, os.path.join(site, f))
    shutil.copytree(os.path.join(SRC, 'dist'), site, dirs_exist_ok=True)
    return site

def serve(site):
    s = socket.socket(); s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]; s.close()
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    h = functools.partial(Quiet, directory=site)
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', port), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f'http://127.0.0.1:{port}'

async def run(base):
    from playwright.async_api import async_playwright
    KV.clear(); KV.update(seed())
    fails = []
    async with async_playwright() as p:
        try: b = await p.chromium.launch(args=['--no-sandbox'])
        except Exception: b = await p.chromium.launch(channel='chrome', args=['--no-sandbox'])  # use installed Chrome if Playwright's own isn't downloaded
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True,
            user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1')
        async def route(r):
            u = r.request.url
            if u.startswith(base): return await r.continue_()
            if 'supabase.co' in u and '/rest/v1/' in u:
                return await r.fulfill(status=200, content_type='application/json', body=json.dumps(kv_route(u, r.request.method, r.request.post_data)))
            if 'supabase.co' in u: return await r.fulfill(status=200, content_type='application/json', body='{}')
            return await r.abort()  # nothing else leaves the machine
        await ctx.route('**/*', route)
        await ctx.add_init_script(f"localStorage.setItem('ds-auth',{json.dumps(json.dumps(SESS))});")
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append('page error: ' + str(e)[:300]))
        pg.on('console', lambda m: errs.append('console: ' + m.text[:300]) if m.type == 'error' and not any(
            s in m.text for s in ('WebSocket', 'Failed to load resource', 'net::')) else None)
        await pg.goto(base + '/index.html', wait_until='domcontentloaded'); await pg.wait_for_timeout(7000)
        if errs: fails.append(('boot', ' / '.join(errs))); errs.clear()
        tabs = await pg.eval_on_selector_all('#bnav button[data-v]', 'e=>e.map(x=>x.dataset.v)')
        if not tabs: fails.append(('boot', 'no tabs in the bottom bar: the app did not start'))
        for v in tabs + SUBS:
            await pg.evaluate(f"location.hash='#{v}'"); await pg.wait_for_timeout(1300)
            info = await pg.evaluate("""(()=>{const s=[...document.querySelectorAll('section[id^=v-]')].find(x=>getComputedStyle(x).display!=='none');
              return {id:s?s.id:'', text:s?s.innerText.trim().length:0, over:document.documentElement.scrollWidth>innerWidth+1}})()""")
            bad = []
            if errs: bad.append(' / '.join(errs)); errs.clear()
            if not info['id']: bad.append('no section shown')
            elif info['text'] < 20: bad.append('page is blank')
            if info['over']: bad.append('wider than the screen (sideways scroll)')
            print(f"  {'FAIL' if bad else 'ok  '} {v:18} {'; '.join(bad)}")
            if bad: fails.append((v, '; '.join(bad)))
        await b.close()
    return fails

def main():
    if '--no-build' not in sys.argv:
        env = dict(os.environ, PYTHONUTF8='1')
        r = subprocess.run([sys.executable, 'build.py'], cwd=SRC, env=env, capture_output=True, text=True)
        if r.returncode: print(r.stdout[-2000:], r.stderr[-2000:]); sys.exit('build failed')
        print(r.stdout.strip().splitlines()[-1] if r.stdout.strip() else 'built')
    site = stage_site(); srv, base = serve(site)
    try: fails = asyncio.run(run(base))
    finally: srv.shutdown(); shutil.rmtree(site, ignore_errors=True)
    if fails:
        print(f'\nSMOKE TEST FAILED ({len(fails)}):'); [print(f'  {v}: {m}') for v, m in fails]; sys.exit(1)
    print('\nsmoke test passed')

if __name__ == '__main__':
    main()
