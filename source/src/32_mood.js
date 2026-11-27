/* ================= MOOD: two-tap check-ins on Today, insights in Journal › Mood =================
   mood/d-YYYY-MM-DD = {in:[{at, m:1..5, e:1..5|null, tags:[]}]}. Check-ins sit in two slots, midday (from 12:00)
   and evening (from 18:00). Old journal moods (1..10) count too, halved, so insights have history from day one. */
/* mood is 0..10 in 0.1 steps (s:10). Older check-ins were 1..5 faces and count double. */
const moodV=x=>x==null||x.m==null?null:(x.s===10?+x.m:+x.m*2);
const mood5=v=>Math.max(1,Math.min(5,Math.round(v/2)||1));
const MOOD_TAGS=['focused','calm','anxious','tired','irritable','social','outside','stressed'];
let MOODD={in:[]},moodOpen=false,moodHold=null;
const moodSlot=()=>{const h=new Date().getHours();return h>=18||h<5?'eve':h>=12?'mid':null};
const moodSlotOf=at=>{const h=new Date(at).getHours();return h>=18||h<5?'eve':h>=12?'mid':'am'};
function moodCur(){const s=moodSlot();return s?MOODD.in.find(x=>moodSlotOf(x.at)===s):null}
async function moodLoad(){MOODD={in:[],...((await load('mood/d-'+DAYK))||{})};renderTodayMood()}
watchPrefix('mood/d-',(evt,path,data)=>{if(path==='mood/d-'+DAYK&&data){MOODD={in:[],...data};renderTodayMood()}if(cur==='journal'&&JTAB==='mood')moodInsightsDirty=true});
function moodSave(){save('mood/d-'+DAYK,MOODD);if(typeof pushSync==='function')setTimeout(()=>pushSync().catch(e=>nxErr(e,'notifications')),800);if(typeof schedWidget==='function')schedWidget()}

function renderTodayMood(){const el=$('todayMood');if(!el)return;
  const s=moodSlot(),c=moodCur(),last=MOODD.in[MOODD.in.length-1];
  if(!s&&!last){el.innerHTML='';return}
  const full=moodOpen||(s&&(!c||c.e==null));
  if(!full){const x=c||last;el.innerHTML=`<div class="nx nx-today" style="padding:0"><button type="button" class="nx-card nx-row" id="moodReopen" style="padding:12px 16px;display:flex;align-items:center;gap:12px;border:0">
    <span style="flex:none">${nxFaceSvg(mood5(moodV(x)),26)}</span><span style="flex:1;min-width:0"><span class="nx-t2">Mood ${moodV(x).toFixed(1)}/10${x.e?` · energy ${eV(x).toFixed(1)}`:''}</span><span class="nx-xs" style="display:block">${nxClock(x.at)}${(x.tags||[]).length?' · '+x.tags.join(', '):''}</span></span><span class="nx-pill">Change</span></button></div>`;return}
  const x=c||{m:null,e:null,tags:[]};
  el.innerHTML=`<div class="nx nx-today" style="padding:0"><div class="nx-card" style="background:radial-gradient(120% 120% at 100% 0%,rgba(48,209,88,.10),transparent 55%),rgba(255,255,255,.045)">
    <div class="nx-split"><span class="nx-t2">How do you feel?</span><span class="nx-xs">${s==='eve'?'evening':'midday'} check-in</span></div>
    <div class="mood10"><b class="num" id="moodVal">${x.m!=null?moodV(x).toFixed(1):'–'}<small>/10</small></b><input type="range" min="1" max="10" step="0.1" value="${x.m!=null?Math.max(1,moodV(x)):5.5}" id="moodRange" aria-label="Mood, 1 to 10"></div>
    <div class="nx-split nx-xs" style="padding:0 6px"><span>Awful</span><span>Great</span></div>
    <div class="nx-split" style="margin:16px 0 8px"><span class="nx-s" style="color:#d1d1d6;font-weight:600">Energy</span><span class="nx-xs">1 to 10</span></div>
    ${nxSlide(eV(x),'data-energyr')}
    <div class="nx-chips" style="margin-top:12px">${MOOD_TAGS.map(t=>`<button type="button" class="nx-ch" data-mtag="${t}" aria-pressed="${(x.tags||[]).includes(t)}">${t[0].toUpperCase()+t.slice(1)}</button>`).join('')}</div>
    <div class="nx-xs" style="margin-top:12px">Tags are optional. Two taps is enough.${last&&last!==c?` Last check-in ${nxClock(last.at)} · mood ${moodV(last).toFixed(1)}${last.e?' · energy '+eV(last).toFixed(1):''}`:''}</div>
  </div></div>`}
