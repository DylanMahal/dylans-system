/* ================= BOOT: sign in, then load ================= */
let booted=false,loginBusy=false;
const BFX=(m,p,ok)=>{try{window.BOOTFX&&BOOTFX.step(m,p,ok)}catch(e){}};const BFXdone=m=>{try{window.BOOTFX&&BOOTFX.done(m)}catch(e){}};
function showLogin(msg){BFXdone('auth required · awaiting operator');$('login').hidden=false;document.body.classList.add('locked');$('loginMsg').textContent=msg||'';setTimeout(()=>{const e=$('lEmail');if(e&&!e.value)e.focus()},50)}
function hideLogin(){$('login').hidden=true;document.body.classList.remove('locked')}
$('loginForm').onsubmit=async e=>{e.preventDefault();if(loginBusy)return;loginBusy=true;$('loginMsg').textContent='signing in…';
  try{const {data,error}=await SB.auth.signInWithPassword({email:$('lEmail').value.trim(),password:$('lPass').value});if(error)throw error;$('lPass').value='';await startApp(data.session)}
  catch(err){$('loginMsg').textContent=(err&&err.message)||'Sign-in failed.';const f=$('loginBox');f.animate&&f.animate([{transform:'translateX(-8px)'},{transform:'translateX(8px)'},{transform:'none'}],{duration:260})}
  finally{loginBusy=false}};
