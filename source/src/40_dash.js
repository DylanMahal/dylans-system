/* ================= HOME DASHBOARD (top of Today) + error badge + full export =================
   One screen that answers "am I on track today?": each tile is green / amber / red and opens its page.
   Reads what the other pages already keep in memory, and fetches only small docs when a page hasn't loaded yet. */
let DASHT=null,DASHC={};
function dashSoon(){clearTimeout(DASHT);DASHT=setTimeout(()=>renderDash().catch(e=>nxErr(e,'dashboard')),350)}
async function dashOnce(k,ms,f){const c=DASHC[k];if(c&&Date.now()-c.t<ms)return c.v;const v=await f();DASHC[k]={t:Date.now(),v};return v}
const dashTone=(v,good,ok,hi)=>v==null?'':hi?(v>=good?'g':v>=ok?'a':'r'):(v<=good?'g':v<=ok?'a':'r');
async function renderDash(){const el=$('todayDash');if(!el||typeof booted==='undefined'||!booted)return;const T=[];
  /* plan */
  if(typeof M!=='undefined'&&M&&M.plans)try{const p=pctOf(countedItems()).p;T.push({k:'plan',l:'Day plan',v:p+'%',s:'target 80%',t:dashTone(p,80,50,1),go:'today'})}catch(e){nxErr(e,'dash plan')}
  /* sleep: last night */
  try{const n=(typeof SNIGHTS!=='undefined'&&SNIGHTS[DAYK])||await dashOnce('sl'+DAYK,3e5,()=>load('sleep/w-'+DAYK));
    let q=null;try{q=n&&typeof sQ==='function'?sQ(n):null}catch(e){}
    T.push({k:'sleep',l:'Sleep',v:n&&n.asleep?(q!=null?q+'':Math.floor(n.asleep/60)+'h'+pad(n.asleep%60)):'–',s:n&&n.asleep?Math.floor(n.asleep/60)+'h '+pad(n.asleep%60)+'m asleep':'no night synced yet',t:q!=null?dashTone(q,80,65,1):n&&n.asleep?dashTone(n.asleep,420,360,1):'r',go:'sleep'})}catch(e){nxErr(e,'dash sleep')}
  /* mood */
  try{const xs=(typeof MOODD!=='undefined'?MOODD.in:[]).filter(x=>x.m!=null);const m=xs.length?avg(xs.map(moodV)):null;
    T.push({k:'mood',l:'Mood',v:m!=null?m.toFixed(1):'–',s:m!=null?xs.length+' check-in'+(xs.length>1?'s':''):'not checked in',t:dashTone(m,7,5,1),go:'journal/mood'})}catch(e){nxErr(e,'dash mood')}
  /* food: calories left and protein */
  try{if(typeof foodLoaded!=='undefined'&&!foodLoaded){if(!FPROF){const p=await dashOnce('fp',6e5,()=>load('food/profile'));if(p&&!FPROF)FPROF=p}if(!FDAYS[DAYK]){const d=await dashOnce('fd'+DAYK,6e4,()=>load('food/d-'+DAYK));if(d&&!FDAYS[DAYK])FDAYS[DAYK]={m:{b:[],l:[],d:[],s:[]},ex:[],w:0,note:'',...d}}}
    if(FPROF){const s=fSum(dayItems(DAYK)),B=fBudget()+(FPROF.noEx?0:exKcal(DAYK)),Tg=fTargets(),left=Math.round(B-s.kcal);const pp=Tg.p?s.p/Tg.p:0;
      T.push({k:'food',l:'Food',v:left>=0?left.toLocaleString('en-GB'):'+'+(-left).toLocaleString('en-GB'),s:`kcal ${left>=0?'left':'over'} · protein ${Math.round(s.p)}/${Tg.p} g`,t:left<-150?'r':pp>=.8?'g':new Date().getHours()>=18&&pp<.6?'r':'a',go:'food'})}}catch(e){nxErr(e,'dash food')}
  /* training this week */
  try{const wk=wrDays(0);const ws=(typeof gymLoaded!=='undefined'&&gymLoaded)?WORKOUTS:await dashOnce('gym',6e5,async()=>(await listDocs('gym/w-')).map(r=>r.data).filter(w=>w&&w.date));
    const n=ws.filter(w=>wk.includes(w.date)).length;const last=ws.map(w=>w.date).filter(Boolean).sort().pop();const ago=last?Math.round((new Date(DAYK+'T12:00')-new Date(last+'T12:00'))/864e5):null;
    const tg=((typeof TGA!=='undefined'&&Object.entries(TGA).find(([k])=>/gym|train|lift|workout/i.test(k)))||[])[1];const goal=tg&&tg.n||null;const dn=(new Date(DAYK+'T12:00').getDay()+6)%7+1;
    T.push({k:'gym',l:'Training',v:goal?n+'/'+goal:String(n),s:ago==null?'no sessions yet':ago===0?'trained today':'last '+ago+' day'+(ago>1?'s':'')+' ago',t:goal?(n>=goal*dn/7-.5?'g':n>=goal*dn/7-1.5?'a':'r'):ago==null?'':dashTone(ago,2,3),go:'gym'})}catch(e){nxErr(e,'dash gym')}
  /* weight rate */
  try{const r=typeof wtRate==='function'?wtRate():null;const ma=typeof wtMA==='function'?wtMA():[];const last=ma[ma.length-1];const goalRate=FPROF&&+FPROF.rate;
    if(last)T.push({k:'wt',l:'Weight',v:last.ma.toFixed(1),s:r?`${r.pct>0?'+':''}${r.pct.toFixed(2)}% / week`:'7-day average',t:r&&goalRate?(Math.sign(r.kg)===Math.sign(goalRate)&&Math.abs(r.pct)<=1.1?'g':Math.abs(r.kg)<.1?'a':'r'):'',go:'food'})}catch(e){nxErr(e,'dash weight')}
  /* focus */
  try{const m=DAY.dw||0,tg=typeof DW_TARGET!=='undefined'?DW_TARGET:240;const h=new Date().getHours();
    T.push({k:'focus',l:'Focus',v:Math.floor(m/60)+'h'+pad(m%60),s:`of ${Math.floor(tg/60)}h ${pad(tg%60)}m deep work`,t:m>=tg?'g':m>=tg*Math.min(1,Math.max(0,(h-8)/10))*.7?'a':'r',go:'tools'})}catch(e){nxErr(e,'dash focus')}
  /* habits */
  try{if(typeof habLoaded!=='undefined'&&!habLoaded&&typeof loadHabits==='function'){await dashOnce('hab',6e5,()=>loadHabits().then(()=>1))}
    if(typeof hAll==='function'&&habLoaded){const due=hAll().filter(h=>hDue(h,DAYK)),ok=due.filter(h=>hDone(h,DAYK)).length;
      T.push({k:'hab',l:'Habits',v:ok+'/'+due.length,s:due.length?Math.round(ok/due.length*100)+'% done today':'nothing due',t:due.length?dashTone(ok/due.length,.8,.5,1):'',go:'streaks'})}}catch(e){nxErr(e,'dash habits')}
  /* backup freshness: the PC agent saves every document to OneDrive nightly */
  let warn='';try{const b=await dashOnce('bk',36e5,()=>load('agent/backup'));const age=b&&b.at?(Date.now()-new Date(b.at))/864e5:null;
    if(age==null||age>2)warn=`<button type="button" class="dash-warn" data-dgo="tools">⚠ ${age==null?'No backup found yet':'Last backup '+Math.floor(age)+' days ago'} · the PC sync agent saves one nightly</button>`}catch(e){}
  const good=T.filter(x=>x.t==='g').length,rated=T.filter(x=>x.t).length;
  el.innerHTML=`<div class="dash"><div class="dash-h"><b>${rated?good===rated?'On track':good>=rated/2?'Mostly on track':'Off track':'Today'}</b><span class="dim num">${good}/${rated} green</span></div>
    <div class="dash-g">${T.map(x=>`<button type="button" class="dash-t ${x.t||''}" data-dgo="${x.go}"><span class="dash-l">${x.l}</span><b class="num">${esc(x.v)}</b><small>${esc(x.s)}</small></button>`).join('')}</div>${warn}</div>`}