function moodEntry(){const s=moodSlot()||'mid';let c=MOODD.in.find(x=>moodSlotOf(x.at)===s);if(!c){c={at:new Date().toISOString(),m:null,e:null,tags:[]};MOODD.in.push(c)}return c}
document.addEventListener('click',e=>{const host=e.target.closest('#todayMood');if(!host)return;
  if(e.target.closest('#moodReopen')){moodOpen=true;renderTodayMood();return}
  const f=e.target.closest('[data-mood]'),en=e.target.closest('[data-energy]'),tg=e.target.closest('[data-mtag]');if(!f&&!en&&!tg)return;
  const c=moodEntry();if(f)c.m=+f.dataset.mood;if(en)c.e=+en.dataset.energy;if(tg){c.tags=c.tags||[];const t=tg.dataset.mtag;c.tags=c.tags.includes(t)?c.tags.filter(x=>x!==t):c.tags.concat(t)}
  if(c.m==null){c.m=5;c.s=10}c.at=c.at||new Date().toISOString();moodSave();
  if(f&&typeof burstEl==='function')burstEl(f,22);
  moodOpen=true;renderTodayMood();clearTimeout(moodHold);if(c.m!=null&&c.e)moodHold=setTimeout(()=>{moodOpen=false;renderTodayMood()},tg?2600:1400)});
const eV=x=>x&&x.e!=null?(x.es===10?+x.e:x.e*2):null;
document.addEventListener('change',e=>{if(!e.target.matches('[data-energyr]'))return;const c=moodEntry();c.e=r10(e.target.value);c.es=10;c.at=c.at||new Date().toISOString();moodSave();
  moodOpen=true;renderTodayMood();clearTimeout(moodHold);if(c.m!=null)moodHold=setTimeout(()=>{moodOpen=false;renderTodayMood()},1600)});
document.addEventListener('input',e=>{if(e.target.id!=='moodRange')return;const v=$('moodVal');if(v)v.innerHTML=(+e.target.value).toFixed(1)+'<small>/10</small>'});
document.addEventListener('change',e=>{if(e.target.id!=='moodRange')return;const c=moodEntry();c.m=Math.round(+e.target.value*10)/10;c.s=10;c.at=c.at||new Date().toISOString();moodSave();
  moodOpen=true;renderTodayMood();clearTimeout(moodHold);if(c.e)moodHold=setTimeout(()=>{moodOpen=false;renderTodayMood()},1600)});
setInterval(()=>{if(!document.hidden&&cur==='today'&&!moodOpen)renderTodayMood()},60e3);

