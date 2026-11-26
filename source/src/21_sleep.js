/* ================= SLEEP =================
   Tracking comes from your Apple Watch: an iPhone Shortcut sends last night's Apple Health sleep to the
   "sleep-in" function every morning → doc sleep/w-YYYY-MM-DD {start,end,asleep,deep,rem,core,awake,segs,mood,tags}.
   Waking: your normal iPhone alarm rings; a Shortcut automation ("when alarm is stopped → open URL") opens
   #wake here, which keeps ringing until an Alarmy-style mission is done. */
const SMISS=[['math','maths'],['shake','shake'],['type','type a phrase'],['scan','scan a barcode']];
const SSND=[['rise','rising chime'],['classic','classic beeps'],['siren','siren']];
const STAGS_FN=()=>{const st=(typeof M!=='undefined'&&M&&M.stack)||[];return [...new Set(st.filter(slMatch).map(s=>String(s.name||'').trim()).filter(Boolean))]};
/* things taken or done that can hurt sleep: generic defaults plus your own, kept in sleep/settings.neg */
const SNEG_DEF=LX('slneg',['Caffeine','Late meal','Screens in bed','Late workout','Stress','Nap']);
const SNEG=()=>[...new Set([...SNEG_DEF,...((SSET&&SSET.neg)||[])])];
const SPHRASE=['I am awake and I am getting up now','Discipline is doing it when you do not feel like it','Get out of bed and win the morning','Everybody wants it until it is time to wake up'];
const SFN='https://ucnwefjblxqbmmwdbqhw.supabase.co/functions/v1/sleep-in';
let SHEALTH={};let SSET=null,SNIGHTS={},SV=({recovery:'sleep',last:'sleep',history:'sleep'})[LS.get('sleepv')]||LS.get('sleepv')||'sleep',sleepLoaded=false,SCFG=null;
const fmtHM=m=>{m=Math.round(m||0);return Math.floor(m/60)+'h '+pad(m%60)+'m'};
async function loadSleep(){if(sleepLoaded){renderSleep();return}
  const [s,rows,c,hr]=await Promise.all([load('sleep/settings'),listDocs('sleep/w-'),load('sleep/cfg'),listDocs('health/d-')]);hr.forEach(r=>{if(r.data)SHEALTH[r.path.slice(9)]=r.data});
  SSET={wake:'07:30',bed:'23:00',goal:8,miss:'math',diff:2,shakes:30,snd:'rise',code:'',...(s||{})};SCFG=c||{};
  rows.forEach(r=>{if(r.data)SNIGHTS[r.path.slice(8)]=r.data});sleepLoaded=true;renderSleep()}
watchPrefix('health/d-',(evt,path,data)=>{const k=path.slice(9);if(evt==='DELETE')delete SHEALTH[k];else if(data)SHEALTH[k]=data;if(cur==='sleep'&&SV!=='setup')renderSleep()});
watchPrefix('sleep/w-',(evt,path,data)=>{const k=path.slice(8);if(evt==='DELETE')delete SNIGHTS[k];else if(data)SNIGHTS[k]=data;if(cur==='sleep'&&!$('sheet').classList.contains('on'))renderSleep()});
const saveSS=()=>save('sleep/settings',SSET);
/* Sleep score 0–100, modelled on Oura / Fitbit / Apple: amounts (not %) of sleep dominate, so a short night can't score well.
   duration 40 · deep 15 · REM 15 · efficiency 10 · awake/restfulness 10 · timing 10. */
const sCl=x=>Math.max(0,Math.min(1,x));
function sQB(n){if(!n||!n.asleep)return null;const g=(SSET&&SSET.goal||8)*60,a=n.asleep,r=a/g;
  const dur=r>=1?(r>1.35?Math.max(.85,1-(r-1.35)):1):Math.pow(sCl((r-.4)/.6),1.1);
  const hasSt=(n.deep||0)+(n.rem||0)+(n.core||0)>0;
  const deep=sCl((n.deep||0)/(g*.16)),rem=sCl((n.rem||0)/(g*.1875));
  const bed=n.start&&n.end?(new Date(n.end)-new Date(n.start))/6e4:0;
  const eff=bed>a?sCl((a/bed-.75)/.17):1; /* share of time in bed asleep: 92%+ full, 75% zero */
  const aw=sWakes(n)!=null?sCl(1-(sWakes(n)-2)/10):sCl(1-((n.awake||0)-20)/70); /* wake-ups: ≤2 full, 12+ zero */
  let tim=1;if(n.start){const d=new Date(n.start),b=d.getHours()*60+d.getMinutes(),[h,m]=sBedFor().split(':').map(Number);let off=Math.abs(b-(h*60+m));off=Math.min(off,1440-off);tim=sCl(1-(off-30)/120)}
  const wk=sWakes(n),offM=n.start?Math.round(Math.abs((()=>{const d=new Date(n.start),b=d.getHours()*60+d.getMinutes(),[h,m]=sBedFor().split(':').map(Number);let o=Math.abs(b-(h*60+m));return Math.min(o,1440-o)})())):0;
  const P=[['Duration',dur,40,fmtHM(a)],['Deep',deep,15,Math.round(n.deep||0)+'m'],['REM',rem,15,Math.round(n.rem||0)+'m'],['Restfulness',aw,10,wk!=null?wk+' wake-up'+(wk===1?'':'s'):Math.round(n.awake||0)+'m awake'],['Timing',tim,5,n.start?offM+'m off':'']].filter(x=>hasSt||(x[0]!=='Deep'&&x[0]!=='REM'));
  const W=P.reduce((t,x)=>t+x[2],0);return {parts:P,score:Math.round(P.reduce((t,x)=>t+x[1]*x[2],0)/W*100)}}
/* one clean timeline from overlapping sources (Watch + phone): at every moment the most specific stage wins, gaps count as awake, blips under 3 min fold into their neighbour */
function sNorm(segs){const g=(segs||[]).map(([a,b,st])=>[+new Date(a),+new Date(b),st]).filter(x=>x[1]>x[0]);if(!g.length)return [];
  const P={deep:4,rem:3,awake:2,core:1};const bs=[...new Set(g.flatMap(x=>[x[0],x[1]]))].sort((a,b)=>a-b);const out=[];
  for(let i=0;i<bs.length-1;i++){const a=bs[i],b=bs[i+1];let best=null;for(const x of g)if(x[0]<=a&&x[1]>=b&&(!best||(P[x[2]]||0)>(P[best]||0)))best=x[2];const st=best||'awake';const l=out[out.length-1];if(l&&l[2]===st&&l[1]===a)l[1]=b;else out.push([a,b,st])}
  for(let k=0;k<3;k++)for(let i=out.length-1;i>=0;i--){if(out.length<2)break;if(out[i][1]-out[i][0]<18e4){const prev=out[i-1],next=out[i+1];if(prev){prev[1]=out[i][1];out.splice(i,1);if(next&&next[2]===prev[2]){prev[1]=next[1];out.splice(i,1)}}else if(next){next[0]=out[i][0];out.splice(i,1)}}}
  return out}
function sWakes(n){const g=sNorm(n.segs);const sl=g.filter(x=>x[2]!=='awake');if(!sl.length)return null;
  const t0=sl[0][0],t1=sl[sl.length-1][1];let c=0,end=-1;g.forEach(([a,b,st])=>{if(st!=='awake'||a<t0||b>t1)return;if(a-end>6e4)c++;end=b});return c}