document.addEventListener('click',e=>{const b=e.target.closest('#todayDash [data-dgo]');if(!b)return;const v=b.dataset.dgo;if(v==='today'){const x=$('blocks');if(x)x.scrollIntoView({behavior:'smooth',block:'start'});return}go(v)});
setInterval(()=>{if(!document.hidden&&cur==='today')dashSoon()},60e3);

/* ---------- visible errors: anything that fails shows as a badge by the sync status, tap for details ---------- */
function errBadge(){const n=(typeof NXERR!=='undefined'?NXERR:[]).filter(x=>!x.seen).length;let b=$('errBadge');const s=$('sync');if(!s)return;
  if(!b){b=document.createElement('button');b.type='button';b.id='errBadge';b.className='errb';b.setAttribute('aria-label','Errors');s.after(b);
    b.onclick=()=>{openSheet('Errors',`<div class="errl">${NXERR.slice(0,40).map(x=>`<div><small class="num">${esc(new Date(x.t).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}))}</small>${esc(x.m)}</div>`).join('')||'<div class="dim">Nothing has failed.</div>'}</div><div class="bigbtns" style="margin-top:12px"><span style="flex:1"></span><button class="btn" type="button" id="errClr">Clear</button></div>`);
      NXERR.forEach(x=>x.seen=1);LS.set('diag/errs',NXERR);errBadge();$('errClr').onclick=()=>{NXERR=[];LS.set('diag/errs',NXERR);closeSheet();errBadge()}}}
  b.hidden=!n;b.textContent='⚠ '+n}
addEventListener('error',e=>{if(e&&e.message&&!/ResizeObserver|Script error/i.test(e.message)&&typeof nxErr==='function')nxErr(e.error||e.message,'page')});
addEventListener('unhandledrejection',e=>{const r=e&&e.reason;if(r&&!/AbortError|NotAllowedError|Load failed|Failed to fetch/i.test(String(r&&(r.name+r.message)||r))&&typeof nxErr==='function')nxErr(r,'async')});
setTimeout(errBadge,3000);

/* ---------- full export: every document in one JSON file, straight from the app ---------- */
async function exportAll(btn){if(!SB||!UID)return;if(btn){btn.disabled=true;btn.textContent='Exporting…'}
  try{const rows=[];let from=0;for(;;){const {data,error}=await SB.from('kv').select('path,data,updated_at').order('path').range(from,from+999);if(error)throw error;rows.push(...data);if(data.length<1000)break;from+=1000}
    const blob=new Blob([JSON.stringify({app:'dylans-system',at:new Date().toISOString(),count:rows.length,rows})],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='dylans-system-'+DAYK+'.json';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},2000);
    if(btn)btn.textContent=`Exported ${rows.length} documents`}catch(e){nxErr(e,'export');if(btn)btn.textContent='Export failed, try again'}finally{if(btn)btn.disabled=false}}
if(typeof nxCmd==='function')nxCmd('export all data','export',()=>exportAll());
if($('expAll'))$('expAll').onclick=e=>exportAll(e.currentTarget);
document.addEventListener('click',e=>{if(e.target.closest('[data-mback]'))go('tools')});