/* ---------------- insights ---------------- */
let moodInsightsDirty=true,MI=null;
async function moodData(){
  const since=addDays(DAYK,-90);
  const [mrows,jrows,srows,hrows,gym,brick,focus,drows,plog]=await Promise.all([listDocs('mood/d-'),listDocs('journal/e-').catch(()=>[]),listDocs('sleep/w-').catch(()=>[]),listDocs('health/d-').catch(()=>[]),
    (typeof gymLoaded!=='undefined'&&gymLoaded?Promise.resolve(WORKOUTS):listDocs('gym/w-').then(r=>r.map(x=>x.data).filter(Boolean))).catch(()=>[]),
    load('tools/brick').catch(()=>null),load('tools/focus').catch(()=>null),listDocs('days/d-').catch(()=>[]),load('people/log').catch(()=>null)]);
  const [frows,hlog,hlist,tasks]=await Promise.all([listDocs('food/d-').catch(()=>[]),load('habits/log').catch(()=>null),load('habits/list').catch(()=>null),load('tasks/all').catch(()=>null)]);
  const day={};const D=k=>day[k]||(day[k]={});
  mrows.forEach(r=>{const k=r.path.slice(7);if(k<since)return;const xs=((r.data&&r.data.in)||[]).filter(x=>x.m!=null);if(xs.length){D(k).m=nxAvg(xs.map(moodV));const es=xs.map(eV).filter(Boolean);if(es.length)D(k).e=nxAvg(es);D(k).src='c'}});
  jrows.forEach(r=>{const k=r.path.slice(10);if(k<since||!r.data||!r.data.mood)return;if(day[k]&&day[k].m!=null)return;D(k).m=+r.data.mood;D(k).src='j'});
  const F={};const set=(k,f,v)=>{if(day[k])(day[k].f=day[k].f||{})[f]=v};
  srows.forEach(r=>{const k=r.path.slice(8);if(!r.data||!day[k])return;try{const q=sQ(r.data);if(q)set(k,'sleep80',q>=80);if(r.data.asleep)set(k,'short',r.data.asleep<360)}catch(_){}});
  hrows.forEach(r=>{const k=r.path.slice(9),h=r.data||{};if(!day[k])return;if(h.screentime!=null)set(k,'screen4',h.screentime>=4*3600);if(h.steps!=null)set(k,'steps8',h.steps>=8000)});
  const gd=new Set((gym||[]).filter(w=>w&&w.date).map(w=>w.date));Object.keys(day).forEach(k=>set(k,'trained',gd.has(k)));
  const bm={};((brick&&brick.sessions)||[]).forEach(s=>{bm[s.d]=(bm[s.d]||0)+(+s.min||0)});Object.keys(day).forEach(k=>set(k,'brick2',(bm[k]||0)>=120));
  const fm={};((focus&&focus.sessions)||[]).forEach(s=>{fm[s.d]=(fm[s.d]||0)+(+s.min||0)});Object.keys(day).forEach(k=>set(k,'focus2',(fm[k]||0)>=120));
  drows.forEach(r=>{const k=r.path.slice(7),d=r.data;if(day[k]&&d&&d.total)set(k,'plan80',d.done/d.total>=.8)});
  const pk=new Set(((plog&&plog.log)||[]).map(x=>x.day||String(x.at).slice(0,10)));Object.keys(day).forEach(k=>set(k,'people',pk.has(k)));
  if(typeof MEDLOG!=='undefined')Object.keys(day).forEach(k=>{const ck=(MEDLOG.checks||[]).filter(c=>String(c.at).slice(0,10)===k);if(ck.length)set(k,'medfocus',nxAvg(ck.map(c=>c.focus))>=4)});
  /* everything else the app tracks, item by item: each becomes a with/without comparison */
  MOOD_DL={};const ks=Object.keys(day),dyn=(key,label,yes)=>{MOOD_DL[key]=label;ks.forEach(k=>set(k,key,yes.has(k)))};
  const short=x=>{x=String(x||'').trim();return x.length>34?x.slice(0,33)+'…':x};
  const tick={};drows.forEach(r=>{const k=r.path.slice(7),t=r.data&&r.data.ticks;if(!day[k]||!t)return;Object.keys(t).forEach(tk=>{if(!t[tk])return;const n=tk.split('|').slice(2).join('|')||tk;(tick[n]=tick[n]||new Set()).add(k)})});
  const logged=new Set(drows.map(r=>r.path.slice(7)));Object.entries(tick).forEach(([n,set2])=>{const key='tk:'+n;MOOD_DL[key]='Did '+short(n);ks.forEach(k=>{if(logged.has(k))set(k,key,set2.has(k))})});
  const stg={};srows.forEach(r=>{const k=r.path.slice(8);if(!day[k]||!r.data)return;(r.data.tags||[]).forEach(t=>{(stg[t]=stg[t]||new Set()).add(k)})});
  const nights=new Set(srows.map(r=>r.path.slice(8)));Object.entries(stg).forEach(([t,set2])=>{const key='sl:'+t;MOOD_DL[key]='Night before: '+short(t);ks.forEach(k=>{if(nights.has(k))set(k,key,set2.has(k))})});
  srows.forEach(r=>{const k=r.path.slice(8);if(day[k]&&r.data&&r.data.asleep){set(k,'sleep8',r.data.asleep>=450);if(r.data.mood!=null)set(k,'wokegood',+r.data.mood>=4)}});
  MOOD_DL.sleep8='Slept 7.5 h+';MOOD_DL.wokegood='Woke up feeling good';
  const hn={};((hlist&&hlist.list)||(Array.isArray(hlist)?hlist:[])).forEach(h=>{hn[h.id]=h.n||h.name});const hd=(hlog&&hlog.d)||{};
  const hset={};Object.entries(hd).forEach(([k,v])=>{if(!day[k]||!v)return;Object.keys(v).forEach(id=>{if(v[id])(hset[id]=hset[id]||new Set()).add(k)})});
  Object.entries(hset).forEach(([id,set2])=>{if(hn[id])dyn('hb:'+id,'Habit: '+short(hn[id]),set2)});
  const kc={},pr={};frows.forEach(r=>{const k=r.path.slice(7),f=r.data;if(!day[k]||!f||!f.m)return;const all=['b','l','d','s'].reduce((a,m)=>a.concat(f.m[m]||[]),[]);if(!all.length)return;
    const t=typeof fSum==='function'?fSum(all):null;if(t){kc[k]=t.kcal;pr[k]=t.p}if((f.m.s||[]).length>=3)set(k,'snacky',true);else set(k,'snacky',false)});
  const med=o=>{const v=Object.values(o).sort((a,b)=>a-b);return v.length?v[v.length>>1]:0};const mk=med(kc),mp=med(pr);
  Object.keys(kc).forEach(k=>{set(k,'kcalhi',kc[k]>mk);set(k,'prohi',pr[k]>mp)});MOOD_DL.kcalhi='Ate more than usual';MOOD_DL.prohi='Higher protein than usual';MOOD_DL.snacky='3+ snacks';
  jrows.forEach(r=>{const k=r.path.slice(10);if(day[k])set(k,'journaled',!!(r.data&&String(r.data.text||'').trim().length>40))});MOOD_DL.journaled='Wrote in the journal';
  const td={};((tasks&&tasks.list)||[]).forEach(t=>{if(t.done){const k=String(t.done).slice(0,10);td[k]=(td[k]||0)+1}});ks.forEach(k=>set(k,'tasks3',(td[k]||0)>=3));MOOD_DL.tasks3='Finished 3+ tasks';
  return day}