function sQ(n){const b=sQB(n);return b?b.score:0}
function renderSleep(){if(!sleepLoaded){loadSleep();return}
  document.querySelectorAll('#sleepSeg [data-sv]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.sv===SV));
  const last=Object.keys(SNIGHTS).sort().pop();$('sleepSub').textContent=last?`${esc(nice(last))} · ${fmtHM(SNIGHTS[last].asleep)} · ${sQ(SNIGHTS[last])}%`:'apple watch sleep + wake-up missions';
  ({sleep:sMain,stats:sTrends,setup:sSetup}[SV]||sMain)()}
document.addEventListener('click',e=>{const b=e.target.closest('#sleepSeg [data-sv]');if(!b)return;SV=b.dataset.sv;LS.set('sleepv',SV);renderSleep()});

/* ---------- shared UI pieces ---------- */
const SLC={awake:'#ff7a6b',rem:'#5ac8fa',core:'#4f7cff',deep:'#8e5cff'},SLN={awake:'Awake',rem:'REM',core:'Core',deep:'Deep'};
const sQC=q=>q>=75?'#30d158':q>=50?'#ffd60a':'#ff453a';
const sT=d=>{const x=new Date(d);return pad(x.getHours())+':'+pad(x.getMinutes())};
const sRing=(v,col,size,sw,inner)=>{const r=50-sw/2;return `<div class="sl-ring" style="width:${size}px;height:${size}px"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="${r}" class="tr" stroke-width="${sw}"/>${v>0?`<circle cx="50" cy="50" r="${r}" class="fl" stroke="${col}" stroke-width="${sw}" pathLength="100" stroke-dasharray="${Math.min(100,v).toFixed(1)} 100"/>`:''}</svg><div class="in">${inner}</div></div>`};
const sStBar=n=>`<div class="sl-stbar">${['awake','rem','core','deep'].map(s=>`<i style="flex:${Math.max(0,n[s]||0)};background:${SLC[s]}"></i>`).join('')}</div>`;
const sEmpty=(t,d,btn)=>`<div class="sl-card sl-empty"><svg viewBox="0 0 24 24" width="34" height="34"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg><b>${t}</b><p>${d}</p>${btn?`<button class="btn p" type="button" data-go="setup">${btn}</button>`:''}</div>`;
const sGoSetup=el=>{el.onclick=e=>{if(e.target.closest('[data-go]')){SV='setup';renderSleep()}}};

/* hypnogram from watch stages */
function sHyp(n,h=120){const segs=n.segs||[];if(!segs.length)return '<div class="sl-note">No stage data for this night</div>';const t0=+new Date(n.start),t1=+new Date(n.end),W=1000,L={awake:0,rem:1,core:2,deep:3};
  const lh=h/4,X=t=>((t-t0)/(t1-t0||1))*W;
  const rects=segs.map(([s,e,st])=>{const l=L[st]??2;return `<rect x="${X(+new Date(s)).toFixed(1)}" y="${(l*lh+lh*.18).toFixed(1)}" width="${Math.max(2,X(+new Date(e))-X(+new Date(s))).toFixed(1)}" height="${(lh*.64).toFixed(1)}" fill="${SLC[st]||SLC.core}" rx="3"/>`}).join('');
  const mid=sT(t0+(t1-t0)/2);
  return `<div class="sl-hyp"><div class="sl-hyl">${['awake','rem','core','deep'].map(s=>`<span>${SLN[s]}</span>`).join('')}</div><div><svg viewBox="0 0 ${W} ${h}" preserveAspectRatio="none" style="height:${h}px">${[1,2,3].map(i=>`<line x1="0" x2="${W}" y1="${i*lh}" y2="${i*lh}" stroke="rgba(255,255,255,.06)" vector-effect="non-scaling-stroke"/>`).join('')}${rects}</svg><div class="sl-axis"><span>${sT(n.start)}</span><span>${mid}</span><span>${sT(n.end)}</span></div></div></div>`}
function sNight(k){const n=SNIGHTS[k];const q=sQ(n);const a=n.asleep||1;const pc=x=>Math.round((n[x]||0)/a*100);
  return `<div class="sl-card sl-night" data-sn="${k}">
    <div class="sl-nh"><div><div class="sl-eyebrow">${esc(nice(k))}</div><div class="sl-dur num">${fmtHM(n.asleep).replace(/(\d+)h (\d+)m/,'$1<small>h</small> $2<small>m</small>')}</div><div class="sl-sub">asleep · ${sT(n.start)} – ${sT(n.end)}</div></div>${sRing(q,sQC(q),64,10,`<b class="num">${q}</b><span>Score</span>`)}</div>
    ${sStBar(n)}
    <div class="sl-legend">${['awake','rem','core','deep'].map(s=>`<div><i style="background:${SLC[s]}"></i><span>${SLN[s]}</span><b class="num">${s==='awake'?Math.round(n.awake||0)+'m':fmtHM(n[s])}</b><em class="num">${s==='awake'?'':pc(s)+'%'}</em></div>`).join('')}</div>
    ${sHyp(n,112)}${sQBars(n)}</div>`}
function sQBars(n){const b=sQB(n);if(!b)return '';return `<div class="sl-qb">${b.parts.map(([l,v,,x])=>{const p=Math.round(v*100);return `<div><span>${l}<small>${x||''}</small></span><i><b style="width:${p}%;background:${sQC(p)}"></b></i><em class="num">${p}</em></div>`}).join('')}</div>`}
function sRow(k){const n=SNIGHTS[k];const q=sQ(n);
  return `<button type="button" class="sl-hrow" data-sn="${k}"><span class="sl-hd"><b>${esc(nice(k))}</b><small class="num">${n.start?sT(n.start)+' – '+sT(n.end):''}</small></span><span class="sl-hbar">${sStBar(n)}</span><span class="sl-hv num">${fmtHM(n.asleep)}</span><span class="sl-pill num" style="--c:${sQC(q)}">${q}</span><svg class="sl-chev" viewBox="0 0 8 14" width="7" height="12"><path d="M1 1l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`}
function sLast(){const el=$('sleepBody');const k=Object.keys(SNIGHTS).sort().pop();
  if(!k){el.innerHTML=sEmpty('No nights yet','Wear your Apple Watch to bed and finish the one-time setup, and every morning your sleep lands here automatically','Open setup');sGoSetup(el);return}
  const n=SNIGHTS[k];
  el.innerHTML=sNight(k)+`<div class="sl-card"><div class="sl-h"><span>How do you feel?</span></div><div class="sl-mood">${['😫','😕','😐','🙂','😁'].map((m,i)=>`<button type="button" data-mood="${i+1}" aria-pressed="${n.mood===i+1}">${m}</button>`).join('')}</div>
    <div class="sl-h" style="margin-top:18px"><span>Sleep notes</span></div><div class="chips" style="margin:0">${STAGS_FN().map(t=>`<button type="button" class="chip${(n.tags||[]).includes(t)?' on':''}" data-tag="${esc(t)}">${t}</button>`).join('')}</div></div>
    <div class="sl-card sl-tonight"><span class="sl-ico"><svg viewBox="0 0 24 24" width="20" height="20"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" fill="currentColor"/></svg></span><div><div class="sl-sub">Tonight</div><b>Be asleep by <span class="num">${sBedFor()}</span></b><div class="sl-sub">${SSET.goal} h goal · ${SSET.wake} wake-up${SSET.bedOn?' · reminder 30 min before':''}</div></div></div>`;
  el.onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.mood){n.mood=+b.dataset.mood;save('sleep/w-'+k,n);sLast();return}
    if(b.dataset.tag){const t=b.dataset.tag;n.tags=(n.tags||[]).includes(t)?n.tags.filter(x=>x!==t):(n.tags||[]).concat(t);save('sleep/w-'+k,n);sLast()}}}
