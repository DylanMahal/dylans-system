// Offline cache for the app shell. Data always comes from Supabase (or the local cache in the page).
const CACHE='system-1794601561';
const SHELL=['./','index.html','app.css?v=1794601561','app.js?v=1794601561','config.js?v=1794601561','vendor/supabase.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE&&k!=='ds-media').map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET')return;
  if(u.hostname.endsWith('supabase.co'))return; // never cache data or auth
  if(u.origin===location.origin){
    const isPage=e.request.mode==='navigate'||u.pathname.endsWith('/')||u.pathname.endsWith('.html')||u.pathname.endsWith('sw.js')||u.pathname.endsWith('.webmanifest');
    if(isPage){ // network first: always get the newest app when online
      e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{if(r.ok){const cp=r.clone();caches.open(CACHE).then(c=>c.put(e.request,cp))}return r}).catch(()=>caches.match(e.request,{ignoreSearch:true}).then(h=>h||caches.match('index.html'))));return}
    // versioned assets: cache first (their URL changes on every release)
    e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{if(r.ok){const cp=r.clone();caches.open(CACHE).then(c=>c.put(e.request,cp))}return r})));return}
  if(u.hostname==='cdn.jsdelivr.net'&&u.pathname.includes('free-exercise-db')){e.respondWith(caches.open('ds-media').then(c=>c.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{if(r.ok||r.type==='opaque')c.put(e.request,r.clone());return r}))));return}
  if(u.hostname.includes('fonts.g')){e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{const cp=r.clone();caches.open(CACHE).then(c=>c.put(e.request,cp));return r})))}
});