let MOOD_DL={};
const MOOD_FL={sleep80:'Sleep score 80+',short:'Slept under 6 h',trained:'Trained',steps8:'8k+ steps',brick2:'Bricked 2 h+',focus2:'Focus 2 h+',plan80:'Plan 80%+',screen4:'Screen time 4 h+',people:'Talked to someone close',medfocus:'Meds focus 4+'};
function moodEffects(day){const keys=Object.keys(day).filter(k=>k>=addDays(DAYK,-90)&&day[k].m!=null);const out=[];const LB={...MOOD_DL,...MOOD_FL};
  Object.keys(LB).forEach(f=>{const yes=keys.filter(k=>day[k].f&&day[k].f[f]===true).map(k=>day[k].m),no=keys.filter(k=>day[k].f&&day[k].f[f]===false).map(k=>day[k].m);
    if(yes.length>=5&&no.length>=5){const d=nxAvg(yes)-nxAvg(no);if(Math.abs(d)>=.3)out.push({f,l:LB[f],d,n:yes.length,a:nxAvg(yes),b:nxAvg(no)})}});
  out.sort((a,b)=>Math.abs(b.d)-Math.abs(a.d));return out.filter(x=>x.d>0).slice(0,8).concat(out.filter(x=>x.d<0).slice(0,8))}