function sBedFor(){const S=SSET||{wake:'07:30',goal:8};const [h,m]=String(S.wake||'07:30').split(':').map(Number);let t=h*60+m-(S.goal||8)*60;t=(t+1440)%1440;return pad(Math.floor(t/60))+':'+pad(t%60)}
function sHistory(){const el=$('sleepBody');const ks=Object.keys(SNIGHTS).sort().reverse();
  if(!ks.length){el.innerHTML=sEmpty('No nights yet','Your synced nights will be listed here.','Open setup');sGoSetup(el);return}
  el.innerHTML=`<div class="sl-card sl-list">${ks.map(sRow).join('')}</div>`;
  el.onclick=e=>{const c=e.target.closest('[data-sn]');if(!c)return;const k=c.dataset.sn;openSheet(nice(k).toLowerCase(),sNight(k)+`<div class="bigbtns"><button class="btn d" type="button" id="snDel">Delete night</button><span style="flex:1"></span><button class="btn p" type="button" id="snOk">Done</button></div>`);
    $('snOk').onclick=closeSheet;$('snDel').onclick=function(){if(!this.dataset.arm){this.dataset.arm=1;this.textContent='Tap again to delete';return}delete SNIGHTS[k];removeDoc('sleep/w-'+k);closeSheet();renderSleep()}}}
function sStats(){const el=$('sleepBody');const N=Object.keys(SNIGHTS).sort().slice(-30).map(k=>({k,...SNIGHTS[k],q:sQ(SNIGHTS[k])}));
  if(!N.length){el.innerHTML=sEmpty('No stats yet','Stats appear after your first synced night.');el.onclick=null;return}
  const avg=f=>N.reduce((a,n)=>a+(+n[f]||0),0)/N.length;const bt=N.map(n=>{const d=new Date(n.start);let m=d.getHours()*60+d.getMinutes();if(m<720)m+=1440;return m});const wk=N.map(n=>{const d=new Date(n.end);return d.getHours()*60+d.getMinutes()});
  const sd=a=>{const m=a.reduce((x,y)=>x+y,0)/a.length;return Math.sqrt(a.reduce((x,y)=>x+(y-m)**2,0)/a.length)};const hm=m=>{m=Math.round(m)%1440;return pad(Math.floor(m/60))+':'+pad(m%60)};
  const L=N.slice(-14);const mx=Math.max(...L.map(n=>n.asleep||0),SSET.goal*60)*1.08;
  const tagI=[...new Set([...STAGS_FN(),...SNEG()])].map(t=>{const w=N.filter(n=>(n.tags||[]).includes(t)),wo=N.filter(n=>!(n.tags||[]).includes(t));if(w.length<2||wo.length<2)return null;const d=w.reduce((a,n)=>a+n.q,0)/w.length-wo.reduce((a,n)=>a+n.q,0)/wo.length;return [t,Math.round(d),w.length]}).filter(Boolean).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1]));
  const debt=N.slice(-7).reduce((a,n)=>a+(SSET.goal*60-(n.asleep||0)),0);const aq=Math.round(avg('q'));const as=Math.max(1,avg('asleep'));
  const tile=(l,v,s,c)=>`<div class="sl-tile"><span>${l}</span><b class="num"${c?` style="color:${c}"`:''}>${v}</b>${s?`<em>${s}</em>`:''}</div>`;
  el.innerHTML=`<div class="sl-tiles sl-t4">${tile('Avg asleep',fmtHM(avg('asleep')),`goal ${SSET.goal}h`)}${tile('Avg score',aq+'%','',sQC(aq))}${tile('Avg bedtime',hm(bt.reduce((a,b)=>a+b,0)/bt.length),`±${Math.round(sd(bt))} min`)}${tile('7-day '+(debt>0?'debt':'surplus'),fmtHM(Math.abs(debt)),'',debt>0?'#ff453a':'#30d158')}</div>
  <div class="sl-card"><div class="sl-h"><span>Last ${L.length} nights</span><em>goal ${SSET.goal} h</em></div><div class="sl-cols" style="grid-template-columns:repeat(${L.length},1fr)"><em class="sl-goal" style="bottom:calc(22px + (100% - 22px) * ${(SSET.goal*60/mx).toFixed(3)})"></em>${L.map(n=>`<div><span class="stk" style="height:calc((100% - 22px) * ${((n.asleep||0)/mx).toFixed(3)})"><i style="flex:${n.rem||0};background:${SLC.rem}"></i><i style="flex:${n.core||0};background:${SLC.core}"></i><i style="flex:${n.deep||0};background:${SLC.deep}"></i></span><span class="l">${new Date(n.k+'T12:00').toLocaleDateString('en-GB',{weekday:'narrow'})}</span></div>`).join('')}</div>
    <div class="sl-keys">${['rem','core','deep'].map(s=>`<span><i style="background:${SLC[s]}"></i>${SLN[s]}</span>`).join('')}</div></div>
  <div class="sl-grid2"><div class="sl-card"><div class="sl-h"><span>Stages · average</span></div><div class="sl-rows">
    <div><span><i class="dot" style="background:${SLC.deep}"></i>Deep</span><b class="num">${fmtHM(avg('deep'))}<em>${Math.round(avg('deep')/as*100)}%</em></b></div>
    <div><span><i class="dot" style="background:${SLC.rem}"></i>REM</span><b class="num">${fmtHM(avg('rem'))}<em>${Math.round(avg('rem')/as*100)}%</em></b></div>
    <div><span><i class="dot" style="background:${SLC.awake}"></i>Awake</span><b class="num">${Math.round(avg('awake'))} min</b></div>
    <div><span>Bedtime consistency</span><b class="num">±${Math.round(sd(bt))} min</b></div>
    <div><span>Wake-up consistency</span><b class="num">±${Math.round(sd(wk))} min</b></div></div></div>
  <div class="sl-card"><div class="sl-h"><span>What affects your sleep</span></div>${tagI.length?`<div class="sl-rows">${tagI.map(([t,d,c])=>`<div><span>${esc(t)}<small>${c} nights</small></span><span class="sl-delta ${d>=0?'up':'dn'} num">${d>=0?'+':''}${d}%</span></div>`).join('')}</div>`:'<div class="sl-note">Tag a few mornings with sleep notes (gym, caffeine…) and this shows what helps or hurts.</div>'}</div></div>`;
  el.onclick=null}
