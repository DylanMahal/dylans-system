/* ================= SLEEP =================
   Tracking comes from your Apple Watch: an iPhone Shortcut sends last night's Apple Health sleep to the
   "sleep-in" function every morning → doc sleep/w-YYYY-MM-DD {start,end,asleep,deep,rem,core,awake,segs,mood,tags}.
   Waking: your normal iPhone alarm rings; a Shortcut automation ("when alarm is stopped → open URL") opens
   #wake here, which keeps ringing until an Alarmy-style mission is done. */
const SMISS=[['math','maths'],['shake','shake'],['type','type a phrase'],['scan','scan a barcode']];
const SSND=[['rise','rising chime'],['classic','classic beeps'],['siren','siren']];
const STAGS=['gym','caffeine late','alcohol','late meal','screens in bed','stressed','melatonin','magnesium','nap','fasted cardio'];
const SPHRASE=['I am awake and I am getting up now','Discipline is doing it when you do not feel like it','Get out of bed and win the morning','Everybody wants it until it is time to wake up'];
const SFN='https://ucnwefjblxqbmmwdbqhw.supabase.co/functions/v1/sleep-in';
let SHEALTH={};let SSET=null,SNIGHTS={},SV=LS.get('sleepv')||'recovery',sleepLoaded=false,SCFG=null;
const fmtHM=m=>{m=Math.round(m||0);return Math.floor(m/60)+'h '+pad(m%60)+'m'};
async function loadSleep(){if(sleepLoaded){renderSleep();return}
  const [s,rows,c,hr]=await Promise.all([load('sleep/settings'),listDocs('sleep/w-'),load('sleep/cfg'),listDocs('health/d-')]);hr.forEach(r=>{if(r.data)SHEALTH[r.path.slice(9)]=r.data});
  SSET={wake:'07:30',bed:'23:00',goal:8,miss:'math',diff:2,shakes:30,snd:'rise',code:'',...(s||{})};SCFG=c||{};
  rows.forEach(r=>{if(r.data)SNIGHTS[r.path.slice(8)]=r.data});sleepLoaded=true;renderSleep()}
watchPrefix('health/d-',(evt,path,data)=>{const k=path.slice(9);if(evt==='DELETE')delete SHEALTH[k];else if(data)SHEALTH[k]=data;if(cur==='sleep'&&SV==='recovery')renderSleep()});
watchPrefix('sleep/w-',(evt,path,data)=>{const k=path.slice(8);if(evt==='DELETE')delete SNIGHTS[k];else if(data)SNIGHTS[k]=data;if(cur==='sleep'&&!$('sheet').classList.contains('on'))renderSleep()});
const saveSS=()=>save('sleep/settings',SSET);
function sQ(n){if(!n||!n.asleep)return 0;const g=(SSET&&SSET.goal||8)*60,a=n.asleep;const dp=n.deep/a,rp=n.rem/a;
  return Math.round(Math.max(0,Math.min(100,45*Math.min(1,a/g)+20*Math.min(1,dp/.15)+20*Math.min(1,rp/.2)+15*Math.max(0,1-(n.awake||0)/45))))}