async function boot(){
  if(location.hash.startsWith('#wake')){setTimeout(()=>sWakeMode(),50)}
  /* let the boot video get its first frames out before the app does its heavy start-up work */
  if(window.BOOTFX&&BOOTFX.ready)await Promise.race([BOOTFX.ready,new Promise(r=>setTimeout(r,2000))]);
  const cfg=window.APP_CONFIG||{};
  if(!cfg.supabaseUrl||!window.supabase){showLogin('This copy of the app isn\'t connected to its database yet.');return}
  SB=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,storageKey:'ds-auth'}});
  SB.auth.onAuthStateChange((ev)=>{if(ev==='SIGNED_OUT'){R=null;UID=null;showLogin()}});
  BFX('supabase client up',22);
  let session=null;try{session=(await SB.auth.getSession()).data.session}catch(e){}
  if(session)BFX('session '+String(session.user.id).slice(0,8)+' verified',36);
  if(!session){showLogin();return}
  await startApp(session);
}
async function startApp(session){
  UID=session.user.id;R=true;hideLogin();setSync('busy','loading');
  /* keep the animated boot frame on this device, so the boot never depends on a video
     element being allowed to play */
  (async()=>{try{const c=await caches.open('ds-media');
    if(await c.match('bootanim'))return;
    const {data}=await SB.storage.from('vault').createSignedUrl(UID+'/boot/anim.webp',600);
    if(!data||!data.signedUrl)return;
    const r=await fetch(data.signedUrl);if(!r.ok)return;
    await c.put('bootanim',new Response(await r.blob(),{headers:{'content-type':'image/webp'}}))
  }catch(e){}})();
  /* what the boot sequence actually did on this device, so it can be read back from
     any other one — guessing at an iPad's behaviour from a laptop does not work */
  try{const d=localStorage.getItem('ds3:bootdiag');
    if(d){localStorage.removeItem('ds3:bootdiag');
      save('diag/boot',{at:new Date().toISOString(),d:JSON.parse(d)},true)}}catch(e){}
  /* private word list: refresh it, and reload once if it changed so every label uses it */
  try{const lx=await load('sys/lex');if(lx&&JSON.stringify(lx)!==JSON.stringify(LEX)){LEX=lx;applyLex();
      if(!sessionStorage.getItem('ds-lex-'+JSON.stringify(lx).length)){sessionStorage.setItem('ds-lex-'+JSON.stringify(lx).length,1);safeReload()}}}catch(e){}
  await loadEdits();BFX('edit queue synced',48);
  const ok=await loadGridsFromDb(true);BFX(ok?'sheets pulled · stack/money/plan':'sheets: using local cache',ok?66:66,ok?undefined:false);
  $('nodata').hidden=ok||!!GMETA.at;
  try{const [tt,np,ni]=await Promise.all([load('today/titles'),load('today/nopct'),load('push/items')]);TITLES=tt||{};NOPCT=np?{m:{},...np}:{m:{}};if(ni)NITEMS={m:{},...ni}}catch(e){}
  rebuild();booted=true;jNightTask().catch(e=>console.warn(e));if(typeof loadProto==='function')loadProto().catch(()=>{});await Promise.all([loadStackStatus(),loadActuals()]);renderPend();renderStack();renderMoney();renderTargets();
  cur=null;go(location.hash.slice(1)||'today',true);
  BFX('ui compiled · '+(cur||'today'),78);
  await loadDay();await loadTools();loadBody();BFX('day state + tools restored',90);
  startRealtime();startAgentLink();loadArtImages();flushOutbox();
  setSync(ONLINE?'on':'',ONLINE?'synced':'offline');BFX('realtime channel open',96);BFXdone('system ready');setTimeout(cacheBootVideo,600);
  schedWidget();setInterval(()=>{if(!document.hidden)publishWidget()},10*60*1000);setTimeout(()=>{Promise.all([loadHabits(),loadTasks()]).catch(()=>{}).then(()=>{if(typeof pushSync==='function')pushSync()})},4000);document.addEventListener('visibilitychange',()=>{if(!document.hidden&&typeof pushSync==='function'){NQ=null;pushSync()}});
}
function flushOutbox(){try{const ks=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('ds3:outbox:'))ks.push(k.slice(11))}ks.forEach(p=>{const v=LS.get(p);if(v!=null)save(p,v,true);localStorage.removeItem('ds3:outbox:'+p)})}catch(e){}}
let resumeAt=0;
async function refreshAfterResume(){if(!booted)return;/* realtime keeps an open app current; only re-pull after a real break */if(Date.now()-resumeAt<30e3)return;resumeAt=Date.now();await loadGridsFromDb();await loadEdits();rebuild();const p='days/d-'+DAYK;const d=await load(p);if(d){DAY={ticks:{},water:0,msg:{},dw:0,...d};applyTicks();renderTools()}AGENT=await load('agent/status');agentState();const y=scrollY;if(cur==='gym'&&!typingInGym())await loadGym(true);if(cur==='journal'&&jLoaded&&!jDirty){const e=await load(jpath(JDATE));if(e&&stab(e)!==stab(JE)&&document.activeElement!==$('jText')){JE=e;if(!JE.ink)JE.ink={h:PAGE_H,strokes:[]};renderJEditor(true)}}if(Math.abs(scrollY-y)>2)scrollTo(0,y)}
async function signOut(){try{await SB.auth.signOut()}catch(e){}try{Object.keys(localStorage).filter(k=>k.startsWith('ds3:')).forEach(k=>localStorage.removeItem(k))}catch(e){}location.reload()}