function moodTwoLine(a,b,w=330,h=110){const pl=2,pr=22,pt=6,pb=16,W=w-pl-pr,H=h-pt-pb,X=i=>pl+i*W/Math.max(1,a.length-1),Y=v=>pt+H-v/10*H;
  let s=`<svg viewBox="0 0 ${w} ${h}" width="100%" style="display:block" role="img" aria-label="mood and energy">`;
  [0,2.5,5,7.5,10].forEach(v=>{s+=`<line x1="${pl}" x2="${pl+W}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="rgba(255,255,255,.06)"/><text x="${pl+W+6}" y="${(Y(v)+3.5).toFixed(1)}" font-size="9.5" fill="#6e6e73">${v}</text>`});
  const ln=(arr,col,sw,op)=>{let d='',pen=false;arr.forEach((v,i)=>{if(v==null){pen=false;return}d+=(pen?' L':' M')+X(i).toFixed(1)+','+Y(v).toFixed(1);pen=true});return d?`<path d="${d}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round" opacity="${op}"/>`:''};
  s+=ln(b.map(v=>v==null?null:v*2),NXC.yellow,1.6,.8)+ln(a,NXC.green,2.4,1);
  s+=`<text x="${pl}" y="${h-2}" font-size="9.5" fill="#6e6e73">${nxDate(addDays(DAYK,-(a.length-1)))}</text><text x="${pl+W}" y="${h-2}" font-size="9.5" fill="#6e6e73" text-anchor="end">today</text>`;
  return s+'</svg>'}
