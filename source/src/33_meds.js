/* ================= MEDS: dose log, peak check-ins, dose comparison and the appointment report (Stack › Meds) =================
   meds/list = {meds:[{id,name,dose,unit,peak,dur,color,on,course:{start,mg,kg,bloods}}]}  (names are your data, never in code)
   meds/log-YYYY-MM = {doses:[{id,med,at,dose,tk}], checks:[{id,med,at,dose,focus,mood,app,jit,se:[],bp}]}
   Ticking a Today item whose name matches a med logs the dose; a check-in is asked for `peak` hours later. */
let MEDS={meds:[]},MEDLOG={doses:[],checks:[]},MEDM={},medsLoaded=false,MEDV='home',MEDSEL=null;
const MED_SE=['dry mouth','jaw tension','headache','racing heart','irritable','nausea','comedown','none'];
const MED_COLS=['#ff2a6d','#05d9e8','#ffd60a','#30d158','#bf5af2','#ff9f0a'];
const medMonth=d=>String(d).slice(0,7);
async function medsLoad(force){if(medsLoaded&&!force)return;
  const m0=medMonth(DAYK),d=new Date(DAYK+'T12:00');const ms=[0,1,2].map(i=>{const x=new Date(d);x.setDate(1);x.setMonth(x.getMonth()-i);return ymd(x).slice(0,7)});
  const [l,...logs]=await Promise.all([load('meds/list'),...ms.map(m=>load('meds/log-'+m))]);
  MEDS={meds:[],...(l||{})};MEDM={};ms.forEach((m,i)=>{MEDM[m]={doses:[],checks:[],...(logs[i]||{})}});medsMerge();medsLoaded=true;if(m0)return}
function medsMerge(){MEDLOG={doses:[],checks:[]};Object.values(MEDM).forEach(x=>{MEDLOG.doses.push(...(x.doses||[]));MEDLOG.checks.push(...(x.checks||[]))});
  MEDLOG.doses.sort((a,b)=>a.at<b.at?-1:1);MEDLOG.checks.sort((a,b)=>a.at<b.at?-1:1)}
function medsSaveLog(mon){mon=mon||medMonth(DAYK);MEDM[mon]=MEDM[mon]||{doses:[],checks:[]};save('meds/log-'+mon,MEDM[mon]);medsMerge();if(typeof schedWidget==='function')schedWidget()}
function medsSaveList(){save('meds/list',MEDS)}
watch('meds/list',d=>{if(d){MEDS={meds:[],...d};if(cur==='stack'&&STACKV==='meds')renderMeds();renderTodayNudges()}});
watchPrefix('meds/log-',(evt,path,data)=>{const m=path.slice(9);if(data){MEDM[m]={doses:[],checks:[],...data};medsMerge();if(cur==='stack'&&STACKV==='meds'&&MEDV==='home')renderMeds();renderTodayNudges()}});
const medActive=()=>MEDS.meds.filter(m=>m.on!==false);
const medById=id=>MEDS.meds.find(m=>m.id===id);
function medMatch(name){const a=norm(name||'').replace(/[^a-z0-9]/g,'');if(a.length<3)return null;return medActive().find(m=>{const b=norm(m.name||'').replace(/[^a-z0-9]/g,'');return b.length>=3&&(a===b||a.includes(b)||b.includes(a))})||null}
const medDosesOn=(id,d)=>MEDLOG.doses.filter(x=>x.med===id&&String(x.at).slice(0,10)===d&&(!x.day||x.day===d)||x.med===id&&x.day===d).filter((x,i,a)=>a.indexOf(x)===i);
const medDayDose=(id,d)=>{const xs=MEDLOG.doses.filter(x=>x.med===id&&(x.day||String(x.at).slice(0,10))===d);return xs.length?xs[xs.length-1]:null};

/* Today hook: 08_today calls this whenever an item is ticked or unticked */
function medsOnTick(k,on){try{if(!medsLoaded)return;const it=visibleItems().find(i=>i.tk===k);if(!it)return;const m=medMatch(it.item);if(!m)return;
  const mon=medMonth(DAYK);MEDM[mon]=MEDM[mon]||{doses:[],checks:[]};const L0=MEDM[mon];
  if(on){if(L0.doses.some(x=>x.med===m.id&&x.day===DAYK))return;const dz={id:rid(),med:m.id,at:new Date().toISOString(),day:DAYK,dose:+m.dose||null,unit:m.unit||'mg',tk:k};L0.doses.push(dz);medsSaveLog(mon);medsPeakPush(m,dz)}
  else{const n=L0.doses.length;L0.doses=L0.doses.filter(x=>!(x.med===m.id&&x.day===DAYK&&x.tk===k));if(L0.doses.length!==n){medsSaveLog(mon);if(typeof pushCancel==='function')pushCancel('peak:'+m.id+':'+DAYK)}}
  renderTodayNudges();if(cur==='stack'&&STACKV==='meds')renderMeds()}catch(e){nxErr(e,'meds log')}}