function renderSleep(){if(!sleepLoaded){loadSleep();return}
  document.querySelectorAll('#sleepSeg [data-sv]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.sv===SV));
  const last=Object.keys(SNIGHTS).sort().pop();$('sleepSub').textContent=last?`${esc(nice(last).toLowerCase())} · ${fmtHM(SNIGHTS[last].asleep)} · ${sQ(SNIGHTS[last])}%`:'apple watch sleep + wake-up missions';
  ({recovery:sRecovery,last:sLast,history:sHistory,stats:sStats,setup:sSetup}[SV]||sRecovery)()}
document.addEventListener('click',e=>{const b=e.target.closest('#sleepSeg [data-sv]');if(!b)return;SV=b.dataset.sv;LS.set('sleepv',SV);renderSleep()});

/* hypnogram from watch stages */
function sHyp(n,h=130){const segs=n.segs||[];if(!segs.length)return '<div class="dim">no stage data</div>';const t0=+new Date(n.start),t1=+new Date(n.end),W=600,L={awake:0,rem:1,core:2,deep:3},C={awake:'#ff2a6d',rem:'#05d9e8',core:'#6b7cff',deep:'#9b5cff'};
  const y=l=>10+l*(h-30)/3;const X=t=>((t-t0)/(t1-t0||1))*W;
  const rects=segs.map(([s,e,st])=>`<rect x="${X(+new Date(s)).toFixed(1)}" y="${y(L[st]??2)}" width="${Math.max(1,X(+new Date(e))-X(+new Date(s))).toFixed(1)}" height="${(h-30)/3-2}" fill="${C[st]||'#6b7cff'}" rx="2"/>`).join('');
  const T=d=>{const x=new Date(d);return pad(x.getHours())+':'+pad(x.getMinutes())};
  return `<svg class="slgraph" viewBox="0 0 ${W} ${h}" preserveAspectRatio="none" style="height:${h}px">${['awake','rem','core','deep'].map((k,i)=>`<line x1="0" x2="${W}" y1="${y(i)+(h-30)/6}" y2="${y(i)+(h-30)/6}" stroke="#1c1c1c"/>`).join('')}${rects}</svg>
  <div class="slaxis dim num"><span>${T(n.start)}</span><span class="sllg"><i style="background:#ff2a6d"></i>awake <i style="background:#05d9e8"></i>REM <i style="background:#6b7cff"></i>core <i style="background:#9b5cff"></i>deep</span><span>${T(n.end)}</span></div>`}
function sCard(k,full){const n=SNIGHTS[k];const q=sQ(n);const a=n.asleep||1;const pc=x=>Math.round((n[x]||0)/a*100);
  return `<div class="panel slcard${full?' full':''}" data-sn="${k}"><div class="pb"><div class="row" style="justify-content:space-between;align-items:baseline"><b>${esc(nice(k).toLowerCase())}</b><span class="num">${['','😫','😕','😐','🙂','😁'][n.mood||0]||''} <b class="${q>=75?'ok':q<50?'bad':''}" style="font-size:${full?28:16}px">${q}%</b></span></div>
    <div class="slstat num"><div><b>${fmtHM(n.asleep)}</b><span>asleep</span></div><div><b>${fmtHM(n.deep)}</b><span>deep ${pc('deep')}%</span></div><div><b>${fmtHM(n.rem)}</b><span>REM ${pc('rem')}%</span></div><div><b>${fmtHM(n.core)}</b><span>core</span></div><div><b>${Math.round(n.awake||0)}m</b><span>awake</span></div></div>
    ${sHyp(n,full?150:90)}${(n.tags||[]).length&&!full?`<div class="dim" style="font-size:11px;margin-top:4px">${n.tags.map(esc).join(' · ')}</div>`:''}</div></div>`}
function sLast(){const el=$('sleepBody');const k=Object.keys(SNIGHTS).sort().pop();
  if(!k){el.innerHTML=`<div class="panel"><div class="pb"><b>no nights yet</b><div class="dim" style="margin-top:6px">Wear your Apple Watch to bed and finish the one-time setup in the <b>setup</b> tab — every morning your sleep lands here automatically.</div><button class="btn p" type="button" data-go="setup" style="margin-top:10px">open setup</button></div></div>`;el.onclick=e=>{if(e.target.closest('[data-go]')){SV='setup';renderSleep()}};return}
  const n=SNIGHTS[k];
  el.innerHTML=sCard(k,true)+`<div class="panel"><div class="ph"><span class="tag">how do you feel?</span></div><div class="pb"><div class="smmood">${['😫','😕','😐','🙂','😁'].map((m,i)=>`<button type="button" data-mood="${i+1}" class="${n.mood===i+1?'on':''}">${m}</button>`).join('')}</div>
    <div class="dim" style="margin:12px 0 6px;font-size:12px">sleep notes</div><div class="chips">${STAGS.map(t=>`<button type="button" class="chip${(n.tags||[]).includes(t)?' on':''}" data-tag="${esc(t)}">${t}</button>`).join('')}</div></div></div>
    <div class="panel"><div class="ph"><span class="tag">tonight</span></div><div class="pb dim" style="font-size:12.5px">for ${SSET.goal} h of sleep before a ${SSET.wake} wake-up, be asleep by <b style="color:var(--fg)">${sBedFor()}</b>${SSET.bedOn?' · you\'ll get a reminder 30 min before':''}</div></div>`;
  el.onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.mood){n.mood=+b.dataset.mood;save('sleep/w-'+k,n);sLast();return}
    if(b.dataset.tag){const t=b.dataset.tag;n.tags=(n.tags||[]).includes(t)?n.tags.filter(x=>x!==t):(n.tags||[]).concat(t);save('sleep/w-'+k,n);sLast()}}}
function sBedFor(){const [h,m]=SSET.wake.split(':').map(Number);let t=h*60+m-SSET.goal*60;t=(t+1440)%1440;return pad(Math.floor(t/60))+':'+pad(t%60)}
function sHistory(){const el=$('sleepBody');const ks=Object.keys(SNIGHTS).sort().reverse();el.innerHTML=ks.length?ks.map(k=>sCard(k,false)).join(''):'<div class="panel"><div class="pb dim">No nights yet.</div></div>';
  el.onclick=e=>{const c=e.target.closest('[data-sn]');if(!c)return;const k=c.dataset.sn;openSheet(nice(k).toLowerCase(),sCard(k,true)+`<div class="bigbtns"><button class="btn d" type="button" id="snDel">delete night</button><span style="flex:1"></span><button class="btn p" type="button" id="snOk">close</button></div>`);
    $('snOk').onclick=closeSheet;$('snDel').onclick=function(){if(!this.dataset.arm){this.dataset.arm=1;this.textContent='tap again';return}delete SNIGHTS[k];removeDoc('sleep/w-'+k);closeSheet();renderSleep()}}}
