/* ================= NOTIFICATIONS (web push) =================
   The app keeps a queue of upcoming notifications in kv "push/q"; a Supabase cron (every 15 s) sends whatever is due
   to this device's push subscription ("push/subs"), even when the app is closed. Works on iPhone/iPad for the home-screen app. */
const VAPID_PUB='BHHSvXm_9iKVpSZSPkmn2jm_1IiM9rzT5cFtPdOzmpNn6cwQzidSZYJKVYc-p7bYgeisTYvVWIsYmOAW-fGhwoU';
const NKINDS=[['plan','plan blocks','when each block of your day starts'],['dose','doses','protocol doses at their times'],['rest','gym rest timer','when rest is over, even if you left the app'],['focus','focus timer','when a focus session ends'],['fast','fasting','when you hit your fasting goal'],['bed','bedtime','30 min before your sleep time'],['cal','calendar events','10 min before each event (or what you set on the event)'],['mood','mood check-ins','13:00 and 21:30, unless you already checked in'],['peak','peak check-ins','when a med should be working best'],['review','monthly review','last Sunday of the month at 19:00']];
let NSET=LS.get('notify')||{on:false,k:{plan:true,dose:true,rest:true,focus:true,fast:true,bed:true,leet:true,water:false}};
if(NSET.k&&NSET.k.cal==null)NSET.k.cal=true;['mood','peak','people','review'].forEach(k=>{if(NSET.k&&NSET.k[k]==null)NSET.k[k]=true});
const nOn=k=>NSET.on&&NSET.k[k];
function b64u(s){const p='='.repeat((4-s.length%4)%4);const b=atob((s+p).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from([...b].map(c=>c.charCodeAt(0)))}
async function nSubscribe(){if(!('serviceWorker' in navigator)||!('PushManager' in window))return 'This device can\'t do web notifications here. On iPhone/iPad they work in the home-screen app (iOS 16.4+).';
  const p=await Notification.requestPermission();if(p!=='granted')return 'Notifications are blocked, allow them in Settings → Notifications → Dylan\'s System.';
  const reg=await navigator.serviceWorker.ready;let sub=await reg.pushManager.getSubscription();if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u(VAPID_PUB)});
  const cur=(await load('push/subs'))||{list:[]};const j=sub.toJSON();const dev=/iPad/.test(navigator.userAgent)||(/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1)?'iPad':/iPhone/.test(navigator.userAgent)?'iPhone':/Windows/.test(navigator.userAgent)?'laptop':'device';
  cur.list=(cur.list||[]).filter(s=>s.sub.endpoint!==j.endpoint&&(dev==='device'||s.dev!==dev)).concat({sub:j,dev,at:new Date().toISOString()});save('push/subs',cur,true);NSET.on=true;LS.set('notify',NSET);pushSync();return null}
/* queue */
let NQ=null;
async function nQueue(){if(NQ)return NQ;NQ=(await load('push/q'))||{items:[]};return NQ}
async function pushOne(tag,at,title,body,url){if(!NSET.on)return;const q=await nQueue();q.items=q.items.filter(i=>i.tag!==tag);if(at&&at>Date.now()+3000)q.items.push({id:rid()+rid(),tag,at:new Date(at).toISOString(),title,body:'',url:url||'./'});save('push/q',q,true)}
/* notification copy: title only, no body. Minimal by design (Dylan's call). */
const nT=t=>{t=String(t||'').replace(/\s+/g,' ').trim();return t?t[0].toUpperCase()+t.slice(1):''};
const nClock=m=>{const h=Math.floor(m/60)%24;return (h%12||12)+':'+pad(m%60)+(h<12?' am':' pm')};
const nRange=(a,b)=>nClock(a).replace(/ (am|pm)$/,nClock(a).slice(-2)===nClock(b).slice(-2)?'':' $1')+' – '+nClock(b);
const nLead=m=>!m?'Now':m>=60?'In '+(m/60)+' hr':'In '+m+' min';
const nJoin=(...a)=>a.filter(Boolean).map(String).map(x=>x.trim()).filter(Boolean).join(' · ');
async function pushCancel(tag){if(!NSET.on)return;const q=await nQueue();const n=q.items.length;q.items=q.items.filter(i=>i.tag!==tag);if(q.items.length!==n)save('push/q',q,true)}
/* self-repair: if this device thinks it's on but its subscription is missing from push/subs (Apple expired it and push-tick dropped it), register it again silently */
let NHEALED=false;
async function nHeal(){if(NHEALED||!NSET.on||typeof Notification==='undefined'||Notification.permission!=='granted'||!('serviceWorker' in navigator)||!('PushManager' in window))return;NHEALED=true;
  try{const reg=await navigator.serviceWorker.ready;const sub=await reg.pushManager.getSubscription();const cur=(await load('push/subs'))||{list:[]};const me=(cur.list||[]).find(s=>s.sub.endpoint===(sub&&sub.endpoint));if(me&&!(cur.list||[]).some(s=>s!==me&&s.dev===me.dev&&me.dev!=='device'))return;await nSubscribe()}catch(e){NHEALED=false}}