function medsPeakPush(m,dz){if(!m.peak||typeof pushOne!=='function'||!nOn('peak'))return;pushOne('peak:'+m.id+':'+DAYK,new Date(dz.at).getTime()+m.peak*36e5,nT(m.name+' peak check-in'),'','./#stack/meds').catch(e=>nxErr(e,'notification'))}
function medLogNow(id){const m=medById(id);if(!m)return;const it=visibleItems().find(i=>medMatch(i.item)===m);
  if(it&&!DAY.ticks[it.tk]){setTick(it.tk,true);return}
  const mon=medMonth(DAYK);MEDM[mon]=MEDM[mon]||{doses:[],checks:[]};if(MEDM[mon].doses.some(x=>x.med===id&&x.day===DAYK))return;
  const dz={id:rid(),med:id,at:new Date().toISOString(),day:DAYK,dose:+m.dose||null,unit:m.unit||'mg'};MEDM[mon].doses.push(dz);medsSaveLog(mon);medsPeakPush(m,dz);renderMeds();renderTodayNudges()}
/* a check-in is due when today's dose was logged at least `peak` hours ago and nothing has been rated since */
function medDue(){if(!medsLoaded)return [];const now=Date.now();return medActive().filter(m=>m.peak).map(m=>{const dz=medDayDose(m.id,DAYK);if(!dz)return null;const at=new Date(dz.at).getTime()+m.peak*36e5;
  const done=MEDLOG.checks.some(c=>c.med===m.id&&String(c.at).slice(0,10)===String(dz.at).slice(0,10)&&c.at>=dz.at);return !done&&now>=at&&now<at+8*36e5?{m,dz}:null}).filter(Boolean)}

/* ---------- the peak check-in sheet ---------- */
function openMedCheck(id){const m=medById(id);if(!m)return;const dz=medDayDose(id,DAYK);const st={focus:null,mood:null,app:null,jit:null,se:[]};
  const draw=()=>`<div class="nx" style="padding:0;gap:14px">
    <div class="nx-s" style="margin-top:-4px">${dz?`About ${Math.max(0,Math.round((Date.now()-new Date(dz.at))/36e5*10)/10)} h after your ${nxClock(dz.at)} dose.`:'No dose logged today yet.'} Rate how today has been so far.</div>
    ${[['focus','Focus'],['mood','Mood'],['app','Appetite'],['jit','Jittery or anxious']].map(([k,l])=>`<div class="nx-field"><span class="nx-lab">${l}</span>${nxScale(st[k],'data-mc-'+k)}</div>`).join('')}
    <div class="nx-field"><span class="nx-lab">Side effects</span><div class="nx-chips">${MED_SE.map(s=>`<button type="button" class="nx-ch" data-mcse="${s}" aria-pressed="${st.se.includes(s)}">${s[0].toUpperCase()+s.slice(1)}</button>`).join('')}</div></div>
    <div class="nx-field"><span class="nx-lab">BP and pulse · optional</span><div class="nx-grid3"><input class="nx-inp num" id="mcS" type="number" inputmode="numeric" placeholder="sys" aria-label="systolic"><input class="nx-inp num" id="mcD" type="number" inputmode="numeric" placeholder="dia" aria-label="diastolic"><input class="nx-inp num" id="mcP" type="number" inputmode="numeric" placeholder="pulse" aria-label="pulse"></div><span class="nx-xs">Also goes into your BP log on Today.</span></div>
    <button type="button" class="nx-btnp" id="mcSave">Save check-in</button></div>`;
  openSheet(m.name+' · peak check-in',draw());const sb=$('sheetBody');
  sb.onclick=e=>{for(const k of ['focus','mood','app','jit']){const b=e.target.closest('[data-mc-'+k+']');if(b){st[k]=+b.getAttribute('data-mc-'+k);b.parentNode.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b));return}}
    const se=e.target.closest('[data-mcse]');if(se){const s=se.dataset.mcse;if(s==='none')st.se=st.se.includes('none')?[]:['none'];else{st.se=st.se.filter(x=>x!=='none');st.se=st.se.includes(s)?st.se.filter(x=>x!==s):st.se.concat(s)}sb.querySelectorAll('[data-mcse]').forEach(x=>x.setAttribute('aria-pressed',st.se.includes(x.dataset.mcse)));return}
    if(e.target.closest('#mcSave')){if(st.focus==null&&st.mood==null&&st.app==null&&st.jit==null&&!st.se.length){closeSheet();return}
      const s=+$('mcS').value,d=+$('mcD').value,p=+$('mcP').value||null;const bp=s&&d?{s,d,p}:(p?{p}:null);
      const mon=medMonth(DAYK);MEDM[mon]=MEDM[mon]||{doses:[],checks:[]};MEDM[mon].checks.push({id:rid(),med:id,at:new Date().toISOString(),dose:dz?dz.dose:(+m.dose||null),...st,bp});medsSaveLog(mon);
      if(bp&&bp.s&&typeof BP!=='undefined'){BP.r.push({t:new Date().toISOString(),s:bp.s,d:bp.d,p:bp.p||null});save('body/bp',BP);if(typeof renderBody==='function')renderBody()}
      if(typeof pushCancel==='function')pushCancel('peak:'+id+':'+DAYK);closeSheet();renderTodayNudges();if(cur==='stack')renderMeds()}}}