function sStats(){const el=$('sleepBody');const N=Object.keys(SNIGHTS).sort().slice(-30).map(k=>({k,...SNIGHTS[k],q:sQ(SNIGHTS[k])}));
  if(!N.length){el.innerHTML='<div class="panel"><div class="pb dim">Stats appear after your first synced night.</div></div>';return}
  const avg=f=>N.reduce((a,n)=>a+(+n[f]||0),0)/N.length;const bt=N.map(n=>{const d=new Date(n.start);let m=d.getHours()*60+d.getMinutes();if(m<720)m+=1440;return m});const wk=N.map(n=>{const d=new Date(n.end);return d.getHours()*60+d.getMinutes()});
  const sd=a=>{const m=a.reduce((x,y)=>x+y,0)/a.length;return Math.sqrt(a.reduce((x,y)=>x+(y-m)**2,0)/a.length)};const hm=m=>{m=Math.round(m)%1440;return pad(Math.floor(m/60))+':'+pad(m%60)};
  const L=N.slice(-14);const mx=Math.max(...L.map(n=>n.asleep||0),SSET.goal*60);
  const tagI=STAGS.map(t=>{const w=N.filter(n=>(n.tags||[]).includes(t)),wo=N.filter(n=>!(n.tags||[]).includes(t));if(w.length<2||wo.length<2)return null;const d=w.reduce((a,n)=>a+n.q,0)/w.length-wo.reduce((a,n)=>a+n.q,0)/wo.length;return [t,Math.round(d),w.length]}).filter(Boolean).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1]));
  const debt=N.slice(-7).reduce((a,n)=>a+(SSET.goal*60-(n.asleep||0)),0);
  el.innerHTML=`<div class="statcards"><div class="panel"><div class="pb"><span class="dim">avg asleep</span><b class="num">${fmtHM(avg('asleep'))}</b></div></div><div class="panel"><div class="pb"><span class="dim">avg score</span><b class="num pink">${Math.round(avg('q'))}%</b></div></div><div class="panel"><div class="pb"><span class="dim">avg bedtime</span><b class="num">${hm(bt.reduce((a,b)=>a+b,0)/bt.length)}</b></div></div><div class="panel"><div class="pb"><span class="dim">7-day sleep ${debt>0?'debt':'surplus'}</span><b class="num ${debt>0?'bad':'ok'}">${fmtHM(Math.abs(debt))}</b></div></div></div>
  <div class="panel"><div class="ph"><span class="tag">last ${L.length} nights</span><span class="dim">goal ${SSET.goal} h</span></div><div class="pb"><div class="slbars" style="grid-template-columns:repeat(${L.length},1fr)">${L.map(n=>{const a=n.asleep||1;return `<div><span class="stk" style="height:${(n.asleep||0)/mx*100}%"><i style="flex:${n.deep};background:#9b5cff"></i><i style="flex:${n.core};background:#6b7cff"></i><i style="flex:${n.rem};background:#05d9e8"></i></span><em style="bottom:${SSET.goal*60/mx*100}%"></em><span class="l">${new Date(n.k+'T12:00').toLocaleDateString('en-GB',{weekday:'narrow'})}</span></div>`}).join('')}</div></div></div>
  <div class="grid2"><div class="panel"><div class="ph"><span class="tag">stages · average</span></div><div class="pb fins"><div>▸ deep <b>${fmtHM(avg('deep'))}</b> <span class="dim">(${Math.round(avg('deep')/Math.max(1,avg('asleep'))*100)}%)</span></div><div>▸ REM <b>${fmtHM(avg('rem'))}</b> <span class="dim">(${Math.round(avg('rem')/Math.max(1,avg('asleep'))*100)}%)</span></div><div>▸ awake <b>${Math.round(avg('awake'))} min</b> a night</div><div>▸ bedtime varies <b>±${Math.round(sd(bt))} min</b>, wake-up <b>±${Math.round(sd(wk))} min</b></div></div></div>
  <div class="panel"><div class="ph"><span class="tag">what affects your sleep</span></div><div class="pb fins">${tagI.length?tagI.map(([t,d,c])=>`<div>▸ <b>${esc(t)}</b>: score ${d>=0?'+':''}${d}% <span class="dim">(${c} nights)</span></div>`).join(''):'<div class="dim">Tag a few mornings with sleep notes (gym, caffeine…) and this shows what helps or hurts.</div>'}</div></div></div>`}