/* ---------- setup: watch sync, wake-up mission, reminders ---------- */
function sSetup(){const el=$('sleepBody'),S=SSET;const tok=SCFG&&SCFG.token;const url=SFN+'?token='+(tok||'…');const wurl=location.origin+location.pathname+'#wake='+encodeURIComponent(JSON.stringify({m:S.miss,d:S.diff,n:S.shakes,c:S.code,s:S.snd}));
  const lastK=Object.keys(SNIGHTS).sort().pop();const synced=!!lastK;
  const link=(id,v)=>`<div class="sl-link"><code id="${id}">${esc(v)}</code><button class="btn sm" type="button" data-copy="${id}">Copy</button></div>`;
  el.innerHTML=`<div class="sl-sec">Apple Watch sync</div><div class="sl-card">
    <div class="sl-status"><i style="background:${synced?'#30d158':'#8e8e93'}"></i><div><b>${synced?'Connected':'Not set up yet'}</b><div class="sl-sub">${synced?'last night received '+esc(nice(lastK)):'finish the steps below once (~5 min)'}</div></div></div>
    <details class="sl-det"${synced?'':' open'}><summary>Shortcut steps</summary><ol class="sl-steps">
      <li>Wear your Watch to bed with <b>Sleep</b> on (Health → Sleep → set a schedule).</li>
      <li>Shortcuts → <b>+</b>, name it <b>Send sleep</b>. Add <b>Find Health Samples</b> — Type <i>Sleep</i>, Start Date is in the last <i>2 days</i>.</li>
      <li><b>Repeat with Each</b> → inside it a <b>Text</b>: <code>Start Date|End Date|Value</code> from <i>Repeat Item</i>, both dates as <i>ISO 8601</i> with time.</li>
      <li>After the repeat: <b>Combine Text</b> (Repeat Results) with <i>New Lines</i>.</li>
      <li>For recovery: <b>Find Health Samples</b> + <b>Calculate Statistics</b> for HRV (Average), Resting Heart Rate (Average), Respiratory Rate (Average) and Active Energy (Sum), each last 1 day.</li>
      <li>A <b>Text</b> with <code>Combined Text</code> then lines <code>HRV|…</code> <code>Resting Heart Rate|…</code> <code>Respiratory Rate|…</code> <code>Active Energy|…</code>, inserting each statistic.</li>
      <li><b>Get Contents of URL</b> — the link below, Method <i>POST</i>, Request Body <i>File</i> → that Text.</li>
      <li>Automation → <b>Time of Day</b> 10:00 daily → <b>Run Immediately</b> → Send sleep.</li></ol></details>
    <div class="sl-lab">Your private upload link</div>${tok?link('slUrl',url):'<div class="sl-note">Link not ready, reopen the app in a minute</div>'}</div>
  <div class="sl-sec">Wake-up mission</div><div class="sl-card">
    <p class="sl-p">Your iPhone alarm rings as normal. Stopping it opens a mission that keeps ringing until you finish it.</p>
    <div class="sl-lab">Mission</div><div class="seg sl-seg">${SMISS.map(([k,l])=>`<button type="button" data-slm="${k}" aria-pressed="${S.miss===k}">${l}</button>`).join('')}</div>
    <div class="sl-opt">${S.miss==='math'?`<div class="sl-lab">Difficulty</div><div class="seg sl-seg">${[1,2,3].map(d=>`<button type="button" data-sld="${d}" aria-pressed="${S.diff===d}">${['easy','medium','hard'][d-1]}</button>`).join('')}</div>`:S.miss==='shake'?`<label class="sl-frow"><span>Shakes needed</span><input class="inp num" id="slShk" value="${S.shakes}" inputmode="numeric"></label>`:S.miss==='scan'?`<div class="sl-frow"><span>${S.code?`Barcode <b class="num">${esc(S.code)}</b>`:'No barcode registered'}</span><button class="btn sm" type="button" id="slReg">${S.code?'Change':'Register'}</button></div>`:'<div class="sl-note">You\'ll type a motivational line exactly.</div>'}</div>
    <div class="sl-lab">Sound</div><div class="seg sl-seg">${SSND.map(([k,l])=>`<button type="button" data-sls="${k}" aria-pressed="${S.snd===k}">${l}</button>`).join('')}</div>
    <div class="sl-btns"><button class="btn" type="button" id="slTest">Preview sound</button><button class="btn" type="button" id="slTry">Try the mission</button></div>
    <details class="sl-det"><summary>Alarm automation</summary><ol class="sl-steps"><li>Shortcuts → <b>Automation</b> → <b>+</b> → <b>Alarm</b> → <b>Is Stopped</b> (any alarm) → <b>Run Immediately</b>.</li><li>Action: <b>Open URLs</b> → paste the link below. Re-copy it if you change the mission.</li></ol></details>
    <div class="sl-lab">Mission link</div>${link('slWake',wurl)}</div>
  <div class="sl-sec">Schedule</div><div class="sl-card sl-form">
    <label class="sl-frow"><span>Usual wake-up</span><input type="time" class="inp num" id="slW" value="${S.wake}"></label>
    <label class="sl-frow"><span>Sleep goal <small>Hours</small></span><input class="inp num" id="slG" value="${S.goal}" inputmode="decimal"></label>
    <label class="sl-frow"><span>Bedtime reminder<small>30 min before ${sBedFor()} · needs notifications on</small></span><input type="checkbox" class="sl-sw" id="slBedOn" ${S.bedOn?'checked':''}></label></div>`;
  el.onchange=e=>{const t=e.target;if(t.id==='slShk'){S.shakes=Math.max(5,+t.value||30)}if(t.id==='slW')S.wake=t.value;if(t.id==='slG')S.goal=Math.max(4,Math.min(12,+t.value||8));if(t.id==='slBedOn')S.bedOn=t.checked;saveSS();if(typeof pushSync==='function')pushSync();sSetup()};
  el.onclick=e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;
    if(d.copy){const v=$(d.copy).textContent;navigator.clipboard&&navigator.clipboard.writeText(v).then(()=>{b.textContent='copied ✓'}).catch(()=>{});return}
    if(d.slm){S.miss=d.slm;saveSS();sSetup();return}if(d.sld){S.diff=+d.sld;saveSS();sSetup();return}if(d.sls){S.snd=d.sls;saveSS();sSetup();return}
    if(b.id==='slTest'){sAlarmSound(true);setTimeout(sAlarmStop,3500);return}if(b.id==='slTry'){sMission(true);return}if(b.id==='slReg')sRegister()}}

/* ---------- #wake: opened by the "alarm stopped" automation (works signed out, in Safari too) ---------- */
function sWakeMode(){let p={};try{p=JSON.parse(decodeURIComponent(location.hash.slice(6)))}catch(e){}
  SSET={wake:'07:30',goal:8,miss:p.m||'math',diff:+p.d||2,shakes:+p.n||30,snd:p.s||'rise',code:p.c||'',...(SSET||{}),...(p.m?{miss:p.m}:{})};
  const o=$('sleepNight');o.hidden=false;document.body.classList.add('sleeping');
  o.innerHTML=`<div class="smhead"><span class="tag pink">Wake up</span><b class="num">${pad(new Date().getHours())}:${pad(new Date().getMinutes())}</b></div><button class="btn p slgo" type="button" id="wkGo">Tap to start your mission</button><div class="dim" style="font-size:11px">The alarm keeps going until it's done</div>`;
  $('wkGo').onclick=async()=>{try{SAC=SAC||new (window.AudioContext||window.webkitAudioContext)();await SAC.resume()}catch(e){}try{if(SSET.miss==='shake'&&typeof DeviceMotionEvent!=='undefined'&&DeviceMotionEvent.requestPermission)await DeviceMotionEvent.requestPermission()}catch(e){}
    if(SSET.miss==='shake')addEventListener('devicemotion',sMotion);sAlarmSound(false);sMission('wake')}}