/* ---------- Today: nudges for due check-ins (People adds its own) ---------- */
function renderTodayNudges(){const el=$('todayNudges');if(!el)return;const due=medDue();const pp=typeof peopleDue==='function'?peopleDue():[];
  if(!due.length&&!pp.length){el.innerHTML='';return}
  el.innerHTML=`<div class="nx nx-today" style="padding:0;gap:8px">${due.map(({m})=>`<button type="button" class="nx-card nx-row" data-medcheck="${m.id}" style="display:flex;align-items:center;gap:12px;padding:12px 16px;border:0"><span class="nx-ic" style="background:${m.color||NXC.pink}">${MED_ICO}</span><span style="flex:1;min-width:0"><span class="nx-t2">${esc(m.name)} peak check-in</span><span class="nx-xs" style="display:block">10 seconds · focus, mood, appetite</span></span><span class="nx-pill nx-pk">Rate</span></button>`).join('')}
    ${pp.map(p=>`<button type="button" class="nx-card nx-row" data-plog="${p.id}" style="display:flex;align-items:center;gap:12px;padding:12px 16px;border:0"><span class="nx-avatar" style="background:${p.color||NXC.yellow};width:34px;height:34px;border-radius:10px">${esc((p.name||'?')[0].toUpperCase())}</span><span style="flex:1;min-width:0"><span class="nx-t2">${esc(p.dueLabel)}</span><span class="nx-xs" style="display:block">${esc(p.dueSub)}</span></span><span class="nx-pill nx-pk">Log</span></button>`).join('')}</div>`}
document.addEventListener('click',e=>{const b=e.target.closest('[data-medcheck]');if(b){openMedCheck(b.dataset.medcheck);return}});
setInterval(()=>{if(!document.hidden&&cur==='today')renderTodayNudges()},60e3);
const MED_ICO='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.3" stroke-linecap="round" aria-hidden="true"><g transform="rotate(-45 12 12)"><rect x="3" y="8" width="18" height="8" rx="4"/><path d="M12 8v8"/></g></svg>';

/* ---------- maths ---------- */
function medEffect(m,t){const x=t;if(x<=0)return 0;const pk=m.peak||3.5,dur=m.dur||13;return (1-Math.exp(-x/(pk/2.7)))*Math.exp(-Math.max(0,x-pk)/((dur-pk)/2.2))}
function medCurve(m,dz){const w=330,h=96,pl=2,pr=2,pt=8,pb=18,W=w-pl-pr,H=h-pt-pb;const d0=new Date(dz.at),h0=d0.getHours()+d0.getMinutes()/60;const a=Math.max(5,Math.floor(h0-1)),b=Math.min(a+16,30);
  const pts=[];for(let i=0;i<=160;i++){const t=a+(b-a)*i/160;pts.push([t,medEffect(m,t-h0)])}const mx=Math.max(...pts.map(p=>p[1]))||1;
  const X=t=>pl+(t-a)/(b-a)*W,Y=y=>pt+H-y/mx*H;const d='M'+pts.map(p=>X(p[0]).toFixed(1)+','+Y(p[1]).toFixed(1)).join(' L');const g='nxg'+(++nxGid);
  const now=new Date(),nh=now.getHours()+now.getMinutes()/60+(now.getHours()<5?24:0);
  let s=`<svg viewBox="0 0 ${w} ${h}" width="100%" style="display:block" role="img" aria-label="estimated effect"><defs><linearGradient id="${g}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${m.color||NXC.pink}" stop-opacity=".35"/><stop offset="1" stop-color="${m.color||NXC.pink}" stop-opacity="0"/></linearGradient></defs><path d="${d} L${X(b)},${pt+H} L${X(a)},${pt+H} Z" fill="url(#${g})"/><path d="${d}" fill="none" stroke="${m.color||NXC.pink}" stroke-width="2.2"/>`;
  s+=`<circle cx="${X(h0).toFixed(1)}" cy="${Y(0).toFixed(1)}" r="3.5" fill="#fff"/>`;if(nh>a&&nh<b)s+=`<line x1="${X(nh).toFixed(1)}" x2="${X(nh).toFixed(1)}" y1="${pt}" y2="${pt+H}" stroke="rgba(255,255,255,.35)" stroke-dasharray="3 3"/>`;
  for(let t=Math.ceil(a/3)*3;t<=b;t+=3)s+=`<text x="${X(t).toFixed(1)}" y="${h-3}" font-size="9.5" fill="#6e6e73" text-anchor="middle">${pad(t%24)}:00</text>`;
  const peakAt=pts.reduce((p,q)=>q[1]>p[1]?q:p);const strong=pts.filter(p=>p[1]>=mx*.5).pop();
  return {svg:s+'</svg>',until:strong?pad(Math.floor(strong[0])%24)+':'+pad(Math.round((strong[0]%1)*60)%60):null}}