/* ---------- setup: watch sync, wake-up mission, reminders ---------- */
function sSetup(){const el=$('sleepBody'),S=SSET;const tok=SCFG&&SCFG.token;const url=SFN+'?token='+(tok||'…');const wurl=location.origin+location.pathname+'#wake='+encodeURIComponent(JSON.stringify({m:S.miss,d:S.diff,n:S.shakes,c:S.code,s:S.snd}));
  el.innerHTML=`<div class="panel"><div class="ph"><span class="tag">1 · apple watch → app (once, ~5 min)</span></div><div class="pb slsteps">
    <ol><li>Wear your Watch to bed with <b>Sleep</b> on (Health → Sleep → set a schedule).</li>
    <li>Open <b>Shortcuts</b> → <b>+</b> → name it <b>Send sleep</b>. Add these actions:<br>
      <b>Find Health Samples</b> — Type: <i>Sleep Analysis</i>, filter: <i>Start Date is in the last 1 days</i>.<br>
      <b>Repeat with Each</b> → inside it add <b>Text</b>: <code>Start Date|End Date|Value</code> (tap each word to insert the variable from <i>Repeat Item</i>; set both dates' format to <i>ISO 8601</i>).<br>
      After the repeat: <b>Combine Text</b> (Repeat Results) with <i>New Lines</i>.<br>
      For recovery (Whoop stats) add, before the upload: <b>Find Health Samples</b> → <i>Heart Rate Variability</i>, last 1 day → <b>Calculate Statistics</b> <i>Average</i>; do the same for <i>Resting Heart Rate</i> and <i>Respiratory Rate</i>; and <i>Active Energy</i> + <i>Steps</i> with Start Date <i>is yesterday</i> → <i>Sum</i>.<br>
      Then one <b>Text</b> action: <code>Combined Text</code> + new lines <code>HRV|Average</code> <code>Resting Heart Rate|Average</code> <code>Respiratory Rate|Average</code> <code>Active Energy|Sum</code> <code>Steps|Sum</code> (insert each statistic as a variable).<br>
      <b>Get Contents of URL</b> — URL below, Method <i>POST</i>, Request Body <i>File</i> → that Text.</li>
    <li>Shortcuts → <b>Automation</b> → <b>+</b> → <b>Time of Day</b> 10:00 daily (or <b>Alarm → is stopped</b>) → <b>Run Immediately</b> → run <b>Send sleep</b>.</li></ol>
    <div class="dim" style="font-size:11px">your private upload link</div>${tok?`<div class="slurl"><code id="slUrl">${esc(url)}</code><button class="iconbtn" type="button" data-copy="slUrl">copy</button></div>`:'<div class="dim">link not ready — reopen the app in a minute</div>'}</div></div>
  <div class="panel"><div class="ph"><span class="tag">2 · wake-up mission (Alarmy style)</span></div><div class="pb">
    <div class="dim" style="font-size:12px;margin-bottom:8px">Your iPhone alarm rings as normal. Stopping it opens this mission, which keeps ringing until you finish it.</div>
    <div class="seg mini">${SMISS.map(([k,l])=>`<button type="button" data-slm="${k}" aria-pressed="${S.miss===k}">${l}</button>`).join('')}</div>
    <div class="slmd dim" style="margin-top:8px">${S.miss==='math'?`difficulty <span class="seg mini" style="display:inline-flex">${[1,2,3].map(d=>`<button type="button" data-sld="${d}" aria-pressed="${S.diff===d}">${['easy','medium','hard'][d-1]}</button>`).join('')}</span>`:S.miss==='shake'?`shakes <input class="inp num" id="slShk" value="${S.shakes}" style="width:60px;display:inline-block">`:S.miss==='scan'?`${S.code?`registered <b>${esc(S.code)}</b> `:''}<button class="iconbtn" type="button" id="slReg">${S.code?'change':'register'} barcode</button>`:'type a motivational line exactly'}</div>
    <div class="dim" style="margin:10px 0 4px;font-size:12px">sound</div><div class="seg mini">${SSND.map(([k,l])=>`<button type="button" data-sls="${k}" aria-pressed="${S.snd===k}">${l}</button>`).join('')}</div>
    <div class="row" style="gap:6px;margin-top:10px;flex-wrap:wrap"><button class="iconbtn" type="button" id="slTest">▶ preview sound</button><button class="iconbtn" type="button" id="slTry">try the mission</button></div>
    <ol class="slsteps" style="margin-top:10px"><li>Shortcuts → <b>Automation</b> → <b>+</b> → <b>Alarm</b> → <b>Is Stopped</b> (any alarm) → <b>Run Immediately</b>.</li><li>Action: <b>Open URLs</b> → paste the link below.</li></ol>
    <div class="slurl"><code id="slWake">${esc(wurl)}</code><button class="iconbtn" type="button" data-copy="slWake">copy</button></div><div class="dim" style="font-size:11px">re-copy this link if you change the mission settings</div></div></div>
  <div class="panel"><div class="ph"><span class="tag">3 · schedule</span></div><div class="pb fform">
    <label class="fl">usual wake-up<input type="time" class="inp" id="slW" value="${S.wake}"></label><label class="fl">sleep goal (hours)<input class="inp num" id="slG" value="${S.goal}" inputmode="decimal"></label>
    <label class="fl" style="grid-column:1/-1"><span><input type="checkbox" id="slBedOn" ${S.bedOn?'checked':''}> bedtime reminder 30 min before ${sBedFor()} (needs notifications on 🔔)</span></label></div></div>`;
  el.onchange=e=>{const t=e.target;if(t.id==='slShk'){S.shakes=Math.max(5,+t.value||30)}if(t.id==='slW')S.wake=t.value;if(t.id==='slG')S.goal=Math.max(4,Math.min(12,+t.value||8));if(t.id==='slBedOn')S.bedOn=t.checked;saveSS();if(typeof pushSync==='function')pushSync();sSetup()};
  el.onclick=e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;
    if(d.copy){const v=$(d.copy).textContent;navigator.clipboard&&navigator.clipboard.writeText(v).then(()=>{b.textContent='copied ✓'}).catch(()=>{});return}
    if(d.slm){S.miss=d.slm;saveSS();sSetup();return}if(d.sld){S.diff=+d.sld;saveSS();sSetup();return}if(d.sls){S.snd=d.sls;saveSS();sSetup();return}
    if(b.id==='slTest'){sAlarmSound(true);setTimeout(sAlarmStop,3500);return}if(b.id==='slTry'){sMission(true);return}if(b.id==='slReg')sRegister()}}