function sAwake(){const o=$('sleepNight');history.replaceState(null,'',location.pathname+'#today');
  o.innerHTML=`<div class="smq">you're up ✓</div><div class="dim">A wake-up check pops up in 3 minutes, tap it or the alarm comes back</div><button class="btn" type="button" id="wkOk" style="margin-top:14px">Ok</button>`;
  $('wkOk').onclick=()=>{o.hidden=true;document.body.classList.remove('sleeping')};
  setTimeout(()=>{o.hidden=false;document.body.classList.add('sleeping');let left=90;o.innerHTML=`<div class="smq">Still awake?</div><div class="smshake num" id="scT">${left}</div><button class="btn p slgo" type="button" id="scOk">yes, I'm up</button>`;
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
    let left=3,cur=mk();const draw=()=>{o.innerHTML=head+`<div class="smq num">${cur.q} =</div><input class="smin num" id="smA" inputmode="none" readonly autocomplete="off"><div class="dim">${left} to go</div><div class="smkp">${[1,2,3,4,5,6,7,8,9,'−',0,'⌫'].map(k=>`<button type="button" data-k="${k}">${k}</button>`).join('')}</div><button class="btn p" type="button" id="smOk">Submit</button>${snz}`;bind()};
    const bind=()=>{o.onclick=e=>{const b=e.target.closest('button');if(!b)return;const i=$('smA');if(b.dataset.k!=null){const k=b.dataset.k;i.value=k==='⌫'?i.value.slice(0,-1):k==='−'?(i.value.startsWith('-')?i.value.slice(1):'-'+i.value):i.value+k;return}
      if(b.id==='smOk'){if(+i.value===cur.ans&&i.value!==''){left--;if(!left)return done();cur=mk();draw()}else{i.value='';i.classList.add('bad');setTimeout(()=>i.classList.remove('bad'),400)}}if(b.id==='smSnz')sSnooze()}};draw()}
  else if(S.miss==='shake'){sShake.on=true;addEventListener('devicemotion',sMotion);sShake.n=0;const need=S.shakes;o.innerHTML=head+`<div class="smq">Shake it</div><div class="smshake num" id="smN">0 / ${need}</div><div class="smbar"><i id="smBar"></i></div>${snz}<div class="dim" style="font-size:11px">no motion sensor? <button class="iconbtn" type="button" id="smAlt">Switch to maths</button></div>`;
    sShake.cb=()=>{$('smN').textContent=sShake.n+' / '+need;$('smBar').style.width=Math.min(100,sShake.n/need*100)+'%';if(sShake.n>=need){sShake.cb=null;done()}};
    o.onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.id==='smSnz')sSnooze();if(b.id==='smAlt'){sShake.on=false;const m=S.miss;S.miss='math';sMission(test);S.miss=m}}}
  else if(S.miss==='type'){const ph=SPHRASE[Math.floor(Math.random()*SPHRASE.length)];o.innerHTML=head+`<div class="smq" style="font-size:20px">type exactly:</div><div class="smph">${esc(ph)}</div><input class="smin" id="smT" autocomplete="off" autocapitalize="off" spellcheck="false">${snz}`;
    $('smT').oninput=e=>{if(e.target.value.trim().toLowerCase()===ph.toLowerCase())done()};o.onclick=e=>{if(e.target.id==='smSnz')sSnooze()}}
  else{if(!S.code){const m=S.miss;S.miss='math';sMission(test);S.miss=m;return}
    o.innerHTML=head+`<div class="smq" style="font-size:20px">Scan your barcode</div><div class="fscan"><video id="smV" playsinline muted></video><i class="fsline"></i></div><div class="dim" id="smMsg">Find it and point the camera at it</div>${snz}`;
    sScanner($('smV'),code=>{if(code===S.code){sScanStop();done();return true}$('smMsg').textContent='wrong barcode, that\'s not the one';return false});o.onclick=e=>{if(e.target.id==='smSnz'){sScanStop();sSnooze()}}}}

let SSC=null;
async function sScanner(v,cb){sScanStop();try{
  if('BarcodeDetector' in window){const st=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});SSC={st};v.srcObject=st;await v.play();const det=new BarcodeDetector({formats:['ean_13','ean_8','upc_a','upc_e','code_128']});
    const loop=async()=>{if(!SSC||!v.isConnected)return sScanStop();try{const r=await det.detect(v);if(r[0]&&cb(r[0].rawValue))return}catch(e){}setTimeout(loop,250)};loop()}
  else{if(!window.ZXing)await new Promise((res,rej)=>{const s=document.createElement('script');s.src='vendor/zxing.min.js';s.onload=res;s.onerror=rej;document.head.appendChild(s)});
    const zx=new ZXing.BrowserMultiFormatReader();SSC={zx};zx.decodeFromConstraints({video:{facingMode:'environment'}},v,res=>{if(res&&SSC&&cb(res.getText()))sScanStop()})}}catch(e){}}
function sScanStop(){if(!SSC)return;try{SSC.zx&&SSC.zx.reset()}catch(e){}if(SSC.st)SSC.st.getTracks().forEach(t=>t.stop());SSC=null}
function sRegister(){openSheet('register barcode',`<div class="dim" style="margin-bottom:8px">Scan something that lives in another room: toothpaste, shower gel, a cereal box.</div><div class="fscan"><video id="srV" playsinline muted></video><i class="fsline"></i></div><div class="row" style="gap:6px;margin-top:8px"><input class="inp num" id="srC" placeholder="Or type the number" style="flex:1"><button class="btn p" type="button" id="srOk">Save</button></div>`);
  const saveC=c=>{SSET.code=c;saveSS();sScanStop();closeSheet();sTonight()};sScanner($('srV'),c=>{saveC(c);return true});$('srOk').onclick=()=>{const c=$('srC').value.replace(/\s/g,'');if(c)saveC(c)};$('sheetX')&&$('sheetX').addEventListener('click',sScanStop,{once:true})}


/* ---------- recovery / strain (Whoop-style) ---------- */
const sAddD=(k,n)=>{const x=new Date(k+'T12:00');x.setDate(x.getDate()+n);return ymd(x)};
function sStrain(day){/* strain for a calendar day: active energy arrives the next morning */const h=SHEALTH[sAddD(day,1)]||{};let load=+h.kcal||0;if(!load&&h.steps)load=h.steps*0.04;
  try{if(typeof WORKOUTS!=='undefined')WORKOUTS.filter(w=>w.date===day).forEach(w=>{const m=w.endedAt&&w.startedAt?(new Date(w.endedAt)-new Date(w.startedAt))/6e4:45;if(!h.kcal)load+=m*5;load+=Math.min(150,(w.vol||0)/100)})}catch(e){nxErr(e,'sleep load')}
  return load?Math.round(21*(1-Math.exp(-load/650))*10)/10:null}
function sBase(k,f,days=30){const v=[];for(let i=1;i<=days;i++){const d=sAddD(k,-i);const x=f==='asleep'?(SNIGHTS[d]||{}).asleep:(SHEALTH[d]||{})[f];if(x!=null&&!isNaN(+x)&&+x>0)v.push(+x)}if(v.length<3)return null;const m=v.reduce((a,b)=>a+b,0)/v.length;const sd=Math.sqrt(v.reduce((a,b)=>a+(b-m)**2,0)/v.length);return {m,sd,n:v.length}}
function sNeed(k){const g=(SSET&&SSET.goal||8)*60;const st=sStrain(sAddD(k,-1));let need=g+(st&&st>10?(st-10)*6:0);let debt=0;for(let i=1;i<=3;i++){const n=SNIGHTS[sAddD(k,-i)];if(n&&n.asleep)debt+=Math.max(0,g-n.asleep)}return Math.round(need+Math.min(60,debt*.3))}
function sRec(k){const h=SHEALTH[k]||{},n=SNIGHTS[k];const need=sNeed(k);const perf=n&&n.asleep?Math.min(100,n.asleep/need*100):null;
  const bH=sBase(k,'hrv'),bR=sBase(k,'rhr'),bRR=sBase(k,'rr');let s=null,est=false;
  if(h.hrv){const zH=bH?(h.hrv-bH.m)/Math.max(5,bH.sd):0,zR=h.rhr&&bR?(h.rhr-bR.m)/Math.max(2,bR.sd):0;s=52+22*zH-14*zR+(perf!=null?.35*(perf-80):0);if(h.rr&&bRR&&h.rr>bRR.m+1)s-=8;est=!bH}
  else if(perf!=null){s=perf*.85;est=true}
  return s==null?null:{v:Math.round(Math.max(1,Math.min(99,s))),perf:perf!=null?Math.round(perf):null,need,est,h,bH,bR}}