async function renderMood(){const el=$('jPaneM');if(!el)return;
  if(!MI||moodInsightsDirty){if(!MI)el.innerHTML='<div class="nx"><div class="nx-card nx-s">Reading your data…</div></div>';try{MI=await moodData();moodInsightsDirty=false}catch(e){nxErr(e,'mood insights');MI=MI||{}}}
  const day=MI,k30=[...Array(30)].map((_,i)=>addDays(DAYK,i-29)),m30=k30.map(k=>day[k]&&day[k].m!=null?day[k].m:null),e30=k30.map(k=>day[k]&&day[k].e!=null?day[k].e:null);
  const prev=[...Array(30)].map((_,i)=>addDays(DAYK,i-59)).map(k=>day[k]&&day[k].m);const a=nxAvg(m30),pa=nxAvg(prev),ea=nxAvg(e30);
  const cks=Object.keys(day).filter(k=>k>=addDays(DAYK,-29)&&day[k].src==='c').length;
  const eff=moodEffects(day);const mx=Math.max(1.2,...eff.map(x=>Math.abs(x.d)));
  const months=[2,1,0].map(o=>{const d=new Date(L);d.setDate(1);d.setMonth(d.getMonth()-o);return d});
  const set=nxGuardOn();
  el.innerHTML=`<div class="nx">
  <div class="nx-card nx-hero">${nxRing(a?a/10:0,74,8,NXC.green,`<b style="font-size:21px">${a?a.toFixed(1):'–'}</b><span>mood</span>`)}
    <div style="flex:1;display:grid;gap:8px;min-width:0">
      <div class="nx-split"><span class="nx-s">Mood · 30 days</span>${a&&pa?`<span class="nx-em ${a>=pa?'nx-up':'nx-dn'}">${a>=pa?'▲':'▼'} ${Math.abs(a-pa).toFixed(1)} vs the 30 before</span>`:''}</div>
      <div class="nx-split"><span class="nx-s">Energy · 30 days</span><b class="num" style="font-size:14px">${ea?ea.toFixed(1):'–'}</b></div>
      <div class="nx-split"><span class="nx-s">Days with check-ins</span><b class="num" style="font-size:14px">${cks} of 30</b></div>
    </div></div>
  <div class="nx-card"><div class="nx-h"><span>Last 30 days</span><em><span style="color:${NXC.green}">●</span> mood &nbsp;<span style="color:${NXC.yellow}">●</span> energy</em></div>${m30.some(v=>v!=null)?moodTwoLine(m30,e30):'<div class="nx-s">Check in on Today and your line starts here.</div>'}</div>
  <div class="nx-card"><div class="nx-h"><span>What moves your mood</span><em>last 90 days</em></div>
    ${eff.length?`<div style="display:grid;gap:10px">${eff.map(x=>{const pc=Math.min(Math.abs(x.d)/mx,1)*50,col=x.d>0?NXC.green:NXC.red;return `<div class="nx-hb"><span style="color:#d1d1d6;line-height:1.2">${esc(x.l)}<br><small style="color:#6e6e73;font-size:10.5px">${x.n} days · ${x.a.toFixed(1)} vs ${x.b.toFixed(1)}</small></span><div><div style="position:absolute;left:50%;top:-4px;bottom:-4px;width:1px;background:rgba(255,255,255,.16)"></div><div style="position:absolute;left:${x.d>0?50:50-pc}%;width:${pc}%;top:0;bottom:0;border-radius:5px;background:${col}"></div></div><b style="text-align:right;color:${col}">${nxSign(x.d)}</b></div>`}).join('')}</div>`
      :'<div class="nx-s">Needs a few weeks of check-ins. Each factor shows once it has 5 days with it and 5 without, and moves mood by 0.3 or more.</div>'}
    <div class="nx-xs" style="margin-top:14px">Average mood on days with each thing vs days without. Patterns, not proof: two things can share a cause, like a good night's sleep.</div></div>
  <div class="nx-card"><div class="nx-h"><span>Year in pixels</span><em>tap a day for its journal</em></div>
    <div class="nx-px">${months.map(m0=>{const y=m0.getFullYear(),mo=m0.getMonth(),nd=new Date(y,mo+1,0).getDate();return `<div><span class="nx-xs">${m0.toLocaleDateString('en-GB',{month:'short'})}</span>${[...Array(31)].map((_,i)=>{if(i>=nd)return '<i style="background:none"></i>';const k=y+'-'+pad(mo+1)+'-'+pad(i+1),v=day[k]&&day[k].m;return v!=null?`<i data-jday="${k}" style="background:${NX_MOODC[mood5(v)]};opacity:.9;cursor:pointer" title="${k} · ${v.toFixed(1)}"></i>`:'<i></i>'}).join('')}</div>`}).join('')}</div>
    <div class="nx-chips nx-xs" style="justify-content:center;margin-top:12px;gap:10px">${[1,2,3,4,5].map(n=>`<span style="display:flex;align-items:center;gap:4px"><i style="width:9px;height:9px;border-radius:2px;background:${NX_MOODC[n]};display:inline-block"></i>${['0–3','3–5','5–7','7–9','9–10'][n-1]}</span>`).join('')}</div></div>
  <div class="nx-flag"><div class="nx-ic">!</div><div style="flex:1"><div class="nx-split"><span class="nx-t2" style="font-size:13.5px">Mood guard ${set?'is on':'is off'}</span><button type="button" class="nx-pill ${set?'nx-ok':''}" id="mgTog">${set?'Turn off':'Turn on'}</button></div>
    <div class="nx-s" style="margin-top:4px">If mood sits at 4 or below for 5 days in a row, a quiet note appears here suggesting you mention it at your next GP check. Some medicines can affect mood. It never tells anyone else.</div>${set&&nxGuardHit(day)?'<div class="nx-s" style="margin-top:8px;color:#ffd60a">Your mood has been 4 or below for 5 days. Worth mentioning to your GP.</div>':''}</div></div>
  </div>`;
  el.onclick=e=>{const j=e.target.closest('[data-jday]');if(j){setJTab('journal');if(typeof openEntry==='function')setTimeout(()=>openEntry(j.dataset.jday).catch(er=>nxErr(er,'journal')),60);return}
    if(e.target.closest('#mgTog')){const s=nxGuardOn();save('mood/guard',{on:!s});MGUARD=!s;renderMood()}}}
let MGUARD=false;load('mood/guard').then(d=>{MGUARD=!!(d&&d.on)}).catch(()=>{});watch('mood/guard',d=>{MGUARD=!!(d&&d.on)});
const nxGuardOn=()=>MGUARD;
function nxGuardHit(day){for(let i=0;i<5;i++){const v=day[addDays(DAYK,-i)];if(!v||v.m==null||v.m>4)return false}return true}
nxCmd('log mood','mood',()=>{go('today');moodOpen=true;renderTodayMood();setTimeout(()=>{const m=$('todayMood');if(m)m.scrollIntoView({behavior:'smooth',block:'center'})},300)});