/* ---------- #wake: opened by the "alarm stopped" automation (works signed out, in Safari too) ---------- */
function sWakeMode(){let p={};try{p=JSON.parse(decodeURIComponent(location.hash.slice(6)))}catch(e){}
  SSET={wake:'07:30',goal:8,miss:p.m||'math',diff:+p.d||2,shakes:+p.n||30,snd:p.s||'rise',code:p.c||'',...(SSET||{}),...(p.m?{miss:p.m}:{})};
  const o=$('sleepNight');o.hidden=false;document.body.classList.add('sleeping');
  o.innerHTML=`<div class="smhead"><span class="tag pink">wake up</span><b class="num">${pad(new Date().getHours())}:${pad(new Date().getMinutes())}</b></div><button class="btn p slgo" type="button" id="wkGo">tap to start your mission</button><div class="dim" style="font-size:11px">the alarm keeps going until it's done</div>`;
  $('wkGo').onclick=async()=>{try{SAC=SAC||new (window.AudioContext||window.webkitAudioContext)();await SAC.resume()}catch(e){}try{if(SSET.miss==='shake'&&typeof DeviceMotionEvent!=='undefined'&&DeviceMotionEvent.requestPermission)await DeviceMotionEvent.requestPermission()}catch(e){}
    if(SSET.miss==='shake')addEventListener('devicemotion',sMotion);sAlarmSound(false);sMission('wake')}}
function sAwake(){const o=$('sleepNight');history.replaceState(null,'',location.pathname+'#today');
  o.innerHTML=`<div class="smq">you're up ✓</div><div class="dim">a wake-up check pops up in 3 minutes — tap it or the alarm comes back</div><button class="btn" type="button" id="wkOk" style="margin-top:14px">ok</button>`;
  $('wkOk').onclick=()=>{o.hidden=true;document.body.classList.remove('sleeping')};
  setTimeout(()=>{o.hidden=false;document.body.classList.add('sleeping');let left=90;o.innerHTML=`<div class="smq">still awake?</div><div class="smshake num" id="scT">${left}</div><button class="btn p slgo" type="button" id="scOk">yes, I'm up</button>`;
    const t=setInterval(()=>{left--;if($('scT'))$('scT').textContent=left;if(left<=0){clearInterval(t);sAlarmSound(false);sMission('check')}},1000);$('scOk').onclick=()=>{clearInterval(t);o.hidden=true;document.body.classList.remove('sleeping')}},3*60e3)}
let SAC=null;
function sMotion(e){const g=e.accelerationIncludingGravity||e.acceleration;if(!g)return;const m=Math.sqrt((g.x||0)**2+(g.y||0)**2+(g.z||0)**2);if(sShake.on&&Math.abs(m-9.8)>14){const t=Date.now();if(t-sShake.lt>220){sShake.lt=t;sShake.n++;sShake.cb&&sShake.cb()}}}
const sShake={on:false,n:0,lt:0,cb:null};

/* alarm sound (generated, ramps up over a minute) */
let SAL=null;
function sAlarmSound(preview){try{SAC=SAC||new (window.AudioContext||window.webkitAudioContext)();SAC.resume()}catch(e){return}
  sAlarmStop();const g=SAC.createGain();g.gain.value=preview?.5:.08;g.connect(SAC.destination);if(!preview)g.gain.linearRampToValueAtTime(1,SAC.currentTime+60);
  const kind=SSET.snd;let i=0;const beep=()=>{if(!SAL)return;const t=SAC.currentTime;
    if(kind==='classic'){[0,.18,.36,.54].forEach(d=>{const o=SAC.createOscillator(),e=SAC.createGain();o.type='square';o.frequency.value=1760;e.gain.setValueAtTime(.35,t+d);e.gain.setValueAtTime(0,t+d+.1);o.connect(e).connect(g);o.start(t+d);o.stop(t+d+.12)})}
    else if(kind==='siren'){const o=SAC.createOscillator(),e=SAC.createGain();o.type='sawtooth';o.frequency.setValueAtTime(600,t);o.frequency.linearRampToValueAtTime(1400,t+.6);o.frequency.linearRampToValueAtTime(600,t+1.2);e.gain.value=.3;o.connect(e).connect(g);o.start(t);o.stop(t+1.2)}
    else{const n=[523.25,659.25,783.99,1046.5,783.99,659.25][i++%6];const o=SAC.createOscillator(),e=SAC.createGain();o.type='triangle';o.frequency.value=n;e.gain.setValueAtTime(.0001,t);e.gain.exponentialRampToValueAtTime(.6,t+.02);e.gain.exponentialRampToValueAtTime(.0001,t+.9);o.connect(e).connect(g);o.start(t);o.stop(t+1)}};
  SAL={g,t:setInterval(beep,kind==='classic'?1000:kind==='siren'?1200:420)};beep();try{navigator.vibrate&&navigator.vibrate([400,200,400,200,400])}catch(e){}}
function sAlarmStop(){if(SAL){clearInterval(SAL.t);try{SAL.g.disconnect()}catch(e){}SAL=null}}