const sZone=v=>v>=67?['#30d158','green','Your body is primed, push it today','14 – 18']:v>=34?['#ffd60a','yellow','Maintain, keep strain moderate','10 – 14']:['#ff453a','red','Prioritise rest and recovery','0 – 10'];
function sLine(vals,col,h=84){const pts=vals.map((v,i)=>v==null||isNaN(+v)?null:[i,+v]).filter(Boolean);if(pts.length<2)return '<div class="sl-note">Not enough data yet, check back after a few mornings</div>';
  const lo=Math.min(...pts.map(p=>p[1])),hi=Math.max(...pts.map(p=>p[1])),X=i=>(i/29*1000).toFixed(1),Y=v=>(h-8-(v-lo)/Math.max(1,hi-lo)*(h-16)).toFixed(1);const d=pts.map(([i,v])=>X(i)+','+Y(v)).join(' ');const g='slg'+col.slice(1);
  return `<svg class="sl-line" viewBox="0 0 1000 ${h}" preserveAspectRatio="none" style="height:${h}px"><defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".3"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs><polygon points="${X(pts[0][0])},${h} ${d} ${X(pts[pts.length-1][0])},${h}" fill="url(#${g})"/><polyline points="${d}" fill="none" stroke="${col}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg><div class="sl-axis"><span>30 days ago</span><span class="num">${Math.round(lo)} – ${Math.round(hi)}</span><span>Today</span></div>`}
function sRecovery(){const el=$('sleepBody');const k=DAYK;const R=sRec(k)||sRec(sAddD(k,-1));const kk=sRec(k)?k:sAddD(k,-1);const yS=sStrain(sAddD(k,-1));
  if(!R&&yS==null){el.innerHTML=sEmpty('Recovery needs your Watch data','Finish the Shortcut in setup (sleep + the HRV / heart-rate lines). After a few mornings you\'ll get a daily recovery %, strain and trends.','Open setup');sGoSetup(el);return}
  const z=R?sZone(R.v):['#8e8e93','—','No recovery score yet',''];const n=SNIGHTS[kk];
  const days=[...Array(30)].map((_,i)=>sAddD(k,-29+i));const recs=days.map(d=>({d,r:sRec(d),s:sStrain(d)}));
  const tile=(l,v,s,up)=>`<div class="sl-tile"><span>${l}</span><b class="num">${v}</b><em${up!=null?` class="${up?'up':'dn'}"`:''}>${s||'&nbsp;'}</em></div>`;
  const bed=(()=>{const [h,m]=SSET.wake.split(':').map(Number);let t=(h*60+m-sNeed(sAddD(k,1))+1440)%1440;return pad(Math.floor(t/60))+':'+pad(t%60)})();
  const hv=days.map(d=>(SHEALTH[d]||{}).hrv),rh=days.map(d=>(SHEALTH[d]||{}).rhr);
  el.innerHTML=`<div class="sl-card sl-hero" style="--z:${z[0]}">
    <div class="sl-heroL">${sRing(R?R.v:0,z[0],168,9,`<span>Recovery</span><b class="num" style="color:${z[0]}">${R?R.v+'<small>%</small>':'—'}</b><span>${kk!==k?'yesterday':R&&R.est?'estimated':'today'}</span>`)}<div class="sl-zone"><i></i>${esc(z[2])}</div></div>
    <div class="sl-tiles">${tile('HRV',R&&R.h.hrv?Math.round(R.h.hrv)+'<small> ms</small>':'—',R&&R.bH&&R.h.hrv?`${R.h.hrv>=R.bH.m?'↑':'↓'} avg ${Math.round(R.bH.m)}`:'',R&&R.bH&&R.h.hrv?R.h.hrv>=R.bH.m:null)}${tile('Resting HR',R&&R.h.rhr?Math.round(R.h.rhr)+'<small> bpm</small>':'—',R&&R.bR&&R.h.rhr?`${R.h.rhr<=R.bR.m?'↓':'↑'} avg ${Math.round(R.bR.m)}`:'',R&&R.bR&&R.h.rhr?R.h.rhr<=R.bR.m:null)}${tile('Sleep',R&&R.perf!=null?R.perf+'<small>%</small>':'—',n&&R?fmtHM(n.asleep)+' of '+fmtHM(R.need):'')}${tile('Resp. rate',R&&R.h.rr?R.h.rr.toFixed(1)+'<small> /min</small>':'—','')}</div></div>
  <div class="sl-grid2"><div class="sl-card"><div class="sl-h"><span>Strain</span></div>
    <div class="sl-strain"><div><span>Yesterday</span><b class="num">${yS!=null?yS.toFixed(1):'—'}</b></div><div><span>Today's target</span><b class="num" style="color:${z[0]}">${R?z[3]:'—'}</b></div></div>
    <div class="sl-gauge"><i style="width:${Math.min(100,(yS||0)/21*100).toFixed(1)}%"></i>${R?`<em style="left:${(parseInt(z[3])/21*100).toFixed(1)}%;width:${((parseInt(z[3].split('–')[1])-parseInt(z[3]))/21*100).toFixed(1)}%;--z:${z[0]}"></em>`:''}</div>
    <div class="sl-note">From active energy, steps and logged gym sessions.</div></div>
  <div class="sl-card"><div class="sl-h"><span>Sleep coach</span></div><div class="sl-rows">
    <div><span>Sleep needed tonight</span><b class="num">${fmtHM(sNeed(sAddD(k,1)))}</b></div>
    <div><span>Be asleep by</span><b class="num">${bed}</b></div>
    ${n?`<div><span>Last night</span><b class="num">${fmtHM(n.asleep)}</b></div><div><span>Deep · REM</span><b class="num">${fmtHM(n.deep)} · ${fmtHM(n.rem)}</b></div>`:''}</div></div></div>
  <div class="sl-card"><div class="sl-h"><span>Recovery · 30 days</span><span class="sl-keys" style="margin:0"><span><i style="background:#30d158"></i>Recovery</span><span><i style="background:#5ac8fa"></i>Strain</span></span></div>
    <div class="sl-rbars">${recs.map(o=>`<div title="${o.d}">${o.r?`<span style="height:${o.r.v}%;background:${sZone(o.r.v)[0]}"></span>`:'<span class="nil"></span>'}${o.s!=null?`<i style="bottom:${(o.s/21*100).toFixed(1)}%"></i>`:''}</div>`).join('')}</div></div>
  <div class="sl-grid2"><div class="sl-card"><div class="sl-h"><span>HRV</span><b class="num" style="color:#5ac8fa">${hv.filter(x=>x!=null).length?Math.round(hv.filter(x=>x!=null).pop())+' ms':''}</b></div>${sLine(hv,'#5ac8fa')}</div>
    <div class="sl-card"><div class="sl-h"><span>Resting heart rate</span><b class="num" style="color:#ff375f">${rh.filter(x=>x!=null).length?Math.round(rh.filter(x=>x!=null).pop())+' bpm':''}</b></div>${sLine(rh,'#ff375f')}</div></div>`;
  el.onclick=null}