async function pushSync(){if(!NSET.on)return;nHeal();const q=await nQueue();const now=Date.now(),H=now+36*36e5;const keep=q.items.filter(i=>!/^(plan|item|dose|bed|leet|water|habit|task|cal|mood|ppl|rev):/.test(i.tag)&&new Date(i.at)>now-60e3);const add=[];
  const push=(tag,at,title,body,url)=>{if(at>now+5000&&at<H)add.push({id:rid()+rid(),tag,at:new Date(at).toISOString(),title,body:body||'',url:url||'./'})};
  const days=[DAYK,ymd(new Date(new Date(DAYK+'T12:00').getTime()+864e5))];
  days.forEach((dk,di)=>{const base=new Date(dk+'T00:00').getTime();const dow=new Date(dk+'T12:00').getDay();const kind=(dow===0||dow===6)?'weekend':'weekday';
    if(nOn('plan')&&typeof M!=='undefined'&&M.plans&&M.plans[kind])M.plans[kind].forEach(b=>{const n=b.items.length;push('plan:'+dk+':'+b.bi,base+b.s*60e3,nT(b.short||b.title),nRange(b.s,b.e),'./#today')});
    if(typeof M!=='undefined'&&M.plans&&M.plans[kind])M.plans[kind].forEach(b=>b.items.forEach(it=>{const lead=NITEMS.m[it.key];if(lead==null||it.t==null)return;if(it.days&&!it.days.has(DOW[dow]))return;if(typeof protoOk==='function'&&!protoOk(it,dk))return;if(di===0&&typeof DAY!=='undefined'&&DAY.ticks&&DAY.ticks[it.tk])return;
      push('item:'+dk+':'+it.key,base+(it.t-lead)*60e3,nT(dn(it.item)),nClock(it.t),'./#today')}));
    if(typeof HAB!=='undefined')HAB.list.filter(h=>h.remind&&!h.arch).forEach(h=>{if(!hDue(h,dk))return;if(di===0&&hDone(h,dk))return;const [rh,rm]=h.remind.split(':').map(Number);push('habit:'+dk+':'+h.id,base+(rh*60+rm)*60e3,nT(h.n),nClock(rh*60+rm),'./#streaks')});
    if(typeof TASKS!=='undefined'&&di===0)TASKS.list.filter(t=>!t.done&&t.d&&t.tm).forEach(t=>{const [th,tm]=t.tm.split(':').map(Number);push('task:'+t.id,new Date(t.d+'T00:00').getTime()+(th*60+tm)*60e3,nT(t.t),nClock(th*60+tm),'./#journal')});
    if(nOn('dose')&&typeof PROTO!=='undefined'&&typeof scheduledOn==='function')PROTO.list.forEach(c=>{if(!scheduledOn(c,dk))return;(c.times||[]).forEach((t,i)=>{const m=/^(\d{1,2}):(\d{2})$/.exec(t);if(!m)return;if(di===0&&typeof logsFor==='function'&&logsFor(c.id,dk)[i])return;push('dose:'+dk+':'+c.id+':'+i,base+(+m[1]*60+ +m[2])*60e3,nT(c.name),nClock(+m[1]*60+ +m[2]),'./#stack/protocols')})});
    if(nOn('mood')&&typeof MOODD!=='undefined')[['mid',13*60],['eve',21*60+30]].forEach(([sl,m])=>{if(di===0&&MOODD.in.some(x=>moodSlotOf(x.at)===sl&&x.m!=null))return;push('mood:'+dk+':'+sl,base+m*60e3,'Mood check-in','','./#today')});
    if(nOn('people')&&typeof peopleDueOn==='function')peopleDueOn(dk).forEach(p=>push('ppl:'+dk+':'+p.id,base+(17*60+30)*60e3,nT(p.dueLabel),'','./#journal/people'));
    if(nOn('review')&&typeof reviewDueOn==='function'&&reviewDueOn(dk))push('rev:'+dk,base+19*60*60e3,'Monthly review','','./#goals/review');
    if(nOn('bed')&&typeof SSET!=='undefined'&&SSET&&SSET.bedOn&&typeof sBedFor==='function'){const [bh,bm]=sBedFor().split(':').map(Number);let t=base+(bh*60+bm-30)*60e3;if(bh<12)t+=864e5;push('bed:'+dk,t,'Bedtime',nClock(bh*60+bm),'./#sleep')}});
  if(nOn('cal')&&typeof calEnsure==='function'&&await calEnsure())days.forEach(dk=>{const base=new Date(dk+'T00:00').getTime();calEvents(new Date(dk+'T12:00')).forEach(ev=>{if(ev.ad||ev.rm<0)return;const lead=ev.rm==null?10:ev.rm;
    push('cal:'+dk+':'+ev.id,base+(ev.s-lead)*60e3,nT(ev.t)||'Event',nRange(ev.s,ev.e),'./#week')})});
  q.items=keep.concat(add).sort((a,b)=>a.at<b.at?-1:1).slice(0,200);save('push/q',q,true)}