/* widget feed: a small summary the iPhone/iPad widgets read */
let widgetT=null;function schedWidget(){clearTimeout(widgetT);widgetT=setTimeout(publishWidget,1500)}
let widgetLast='';
function publishWidget(){if(!R||!booted)return;if(typeof nxWidget==='function')nxWidget();if(!M.plans)return;
  const vis=visibleItems().filter(i=>i.t!==null).sort((a,b)=>a.t-b.t);
  const done=countedItems().filter(i=>DAY.ticks[i.tk]).length,total=countedItems().length,wp=pctOf(countedItems()).p;
  const w={at:new Date().toISOString(),date:DAYK,plan:planKind,pct:wp,done,total,
    items:vis.map(i=>({t:fmtM(i.t),n:i.item,d:!!DAY.ticks[i.tk],c:!!i.cmp})),water:DAY.water||0,waterTarget:(SET&&SET.water)||8,dw:DAY.dw||0,lc:typeof leetWeek==='function'?leetWeek():0,
    habits:habLoaded?hAll().filter(h=>hDue(h,DAYK)).slice(0,12).map(h=>({l:h.n,d:hDone(h,DAYK)})):[]};
  /* doses: today's plan items that match an active Stack entry; budget categories for the money widget */
  const kn=x=>norm(x).replace(/[^a-z0-9]/g,''),SN=(M.stack||[]).filter(x=>x.status!=='paused'&&x.status!=='notinplan'&&kn(x.name).length>=3).map(x=>({k:kn(x.name),dose:x.dose||''}));
  w.doses=vis.map(i=>{const k=kn(i.item),m=SN.find(x=>k.includes(x.k)||(k.length>=4&&x.k.includes(k)));return m?{t:fmtM(i.t),n:i.item,d:!!DAY.ticks[i.tk],dose:String(m.dose||'')}:null}).filter(Boolean);
  w.cats=Object.fromEntries(Object.entries(M.cats||{}).filter(([c])=>c!=='Investment & Savings'&&c!=='Stack'));
  w.money={take:+(M.inc&&M.inc.take)||0,out:+M.out||0,left:+M.left||0,spend:+M.spend||0,save:+M.save||0,cats:M.cats||{}};
  /* only write when something on it changed (stamp the time at most hourly, so the widget can tell it's fresh) */
  if(habLoaded)try{hWidget()}catch(e){}
  const sig=JSON.stringify({...w,at:0}),fresh=Date.now()-(+new Date(widgetAt||0))<36e5;if(sig===widgetLast&&fresh)return;widgetLast=sig;widgetAt=w.at;save('widget/today',w,true)}
let widgetAt=null;

/* installable app: offline cache */
if('serviceWorker' in navigator&&location.protocol==='https:'){
  const hadCtl=!!navigator.serviceWorker.controller;let reloaded=false;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(hadCtl&&!reloaded){reloaded=true;safeReload()}});
  addEventListener('load',()=>navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(r=>{
    const chk=()=>{r.update().catch(()=>{});checkVersion()};document.addEventListener('visibilitychange',()=>{if(!document.hidden)chk()});setInterval(chk,10*60*1000)}).catch(()=>{}));
}
// belt and braces: if the server has a newer build than the one running, reload once
async function checkVersion(){try{const t=await (await fetch('index.html?_='+Date.now(),{cache:'no-store'})).text();const m=t.match(/APP_V="(\d+)"/);
  if(m&&window.APP_V&&m[1]!==window.APP_V&&!sessionStorage.getItem('ds-reloaded-'+m[1])){sessionStorage.setItem('ds-reloaded-'+m[1],'1');if(window.caches){const ks=await caches.keys();await Promise.all(ks.filter(k=>k!=='ds-media').map(k=>caches.delete(k)))}safeReload()}}catch(e){}}
/* never reload under the boot edit: wait until it's finished, then reload with a quick boot (no second play) */
function safeReload(){if(document.getElementById('bootfx')){setTimeout(safeReload,700);return}try{sessionStorage.setItem('ds-quickboot','1')}catch(e){}location.reload()}
if(location.protocol==='https:')setTimeout(checkVersion,1500);
boot();

/* own boot video: lives in private storage (vault/<uid>/boot.mp4); each device keeps a copy in its own cache */
async function cacheBootVideo(){try{if(!window.caches||!SB||!UID)return;
  const {data:list,error:le}=await SB.storage.from('vault').list(UID,{search:'boot.mp4'});if(le||!Array.isArray(list))return; /* a failed check must never wipe the saved edit */
  const f=list.find(x=>x.name==='boot.mp4');const c=await caches.open('ds-media');
  if(!f){if(list.length===0&&LS.get('bootvidRemoved'))await c.delete('bootvid');return}
  const stamp=f.updated_at||f.created_at||String(f.metadata&&f.metadata.size);if(LS.get('bootvidStamp')===stamp&&await c.match('bootvid'))return;
  const {data:blob,error}=await SB.storage.from('vault').download(UID+'/boot.mp4');if(error||!blob)return;
  await c.put('bootvid',new Response(blob,{headers:{'Content-Type':'video/mp4'}}));LS.set('bootvidStamp',stamp);bvStatus()}catch(e){console.warn('boot video',e)}}

