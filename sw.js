// Offline cache for the app shell. Data always comes from Supabase (or the local cache in the page).
const CACHE='system-1795349452';
const SHELL=['./','index.html','app.css?v=1795349452','app.js?v=1795349452','config.js?v=1795349452','vendor/supabase.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE&&k!=='ds-media').map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET')return;
  if(u.hostname.endsWith('supabase.co')){
    // private vault media: keep one copy per file on this device. Signed URLs carry a fresh token
    // each time, so the key is the path alone. Data, auth and everything else go straight through.
    if(u.pathname.includes('/storage/v1/object/sign/vault/'))e.respondWith(vaultMedia(e.request,u));
    return}
  if(u.origin===location.origin){
    const isPage=e.request.mode==='navigate'||u.pathname.endsWith('/')||u.pathname.endsWith('.html')||u.pathname.endsWith('sw.js')||u.pathname.endsWith('.webmanifest');
    if(isPage){ // network first: always get the newest app when online
      e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{if(r.ok){const cp=r.clone();caches.open(CACHE).then(c=>c.put(e.request,cp))}return r}).catch(()=>caches.match(e.request,{ignoreSearch:true}).then(h=>h||caches.match('index.html'))));return}
    // versioned assets: cache first (their URL changes on every release)
    e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{if(r.ok){const cp=r.clone();caches.open(CACHE).then(c=>c.put(e.request,cp))}return r})));return}
  if(u.hostname==='cdn.jsdelivr.net'&&u.pathname.includes('free-exercise-db')){e.respondWith(caches.open('ds-media').then(c=>c.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{if(r.ok||r.type==='opaque')c.put(e.request,r.clone());return r}))));return}
  if(u.hostname.includes('fonts.g')){e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{const cp=r.clone();caches.open(CACHE).then(c=>c.put(e.request,cp));return r})))}
});
// web push: show it, and open/focus the app when tapped
self.addEventListener('push',e=>{let d={};try{d=e.data?e.data.json():{}}catch(x){d={title:'dylan@system',body:e.data&&e.data.text()}}
  e.waitUntil(self.registration.showNotification(d.title||'dylan@system',{body:d.body||'',tag:d.tag||undefined,renotify:!!d.tag,icon:'icons/icon-192.png',badge:'icons/icon-192.png',data:{url:d.url||'./'}}))});
self.addEventListener('notificationclick',e=>{e.notification.close();const url=new URL((e.notification.data&&e.notification.data.url)||'./',self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{for(const c of cs){if('focus' in c){c.navigate&&c.navigate(url).catch(()=>{});return c.focus()}}return self.clients.openWindow(url)}))});

// ---- vault media cache (cache-first, with byte ranges for video) ----
const VKEY=u=>u.origin+u.pathname;
const vInflight=new Map();
async function vaultFull(req,u){const c=await caches.open('ds-media');const key=VKEY(u);
  const hit=await c.match(key);if(hit)return hit;
  if(vInflight.has(key))return (await vInflight.get(key)).clone();
  const p=(async()=>{const r=await fetch(u.href,{mode:'cors',credentials:'omit'});
    if(!r.ok)return r;
    const blob=await r.blob();
    const res=new Response(blob,{status:200,headers:{'Content-Type':r.headers.get('Content-Type')||blob.type||'application/octet-stream','Content-Length':String(blob.size),'Accept-Ranges':'bytes'}});
    await c.put(key,res.clone());return res})();
  vInflight.set(key,p);try{return (await p).clone()}finally{vInflight.delete(key)}}
async function vaultMedia(req,u){
  try{const full=await vaultFull(req,u);if(!full.ok)return full;
    const range=req.headers.get('Range');if(!range)return full;
    const m=/bytes=(\d*)-(\d*)/.exec(range);if(!m)return full;
    const blob=await full.blob(),size=blob.size;
    let start=m[1]===''?Math.max(0,size-(+m[2]||0)):+m[1];let end=m[1]===''||m[2]===''?size-1:Math.min(+m[2],size-1);
    if(start>=size||start>end)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});
    return new Response(blob.slice(start,end+1),{status:206,statusText:'Partial Content',headers:{
      'Content-Type':full.headers.get('Content-Type')||'application/octet-stream','Content-Range':`bytes ${start}-${end}/${size}`,
      'Content-Length':String(end-start+1),'Accept-Ranges':'bytes'}})}
  catch(err){return fetch(req)}}