/* group check-ins by the dose that day */
function medByDose(id){const g={};MEDLOG.checks.filter(c=>c.med===id&&c.dose!=null).forEach(c=>{(g[c.dose]=g[c.dose]||[]).push(c)});return g}
function medDoseDays(id,dose){return [...new Set(MEDLOG.doses.filter(x=>x.med===id&&+x.dose===+dose).map(x=>x.day||String(x.at).slice(0,10)))]}
function medStats(id,dose){const cs=(medByDose(id)[dose]||[]),days=medDoseDays(id,dose);const a=k=>nxAvg(cs.map(c=>c[k]));
  const bps=(typeof BP!=='undefined'?BP.r:[]).filter(r=>days.includes(String(r.t).slice(0,10)));const ck=cs.map(c=>c.bp).filter(Boolean);
  const sys=nxAvg(bps.map(r=>r.s).concat(ck.map(b=>b.s))),dia=nxAvg(bps.map(r=>r.d).concat(ck.map(b=>b.d))),pul=nxAvg(bps.map(r=>r.p).concat(ck.map(b=>b.p)));
  const se={};cs.forEach(c=>(c.se||[]).filter(x=>x!=='none').forEach(x=>{se[x]=(se[x]||0)+1}));
  return {n:cs.length,days:days.length,focus:a('focus'),mood:a('mood'),app:a('app'),jit:a('jit'),sys,dia,pul,se,sleep:null,dayList:days}}
async function medSleepFor(days){try{const rows=await listDocs('sleep/w-');const by={};rows.forEach(r=>{by[r.path.slice(8)]=r.data});const q=days.map(d=>{const n=by[addDays(d,1)];try{return n?sQ(n):null}catch(_){return null}}).filter(v=>v);return nxAvg(q)}catch(e){return null}}