/* missions: alarm keeps going until it's solved */
function sMission(test){const o=$('sleepNight');o.hidden=false;document.body.classList.add('sleeping');const S=SSET;const done=()=>{sAlarmStop();sShake.on=false;if(test==='check'||test===true){o.hidden=true;document.body.classList.remove('sleeping');return}sAwake()};
  const snz='';
  const head=`<div class="smhead"><span class="tag pink">${test===true?'mission test':'wake up'}</span><b class="num">${pad(new Date().getHours())}:${pad(new Date().getMinutes())}</b></div>`;
  if(test===true)sAlarmStop();
  if(S.miss==='math'){const mk=()=>{const d=S.diff;const r=n=>Math.floor(Math.random()*n);let a,b,c,q,ans;if(d===1){a=10+r(40);b=10+r(40);q=`${a} + ${b}`;ans=a+b}else if(d===2){a=12+r(30);b=3+r(9);c=10+r(90);q=`${a} × ${b} + ${c}`;ans=a*b+c}else{a=13+r(40);b=12+r(20);c=100+r(400);q=`${a} × ${b} − ${c}`;ans=a*b-c}return {q,ans}};
    let left=3,cur=mk();const draw=()=>{o.innerHTML=head+`<div class="smq num">${cur.q} =</div><input class="smin num" id="smA" inputmode="none" readonly autocomplete="off"><div class="dim">${left} to go</div><div class="smkp">${[1,2,3,4,5,6,7,8,9,'−',0,'⌫'].map(k=>`<button type="button" data-k="${k}">${k}</button>`).join('')}</div><button class="btn p" type="button" id="smOk">submit</button>${snz}`;bind()};
    const bind=()=>{o.onclick=e=>{const b=e.target.closest('button');if(!b)return;const i=$('smA');if(b.dataset.k!=null){const k=b.dataset.k;i.value=k==='⌫'?i.value.slice(0,-1):k==='−'?(i.value.startsWith('-')?i.value.slice(1):'-'+i.value):i.value+k;return}
      if(b.id==='smOk'){if(+i.value===cur.ans&&i.value!==''){left--;if(!left)return done();cur=mk();draw()}else{i.value='';i.classList.add('bad');setTimeout(()=>i.classList.remove('bad'),400)}}if(b.id==='smSnz')sSnooze()}};draw()}
  else if(S.miss==='shake'){sShake.on=true;addEventListener('devicemotion',sMotion);sShake.n=0;const need=S.shakes;o.innerHTML=head+`<div class="smq">shake it</div><div class="smshake num" id="smN">0 / ${need}</div><div class="smbar"><i id="smBar"></i></div>${snz}<div class="dim" style="font-size:11px">no motion sensor? <button class="iconbtn" type="button" id="smAlt">switch to maths</button></div>`;
    sShake.cb=()=>{$('smN').textContent=sShake.n+' / '+need;$('smBar').style.width=Math.min(100,sShake.n/need*100)+'%';if(sShake.n>=need){sShake.cb=null;done()}};
    o.onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.id==='smSnz')sSnooze();if(b.id==='smAlt'){sShake.on=false;const m=S.miss;S.miss='math';sMission(test);S.miss=m}}}
  else if(S.miss==='type'){const ph=SPHRASE[Math.floor(Math.random()*SPHRASE.length)];o.innerHTML=head+`<div class="smq" style="font-size:20px">type exactly:</div><div class="smph">${esc(ph)}</div><input class="smin" id="smT" autocomplete="off" autocapitalize="off" spellcheck="false">${snz}`;
    $('smT').oninput=e=>{if(e.target.value.trim().toLowerCase()===ph.toLowerCase())done()};o.onclick=e=>{if(e.target.id==='smSnz')sSnooze()}}
  else{if(!S.code){const m=S.miss;S.miss='math';sMission(test);S.miss=m;return}
    o.innerHTML=head+`<div class="smq" style="font-size:20px">scan your barcode</div><div class="fscan"><video id="smV" playsinline muted></video><i class="fsline"></i></div><div class="dim" id="smMsg">find it and point the camera at it</div>${snz}`;
    sScanner($('smV'),code=>{if(code===S.code){sScanStop();done();return true}$('smMsg').textContent='wrong barcode — that\'s not the one';return false});o.onclick=e=>{if(e.target.id==='smSnz'){sScanStop();sSnooze()}}}}

let SSC=null;
async function sScanner(v,cb){sScanStop();try{
  if('BarcodeDetector' in window){const st=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});SSC={st};v.srcObject=st;await v.play();const det=new BarcodeDetector({formats:['ean_13','ean_8','upc_a','upc_e','code_128']});
    const loop=async()=>{if(!SSC||!v.isConnected)return sScanStop();try{const r=await det.detect(v);if(r[0]&&cb(r[0].rawValue))return}catch(e){}setTimeout(loop,250)};loop()}
  else{if(!window.ZXing)await new Promise((res,rej)=>{const s=document.createElement('script');s.src='vendor/zxing.min.js';s.onload=res;s.onerror=rej;document.head.appendChild(s)});
    const zx=new ZXing.BrowserMultiFormatReader();SSC={zx};zx.decodeFromConstraints({video:{facingMode:'environment'}},v,res=>{if(res&&SSC&&cb(res.getText()))sScanStop()})}}catch(e){}}