/* ---------- main sleep page (Sleep Cycle style): quality first, graph, tiles, calendar ---------- */
let SSEL=null,SCALM=null;
const SI={moon:'<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" fill="currentColor" stroke="none"/>',
  alarm:'<circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.2 1.6M4.5 5.5l2.5-2M19.5 5.5l-2.5-2"/>',
  lat:'<path d="M4 12a8 8 0 1 0 8-8"/><path d="M12 8v4l2.5 2"/><path d="M3 4.5h4.5L3 9.5h4.5" stroke-width="1.7"/>',
  reg:'<path d="M5 18V9M9.5 18V6M14 18v-8M18.5 18V7.5"/>',
  heart:'<path d="M19.5 12.6 12 20l-7.5-7.4A4.6 4.6 0 0 1 12 6.5a4.6 4.6 0 0 1 7.5 6.1z"/><path d="M3.5 12.5h4l1.5-2.5 2.5 5 1.5-2.5h3"/>',
  wake:'<path d="M12 3v3M5.6 5.6l2.1 2.1M3 12h3M18 12h3M16.3 7.7l2.1-2.1"/><path d="M7 17a5 5 0 0 1 10 0"/><path d="M3 20h18"/>',
  cal:'<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
  chevL:'<path d="m15 18-6-6 6-6"/>',chevR:'<path d="m9 18 6-6-6-6"/>'};
const sIco=(k,s=20)=>`<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SI[k]}</svg>`;
const sHM=m=>{m=Math.round(m||0);return `${Math.floor(m/60)}<small>h</small> ${pad(m%60)}<small>m</small>`};
/* intervals asleep for every synced night — used for regularity */
function sSleepIv(){const iv=[];Object.values(SNIGHTS).forEach(n=>{const sg=(n.segs||[]).filter(x=>x[2]!=='awake');if(sg.length)sg.forEach(([a,b])=>iv.push([+new Date(a),+new Date(b)]));else if(n.start&&n.end)iv.push([+new Date(n.start),+new Date(n.end)])});return iv.sort((a,b)=>a[0]-b[0])}
/* Sleep Regularity: how often you're in the same state (asleep / awake) at the same clock time 24 h apart, over the last week */
function sRegularity(k){const iv=sSleepIv();const at=t=>{for(const [a,b] of iv){if(a>t)return 0;if(t<b)return 1}return 0};let same=0,tot=0;
  for(let i=0;i<7;i++){const d=sAddD(k,-i),p=sAddD(k,-i-1),n=SNIGHTS[d];if(!n||!n.end||!SNIGHTS[p])continue;const e=+new Date(n.end);for(let t=e-864e5;t<e;t+=3e5){tot++;if(at(t)===at(t-864e5))same++}}
  return tot?Math.round(same/tot*100):null}
function sLatency(n){const sg=sNorm(n.segs).filter(x=>x[2]!=='awake').map(x=>x[0]);return sg.length&&n.start?Math.max(0,Math.round((sg[0]-new Date(n.start))/6e4)):null}
/* the night as one smooth line: awake at the top, deep at the bottom */
function sWave(n,H=200){const segs=sNorm(n.segs);if(!segs.length)return '<div class="sl-note">No stage data for this night, as your Watch needs to be worn to bed</div>';
  const t0=Math.min(+new Date(n.start)||segs[0][0],segs[0][0]),t1=Math.max(+new Date(n.end)||0,segs[segs.length-1][1]),W=1000,L={awake:0,rem:1,core:2,deep:3},pt=16,Y=st=>(pt+(L[st]??2)*(H-2*pt)/3).toFixed(1),X=t=>((t-t0)/(t1-t0||1))*W;
  const m=[];segs.forEach(s=>{const l=m[m.length-1];if(l&&l[2]===s[2]&&s[0]-l[1]<12e4)l[1]=Math.max(l[1],s[1]);else m.push([...s])});
  let d=`M0,${Y(m[0][2])} L${X(m[0][0]).toFixed(1)},${Y(m[0][2])}`;
  m.forEach((s,i)=>{const x0=X(s[0]),x1=X(s[1]),nx=m[i+1];if(!nx){d+=` L${W},${Y(s[2])}`;return}const nw=X(nx[1])-X(nx[0]),r=Math.max(.5,Math.min(42,(x1-x0)*.45,nw*.45)),xb=X(nx[0]);d+=` L${(x1-r).toFixed(1)},${Y(s[2])} C${(x1+r*.1).toFixed(1)},${Y(s[2])} ${(xb-r*.1).toFixed(1)},${Y(nx[2])} ${(xb+r).toFixed(1)},${Y(nx[2])}`});
  const ticks=[];for(let h=Math.ceil(t0/36e5)*36e5;h<t1;h+=36e5){const p=(h-t0)/(t1-t0);if(p>.07&&p<.93)ticks.push(`<span style="left:${(p*100).toFixed(1)}%">${new Date(h).getHours()}</span>`)}
  return `<div class="sw"><div class="sw-lab">${['Awake','REM','Core','Deep'].map(s=>`<span>${s}</span>`).join('')}</div><div class="sw-plot"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="height:${H}px"><defs><linearGradient id="swg" gradientUnits="userSpaceOnUse" x1="0" y1="${pt}" x2="0" y2="${H-pt}"><stop offset="0" stop-color="#ffb07a"/><stop offset=".34" stop-color="#ff7a9c"/><stop offset=".68" stop-color="#8fa8d8"/><stop offset="1" stop-color="#4fb3c8"/></linearGradient></defs>${[0,1,2,3].map(i=>`<line x1="0" x2="${W}" y1="${Y(Object.keys(L)[i])}" y2="${Y(Object.keys(L)[i])}" class="sw-grid"/>`).join('')}<path d="${d}" class="sw-line"/></svg>
    <div class="sw-ax"><span class="e">${sT(t0)}</span>${ticks.join('')}<span class="e r">${sT(t1)}</span></div></div></div>`}
const sFace=(v)=>{const c=[-6,-3,0,3.5,6][v-1];return `<svg viewBox="0 0 32 32" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="16" cy="16" r="13"/><circle cx="11.5" cy="13" r="1.2" fill="currentColor" stroke="none"/><circle cx="20.5" cy="13" r="1.2" fill="currentColor" stroke="none"/><path d="M10.5 ${20-c/3} Q16 ${20+c} 21.5 ${20-c/3}"/></svg>`};
function sCal(selK){const keys=Object.keys(SNIGHTS);const base=SCALM||(selK||DAYK).slice(0,7);const [y,mo]=base.split('-').map(Number);const first=new Date(y,mo-1,1),days=new Date(y,mo,0).getDate(),lead=(first.getDay()+6)%7;
  const cell=dn=>{const k=`${y}-${pad(mo)}-${pad(dn)}`,n=SNIGHTS[k],q=n?sQ(n):null;const fut=k>DAYK;
    return `<button type="button" class="sc-d${k===selK?' sel':''}${k===DAYK?' today':''}" ${n?`data-sc="${k}"`:'disabled'}><span>${dn}</span><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" class="t${fut?' fut':''}"/>${n?`<circle cx="18" cy="18" r="15" class="f" pathLength="100" style="stroke-dasharray:${Math.max(3,q)} 100"/>`:''}</svg></button>`};
  return `<div class="sl-card sc"><div class="sc-h"><b>${first.toLocaleDateString('en-GB',{month:'long',year:'numeric'})}</b><span><button type="button" class="sc-nav" data-cm="-1" aria-label="Previous month">${sIco('chevL',18)}</button><button type="button" class="sc-nav" data-cm="1" aria-label="Next month"${base>=DAYK.slice(0,7)?' disabled':''}>${sIco('chevR',18)}</button></span></div>
    <div class="sc-g">${['M','T','W','T','F','S','S'].map(d=>`<em>${d}</em>`).join('')}${'<i></i>'.repeat(lead)}${[...Array(days)].map((_,i)=>cell(i+1)).join('')}</div></div>`}