/* ---------- the pane ---------- */
async function renderMeds(){const el=$('stackPaneM');if(!el)return;if(!medsLoaded){el.innerHTML='<div class="nx"><div class="nx-card nx-s">Loading…</div></div>';try{await medsLoad()}catch(e){nxErr(e,'meds')}}
  if(MEDV==='compare')return renderMedCompare(el);if(MEDV==='report')return renderMedReport(el);
  const act=medActive(),stim=act.find(m=>m.peak&&medDayDose(m.id,DAYK));const ti=act.find(m=>Object.keys(medByDose(m.id)).length>=1&&m.peak);
  const course=act.filter(m=>m.course&&m.course.start);
  const bp14=(typeof BP!=='undefined'?BP.r:[]).filter(r=>Date.now()-new Date(r.t)<14*864e5);
  let h=`<div class="nx">`;
  h+=`<div class="nx-card"><div class="nx-h"><span>Today</span><em>${act.length} med${act.length===1?'':'s'} · ${act.filter(m=>medDayDose(m.id,DAYK)).length} taken</em></div>`;
  h+=act.length?`<div class="nx-rows">${act.map(m=>{const dz=medDayDose(m.id,DAYK),ck=dz&&MEDLOG.checks.some(c=>c.med===m.id&&c.at>=dz.at);const due=medDue().some(x=>x.m===m);
    return `<div class="nx-row"><button type="button" class="nx-l" data-medEd="${m.id}" style="background:none;border:0;color:inherit;font:inherit;text-align:left;padding:0;cursor:pointer"><span class="nx-ic" style="background:${m.color||NXC.pink}">${MED_ICO}</span><div><div class="nx-t2">${esc(m.name)} ${m.dose?esc(m.dose+' '+(m.unit||'mg')):''}</div><div class="nx-xs">${dz?'taken '+nxClock(dz.at)+(m.peak?(ck?' · peak check-in done':' · check-in '+(due?'due now':'at '+nxClock(new Date(new Date(dz.at).getTime()+m.peak*36e5).toISOString()))):''):'not taken yet'}</div></div></button>
      ${dz?(due?`<button type="button" class="nx-pill nx-pk" data-medcheck="${m.id}">Rate</button>`:`<span class="nx-tick" aria-pressed="true" role="img" aria-label="taken"></span>`):`<button type="button" class="nx-pill nx-pk" data-medlog="${m.id}">Log</button>`}</div>`}).join('')}</div>`
    :`<div class="nx-s">Add the meds you take. Ticking a Today item with the same name logs the dose and time, and you get a check-in at the time it should be working best.</div>`;
  h+=`<button type="button" class="nx-btn2" id="medAdd" style="margin-top:12px">+ Add med</button></div>`;
  if(stim){const dz=medDayDose(stim.id,DAYK),c=medCurve(stim,dz);h+=`<div class="nx-card"><div class="nx-h"><span>${esc(stim.name)} today</span><em>estimated effect</em></div>${c.svg}<div class="nx-split" style="margin-top:8px"><span class="nx-s">${c.until?`Likely strongest until about <b style="color:#fff">${c.until}</b>`:''}</span><span class="nx-pill">est.</span></div></div>`}
  if(ti){const g=medByDose(ti.id),ds=Object.keys(g).map(Number).sort((a,b)=>a-b);const curD=+(medDayDose(ti.id,DAYK)||{}).dose||+ti.dose||ds[ds.length-1];const prevD=ds.filter(d=>d!==curD).pop();
    const A=medStats(ti.id,curD),B=prevD!=null?medStats(ti.id,prevD):null;const since=MEDLOG.doses.filter(x=>x.med===ti.id&&+x.dose===curD).map(x=>x.day||String(x.at).slice(0,10)).sort()[0];
    const t=(lab,v,u,pv,better)=>{const d=v!=null&&pv!=null?v-pv:null;const good=d==null?null:(better==='up'?d>=0:d<=0);return `<div class="nx-tile" style="background:rgba(255,255,255,.04)"><span>${lab}</span><b class="num">${v!=null?(Math.abs(v)>=20?Math.round(v):v.toFixed(1)):'–'}<small> ${u}</small></b><em class="${good==null?'':good?'nx-up':'nx-dn'}">${d==null?(A.n?A.n+' check-ins':'no check-ins yet'):(d>0?'▲ ':'▼ ')+(Math.abs(d)>=20?Math.round(Math.abs(d)):Math.abs(d).toFixed(1))+' vs '+prevD+' '+(ti.unit||'mg')}</em></div>`};
    h+=`<div class="nx-card"><div class="nx-split"><span class="nx-t2">Titration · ${esc(ti.name)}</span><span class="nx-pill nx-cy">${since?'Day '+(nxDays(since,DAYK)+1)+' on '+curD+' '+(ti.unit||'mg'):curD+' '+(ti.unit||'mg')}</span></div>
      <div class="nx-grid2" style="margin-top:12px;gap:8px">${t('Focus',A.focus,'/ 5',B&&B.focus,'up')}${t('Appetite',A.app,'/ 5',B&&B.app,'up')}${t('Resting pulse',A.pul,'bpm',B&&B.pul,'down')}${t('Jittery',A.jit,'/ 5',B&&B.jit,'down')}</div>
      <div class="nx-btns" style="margin-top:12px"><button type="button" class="nx-btn2" data-medv="compare" data-med="${ti.id}">Compare doses</button><button type="button" class="nx-btn2 pk" data-medv="report" data-med="${ti.id}">Appointment report</button></div></div>`}
  course.forEach(m=>{const c=m.course,day=nxDays(c.start,DAYK)+1;const logged=MEDLOG.doses.filter(x=>x.med===m.id).reduce((a,x)=>a+(+x.dose||0),0);const est=Math.max(logged,(+c.mg||+m.dose||0)*day);
    const kg=+c.kg||(typeof WT!=='undefined'&&WT.r.length?+WT.r[WT.r.length-1].kg:0);const total=+c.target||0;
    h+=`<div class="nx-card"><div style="display:flex;gap:14px;align-items:center">${nxRing(total&&kg?Math.min(1,est/kg/total):Math.min(1,day/180),66,7,m.color||NXC.yellow,`<b style="font-size:15px">${day}</b><span>days</span>`)}
      <div style="min-width:0"><div class="nx-t2">${esc(m.name)} course</div><div class="nx-xs" style="margin-top:3px">cumulative ${est>=1000?(est/1000).toFixed(2)+' g':Math.round(est)+' mg'}${kg?' · '+(est/kg).toFixed(1)+' mg/kg':''}</div><div class="nx-xs">${total?'target '+total+' mg/kg, set by your doctor':'target set by your doctor'}</div></div></div>
      <div class="nx-rows" style="margin-top:12px"><div class="nx-row"><span class="nx-s" style="color:#d1d1d6">Next blood test</span><span class="nx-pill">${c.bloods?nxDate(c.bloods):'not set'}</span></div>
      <div class="nx-row"><span class="nx-s" style="color:#d1d1d6">Mood guard</span><span class="nx-pill ${typeof nxGuardOn==='function'&&nxGuardOn()?'nx-ok':''}">${typeof nxGuardOn==='function'&&nxGuardOn()?'On':'Off · Journal › Mood'}</span></div></div></div>`});
  if(bp14.length){const s=nxAvg(bp14.map(r=>r.s)),d=nxAvg(bp14.map(r=>r.d)),p=nxAvg(bp14.map(r=>r.p));
    h+=`<div class="nx-card"><div class="nx-h"><span>BP and pulse</span><em>your Today BP log · 14 days</em></div><div class="nx-grid2"><div><div class="nx-mid num">${Math.round(s)}/${Math.round(d)}</div><div class="nx-xs">average · ${bp14.length} readings</div>${nxSpark(bp14.map(r=>r.s),{w:150,h:30,col:NXC.cyan,sw:1.8})}</div>
      <div><div class="nx-mid num">${p?Math.round(p):'–'}<small> bpm</small></div><div class="nx-xs">average resting pulse</div>${nxSpark(bp14.map(r=>r.p).filter(Boolean),{w:150,h:30,col:NXC.orange,sw:1.8})}</div></div></div>`}
  h+=`<div class="nx-note">A log for you and your prescriber, not advice. Dose changes stay with them.</div></div>`;
  el.innerHTML=h;el.onclick=medClick}