function sScanStop(){if(!SSC)return;try{SSC.zx&&SSC.zx.reset()}catch(e){}if(SSC.st)SSC.st.getTracks().forEach(t=>t.stop());SSC=null}
function sRegister(){openSheet('register barcode',`<div class="dim" style="margin-bottom:8px">Scan something that lives in another room — toothpaste, shower gel, a cereal box.</div><div class="fscan"><video id="srV" playsinline muted></video><i class="fsline"></i></div><div class="row" style="gap:6px;margin-top:8px"><input class="inp num" id="srC" placeholder="or type the number" style="flex:1"><button class="btn p" type="button" id="srOk">save</button></div>`);
  const saveC=c=>{SSET.code=c;saveSS();sScanStop();closeSheet();sTonight()};sScanner($('srV'),c=>{saveC(c);return true});$('srOk').onclick=()=>{const c=$('srC').value.replace(/\s/g,'');if(c)saveC(c)};$('sheetX')&&$('sheetX').addEventListener('click',sScanStop,{once:true})}


/* ---------- recovery / strain (Whoop-style) ---------- */
const sAddD=(k,n)=>{const x=new Date(k+'T12:00');x.setDate(x.getDate()+n);return ymd(x)};
function sStrain(day){/* strain for a calendar day: active energy arrives the next morning */const h=SHEALTH[sAddD(day,1)]||{};let load=+h.kcal||0;if(!load&&h.steps)load=h.steps*0.04;
  try{if(typeof WORKOUTS!=='undefined')WORKOUTS.filter(w=>w.date===day).forEach(w=>{const m=w.endedAt&&w.startedAt?(new Date(w.endedAt)-new Date(w.startedAt))/6e4:45;if(!h.kcal)load+=m*5;load+=Math.min(150,(w.vol||0)/100)})}catch(e){}
  return load?Math.round(21*(1-Math.exp(-load/650))*10)/10:null}
function sBase(k,f,days=30){const v=[];for(let i=1;i<=days;i++){const d=sAddD(k,-i);const x=f==='asleep'?(SNIGHTS[d]||{}).asleep:(SHEALTH[d]||{})[f];if(x!=null&&!isNaN(+x)&&+x>0)v.push(+x)}if(v.length<3)return null;const m=v.reduce((a,b)=>a+b,0)/v.length;const sd=Math.sqrt(v.reduce((a,b)=>a+(b-m)**2,0)/v.length);return {m,sd,n:v.length}}
function sNeed(k){const g=(SSET&&SSET.goal||8)*60;const st=sStrain(sAddD(k,-1));let need=g+(st&&st>10?(st-10)*6:0);let debt=0;for(let i=1;i<=3;i++){const n=SNIGHTS[sAddD(k,-i)];if(n&&n.asleep)debt+=Math.max(0,g-n.asleep)}return Math.round(need+Math.min(60,debt*.3))}
function sRec(k){const h=SHEALTH[k]||{},n=SNIGHTS[k];const need=sNeed(k);const perf=n&&n.asleep?Math.min(100,n.asleep/need*100):null;
  const bH=sBase(k,'hrv'),bR=sBase(k,'rhr'),bRR=sBase(k,'rr');let s=null,est=false;
  if(h.hrv){const zH=bH?(h.hrv-bH.m)/Math.max(5,bH.sd):0,zR=h.rhr&&bR?(h.rhr-bR.m)/Math.max(2,bR.sd):0;s=52+22*zH-14*zR+(perf!=null?.35*(perf-80):0);if(h.rr&&bRR&&h.rr>bRR.m+1)s-=8;est=!bH}
  else if(perf!=null){s=perf*.85;est=true}
  return s==null?null:{v:Math.round(Math.max(1,Math.min(99,s))),perf:perf!=null?Math.round(perf):null,need,est,h,bH,bR}}