function openNotify(){const sup=('serviceWorker' in navigator)&&('PushManager' in window);const perm=typeof Notification!=='undefined'?Notification.permission:'unsupported';
  openSheet('notifications',`<div class="row" style="justify-content:space-between;align-items:center"><div><b>${NSET.on&&perm==='granted'?'on for this device':'off'}</b><div class="dim" style="font-size:11px">${sup?'arrive even when the app is closed':'not supported in this browser'}</div></div><button class="btn ${NSET.on&&perm==='granted'?'':'p'}" type="button" id="nTog">${NSET.on&&perm==='granted'?'turn off':'turn on'}</button></div>
  <div class="dim" id="nMsg" style="font-size:12px;margin:8px 0"></div>
  <div class="nlist">${NKINDS.map(([k,l,d])=>`<label class="nrow"><span><b>${l}</b><span class="dim">${d}</span></span><input type="checkbox" data-nk="${k}" ${NSET.k[k]?'checked':''}></label>`).join('')}</div>
  <div class="bigbtns" style="margin-top:12px"><button class="iconbtn" type="button" id="nTest">Send a test</button><span style="flex:1"></span><button class="btn p" type="button" id="nOk">Done</button></div>`);
  const sb=$('sheetBody');sb.onchange=e=>{const k=e.target.dataset.nk;if(!k)return;NSET.k[k]=e.target.checked;LS.set('notify',NSET);pushSync()};
  $('nOk').onclick=closeSheet;
  $('nTest').onclick=async()=>{if(!NSET.on){$('nMsg').textContent='turn notifications on first';return}await pushOne('test',Date.now()+8000,'Notifications on','','./');$('nMsg').textContent='sent, it should arrive within ~20 seconds (lock your phone to see it)'};
  $('nTog').onclick=async()=>{if(NSET.on&&perm==='granted'){NSET.on=false;LS.set('notify',NSET);try{const reg=await navigator.serviceWorker.ready;const s=await reg.pushManager.getSubscription();if(s){const cur=(await load('push/subs'))||{list:[]};cur.list=(cur.list||[]).filter(x=>x.sub.endpoint!==s.endpoint);save('push/subs',cur,true);await s.unsubscribe()}}catch(e){}openNotify();return}
    $('nMsg').textContent='asking…';const err=await nSubscribe().catch(e=>String(e&&e.message||e));if(err){$('nMsg').textContent=err;return}openNotify()}}
document.addEventListener('click',e=>{if(e.target.closest('#notifyBtn'))openNotify()});

function leetDue(){return typeof LEET!=='undefined'&&LEET&&LEET.items?Object.values(LEET.items).filter(it=>it.review&&it.review<=DAYK).length:0}

/* per-item reminders set from a Today item's edit sheet: doc push/items {m:{itemKey:minutesBefore}} */
let NITEMS={m:{}};
load('push/items').then(d=>{if(d)NITEMS={m:{},...d}}).catch(()=>{});
watch('push/items',d=>{if(d)NITEMS={m:{},...d}});
async function setItemNotify(key,lead){if(lead==null)delete NITEMS.m[key];else NITEMS.m[key]=lead;save('push/items',NITEMS,true);
  if(lead!=null&&!NSET.on){openNotify();return}pushSync()}