function medClick(e){const lg=e.target.closest('[data-medlog]');if(lg){medLogNow(lg.dataset.medlog);return}
  const v=e.target.closest('[data-medv]');if(v){MEDV=v.dataset.medv;MEDSEL=v.dataset.med;renderMeds();window.scrollTo(0,$('stackSeg').offsetTop-10);return}
  if(e.target.closest('[data-medback]')){MEDV=MEDV==='report'?'compare':'home';renderMeds();return}
  if(e.target.closest('#medAdd')){medEdit(null);return}const ed=e.target.closest('[data-medEd]');if(ed){medEdit(ed.getAttribute('data-medEd'));return}
  if(e.target.closest('#medPrint')){medPrint();return}}

function medEdit(id){const m=id?{...medById(id),course:{...(medById(id).course||{})}}:{id:rid(),name:'',dose:'',unit:'mg',peak:0,dur:13,on:true,color:MED_COLS[MEDS.meds.length%MED_COLS.length],course:{}};
  const names=[...new Set(((typeof M!=='undefined'&&M.plans)?['weekday','weekend'].flatMap(k=>M.plans[k].flatMap(b=>b.items.map(i=>dn(i.item)))):[]))].sort();
  openSheet(id?'edit med':'add med',`<div class="nx" style="padding:0;gap:14px">
    <div class="nx-field"><label for="meN">Name</label><input class="nx-inp" id="meN" list="meNames" value="${esc(m.name)}" placeholder="the same name as on Today" autocomplete="off"><datalist id="meNames">${names.map(n=>`<option value="${esc(n)}">`).join('')}</datalist><span class="nx-xs">Ticking a Today item with this name logs the dose.</span></div>
    <div class="nx-grid2"><div class="nx-field"><label for="meD">Dose</label><input class="nx-inp num" id="meD" type="number" inputmode="decimal" value="${esc(m.dose)}"></div><div class="nx-field"><label for="meU">Unit</label><select class="nx-inp" id="meU">${['mg','mcg','g','ml','IU','tabs'].map(u=>`<option ${u===m.unit?'selected':''}>${u}</option>`).join('')}</select></div></div>
    <div class="nx-grid2"><div class="nx-field"><label for="meP">Peak check-in after</label><select class="nx-inp" id="meP">${[[0,'no check-in'],[1,'1 h'],[2,'2 h'],[3,'3 h'],[4,'4 h'],[5,'5 h']].map(([v,l])=>`<option value="${v}" ${+m.peak===v?'selected':''}>${l}</option>`).join('')}</select></div><div class="nx-field"><label for="meL">Lasts about</label><select class="nx-inp" id="meL">${[4,6,8,10,12,13,14].map(v=>`<option value="${v}" ${+m.dur===v?'selected':''}>${v} h</option>`).join('')}</select></div></div>
    <div class="nx-sec" style="margin:4px 0 -4px">Course tracking · optional</div>
    <div class="nx-grid2"><div class="nx-field"><label for="meCs">Course started</label><input class="nx-inp" id="meCs" type="date" value="${esc(m.course.start||'')}"></div><div class="nx-field"><label for="meCb">Next blood test</label><input class="nx-inp" id="meCb" type="date" value="${esc(m.course.bloods||'')}"></div></div>
    <div class="nx-grid2"><div class="nx-field"><label for="meCk">Weight for mg/kg</label><input class="nx-inp num" id="meCk" type="number" inputmode="decimal" value="${esc(m.course.kg||'')}" placeholder="latest weigh-in"></div><div class="nx-field"><label for="meCt">Target mg/kg</label><input class="nx-inp num" id="meCt" type="number" inputmode="decimal" value="${esc(m.course.target||'')}" placeholder="from your doctor"></div></div>
    <div class="nx-btns"><button type="button" class="nx-btnp" id="meSave">Save</button></div>
    ${id?`<button type="button" class="nx-btn2" id="meOff">${m.on===false?'Turn back on':'Stop tracking'}</button>`:''}</div>`);
  $('sheetBody').onclick=e=>{if(e.target.closest('#meOff')){const x=medById(id);x.on=x.on===false;medsSaveList();closeSheet();renderMeds();return}
    if(!e.target.closest('#meSave'))return;const name=$('meN').value.trim();if(!name){$('meN').focus();return}
    Object.assign(m,{name,dose:+$('meD').value||'',unit:$('meU').value,peak:+$('meP').value,dur:+$('meL').value});
    const cs=$('meCs').value;m.course=cs?{start:cs,bloods:$('meCb').value||'',kg:+$('meCk').value||'',target:+$('meCt').value||'',mg:+m.dose||''}:{};
    if(!cs)delete m.course;const i=MEDS.meds.findIndex(x=>x.id===m.id);if(i>=0)MEDS.meds[i]=m;else MEDS.meds.push(m);medsSaveList();closeSheet();renderMeds()}}