const sZone=v=>v>=67?['#16ec06','green','your body is primed — push it today','14 – 18']:v>=34?['#ffde00','yellow','maintain — moderate strain','10 – 14']:['#ff0026','red','prioritise rest and recovery','0 – 10'];
function sRecovery(){const el=$('sleepBody');const k=DAYK;const R=sRec(k)||sRec(sAddD(k,-1));const kk=sRec(k)?k:sAddD(k,-1);const yS=sStrain(sAddD(k,-1));
  if(!R&&yS==null){el.innerHTML=`<div class="panel"><div class="pb"><b>recovery needs your Watch data</b><div class="dim" style="margin-top:6px">Finish the Shortcut in <b>setup</b> (sleep + the HRV / heart-rate lines). After a few mornings you'll get a daily recovery %, strain and trends like Whoop.</div><button class="btn p" type="button" data-go="setup" style="margin-top:10px">open setup</button></div></div>`;el.onclick=e=>{if(e.target.closest('[data-go]')){SV='setup';renderSleep()}};return}
  const z=R?sZone(R.v):['#7a7a7a','—','',''];const C=2*Math.PI*78;const n=SNIGHTS[kk];
  const days=[...Array(30)].map((_,i)=>sAddD(k,-29+i));const recs=days.map(d=>({d,r:sRec(d),s:sStrain(d)}));
  const line=(vals,col,h=70)=>{const pts=vals.map((v,i)=>v==null?null:[i,v]).filter(Boolean);if(pts.length<2)return '<div class="dim" style="font-size:11px">not enough data yet</div>';const lo=Math.min(...pts.map(p=>p[1])),hi=Math.max(...pts.map(p=>p[1]));const Y=v=>h-6-(v-lo)/Math.max(1,hi-lo)*(h-12);
    return `<svg class="slgraph" viewBox="0 0 600 ${h}" preserveAspectRatio="none" style="height:${h}px"><polyline points="${pts.map(([i,v])=>`${(i/29*600).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')}" fill="none" stroke="${col}" stroke-width="2"/>${pts.map(([i,v])=>`<circle cx="${(i/29*600).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="2.5" fill="${col}"/>`).join('')}</svg><div class="slaxis dim num"><span>${Math.round(lo)}</span><span>30 days</span><span>${Math.round(hi)}</span></div>`};
  el.innerHTML=`<div class="wrec panel"><div class="pb"><div class="wring"><svg viewBox="0 0 180 180"><circle cx="90" cy="90" r="78" class="rb"/><circle cx="90" cy="90" r="78" class="rf" style="stroke:${z[0]};stroke-dasharray:${C};stroke-dashoffset:${R?C*(1-R.v/100):C};filter:drop-shadow(0 0 10px ${z[0]})"/></svg><div><span class="dim">recovery${kk!==k?' · yesterday':''}</span><b class="num" style="color:${z[0]}">${R?R.v+'%':'—'}</b><span class="dim">${R&&R.est?'estimated':''}</span></div></div>
    <div class="wside"><div class="wmsg" style="color:${z[0]}">${esc(z[2])}</div>
      <div class="wkv num"><div><span>HRV</span><b>${R&&R.h.hrv?Math.round(R.h.hrv)+' ms':'—'}</b><em>${R&&R.bH?`${R.h.hrv>=R.bH.m?'▲':'▼'} avg ${Math.round(R.bH.m)}`:''}</em></div><div><span>resting HR</span><b>${R&&R.h.rhr?Math.round(R.h.rhr)+' bpm':'—'}</b><em>${R&&R.bR?`${R.h.rhr<=R.bR.m?'▼':'▲'} avg ${Math.round(R.bR.m)}`:''}</em></div><div><span>sleep performance</span><b>${R&&R.perf!=null?R.perf+'%':'—'}</b><em>${n?fmtHM(n.asleep)+' of '+fmtHM(R?R.need:0):''}</em></div><div><span>resp. rate</span><b>${R&&R.h.rr?R.h.rr.toFixed(1):'—'}</b><em></em></div></div></div></div></div>
  <div class="grid2"><div class="panel"><div class="ph"><span class="tag">strain</span><span class="dim">0 – 21</span></div><div class="pb"><div class="wstrain"><div><span class="dim">yesterday</span><b class="num">${yS!=null?yS.toFixed(1):'—'}</b></div><div><span class="dim">today's target</span><b class="num" style="color:${z[0]}">${R?z[3]:'—'}</b></div></div><div class="wsbar"><i style="width:${(yS||0)/21*100}%"></i>${R?`<em style="left:${parseInt(z[3])/21*100}%;width:${(parseInt(z[3].split('–')[1])-parseInt(z[3]))/21*100}%"></em>`:''}</div><div class="dim" style="font-size:11px;margin-top:6px">from active energy, steps and logged gym sessions</div></div></div>
    <div class="panel"><div class="ph"><span class="tag">sleep coach</span></div><div class="pb fins"><div>▸ tonight you need <b>${fmtHM(sNeed(sAddD(k,1)))}</b></div><div>▸ for a ${SSET.wake} wake-up, be asleep by <b>${(()=>{const [h,m]=SSET.wake.split(':').map(Number);let t=(h*60+m-sNeed(sAddD(k,1))+1440)%1440;return pad(Math.floor(t/60))+':'+pad(t%60)})()}</b></div>${n?`<div>▸ last night: deep ${fmtHM(n.deep)}, REM ${fmtHM(n.rem)}, awake ${Math.round(n.awake||0)} min</div>`:''}</div></div></div>
  <div class="panel"><div class="ph"><span class="tag">recovery · 30 days</span></div><div class="pb"><div class="wbars">${recs.map(o=>`<div title="${o.d}"><span style="height:${o.r?o.r.v:0}%;background:${o.r?sZone(o.r.v)[0]:'transparent'}"></span><i style="height:${o.s!=null?o.s/21*100:0}%"></i></div>`).join('')}</div><div class="dim" style="font-size:11px;margin-top:6px">bars = recovery · blue = strain</div></div></div>
  <div class="grid2"><div class="panel"><div class="ph"><span class="tag">HRV</span></div><div class="pb">${line(days.map(d=>(SHEALTH[d]||{}).hrv),'#05d9e8')}</div></div><div class="panel"><div class="ph"><span class="tag">resting heart rate</span></div><div class="pb">${line(days.map(d=>(SHEALTH[d]||{}).rhr),'#ff2a6d')}</div></div></div>`;
  el.onclick=null}