/* boot video controls (search menu → "boot video") */
async function bvStatus(){const el=$('bvStat');if(!el)return;try{const c=window.caches?await caches.open('ds-media'):null;const r=c?await c.match('bootvid'):null;
  if(r){const b=await r.blob();el.textContent=`on this device · ${(b.size/1048576).toFixed(1)} MB`}else el.textContent='not on this device yet'}catch(e){el.textContent=''}}
function openBootVideo(){openSheet('boot video',`<p class="dim" style="margin:0 0 10px;font-size:12px">Plays full screen when the app opens. Stored privately in your account; each device keeps its own copy.</p><div class="dim" id="bvStat" style="margin-bottom:10px"></div>
  <div class="bigbtns"><label class="btn p" style="cursor:pointer">Upload new<input type="file" id="bvFile" accept="video/mp4,video/*" hidden></label><button class="btn" type="button" id="bvRefresh">Re-download here</button><button class="btn" type="button" id="bvDel">Remove</button></div>`);bvStatus();
  $('bvFile').onchange=async e=>{const f=e.target.files&&e.target.files[0];e.target.value='';if(!f||!SB||!UID)return;
    if(f.size>50*1048576){$('bvStat').textContent='over 50 MB: trim it first';return}
    $('bvStat').textContent='uploading…';const {error}=await SB.storage.from('vault').upload(UID+'/boot.mp4',f,{upsert:true,contentType:f.type||'video/mp4'});
    if(error){$('bvStat').textContent='upload failed: '+error.message;return}LS.set('bootvidStamp',null);LS.set('bootvidRemoved',null);$('bvStat').textContent='uploaded · saving here…';await cacheBootVideo();flash('boot_video_set')};
  $('bvRefresh').onclick=async()=>{LS.set('bootvidStamp',null);$('bvStat').textContent='downloading…';await cacheBootVideo();bvStatus()};
  $('bvDel').onclick=async()=>{if(!SB||!UID)return;await SB.storage.from('vault').remove([UID+'/boot.mp4']);LS.set('bootvidRemoved',1);if(window.caches){const c=await caches.open('ds-media');await c.delete('bootvid')}LS.set('bootvidStamp',null);bvStatus()}}

/* no pinch / double-tap zoom, like a real app */
document.addEventListener('gesturestart',e=>e.preventDefault());document.addEventListener('touchmove',e=>{if(e.touches.length>1)e.preventDefault()},{passive:false});

/* a desktop opens straight into full screen. browsers only grant that from a gesture, so it
   rides on the very first click or key press — the tap that wakes the boot is enough. */
(function(){const touch=navigator.maxTouchPoints>1;if(touch||innerWidth<901||!document.documentElement.requestFullscreen)return;
  const go=()=>{off();if(!document.fullscreenElement)document.documentElement.requestFullscreen({navigationUI:'hide'}).catch(()=>{})};
  const off=()=>{removeEventListener('pointerdown',go,true);removeEventListener('keydown',go,true)};
  addEventListener('pointerdown',go,true);addEventListener('keydown',go,true)})();

/* one-time: put Journal into the night routine of both plans (deleting it later sticks) */
async function jNightTask(){if(!M||!M.plans||!M.plans.weekday||!M.plans.weekday.length)return;if((await load('today/mig-journal')))return;
  for(const kind of ['weekday','weekend']){const B=M.plans&&M.plans[kind];if(!B||!B.length)continue;
    if(B.some(b=>b.items.some(i=>/journal/i.test(i.item||''))))continue;
    const b=B.find(x=>/night|evening|wind|bed|sleep/i.test(x.title||''))||B[B.length-1];const pre=kind==='weekday'?'wd':'we';
    patch(`${pre}:n:${rid()}`,{time:fmtM(Math.max(b.s,b.e-30)),item:'Journal',type:'Mindset',sched:'Daily',_new:true},{block:b.row,kind})}
  save('today/mig-journal',{at:new Date().toISOString()},true)}