async function renderMedCompare(el){const m=medById(MEDSEL)||medActive().find(x=>x.peak);if(!m){MEDV='home';return renderMeds()}
  const g=medByDose(m.id),ds=Object.keys(g).map(Number).sort((a,b)=>a-b);const u=m.unit||'mg';
  const S=ds.map(d=>medStats(m.id,d));await Promise.all(S.map(async s=>{s.sleep=await medSleepFor(s.dayList)}));
  const first=MEDLOG.doses.filter(x=>x.med===m.id)[0];
  const row=(lab,k,lo,hi,better,fmt=v=>v.toFixed(1),u2='',note='')=>{const vals=S.map(s=>s[k]);if(vals.every(v=>v==null))return '';const a=vals[vals.length-2],b=vals[vals.length-1];const good=a!=null&&b!=null?((b>a)===(better==='up')):null;
    return `<div class="nx-pairs"><div class="nx-split"><span style="font-size:13.5px;color:#f2f2f7;font-weight:600">${lab}</span><span class="num" style="font-size:12.5px;color:#8e8e93">${vals.map((v,i)=>i===vals.length-1?`<b style="color:${good==null?'#fff':good?NXC.green:NXC.red}">${v!=null?fmt(v)+u2:'–'}</b>`:(v!=null?fmt(v)+u2:'–')).join(' → ')}</span></div>
      ${S.map((s,i)=>`<div class="nx-pr"><span class="nx-xs" ${i===S.length-1?`style="color:${NXC.pink}"`:''}>${ds[i]} ${u}</span><div class="nx-bar" style="height:6px"><i class="${i===S.length-1?'':'w'}" style="width:${s[k]!=null?Math.max(2,Math.min(100,(s[k]-lo)/(hi-lo)*100)):0}%"></i></div></div>`).join('')}${note?`<div class="nx-xs">${note}</div>`:''}</div>`};
  const seKeys=[...new Set(S.flatMap(s=>Object.keys(s.se)))];
  el.innerHTML=`<div class="nx"><button type="button" class="nx-back" data-medback>‹ Meds</button>
    <div class="nx-card"><div class="nx-t1">${esc(m.name)} · dose comparison</div><div class="nx-s" style="margin-top:4px">${first?nxDate(first.day||String(first.at).slice(0,10))+' to '+nxDate(DAYK)+' · ':''}${S.map((s,i)=>`${ds[i]} ${u} for ${s.days} day${s.days===1?'':'s'}`).join(', ')} · ${S.reduce((a,s)=>a+s.n,0)} check-ins</div>
      ${ds.length?`<div style="margin-top:8px">${row('Focus','focus',1,5,'up')}${row('Mood','mood',1,5,'up')}${row('Appetite','app',1,5,'up','',undefined,'Lower appetite helps a cut, but keep protein up')}${row('Jittery or anxious','jit',1,5,'down')}${row('Resting pulse','pul',50,110,'down',v=>String(Math.round(v)),' bpm')}${row('Systolic BP','sys',90,150,'down',v=>String(Math.round(v)))}${row('Sleep score the night after','sleep',0,100,'up',v=>String(Math.round(v)))}</div>`:'<div class="nx-s" style="margin-top:10px">Rate a few peak check-ins on each dose and the comparison builds itself.</div>'}</div>
    ${seKeys.length?`<div class="nx-card"><div class="nx-h"><span>Side effects</span><em>share of check-ins</em></div><div class="nx-rows">${seKeys.map(k=>`<div class="nx-row"><span>${esc(k[0].toUpperCase()+k.slice(1))}</span><span class="num nx-s">${S.map((s,i)=>(s.n?Math.round((s.se[k]||0)/s.n*100):0)+'%'+(i<S.length-1?' → ':'')).join('')}</span></div>`).join('')}</div></div>`:''}
    <div class="nx-card"><div class="nx-h"><span>Questions for your appointment</span><em>saved with this med</em></div><textarea class="nx-inp" id="medQ" rows="4" placeholder="What you want to ask, one per line">${esc(m.q||'')}</textarea></div>
    <button type="button" class="nx-btnp" data-medv="report" data-med="${m.id}">Make appointment report</button></div>`;
  el.onclick=medClick;const q=$('medQ');if(q)q.oninput=()=>{m.q=q.value;clearTimeout(q._t);q._t=setTimeout(medsSaveList,600)}}