function sMain(){const el=$('sleepBody');const ks=Object.keys(SNIGHTS).sort();
  if(!ks.length){el.innerHTML=sEmpty('No nights yet','Wear your Apple Watch to bed and finish the one-time setup, and every morning your sleep lands here automatically','Open setup');sGoSetup(el);return}
  const k=SSEL&&SNIGHTS[SSEL]?SSEL:ks[ks.length-1],n=SNIGHTS[k],i=ks.indexOf(k),q=sQ(n);
  const inBed=n.start&&n.end?(new Date(n.end)-new Date(n.start))/6e4:null,lat=sLatency(n),reg=sRegularity(k),R=sRec(k),wk=sWakes(n);
  const d1=new Date(sAddD(k,-1)+'T12:00'),d2=new Date(k+'T12:00');const lbl=`${d1.toLocaleDateString('en-GB',{weekday:'short'})} ${d1.getDate()}–${d2.getDate()} ${d2.toLocaleDateString('en-GB',{month:'short'})}`;
  const tile=(ic,l,v,cls)=>`<div class="smt${cls?' '+cls:''}"><span>${l}</span><b class="num">${sIco(ic,22)}${v}</b></div>`;
  const stages=[['awake','Awake'],['rem','REM'],['core','Core'],['deep','Deep']];
  el.innerHTML=`<div class="sm"><div class="sm-l">
    <div class="sh-hero"><div class="sh-top"><button type="button" class="sh-ic" id="shCal" aria-label="Calendar">${sIco('cal',19)}</button><span class="sh-nav"><button type="button" data-sk="-1" aria-label="Previous night"${i<=0?' disabled':''}>${sIco('chevL',18)}</button><b>${lbl}</b><button type="button" data-sk="1" aria-label="Next night"${i>=ks.length-1?' disabled':''}>${sIco('chevR',18)}</button></span><span class="sh-ic sp"></span></div>
      <button type="button" class="sh-ring" id="shQ"><svg viewBox="0 0 200 200"><defs><linearGradient id="shg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff9f6b"/><stop offset="1" stop-color="#ffe0cf"/></linearGradient></defs><circle cx="100" cy="100" r="88" class="t"/><circle cx="100" cy="100" r="76" class="t2"/><circle cx="100" cy="100" r="88" class="f" pathLength="100" style="stroke-dasharray:${q} 100"/></svg><span class="sh-v"><b class="num">${q}<small>%</small></b><em>Quality ${sIco('chevR',16)}</em></span></button>
      <div class="sh-sum"><div><b class="num">${sHM(n.asleep)}</b><span>Time asleep</span></div><i></i><div><b class="num">${n.end?sT(n.end):'—'}</b><span>Woke up</span></div></div></div>
    <div class="sm-cal" id="smCal">${sCal(k)}</div>
  </div><div class="sm-r">
    <div class="sl-card sw-card">${sWave(n)}</div>
    <div class="sl-card sm-stg">${stages.map(([s,l])=>`<div><i style="background:${SLC[s]}"></i><span>${l}</span><b class="num">${s==='awake'?Math.round(n.awake||0)+'<small>m</small>':sHM(n[s])}</b></div>`).join('')}</div>
    <div class="sm-tiles">${tile('moon','Fell asleep',n.start?sT(n.start):'—')}${tile('reg','Regularity',reg!=null?reg+'<small>%</small>':'—')}${tile('heart','Recovery',R?R.v+'<small>%</small>':'—','rec" style="--z:'+(R?sZone(R.v)[0]:'#8e8e93'))}${tile('wake','Wake-ups',wk!=null?wk:'—')}</div>
    ${reg==null?`<div class="sl-note sm-hint">Regularity appears once you have two nights in a row synced.</div>`:''}
    <div class="sm-sec">Experience</div>
    <div class="sl-card"><div class="sm-q">How did you feel waking up?</div><div class="sm-mood">${[1,2,3,4,5].map(v=>`<button type="button" data-mood="${v}" aria-pressed="${n.mood===v}" aria-label="Mood ${v} of 5">${sFace(v)}</button>`).join('')}</div>
      <div class="sm-q" style="margin-top:18px">Sleep notes</div><div class="sm-tags">${STAGS_FN().map(t=>`<button type="button" data-tag="${esc(t)}" aria-pressed="${(n.tags||[]).includes(t)}">${esc(t)}</button>`).join('')}</div>
      <div class="sm-q" style="margin-top:16px">Might have hurt sleep</div><div class="sm-tags sm-neg">${SNEG().map(t=>`<button type="button" data-tag="${esc(t)}" aria-pressed="${(n.tags||[]).includes(t)}">${esc(t)}</button>`).join('')}<button type="button" class="sm-add" data-negadd="1">+ Add</button></div></div>
    <div class="sl-card sl-tonight"><span class="sl-ico">${sIco('moon',20)}</span><div><div class="sl-sub">Tonight</div><b>Be asleep by <span class="num">${sBedFor()}</span></b><div class="sl-sub">${SSET.goal} h goal · ${SSET.wake} wake-up${SSET.bedOn?' · reminder 30 min before':''}</div></div></div>
    <button type="button" class="sm-del" id="smDel">Delete this night</button>
  </div></div>`;
  el.onclick=e=>{const b=e.target.closest('button');if(!b)return;
    if(b.dataset.sk){SSEL=ks[i+ +b.dataset.sk]||k;SCALM=null;sMain();return}
    if(b.dataset.sc){SSEL=b.dataset.sc;sMain();if(innerWidth<900)$('sleepBody').scrollIntoView({behavior:'smooth',block:'start'});return}
    if(b.dataset.cm){const [yy,mm]=(SCALM||k.slice(0,7)).split('-').map(Number);const d=new Date(yy,mm-1+ +b.dataset.cm,1);SCALM=`${d.getFullYear()}-${pad(d.getMonth()+1)}`;$('smCal').innerHTML=sCal(k);return}
    if(b.id==='shCal'){$('smCal').scrollIntoView({behavior:'smooth',block:'center'});return}
    if(b.id==='shQ'){openSheet('Sleep quality',`<div class="sq-big num">${q}<small>%</small></div><div class="sl-note" style="text-align:center;margin-bottom:14px">Duration counts most, then deep sleep, REM, efficiency, restfulness and timing.</div>${sQBars(n)}`);return}
    if(b.dataset.mood){n.mood=+b.dataset.mood;save('sleep/w-'+k,n);el.querySelectorAll('[data-mood]').forEach(x=>x.setAttribute('aria-pressed',x===b));return}
    if(b.dataset.negadd){const i2=document.createElement('input');i2.className='sm-negin';i2.placeholder='e.g. late coffee';i2.maxLength=30;b.replaceWith(i2);i2.focus();
      const add=()=>{const v=i2.value.trim();if(!v){sMain();return}SSET.neg=[...new Set([...(SSET.neg||[]),v])];save('sleep/settings',SSET);n.tags=[...new Set([...(n.tags||[]),v])];save('sleep/w-'+k,n);sMain()};
      i2.onkeydown=ev=>{if(ev.key==='Enter'){ev.preventDefault();add()}if(ev.key==='Escape')sMain()};i2.onblur=add;return}
    if(b.dataset.tag){const t=b.dataset.tag;n.tags=(n.tags||[]).includes(t)?n.tags.filter(x=>x!==t):(n.tags||[]).concat(t);save('sleep/w-'+k,n);b.setAttribute('aria-pressed',n.tags.includes(t));return}
    if(b.id==='smDel'){if(!b.dataset.arm){b.dataset.arm=1;b.textContent='Tap again to delete';return}delete SNIGHTS[k];removeDoc('sleep/w-'+k);SSEL=null;sMain()}}}
function sTrends(){const el=$('sleepBody');sRecovery();const a=el.innerHTML;sStats();el.innerHTML=a+'<div class="sm-sec">Sleep</div>'+el.innerHTML;sGoSetup(el)}
