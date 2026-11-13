// Offline cache for the app shell. Data always comes from Supabase (or the local cache in the page).
const CACHE='system-1794588650';
const SHELL=['./','index.html','app.css?v=1794588650','app.js?v=1794588650','config.js?v=1794588650','vendor/supabase.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET')return;
  if(u.hostname.endsWith('supabase.co'))return; // never cache data or auth
  if(u.origin===location.origin){e.respondWith(caches.match(e.request,{ignoreSearch:u.pathname.endsWith('/')||u.pathname.endsWith('index.html')}).then(hit=>{const net=fetch(e.request).then(r=>{if(r.ok){const cp=r.clone();caches.open(CACHE).then(c=>c.put(e.request,cp))}return r}).catch(()=>hit);return hit||net}));return}
  if(u.hostname.includes('fonts.g')){e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{const cp=r.clone();caches.open(CACHE).then(c=>c.put(e.request,cp));return r})))}
});