function medReportHtml(m){const g=medByDose(m.id),ds=Object.keys(g).map(Number).sort((a,b)=>a-b),u=m.unit||'mg',S=ds.map(d=>medStats(m.id,d));
  const f=v=>v==null?'–':v.toFixed(1),first=MEDLOG.doses.filter(x=>x.med===m.id)[0];const se=[...new Set(S.flatMap(s=>Object.keys(s.se)))];
  const others=medActive().filter(x=>x.id!==m.id).map(x=>esc(x.name+(x.dose?' '+x.dose+' '+(x.unit||'mg'):'')));
  return `<div class="nx-paper"><h4>${esc(m.name)} log</h4><div class="ps">${first?nxDate(first.day||String(first.at).slice(0,10))+' to '+nxDate(DAYK)+' '+DAYK.slice(0,4):''} · self-reported in Dylan's System · ratings 1 (low) to 5 (high)</div>
    <div class="sh">By dose</div><table><tr><th></th>${ds.map(d=>`<th>${d} ${u}</th>`).join('')}</tr>
    ${[['Days',s=>s.days],['Check-ins',s=>s.n],['Focus',s=>f(s.focus)],['Mood',s=>f(s.mood)],['Appetite',s=>f(s.app)],['Jittery / anxious',s=>f(s.jit)],['BP (avg)',s=>s.sys?Math.round(s.sys)+'/'+Math.round(s.dia):'–'],['Resting pulse',s=>s.pul?Math.round(s.pul)+' bpm':'–'],['Sleep score after',s=>s.sleep?Math.round(s.sleep):'–']].map(([l,fn])=>`<tr><td>${l}</td>${S.map(s=>`<td>${fn(s)}</td>`).join('')}</tr>`).join('')}</table>
    ${se.length?`<div class="sh">Side effects · % of check-ins</div><table><tr><th>Effect</th>${ds.map(d=>`<th>${d} ${u}</th>`).join('')}</tr>${se.map(k=>`<tr><td>${esc(k)}</td>${S.map(s=>`<td>${s.n?Math.round((s.se[k]||0)/s.n*100):0}%</td>`).join('')}</tr>`).join('')}</table>`:''}
    ${others.length?`<div class="sh">Also taking</div><ul>${others.map(o=>`<li>${o}</li>`).join('')}</ul>`:''}
    ${m.q?`<div class="sh">Questions</div><ul>${m.q.split('\n').map(x=>x.trim()).filter(Boolean).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}</div>`}
async function renderMedReport(el){const m=medById(MEDSEL);if(!m){MEDV='home';return renderMeds()}const g=medByDose(m.id);const S=Object.keys(g);
  el.innerHTML=`<div class="nx"><div class="nx-split" style="align-items:center"><button type="button" class="nx-back" data-medback>‹ Comparison</button><button type="button" class="nx-pill nx-pk" id="medPrint">Share PDF</button></div><div id="medRep">${medReportHtml(m)}</div><div class="nx-note">Share PDF opens the print sheet: pick Save to Files or share it. Only what's on this page leaves the app.</div></div>`;
  el.onclick=medClick;
  /* sleep after each dose loads a moment later */
  const ds=Object.keys(g).map(Number);await Promise.all(ds.map(async d=>{const s=medStats(m.id,d);s.sleep=await medSleepFor(s.dayList)}));if(S.length)$('medRep').innerHTML=medReportHtml(m)}
function medPrint(){const src=$('medRep');if(!src)return;let p=$('nxPrint');if(!p){p=document.createElement('div');p.id='nxPrint';document.body.appendChild(p)}p.innerHTML=src.innerHTML;document.documentElement.classList.add('nx-printing');
  const done=()=>{document.documentElement.classList.remove('nx-printing');p.innerHTML=''};addEventListener('afterprint',done,{once:true});setTimeout(()=>{try{print()}catch(e){nxErr(e,'print')}setTimeout(done,60e3)},50)}
nxCmd('log a med dose','meds',()=>{go('stack');setStackV('meds')});
