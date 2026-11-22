/* ================= GYM v2 — full workout tracker ================= */
/* exercise database: free-exercise-db (Unlicense), images from its GitHub CDN */
const IMGBASE='https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/';
const MUSCLES2=['chest','shoulders','biceps','triceps','forearms','abs','lats','upper back','lower back','traps','quads','hamstrings','glutes','calves','adductors','abductors','neck','cardio','full body'];
const EQUIP2=['barbell','dumbbell','machine','cable','none','kettlebell','band','ez bar','smith machine','plate','other'];
const XTYPES={wr:{l:'weight & reps',f:['kg','r']},bw:{l:'bodyweight reps',f:['r']},wbw:{l:'weighted bodyweight',f:['kg','r'],pfx:'+'},abw:{l:'assisted bodyweight',f:['kg','r'],pfx:'−'},r:{l:'reps only',f:['r']},dur:{l:'duration',f:['sec']},dd:{l:'distance & duration',f:['km','sec']},wd:{l:'weight & distance',f:['kg','m']}};
const FLAB={kg:'kg',r:'reps',sec:'time',km:'km',m:'m'};
const LEGACY={'bench press (barbell)':['chest','barbell'],'incline bench press (barbell)':['chest','barbell'],'incline bench press (dumbbell)':['chest','dumbbell'],'bench press (dumbbell)':['chest','dumbbell'],'chest press (machine)':['chest','machine'],'cable fly':['chest','cable'],'pec deck':['chest','machine'],'pull up':['lats','none','bw'],'chin up':['lats','none','bw'],'lat pulldown (cable)':['lats','cable'],'seated cable row':['upper back','cable'],'bent over row (barbell)':['upper back','barbell'],'deadlift (barbell)':['lower back','barbell'],'overhead press (barbell)':['shoulders','barbell'],'shoulder press (dumbbell)':['shoulders','dumbbell'],'lateral raise (dumbbell)':['shoulders','dumbbell'],'face pull':['shoulders','cable'],'bicep curl (dumbbell)':['biceps','dumbbell'],'hammer curl (dumbbell)':['biceps','dumbbell'],'triceps pushdown':['triceps','cable'],'squat (barbell)':['quads','barbell'],'leg press':['quads','machine'],'leg extension':['quads','machine'],'romanian deadlift (barbell)':['hamstrings','barbell'],'lying leg curl':['hamstrings','machine'],'seated leg curl':['hamstrings','machine'],'hip thrust (barbell)':['glutes','barbell'],'standing calf raise':['calves','machine'],'cable crunch':['abs','cable'],'hanging leg raise':['abs','none','bw'],'plank':['abs','none','dur'],'treadmill incline walk':['cardio','machine','dd']};

let WPH={};
let GYMV='workout',ACTIVE=null,ROUTINES={list:[]},GLIB={custom:[]},WORKOUTS=[],gymLoaded=false,EXDB=null,EXMAP=new Map(),PHOTOS={};
let restEnd=LS.get('restEnd')||null,restTotal=LS.get('restTotal')||120,HIST_MODE='list',HIST_MONTH=null,STAT_P=12,STAT_M='volume';
const GSET={bar:20,plates:[25,20,15,10,5,2.5,1.25],...(LS.get('gymset')||{})};
function gymTypeFor(){if(planKind==='weekend')return DOWN==='Sun'?'lower':'upper';return 'upper'}
const e1=s=>(+s.kg||0)*(1+(+s.r||0)/30);
const fmtDur=ms=>{const s=Math.max(0,Math.floor(ms/1000));const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return h?`${h}h ${pad(m)}m`:`${m}:${pad(x)}`};
const kgs=v=>{const n=+v;return v!==''&&v!=null&&isFinite(n)?(Math.round(n*100)/100).toString():''};
const mmss=s=>{s=+s||0;return Math.floor(s/60)+':'+pad(Math.round(s%60))};
const pmmss=v=>{v=String(v||'').trim();if(!v)return '';if(v.includes(':')){const [m,s]=v.split(':');return (+m||0)*60+(+s||0)}return Math.round((+v||0)*60)};
const fmtVol=v=>Math.round(v||0).toLocaleString('en-GB');

/* ---------- exercise catalogue ---------- */
async function loadExDb(){if(EXDB)return;try{const r=await fetch('exdb.json?v=1');EXDB=await r.json()}catch(e){EXDB=[]}indexEx()}
let NMAP=new Map();function indexEx(){EXMAP=new Map();NMAP=new Map();(EXDB||[]).forEach(x=>EXMAP.set(x.id,x));
  Object.entries(LEGACY).forEach(([k,v])=>{const id='n:'+k;if(!EXMAP.has(id))EXMAP.set(id,{id,n:k.replace(/(^|\s|\()\S/g,c=>c.toUpperCase()),pm:[v[0]],sm:[],eq:v[1],ty:v[2]||'wr',legacy:1})});
  (GLIB.custom||[]).forEach(c=>{if(!c.id)c.id='c-'+norm(c.name||c.n).replace(/\s+/g,'-');EXMAP.set(c.id,{id:c.id,n:c.n||c.name,pm:c.pm||[(c.muscle||'other').toLowerCase()],sm:c.sm||[],eq:c.eq||c.equip||'other',ty:c.ty||'wr',custom:1})});
  EXMAP.forEach(e=>{const k=norm(e.n);if(!NMAP.has(k)||e.custom)NMAP.set(k,e)})}
function exOf(x){if(x.id&&EXMAP.has(x.id))return EXMAP.get(x.id);const k='n:'+norm(x.n||'');if(EXMAP.has(k))return EXMAP.get(k);const nm=NMAP.get(norm(x.n||''));if(nm)return nm;return {id:x.id||k,n:x.n,pm:['other'],sm:[],eq:'other',ty:'wr'}}
function exKey(x){return exOf(x).id}
function imgOf(e,i=0){if(e.custom&&PHOTOS[e.id])return PHOTOS[e.id];return e.img&&e.img[i]?IMGBASE+e.img[i]:''}
function thumb(e,cls='thumb'){const u=imgOf(e);return u?`<img class="${cls}" src="${esc(u)}" alt="" loading="lazy" decoding="async">`:`<span class="${cls} ph">${esc((e.pm[0]||'?').slice(0,2))}</span>`}
function allExList(){return [...EXMAP.values()].filter(e=>!e.legacy||usedCount(e.id))}
let USED=new Map();function recountUsed(){USED=new Map();WORKOUTS.forEach(w=>(w.ex||[]).forEach(x=>{const k=exKey(x);USED.set(k,(USED.get(k)||0)+1)}))}
function usedCount(id){return USED.get(id)||0}

function convertOld(s){return {id:'old-'+s.date,name:(s.type||'workout').replace(/^./,c=>c.toUpperCase()),date:s.date,startedAt:s.date+'T12:00:00',endedAt:null,ex:(s.ex||[]).filter(x=>x.sets&&x.sets.length).map(x=>({n:x.n,sets:x.sets.map(t=>({t:'n',kg:t.w,r:t.r,done:true}))})),vol:s.vol||0,nsets:s.nsets||0,prs:[]}}
async function loadGym(force){
  if(gymLoaded&&!force){renderGym();return}
  const [a,r,l,rows]=await Promise.all([load('gym/active'),load('gym/routines'),load('gym/lib'),listDocs('gym/'),loadExDb()]);
  ACTIVE=a&&a.ex?a:null;ROUTINES={list:[],...(r||{})};GLIB={custom:[],...(l||{})};
  const ws=[];PHOTOS={};rows.forEach(x=>{if(x.path.startsWith('gym/w-')&&x.data&&x.data.date)ws.push(x.data);else if(x.path.startsWith('gym/s-')&&x.data&&x.data.date&&(x.data.nsets||0)>0)ws.push(convertOld(x.data));else if(x.path.startsWith('gym/xp-')&&x.data&&x.data.img)PHOTOS[x.path.slice(7)]=x.data.img;else if(x.path.startsWith('gym/wp-')&&x.data&&x.data.imgs)WPH[x.path.slice(7)]=x.data.imgs});
  WORKOUTS=ws.sort((a,b)=>(b.startedAt||b.date)<(a.startedAt||a.date)?-1:1);indexEx();recountUsed();gymLoaded=true;renderGym();
}
let gymDefer=false;function typingInGym(){const a=document.activeElement;return a&&a.closest&&a.closest('#g-workout')&&/INPUT|TEXTAREA/.test(a.tagName)}
watch('gym/active',d=>{if(typingInGym()&&ACTIVE&&d&&d.id===ACTIVE.id){gymDefer=d;return}ACTIVE=d&&d.ex?d:null;if(cur==='gym')renderGym()});
document.addEventListener('focusout',()=>setTimeout(()=>{if(gymDefer&&!typingInGym()){ACTIVE=gymDefer.ex?gymDefer:ACTIVE;gymDefer=false;if(cur==='gym')renderGym()}},0));
watch('gym/routines',d=>{ROUTINES={list:[],...(d||{})};if(cur==='gym')renderGym()});
let GUNITS={};load('gym/units').then(d=>{GUNITS=d||{};if(cur==='gym')renderGym()});watch('gym/units',d=>{GUNITS=d||{};if(cur==='gym')renderGym()});
const LB=2.20462,isLb=id=>GUNITS[id]==='lb',uL=id=>isLb(id)?'lbs':'kg',uIn=(id,v)=>{if(v===''||v==null||!isFinite(+v))return v??'';return isLb(id)?kgs(Math.round(+v*LB*10)/10):kgs(v)},uOut=(id,v)=>{if(v===''||!isFinite(+v))return v;return isLb(id)?String(Math.round(+v/LB*10000)/10000):v},wU=(id,v)=>uIn(id,v)+' '+uL(id);
watch('gym/lib',d=>{GLIB={custom:[],...(d||{})};indexEx();if(cur==='gym')renderGym()});
watchPrefix('gym/w-',(evt,path,data)=>{const id=path.slice(6);WORKOUTS=WORKOUTS.filter(w=>w.id!==id);if(evt!=='DELETE'&&data)WORKOUTS.unshift(data);WORKOUTS.sort((a,b)=>(b.startedAt||b.date)<(a.startedAt||a.date)?-1:1);recountUsed();if(cur==='gym')renderGym()});
watchPrefix('gym/xp-',(evt,path,data)=>{const id=path.slice(7);if(evt==='DELETE')delete PHOTOS[id];else if(data&&data.img)PHOTOS[id]=data.img;if(cur==='gym')renderGym()});
let activeT=null;function saveActive(){clearTimeout(activeT);activeT=setTimeout(()=>{if(ACTIVE)save('gym/active',ACTIVE);else removeDoc('gym/active')},300)}

/* ---------- history helpers ---------- */
function exHistory(key,beforeId){return WORKOUTS.filter(w=>w.id!==beforeId).map(w=>({w,x:(w.ex||[]).find(x=>exKey(x)===key)})).filter(o=>o.x&&o.x.sets.some(s=>s.done!==false))}
function prevSets(x){const h=exHistory(exKey(x),ACTIVE&&ACTIVE.id)[0];return h?h.x.sets.filter(s=>s.done!==false):[]}
function bests(key,beforeId){let kg=0,e=0,vol=0,reps=0,sec=0,km=0;exHistory(key,beforeId).forEach(o=>o.x.sets.forEach(s=>{if(s.t==='w'||s.done===false)return;kg=Math.max(kg,+s.kg||0);e=Math.max(e,e1(s));vol=Math.max(vol,(+s.kg||0)*(+s.r||0));reps=Math.max(reps,+s.r||0);sec=Math.max(sec,+s.sec||0);km=Math.max(km,+s.km||0)}));return {kg,e,vol,reps,sec,km}}
function setLabel(sets,i){const s=sets[i];if(s.t==='w')return 'W';if(s.t==='d')return 'D';if(s.t==='f')return 'F';let n=0;for(let j=0;j<=i;j++)if(!sets[j].t||sets[j].t==='n')n++;return String(n)}
function volOf(x,s){const ty=exOf(x).ty;return (ty==='wr'||ty==='wbw')?(+s.kg||0)*(+s.r||0):0}
function NS(w){return (w.ex||[]).some(x=>x.sets&&x.sets.length)?stats(w).n:(w.nsets||0)}
function stats(w){let vol=0,n=0,reps=0;(w.ex||[]).forEach(x=>x.sets.forEach(s=>{if(s.done){if(s.t!=='w')n++;vol+=volOf(x,s);reps+=+s.r||0}}));return {vol,n,reps}}
function fmtSet(x,s){const xid=exOf(x).id,ty=exOf(x).ty;const T=XTYPES[ty]||XTYPES.wr;const p=[];
  if(T.f.includes('kg')&&s.kg!==''&&s.kg!=null)p.push((T.pfx||'')+uIn(xid,s.kg)+(isLb(xid)?'lb':'kg'));if(T.f.includes('km')&&s.km)p.push(kgs(s.km)+'km');if(T.f.includes('m')&&s.m)p.push(s.m+'m');
  if(T.f.includes('r')&&s.r)p.push((p.length?'× ':'')+s.r);if(T.f.includes('sec')&&s.sec)p.push(mmss(s.sec));let o=p.join(' ');if(s.rpe)o+=' @'+s.rpe;return o||'—'}
function bestSet(x){return x.sets.filter(s=>s.done!==false&&s.t!=='w').sort((a,b)=>e1(b)-e1(a)||(+b.r||0)-(+a.r||0)||(+b.sec||0)-(+a.sec||0))[0]}

/* ---------- shell ---------- */
function renderGym(){
  $('gymSeg').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.g===GYMV));
  ['workout','routines','history','stats','exercises','motivation'].forEach(v=>$('g-'+v).hidden=v!==GYMV);
  $('gymSub').textContent=ACTIVE?(ACTIVE.editing?'editing a past workout':'workout in progress'):(planKind==='weekend'?(DOWN==='Sun'?'plan today: lower 11:00':'plan today: upper 11:00'):(DOWN==='Tue'||DOWN==='Thu'?'plan today: upper 20:30':'rest day in the plan'));
  if(!EXDB){loadExDb().then(()=>{indexEx();renderGym()});}
  ({workout:renderWorkout,routines:renderRoutines,history:renderHistory,stats:renderStats,exercises:renderLibrary,motivation:renderMotivation})[GYMV]();renderRest();
}
$('gymSeg').onclick=e=>{const b=e.target.closest('button');if(!b)return;GYMV=b.dataset.g;renderGym();staggerIn($('g-'+GYMV))};

/* ---------- workout ---------- */
const SSCOL=['#05d9e8','#ffb000','#b967ff','#57f5a8','#ff6b6b'];
function ssColor(ss){if(!ss||!ACTIVE)return '';const ids=[...new Set(ACTIVE.ex.map(x=>x.ss).filter(Boolean))];return SSCOL[ids.indexOf(ss)%SSCOL.length]}
function renderWorkout(){if(ACTIVE&&!ACTIVE.editing)ascPrime();
  const el=$('g-workout');
  if(!ACTIVE){
    const sug=gymTypeFor();const folders={};ROUTINES.list.forEach(r=>(folders[r.folder||'my routines']=folders[r.folder||'my routines']||[]).push(r));
    domPatch(el,`<div class="gstart">${rlWindow()}
      <button class="bigstart" type="button" data-act="empty"><span class="tag">Quick start</span><b>Start empty workout</b><span class="dim">Log as you go</span></button>
      ${Object.entries(folders).map(([f,rs])=>`<div class="rgrid">${rs.map(r=>rCard(r,norm(r.name).includes(sug))).join('')}</div>`).join('')||'<div class="dim" style="font-size:12px">No routines yet. Make an "Upper" and a "Lower" one so starting a session is one tap.</div>'}
      ${WORKOUTS[0]?`<div class="ph2"><span class="tag">Last workout</span></div>${wCard(WORKOUTS[0])}`:''}
    </div>`);return}
  const st=stats(ACTIVE);const ed=!!ACTIVE.editing;
  domPatch(el,`<div class="wbar"><input class="wname" id="wName" value="${esc(ACTIVE.name)}" aria-label="Workout name"><div class="wstats"><div><span class="dim">${ed?'date':'duration'}</span><b class="num" id="wDur">${ed?esc(nice(ACTIVE.date).toLowerCase()):fmtDur(Date.now()-new Date(ACTIVE.startedAt))}</b></div><div><span class="dim">Volume</span><b class="num">${fmtVol(st.vol)} kg</b></div><div><span class="dim">Sets</span><b class="num">${st.n}</b></div><div><span class="dim">Session rank</span>${rlChip(rlLive(),18)}</div></div><div class="row"><button class="btn" type="button" data-act="discard">${ed?'cancel':'discard'}</button><button class="btn p" type="button" data-act="finish">${ed?'save':'finish'}</button></div></div>
  <textarea class="wnote" id="wNote" rows="1" placeholder="Workout notes">${esc(ACTIVE.note||'')}</textarea>
  <div class="exlist">${ACTIVE.ex.map((x,xi)=>exCard(x,xi)).join('')}</div>
  <button class="addex" type="button" data-act="addex">+ Add exercises</button>`);
  const wn=$('wNote');if(wn&&wn.value){wn.style.height='auto';wn.style.height=wn.scrollHeight+'px'}
}
function exCard(x,xi){
  const e=exOf(x);const T=XTYPES[e.ty]||XTYPES.wr;const prev=prevSets(x);const b=bests(e.id,ACTIVE.id);const col=ssColor(x.ss);
  const cols=`34px minmax(0,1fr) ${T.f.map(()=>'minmax(52px,64px)').join(' ')} 40px 38px`;
  return `<div class="exc${x.ss?' ss':''}" data-x="${xi}" style="${x.ss?'--ssc:'+col:''}">${x.ss?`<span class="sslab">Superset</span>`:''}
  <div class="exh"><button class="exhead" type="button" data-exinfo="${xi}">${thumb(e)}<span><b class="exname">${esc(e.n)}</b><span class="dim exsub">${esc(e.pm.join(', '))}${T!==XTYPES.wr?' · '+T.l:''}</span>${(()=>{const sc=rlEx(e.id,ACTIVE.id,x);return sc==null?'':rlChip(sc,18)})()}</span></button><button class="iconbtn" type="button" data-exmenu="${xi}" aria-label="Exercise options">⋯</button></div>
  <input class="exnote" data-note="${xi}" placeholder="Add notes here…" value="${esc(x.note||'')}" aria-label="Notes">
  <button class="resttag" type="button" data-restpick="${xi}">⧗ rest timer: ${x.rest?mmss(x.rest):'off'}</button>
  <div class="sgrid shead" style="grid-template-columns:${cols}"><span>Set</span><span>Previous</span>${T.f.map(f=>f==='kg'?`<button class="uswap" type="button" data-unit="${xi}" title="Switch kg / lbs">${(T.pfx||'')+uL(e.id)} ⇄</button>`:`<span>${FLAB[f]}</span>`).join('')}<span>RPE</span><span>✓</span></div>
  ${x.sets.map((s,si)=>{const p=prev[si];const pr=s.done&&s.t!=='w'&&isPR(e,s,b);return `<div class="sgrid srow${s.done?' done':''}${pr?' pr':''}" data-s="${xi}:${si}" style="grid-template-columns:${cols}">
    <button class="stype t-${s.t||'n'}" type="button" data-stype="${xi}:${si}" title="Set type">${setLabel(x.sets,si)}</button>
    <button class="sprev" type="button" data-prev="${xi}:${si}" ${p?'':'disabled'}>${p?esc(fmtSet(x,p)):'—'}</button>
    ${T.f.map(f=>{const v=f==='sec'?(s.sec?mmss(s.sec):''):f==='kg'?uIn(e.id,s.kg):(s[f]??'');const ph=p?(f==='sec'?(p.sec?mmss(p.sec):''):f==='kg'?uIn(e.id,p.kg):(p[f]??'')):'';return `<input class="sin num" inputmode="${f==='r'||f==='m'?'numeric':f==='sec'?'text':'decimal'}" data-f="${f}" data-at="${xi}:${si}" value="${esc(v)}" placeholder="${esc(ph)}" aria-label="${FLAB[f]}">`}).join('')}
    <button class="srpe${s.rpe?' on':''}" type="button" data-rpe="${xi}:${si}">${s.rpe||'·'}</button>
    <button class="scheck" type="button" data-done="${xi}:${si}" aria-pressed="${!!s.done}" aria-label="Complete set">✓</button>
    ${pr?'<span class="prtag">PR</span>':''}</div>`}).join('')}
  <button class="addset" type="button" data-addset="${xi}">+ Add set</button></div>`;
}
function isPR(e,s,b){if(e.ty==='wr'||e.ty==='wbw')return b.e>0&&e1(s)>b.e;if(e.ty==='bw'||e.ty==='r')return b.reps>0&&+s.r>b.reps;if(e.ty==='dur')return b.sec>0&&+s.sec>b.sec;if(e.ty==='dd')return b.km>0&&+s.km>b.km;return false}
function rCard(r,hot){return `<div class="rcard${hot?' hot':''}"><div class="rtop"><b>${esc(r.name)}</b><span class="row" style="gap:4px">${hot?'<span class="chipy hot">Today</span>':''}<button class="iconbtn" type="button" data-rmenu="${esc(r.id)}" aria-label="Routine options">⋯</button></span></div>
  <div class="rthumbs">${r.ex.slice(0,6).map(x=>thumb(exOf(x),'rth')).join('')}</div><span class="dim rsum">${esc(r.ex.map(x=>exOf(x).n).join(', ')||'no exercises yet')}</span><button class="btn p" type="button" data-start="${esc(r.id)}">Start routine</button></div>`}
function wCard(w){const st={vol:w.vol??stats(w).vol,n:NS(w)};const dur=w.endedAt&&w.startedAt?fmtDur(new Date(w.endedAt)-new Date(w.startedAt)):'';
  return `<div class="wcard" data-w="${esc(w.id)}">${(WPH[w.id]||[])[0]?`<img class="wcimg" src="${WPH[w.id][0]}" alt="">`:''}<div class="rtop"><b>${esc(w.name)}</b><span class="dim">${esc(nice(w.date))}</span></div><div class="wcrank">${rlChip(rlSession(w),18)}</div>
  <div class="wmeta num"><span>${dur||'—'}</span><span>${fmtVol(st.vol)} kg</span><span>${st.n||0} sets</span>${(w.prs||[]).length?`<span class="pink">${w.prs.length} PR</span>`:''}</div>
  <div class="wex">${(w.ex||[]).map(x=>{const bs=bestSet(x);return `<div><span>${x.sets.filter(s=>s.done!==false&&s.t!=='w').length} × ${esc(exOf(x).n)}</span><span class="dim num">${bs?esc(fmtSet(x,bs)):''}</span></div>`}).join('')}</div></div>`}
function newSetsFor(x,count){const ps=prevSets(x);return Array.from({length:count},(_,i)=>({t:(ps[i]&&ps[i].t)||'n',kg:'',r:'',done:false}))}
function exEntry(e,opt={}){const x={id:e.id,n:e.n,rest:opt.rest??(e.ty==='dur'||e.ty==='dd'?0:120),note:opt.note||'',ss:opt.ss||null,sets:[]};const ps=prevSets(x);x.sets=newSetsFor(x,opt.sets||Math.max(1,Math.min(ps.length||3,8)));if(opt.reps)x.sets.forEach(s=>s.tr=opt.reps);return x}
function startWorkout(r){
  ACTIVE={id:new Date().toISOString().replace(/[:.]/g,'-'),name:r?r.name:(gymTypeFor()==='lower'?'Lower':'Upper'),routineId:r?r.id:null,startedAt:new Date().toISOString(),note:'',
    ex:r?r.ex.map(x=>exEntry(exOf(x),x)):[]};
  saveActive();GYMV='workout';renderGym();flash('workout_started');staggerIn($('g-workout'));
}
function editWorkout(w){if(ACTIVE&&!ACTIVE.editing){flash('finish_current_first');return}ACTIVE={...clone(w),editing:true};ACTIVE.ex.forEach(x=>x.sets.forEach(s=>s.done=true));GYMV='workout';closeSheet();renderGym()}
function mut(fn){fn();saveActive();renderWorkout()}
const SXY=v=>v.split(':').map(Number);
$('g-workout').addEventListener('click',e=>{
  const t=e.target.closest('button');if(!t)return;const d=t.dataset;
  if(d.act==='empty')return startWorkout(null);
  if(d.start)return startWorkout(ROUTINES.list.find(r=>r.id===d.start));
  if(d.unit!=null)return toggleUnit(exOf(ACTIVE.ex[+d.unit]).id);
  if(d.rmenu)return routineMenu(d.rmenu);
  if(d.act==='newroutine'){GYMV='routines';renderGym();return editRoutine(null)}
  if(d.act==='explore'){GYMV='exercises';return renderGym()}
  if(d.act==='addex')return pickExercises(list=>mut(()=>list.forEach(ex=>ACTIVE.ex.push(exEntry(ex)))));
  if(d.act==='discard'){if(ACTIVE.editing){ACTIVE=null;saveActive();renderGym();return}if(t.dataset.arm){ACTIVE=null;saveActive();clearRest();renderGym();glitchAll()}else{t.dataset.arm=1;t.textContent='tap again';setTimeout(()=>{if(t.isConnected){delete t.dataset.arm;t.textContent='discard'}},2500)}return}
  if(d.act==='finish')return finishWorkout();
  if(d.exinfo)return openExercise(exOf(ACTIVE.ex[+d.exinfo]).id);
  if(d.exmenu)return exMenu(+d.exmenu);
  if(d.restpick)return restPicker(+d.restpick);
  if(d.addset){const xi=+d.addset;return mut(()=>{const x=ACTIVE.ex[xi];const l=x.sets[x.sets.length-1];x.sets.push({t:'n',kg:l?l.kg:'',r:l?l.r:'',sec:l?l.sec:'',km:l?l.km:'',m:l?l.m:'',done:false})})}
  if(d.stype){const [xi,si]=SXY(d.stype);return setTypeMenu(xi,si)}
  if(d.rpe){const [xi,si]=SXY(d.rpe);return rpeMenu(xi,si)}
  if(d.prev){const [xi,si]=SXY(d.prev);const p=prevSets(ACTIVE.ex[xi])[si];if(p)return mut(()=>{const s=ACTIVE.ex[xi].sets[si];['kg','r','sec','km','m'].forEach(f=>{if(p[f]!=null&&p[f]!=='')s[f]=p[f]})})}
  if(d.done){const [xi,si]=SXY(d.done);const x=ACTIVE.ex[xi];const s=x.sets[si];const ex=exOf(x);const T=XTYPES[ex.ty]||XTYPES.wr;
    if(!s.done){const p=prevSets(x)[si];T.f.forEach(f=>{if((s[f]===''||s[f]==null)&&p&&p[f]!=null)s[f]=p[f]});
      const ok=T.f.every(f=>f==='kg'||(+s[f]>0));if(!ok){const row=t.closest('.srow');row&&row.animate&&row.animate([{transform:'translateX(-6px)'},{transform:'translateX(6px)'},{transform:'none'}],{duration:220});return}}
    const rb=s.done?null:rlEx(ex.id,ACTIVE.id,x);
    s.done=!s.done;s.at=s.done?new Date().toISOString():null;const ra=s.done&&rb!=null?rlEx(ex.id,ACTIVE.id,x):null;if(ra!=null&&Math.floor(ra)>Math.floor(rb)){if(!ascRank(ex,rb,ra))setTimeout(()=>rlUpToast(ex.n,rb,ra),350)}const b=bests(ex.id,ACTIVE.id);const pr=s.done&&s.t!=='w'&&isPR(ex,s,b);if(s.done)ascCheck(ex,s,b.kg);
    saveActive();renderWorkout();
    if(s.done){const row=document.querySelector(`.srow[data-s="${xi}:${si}"]`);if(row)burstEl(row.querySelector('.scheck'),pr?90:24,pr);if(pr){flash('new_pr');shake()}
      const grp=x.ss?ACTIVE.ex.filter(y=>y.ss===x.ss):[x];if(!ACTIVE.editing&&x.rest&&grp[grp.length-1]===x)startRest(x.rest)}
    if(s.done&&stats(ACTIVE).n===1&&!ACTIVE.editing)autoTick(/^Gym\b/);
  }
});
$('g-workout').addEventListener('input',e=>{const t=e.target;const d=t.dataset;
  if(t.id==='wName'){ACTIVE.name=t.value;saveActive();return}
  if(t.id==='wNote'){ACTIVE.note=t.value;t.style.height='auto';t.style.height=t.scrollHeight+'px';saveActive();return}
  if(d.note!=null){ACTIVE.ex[+d.note].note=t.value;saveActive();return}
  if(d.f){const [xi,si]=SXY(d.at);const s=ACTIVE.ex[xi].sets[si];const f=d.f;const v=t.value.replace(',','.');s[f]=f==='sec'?pmmss(t.value):f==='kg'?uOut(exOf(ACTIVE.ex[xi]).id,v):v;saveActive()}
});
$('g-workout').addEventListener('change',e=>{if(e.target.dataset.f)renderWorkout()});

/* set type / rpe / rest pickers */
function setTypeMenu(xi,si){openSheet('set type',`<div class="optlist">${[['n','normal set','1'],['w','warm-up set','W'],['d','drop set','D'],['f','failure set','F']].map(([k,l,s])=>`<button class="opt" type="button" data-ty="${k}"><span class="stype t-${k}">${s}</span>${l}</button>`).join('')}<button class="opt bad" type="button" data-ty="del"><span class="stype">✕</span>Remove set</button></div>`);
  $('sheetBody').onclick=e=>{const b=e.target.closest('[data-ty]');if(!b)return;closeSheet();mut(()=>{const x=ACTIVE.ex[xi];if(b.dataset.ty==='del')x.sets.splice(si,1);else x.sets[si].t=b.dataset.ty})}}
function rpeMenu(xi,si){const s=ACTIVE.ex[xi].sets[si];const vals=[6,6.5,7,7.5,8,8.5,9,9.5,10];const txt={6:'could do 4+ more reps',7:'could do 3 more',7.5:'2–3 more',8:'2 more reps',8.5:'1–2 more',9:'1 more rep',9.5:'maybe 1 more',10:'max effort',6.5:'3–4 more'};
  openSheet('rpe · rate of perceived exertion',`<div class="rpegrid">${vals.map(v=>`<button type="button" class="rpeb${s.rpe==v?' on':''}" data-v="${v}"><b>${v}</b><span>${txt[v]}</span></button>`).join('')}</div><button class="btn" type="button" data-v="" style="margin-top:10px">Clear</button>`);
  $('sheetBody').onclick=e=>{const b=e.target.closest('[data-v]');if(!b)return;closeSheet();mut(()=>{s.rpe=b.dataset.v?+b.dataset.v:null})}}
function restPicker(xi){const x=ACTIVE?ACTIVE.ex[xi]:null;const opts=[0,30,45,60,75,90,105,120,150,180,210,240,300];
  openSheet('rest timer',`<div class="chips">${opts.map(s=>`<button class="chip" type="button" data-s="${s}" aria-pressed="${(x.rest||0)===s}">${s?mmss(s):'off'}</button>`).join('')}</div>`);
  $('sheetBody').onclick=e=>{const b=e.target.closest('[data-s]');if(!b)return;closeSheet();mut(()=>{x.rest=+b.dataset.s;if(x.ss)ACTIVE.ex.filter(y=>y.ss===x.ss).forEach(y=>y.rest=x.rest)})}}

/* exercise ⋯ menu */
function exMenu(xi){const x=ACTIVE.ex[xi];const e=exOf(x);const T=XTYPES[e.ty]||XTYPES.wr;
  openSheet(e.n,`<div class="optlist">
   <button class="opt" type="button" data-m="info">ⓘ exercise info &amp; history</button>
   <button class="opt" type="button" data-m="ss">⛓ ${x.ss?'remove from superset':'superset with…'}</button>
   <button class="opt" type="button" data-m="replace">⇄ replace exercise</button>
   ${T.f.includes('kg')?'<button class="opt" type="button" data-m="unit">⇄ use '+(isLb(e.id)?'kg':'lbs')+' for this exercise</button><button class="opt" type="button" data-m="warm">Add warm-up sets</button><button class="opt" type="button" data-m="plates">◎ plate calculator</button>':''}
   <button class="opt" type="button" data-m="up">↑ move up</button><button class="opt" type="button" data-m="down">↓ move down</button>
   <button class="opt bad" type="button" data-m="rm">✕ remove exercise</button></div>`);
  $('sheetBody').onclick=ev=>{const b=ev.target.closest('[data-m]');if(!b)return;const m=b.dataset.m;
    if(m==='info')return openExercise(e.id);
    if(m==='unit'){closeSheet();return toggleUnit(e.id)}
    if(m==='rm'){closeSheet();return mut(()=>ACTIVE.ex.splice(xi,1))}
    if(m==='up'||m==='down'){closeSheet();const j=xi+(m==='up'?-1:1);if(j<0||j>=ACTIVE.ex.length)return;return mut(()=>{const a=ACTIVE.ex;[a[xi],a[j]]=[a[j],a[xi]]})}
    if(m==='replace'){return pickExercises(list=>{const n=list[0];if(!n)return;mut(()=>{const y=exEntry(n,{sets:x.sets.length,rest:x.rest,ss:x.ss});ACTIVE.ex[xi]=y})},{single:true})}
    if(m==='ss'){if(x.ss){closeSheet();return mut(()=>{const g=x.ss;x.ss=null;const left=ACTIVE.ex.filter(y=>y.ss===g);if(left.length<2)left.forEach(y=>y.ss=null)})}
      const others=ACTIVE.ex.map((y,i)=>[y,i]).filter(([y,i])=>i!==xi);if(!others.length){flash('add_another_exercise');return}
      openSheet('superset with',`<div class="optlist">${others.map(([y,i])=>`<button class="opt" type="button" data-with="${i}">${thumb(exOf(y),'rth')} ${esc(exOf(y).n)}</button>`).join('')}</div>`);
      $('sheetBody').onclick=ev2=>{const b2=ev2.target.closest('[data-with]');if(!b2)return;const j=+b2.dataset.with;closeSheet();mut(()=>{const y=ACTIVE.ex[j];const g=y.ss||x.ss||rid();x.ss=g;y.ss=g;x.rest=y.rest;const a=ACTIVE.ex;const xo=a.splice(a.indexOf(x),1)[0];a.splice(a.indexOf(y)+1,0,xo)})};return}
    if(m==='warm'){const work=x.sets.find(s=>s.t!=='w'&&+s.kg>0)||prevSets(x).find(s=>s.t!=='w'&&+s.kg>0);if(!work){flash('enter_a_weight_first');return}closeSheet();
      const W=+work.kg;const r=v=>Math.max(GSET.bar,Math.round(v/2.5)*2.5);mut(()=>x.sets.unshift({t:'w',kg:r(W*.4),r:10,done:false},{t:'w',kg:r(W*.6),r:6,done:false},{t:'w',kg:r(W*.8),r:3,done:false}));return}
    if(m==='plates'){const s=x.sets.find(s=>!s.done&&+s.kg>0)||x.sets.find(s=>+s.kg>0);return plateCalc(s?+s.kg:60)}
  }}
function plateCalc(target){const draw=()=>{let side=(target-GSET.bar)/2;const used=[];GSET.plates.forEach(p=>{while(side>=p-1e-9){used.push(p);side=Math.round((side-p)*1000)/1000}});
    $('pcOut').innerHTML=`<div class="barviz"><span class="bar"></span>${used.map(p=>`<span class="plate" style="height:${30+p*2.4}px" title="${p}kg">${p}</span>`).join('')}</div><div class="dim" style="font-size:12px;margin-top:8px">each side: ${used.length?used.join(' + ')+' kg':'nothing'}${side>0?` · ${kgs(side*2)}kg can't be made`:''}</div>`};
  openSheet('plate calculator',`<div class="row" style="gap:10px;align-items:end;flex-wrap:wrap"><label class="dim">Target kg<input class="inp num" id="pcT" value="${kgs(target)}" inputmode="decimal" style="width:90px;display:block"></label><label class="dim">Bar kg<input class="inp num" id="pcB" value="${GSET.bar}" inputmode="decimal" style="width:70px;display:block"></label></div><div id="pcOut" style="margin-top:14px"></div>`);
  draw();$('pcT').oninput=e=>{target=+e.target.value||0;draw()};$('pcB').oninput=e=>{GSET.bar=+e.target.value||0;LS.set('gymset',GSET);draw()}}

function finishWorkout(){
  if(ACTIVE.editing){const w=clone(ACTIVE);delete w.editing;w.ex=w.ex.map(x=>({...x,sets:x.sets.filter(s=>s.done)})).filter(x=>x.sets.length);const st=stats(w);w.vol=st.vol;w.nsets=st.n;
    save('gym/w-'+w.id,w,true);const i=WORKOUTS.findIndex(y=>y.id===w.id);if(i>=0)WORKOUTS[i]=w;ACTIVE=null;saveActive();recountUsed();renderGym();flash('saved');return}
  const undone=ACTIVE.ex.reduce((a,x)=>a+x.sets.filter(s=>!s.done).length,0);
  const go2=(dropUndone)=>{
    const w=clone(ACTIVE);w.endedAt=new Date().toISOString();w.date=ymd(logical(new Date(w.startedAt)));
    w.ex=w.ex.map(x=>({...x,sets:x.sets.filter(s=>s.done||(!dropUndone&&(+s.r>0||+s.sec>0))).map(s=>({...s,done:true}))})).filter(x=>x.sets.length);
    const prs=[];w.ex.forEach(x=>{const e=exOf(x);const b=bests(e.id,w.id);let mk=0,me=0,mv=0,mr=0,ms=0,mkm=0;x.sets.forEach(s=>{if(s.t==='w')return;mk=Math.max(mk,+s.kg||0);me=Math.max(me,e1(s));mv=Math.max(mv,(+s.kg||0)*(+s.r||0));mr=Math.max(mr,+s.r||0);ms=Math.max(ms,+s.sec||0);mkm=Math.max(mkm,+s.km||0)});
      const had=exHistory(e.id,w.id).length>0;if(!had)return;
      if(e.ty==='wr'||e.ty==='wbw'){if(mk>b.kg)prs.push({n:e.n,kind:'heaviest weight',v:kgs(mk)+' kg'});if(me>b.e)prs.push({n:e.n,kind:'best est. 1RM',v:kgs(Math.round(me*10)/10)+' kg'});if(mv>b.vol)prs.push({n:e.n,kind:'best set volume',v:fmtVol(mv)+' kg'})}
      else if(e.ty==='bw'||e.ty==='r'){if(mr>b.reps)prs.push({n:e.n,kind:'most reps',v:mr})}else if(e.ty==='dur'){if(ms>b.sec)prs.push({n:e.n,kind:'longest',v:mmss(ms)})}else if(e.ty==='dd'){if(mkm>b.km)prs.push({n:e.n,kind:'furthest',v:kgs(mkm)+' km'})}});
    const st=stats(w);w.vol=st.vol;w.nsets=st.n;w.prs=prs;
    if(!w.ex.length){ACTIVE=null;saveActive();renderGym();return}
    saveScreen(w,()=>commit(w));};
  const commit=w=>{
    const pre=rlOverall();save('gym/w-'+w.id,w,true);WORKOUTS.unshift(w);recountUsed();ACTIVE=null;saveActive();clearRest();
    autoTick(/^Gym\b/);shake();renderGym();rlAfter(pre,w,()=>showSummary(w));
  };
  if(undone){openSheet('finish workout?',`<p class="dim" style="margin:0 0 14px">${undone} set${undone>1?'s':''} not ticked.</p><div class="bigbtns"><button class="btn p" type="button" id="fDrop">Discard unticked + finish</button><button class="btn" type="button" id="fKeep">Keep sets with values</button><button class="btn" type="button" id="fBack">Back</button></div>`);
    $('fDrop').onclick=()=>{closeSheet();go2(true)};$('fKeep').onclick=()=>{closeSheet();go2(false)};$('fBack').onclick=closeSheet}
  else go2(true);
}
/* Hevy-style "save workout": title, stats, photos, description — then the summary */
function saveScreen(w,done){let imgs=[];
  const draw=()=>{const ph=$('swPh');if(!ph)return;ph.innerHTML=imgs.map((s,i)=>`<div class="swimg"><img src="${s}" alt=""><button type="button" data-swdel="${i}" aria-label="Remove photo">✕</button></div>`).join('')+(imgs.length<4?`<label class="swadd"><input type="file" accept="image/*" id="swFile" hidden multiple><span>＋</span><small>Add photo</small></label>`:'');
    const f=$('swFile');if(f)f.onchange=async e=>{for(const file of [...e.target.files].slice(0,4-imgs.length)){try{imgs.push(await resizeImg(file,1080))}catch(x){}}draw()}};
  openSheet('save workout',`<input class="inp swtitle" id="swName" value="${esc(w.name)}" aria-label="Workout title">
  <div class="wstats big" style="margin:12px 0"><div><span class="dim">Duration</span><b class="num">${fmtDur(new Date(w.endedAt)-new Date(w.startedAt))}</b></div><div><span class="dim">Volume</span><b class="num">${fmtVol(w.vol)} kg</b></div><div><span class="dim">Sets</span><b class="num">${NS(w)}</b></div><div><span class="dim">Records</span><b class="num pink">${w.prs.length}</b></div></div>
  <div class="dim" style="font-size:12px;margin-bottom:6px">when · ${esc(nice(w.date))} · ${new Date(w.startedAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</div>
  <div class="swph" id="swPh"></div>
  <textarea class="inp" id="swDesc" rows="3" placeholder="How did it go? share more about your workout…" style="margin-top:10px">${esc(w.note||'')}</textarea>
  <div class="bigbtns" style="margin-top:14px"><button class="btn" type="button" id="swBack">Resume</button><span style="flex:1"></span><button class="btn p" type="button" id="swSave">Save workout</button></div>`);
  draw();
  $('swPh').onclick=e=>{const b=e.target.closest('[data-swdel]');if(b){imgs.splice(+b.dataset.swdel,1);draw()}};
  $('swBack').onclick=closeSheet;
  $('swSave').onclick=()=>{w.name=$('swName').value.trim()||w.name;w.note=$('swDesc').value.trim();if(imgs.length){w.photos=imgs.length;WPH[w.id]=imgs;save('gym/wp-'+w.id,{imgs},true)}closeSheet();done()}}
function workoutNo(w){return WORKOUTS.slice().reverse().findIndex(x=>x.id===w.id)+1}
function showSummary(w){const muscles=muscleSets([w]);const top=Object.entries(muscles).sort((a,b)=>b[1]-a[1]).slice(0,6);const mx=Math.max(1,...top.map(t=>t[1]));
  openSheet('workout complete',`${(WPH[w.id]||[]).length?`<div class="swgal">${WPH[w.id].map(s=>`<img src="${s}" alt="">`).join('')}</div>`:''}${(()=>{const sc=rlSession(w),r=rlOf(sc);const ups=w.ex.map(x=>{const ex=exOf(x);const a=rlEx(ex.id,w.id),b=rlEx(ex.id);return b==null?null:[ex.n,a,b]}).filter(Boolean);return `<div class="rlsum" style="--rc:${RL[r.t][1]}">${rlBadge(sc,72)}<div><span class="dim">Session rank</span><b>${r.name}</b></div></div>${ups.length?`<div class="rlups">${ups.map(([n,a,b])=>`<div>${rlBadge(b,22)}<span>${esc(n)}</span><b style="color:${RL[rlOf(b).t][1]}">${rlOf(b).name}</b>${a!=null&&Math.floor(b)>Math.floor(a)?'<em>▲ rank up</em>':''}</div>`).join('')}</div>`:''}`})()}<div class="sumhero"><span class="tag">workout #${workoutNo(w)}</span><b class="glitch" data-text="${esc(w.name)}">${esc(w.name)}</b><span class="dim">${esc(nice(w.date))}</span></div>
  <div class="wstats big"><div><span class="dim">Duration</span><b class="num">${fmtDur(new Date(w.endedAt)-new Date(w.startedAt))}</b></div><div><span class="dim">Volume</span><b class="num">${fmtVol(w.vol)} kg</b></div><div><span class="dim">Sets</span><b class="num">${NS(w)}</b></div><div><span class="dim">Records</span><b class="num pink">${w.prs.length}</b></div></div>
  ${w.prs.length?`<div class="prlist">${w.prs.map(p=>`<div><span class="medal">PR</span> ${esc(p.n)} · ${esc(p.kind)} <b class="num">${esc(String(p.v))}</b></div>`).join('')}</div>`:''}
  ${top.length?`<div class="mbars" style="margin-top:12px">${top.map(([m,v])=>`<div><span>${esc(m)}</span><i style="--w:${v/mx*100}%"></i><b class="num">${kgs(v)}</b></div>`).join('')}</div>`:''}
  <div class="bigbtns" style="margin-top:16px">${w.routineId?'<button class="btn" type="button" id="updR">Update routine</button>':'<button class="btn" type="button" id="saveR">Save as routine</button>'}<button class="btn p" type="button" id="sumOk">Done</button></div>`);
  $('sumOk').onclick=closeSheet;
  if($('saveR'))$('saveR').onclick=()=>{ROUTINES.list.push(routineFrom(w));save('gym/routines',ROUTINES);closeSheet();flash('saved')};
  if($('updR'))$('updR').onclick=()=>{const r=ROUTINES.list.find(x=>x.id===w.routineId);if(r){const n=routineFrom(w);r.ex=n.ex}save('gym/routines',ROUTINES);closeSheet();flash('saved')};
}
function routineFrom(w){return {id:rid(),name:w.name,folder:'',ex:w.ex.map(x=>({id:exKey(x),n:exOf(x).n,sets:x.sets.filter(s=>s.t!=='w').length||x.sets.length,rest:x.rest??120,note:x.note||'',ss:x.ss||null}))}}

/* ---------- rest timer ---------- */
function startRest(sec){restTotal=sec;restEnd=Date.now()+sec*1000;LS.set('restEnd',restEnd);LS.set('restTotal',restTotal);renderRest();if(nOn('rest')){let nx='';try{for(const x of ACTIVE.ex){if(x.sets.some(s=>!s.done)){nx=exOf(x).n;break}}}catch(e){}pushOne('rest',restEnd,'Rest complete',nx?'Next up: '+nx:'Time for your next set','./#gym')}}
let restOk=null;
function clearRest(){restEnd=null;LS.set('restEnd',null);$('restDock').classList.remove('on');pushCancel('rest')}
function renderRest(){const bar=$('restDock');if(!restEnd){bar.classList.remove('on');return}bar.classList.add('on')}
$('restDock').onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.rd==='skip'){restEnd=null;LS.set('restEnd',null);renderRest();pushCancel('rest');return}const d=+b.dataset.rd;restEnd=Math.max(Date.now()+1000,restEnd+d*1000);restTotal=Math.max(15,restTotal+d);LS.set('restEnd',restEnd);LS.set('restTotal',restTotal);if(nOn('rest'))pushOne('rest',restEnd,'Rest complete','Time for your next set','./#gym')};
function beep(){try{const A=window.AudioContext||window.webkitAudioContext;const a=new A();[0,.18,.36].forEach((t,i)=>{const o=a.createOscillator(),g=a.createGain();o.frequency.value=i===2?1320:880;g.gain.setValueAtTime(.0001,a.currentTime+t);g.gain.exponentialRampToValueAtTime(.25,a.currentTime+t+.01);g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+t+.15);o.connect(g);g.connect(a.destination);o.start(a.currentTime+t);o.stop(a.currentTime+t+.16)})}catch(e){}}
setInterval(()=>{
  if(ACTIVE&&!ACTIVE.editing&&$('wDur'))$('wDur').textContent=fmtDur(Date.now()-new Date(ACTIVE.startedAt));
  if(!restEnd)return;
  // no workout running (finished, discarded, ended on another device) or the timer ran out long ago: drop it silently
  if((gymLoaded&&(!ACTIVE||ACTIVE.editing))||Date.now()-restEnd>10000){clearRest();return}
  if(!gymLoaded){if(restOk==null){restOk=false;load('gym/active').then(x=>{restOk=!!(x&&x.ex&&!x.editing);if(!restOk)clearRest()}).catch(()=>{restOk=null})}if(!restOk)return}
  const l=Math.max(0,Math.round((restEnd-Date.now())/1000));$('restT').textContent=Math.floor(l/60)+':'+pad(l%60);$('restBar').style.width=Math.min(100,100-l/restTotal*100)+'%';$('restDock').classList.add('on');
  if(l===0){restEnd=null;LS.set('restEnd',null);$('restDock').classList.remove('on');flash('go');beep();try{navigator.vibrate&&navigator.vibrate([200,80,200])}catch(e){}}
},250);

/* ---------- routines (with folders) ---------- */
const FOLDC=new Set(LS.get('gymfold')||[]);
function allFolders(){const f=[...(ROUTINES.folders||[])];ROUTINES.list.forEach(r=>{if(r.folder&&!f.includes(r.folder))f.push(r.folder)});return f}
function saveR(){save('gym/routines',ROUTINES);renderGym()}
function renderRoutines(){const fs=allFolders();const loose=ROUTINES.list.filter(r=>!r.folder);
  const grp=(f,rs)=>{const shut=FOLDC.has(f);return `<div class="fold fhead"><button type="button" class="fbtn" data-fold="${esc(f)}">${shut?'▸':'▾'} ${esc(f)} <span class="dim">· ${rs.length}</span></button><button class="iconbtn" type="button" data-fmenu="${esc(f)}" aria-label="Folder options">⋯</button></div>${shut?'':`<div class="rgrid">${rs.map(r=>rCard(r,false)).join('')||'<div class="dim">Empty — move routines here from their ⋯ menu.</div>'}</div>`}`};
  $('g-routines').innerHTML=`<div class="ph2"><span class="tag">${ROUTINES.list.length} routines</span><span class="row" style="gap:6px"><button class="btn" type="button" data-r="folder">+ Folder</button><button class="btn p" type="button" data-r="new">+ New routine</button></span></div>
  ${fs.map(f=>grp(f,ROUTINES.list.filter(r=>r.folder===f))).join('')}${loose.length?(fs.length?`<div class="fold"><span class="dim">no folder · ${loose.length}</span></div>`:'')+`<div class="rgrid">${loose.map(r=>rCard(r,false)).join('')}</div>`:''}${!ROUTINES.list.length&&!fs.length?'<div class="dim">No routines yet.</div>':''}`}
function newFolder(then){const n=(prompt('Folder name')||'').trim();if(!n)return;ROUTINES.folders=allFolders();if(!ROUTINES.folders.includes(n))ROUTINES.folders.push(n);then&&then(n);saveR()}
function folderMenu(f){openSheet(f,`<div class="optlist"><button class="opt" type="button" data-m="new">+ New routine in this folder</button><button class="opt" type="button" data-m="ren">✎ rename folder</button><button class="opt" type="button" data-m="up">↑ move up</button><button class="opt" type="button" data-m="down">↓ move down</button><button class="opt bad" type="button" data-m="del">✕ delete folder (keeps routines)</button></div>`);
  $('sheetBody').onclick=e=>{const b=e.target.closest('[data-m]');if(!b)return;const m=b.dataset.m;ROUTINES.folders=allFolders();const i=ROUTINES.folders.indexOf(f);
    if(m==='new')return editRoutine(null,f);
    if(m==='ren'){const n=(prompt('Rename folder',f)||'').trim();if(!n||n===f)return;closeSheet();if(ROUTINES.folders.includes(n))ROUTINES.folders.splice(i,1);else ROUTINES.folders[i]=n;ROUTINES.list.forEach(r=>{if(r.folder===f)r.folder=n});return saveR()}
    if(m==='up'||m==='down'){const j=i+(m==='up'?-1:1);closeSheet();if(j<0||j>=ROUTINES.folders.length)return;const a=ROUTINES.folders;[a[i],a[j]]=[a[j],a[i]];return saveR()}
    if(m==='del'){if(b.dataset.arm){ROUTINES.folders.splice(i,1);ROUTINES.list.forEach(r=>{if(r.folder===f)r.folder=''});closeSheet();saveR()}else{b.dataset.arm=1;b.textContent='tap again to delete folder'}}}}
function moveMenu(r){const fs=allFolders();openSheet('move “'+r.name+'” to',`<div class="optlist">${fs.map(f=>`<button class="opt" type="button" data-f="${esc(f)}">${r.folder===f?'● ':'▤ '}${esc(f)}</button>`).join('')}<button class="opt" type="button" data-f="">${r.folder?'○ ':'● '}no folder</button><button class="opt" type="button" data-nf="1">+ New folder…</button></div>`);
  $('sheetBody').onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.nf){closeSheet();return newFolder(n=>r.folder=n)}if(b.dataset.f==null)return;r.folder=b.dataset.f;closeSheet();saveR()}}
$('g-routines').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.r==='new')return editRoutine(null);
  if(b.dataset.r==='folder')return newFolder();
  if(b.dataset.fold!=null){const f=b.dataset.fold;FOLDC.has(f)?FOLDC.delete(f):FOLDC.add(f);LS.set('gymfold',[...FOLDC]);return renderRoutines()}
  if(b.dataset.fmenu!=null)return folderMenu(b.dataset.fmenu);
  if(b.dataset.rmenu)return routineMenu(b.dataset.rmenu);
  if(b.dataset.start){if(ACTIVE){flash('finish_current_first');return}startWorkout(ROUTINES.list.find(r=>r.id===b.dataset.start))}});
function routineMenu(id){const r=ROUTINES.list.find(x=>x.id===id);if(!r)return;
  openSheet(r.name,`<div class="optlist"><button class="opt" type="button" data-m="edit">✎ edit routine</button><button class="opt" type="button" data-m="move">▤ move to folder${r.folder?' · '+esc(r.folder):''}</button><button class="opt" type="button" data-m="dup">⧉ duplicate</button><button class="opt bad" type="button" data-m="del">✕ delete routine</button></div>`);
  $('sheetBody').onclick=e=>{const b=e.target.closest('[data-m]');if(!b)return;const m=b.dataset.m;
    if(m==='edit')return editRoutine(r);
    if(m==='move')return moveMenu(r);
    if(m==='dup'){ROUTINES.list.push({...clone(r),id:rid(),name:r.name+' (copy)'});save('gym/routines',ROUTINES);closeSheet();renderGym();return}
    if(m==='del'){if(b.dataset.arm){ROUTINES.list=ROUTINES.list.filter(x=>x.id!==id);save('gym/routines',ROUTINES);closeSheet();renderGym()}else{b.dataset.arm=1;b.textContent='tap again to delete'}}}}
function editRoutine(r,inF){
  const R2=r?clone(r):{id:rid(),name:gymTypeFor()==='lower'?'Lower':'Upper',folder:inF||'',ex:[]};const folders=allFolders();
  const draw=()=>{openSheet(r?'edit routine':'new routine',`<input class="inp" id="rName" value="${esc(R2.name)}" aria-label="Routine name" style="font-size:18px;margin-bottom:8px">
    <input class="inp" id="rFolder" value="${esc(R2.folder||'')}" placeholder="Folder (optional, e.g. PPL, cut block)" list="rFolders" style="margin-bottom:12px"><datalist id="rFolders">${folders.map(f=>`<option value="${esc(f)}">`).join('')}</datalist>
    <div class="rex">${R2.ex.map((x,i)=>{const e=exOf(x);return `<div class="rexrow">${thumb(e,'rth')}<span class="rexn">${esc(e.n)}</span><label class="dim">sets <input class="inp num" data-rs="${i}" value="${x.sets}" inputmode="numeric" style="width:46px"></label><label class="dim">reps <input class="inp num" data-rp="${i}" value="${esc(x.reps||'')}" placeholder="8-12" style="width:62px"></label><label class="dim">rest <select class="inp" data-rr="${i}">${[0,30,60,90,120,150,180,240,300].map(s=>`<option value="${s}" ${s===(x.rest??120)?'selected':''}>${s?mmss(s):'off'}</option>`).join('')}</select></label><span class="row" style="gap:4px"><button class="iconbtn" type="button" data-rm="${i}:-1">↑</button><button class="iconbtn" type="button" data-rm="${i}:1">↓</button><button class="iconbtn" type="button" data-rx="${i}">✕</button></span></div>`}).join('')||'<div class="dim" style="font-size:12px">Add the exercises you do in this session.</div>'}</div>
    <button class="addex" type="button" id="rAdd">+ Add exercises</button>
    <div class="bigbtns" style="margin-top:14px"><span style="flex:1"></span><button class="btn" type="button" id="rCancel">Cancel</button><button class="btn p" type="button" id="rSave">Save routine</button></div>`);
    const sh=$('sheetBody');
    sh.oninput=e=>{const t=e.target;if(t.id==='rName')R2.name=t.value;if(t.id==='rFolder')R2.folder=t.value.trim();if(t.dataset.rs!=null)R2.ex[+t.dataset.rs].sets=Math.max(1,Math.min(12,parseInt(t.value)||1));if(t.dataset.rp!=null)R2.ex[+t.dataset.rp].reps=t.value;if(t.dataset.rr!=null)R2.ex[+t.dataset.rr].rest=+t.value};
    sh.onchange=sh.oninput;
    sh.onclick=e=>{const b=e.target.closest('button');if(!b)return;
      if(b.dataset.rm){const [i,d]=SXY(b.dataset.rm);const j=i+d;if(j>=0&&j<R2.ex.length){[R2.ex[i],R2.ex[j]]=[R2.ex[j],R2.ex[i]];draw()}}
      if(b.dataset.rx!=null){R2.ex.splice(+b.dataset.rx,1);draw()}
      if(b.id==='rAdd')pickExercises(list=>{list.forEach(n=>R2.ex.push({id:n.id,n:n.n,sets:3,rest:n.ty==='dur'||n.ty==='dd'?0:120,reps:'',note:''}));draw()},{back:draw});
      if(b.id==='rCancel')closeSheet();
      if(b.id==='rSave'){R2.name=(R2.name||'').trim()||'Routine';const i=ROUTINES.list.findIndex(x=>x.id===R2.id);if(i>=0)ROUTINES.list[i]=R2;else ROUTINES.list.push(R2);if(R2.folder){ROUTINES.folders=allFolders()}save('gym/routines',ROUTINES);closeSheet();renderGym();flash('saved')}};
  };draw();
}

/* ---------- exercise picker (multi-select, filters, images) ---------- */
function filterBar(st){return `<input class="inp" id="pkQ" placeholder="Search ${EXMAP.size} exercises" autocomplete="off" value="${esc(st.q)}" style="margin-bottom:8px">
  <div class="row" style="gap:6px;margin-bottom:8px;flex-wrap:wrap"><select class="inp" id="pkM" style="flex:1;min-width:130px"><option value="">All muscles</option>${MUSCLES2.map(m=>`<option ${st.m===m?'selected':''}>${m}</option>`).join('')}</select><select class="inp" id="pkE" style="flex:1;min-width:130px"><option value="">All equipment</option>${EQUIP2.map(m=>`<option ${st.e===m?'selected':''}>${m}</option>`).join('')}</select></div>`}
function filteredEx(st){const q=norm(st.q);return allExList().filter(e=>(!st.m||e.pm.includes(st.m)||(st.m==='full body'&&e.pm.length>2))&&(!st.e||e.eq===st.e)&&(!q||q.split(' ').every(w=>norm(e.n).includes(w)))).sort((a,b)=>usedCount(b.id)-usedCount(a.id)||(b.custom?1:0)-(a.custom?1:0)||a.n.localeCompare(b.n))}
function exRow(e,sel){const u=usedCount(e.id);return `<button type="button" class="pickx${sel?' sel':''}" data-pick="${esc(e.id)}">${thumb(e)}<span class="pxn"><b>${esc(e.n)}</b><span class="dim">${esc(e.pm.join(', '))}${e.eq&&e.eq!=='other'?' · '+esc(e.eq):''}${u?' · '+u+'×':''}${e.custom?' · custom':''}</span></span><span class="pxc">${sel?'✓':''}</span></button>`}
async function pickExercises(cb,opt={}){await loadExDb();
  const st={q:'',m:'',e:''};const sel=[];
  const draw=()=>{const list=filteredEx(st).slice(0,250);$('pickList').innerHTML=list.map(e=>exRow(e,sel.includes(e.id))).join('')||'<div class="dim" style="padding:12px">No matches.</div>';
    $('pkGo').hidden=opt.single||!sel.length;$('pkGo').textContent=`add ${sel.length} exercise${sel.length>1?'s':''}`};
  openSheet(opt.single?'replace exercise':'add exercises',`${filterBar(st)}<div class="row" style="justify-content:flex-end;margin-bottom:6px"><button class="iconbtn" type="button" id="pkNew">+ Create custom exercise</button></div><div class="picklist" id="pickList"></div><button class="btn p pkgo" type="button" id="pkGo" hidden></button>`);
  draw();
  $('pkQ').oninput=e=>{st.q=e.target.value;draw()};$('pkM').onchange=e=>{st.m=e.target.value;draw()};$('pkE').onchange=e=>{st.e=e.target.value;draw()};
  $('pkNew').onclick=()=>editCustom(null,ex=>{if(opt.single){closeSheet();cb([ex])}else{sel.push(ex.id);pickExercisesResume()}},st.q);
  const pickExercisesResume=()=>{openSheet('add exercises',`${filterBar(st)}<div class="row" style="justify-content:flex-end;margin-bottom:6px"><button class="iconbtn" type="button" id="pkNew">+ Create custom exercise</button></div><div class="picklist" id="pickList"></div><button class="btn p pkgo" type="button" id="pkGo" hidden></button>`);bind();draw()};
  const bind=()=>{$('pkQ').oninput=e=>{st.q=e.target.value;draw()};$('pkM').onchange=e=>{st.m=e.target.value;draw()};$('pkE').onchange=e=>{st.e=e.target.value;draw()};
    $('pkNew').onclick=()=>editCustom(null,ex=>{sel.push(ex.id);pickExercisesResume()},st.q);
    $('pickList').onclick=e=>{const b=e.target.closest('[data-pick]');if(!b)return;const id=b.dataset.pick;if(opt.single){closeSheet();cb([EXMAP.get(id)]);return}const i=sel.indexOf(id);if(i>=0)sel.splice(i,1);else sel.push(id);draw()};
    $('pkGo').onclick=()=>{const list=sel.map(id=>EXMAP.get(id)).filter(Boolean);if(opt.back){cb(list)}else{closeSheet();cb(list)}}};
  bind();
}

/* ---------- custom exercises (with your own photo) ---------- */
function resizeImg(file,max=420){return new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>{const im=new Image();im.onload=()=>{const s=Math.min(1,max/Math.max(im.width,im.height));const c=document.createElement('canvas');c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);c.getContext('2d').drawImage(im,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',.72))};im.onerror=rej;im.src=fr.result};fr.onerror=rej;fr.readAsDataURL(file)})}
function editCustom(id,done,preset){const ex=id?clone(EXMAP.get(id)):{id:'c-'+rid(),n:preset||'',pm:['chest'],sm:[],eq:'machine',ty:'wr',custom:1};let photo=id?PHOTOS[id]||'':'';
  const draw=()=>{openSheet(id?'edit exercise':'create exercise',`<div class="cxphoto">${photo?`<img src="${esc(photo)}" alt="">`:'<span class="dim">No photo</span>'}<label class="btn">${photo?'retake':'take photo of machine'}<input type="file" accept="image/*" capture="environment" id="cxCam" hidden></label>${photo?'<button class="iconbtn" type="button" id="cxNoPh">Remove photo</button>':''}<label class="iconbtn">From library<input type="file" accept="image/*" id="cxLib" hidden></label></div>
    <input class="inp" id="cxN" value="${esc(ex.n)}" placeholder="Exercise name" style="font-size:16px;margin:10px 0">
    <label class="dim">type <select class="inp" id="cxT">${Object.entries(XTYPES).map(([k,v])=>`<option value="${k}" ${ex.ty===k?'selected':''}>${v.l}</option>`).join('')}</select></label>
    <label class="dim">equipment <select class="inp" id="cxE">${EQUIP2.map(m=>`<option ${ex.eq===m?'selected':''}>${m}</option>`).join('')}</select></label>
    <label class="dim">primary muscle <select class="inp" id="cxP">${MUSCLES2.map(m=>`<option ${ex.pm[0]===m?'selected':''}>${m}</option>`).join('')}</select></label>
    <div class="dim" style="font-size:12px;margin:10px 0 4px">Other muscles</div><div class="chips" id="cxS">${MUSCLES2.filter(m=>m!=='cardio'&&m!=='full body').map(m=>`<button class="chip" type="button" data-m="${m}" aria-pressed="${ex.sm.includes(m)}">${m}</button>`).join('')}</div>
    <div class="bigbtns" style="margin-top:12px">${id?'<button class="btn d" type="button" id="cxDel">Delete</button>':''}<span style="flex:1"></span><button class="btn p" type="button" id="cxSave">Save exercise</button></div>`);
    const onFile=async e=>{const f=e.target.files&&e.target.files[0];if(!f)return;try{photo=await resizeImg(f)}catch(x){}draw()};
    $('cxCam').onchange=onFile;$('cxLib').onchange=onFile;if($('cxNoPh'))$('cxNoPh').onclick=()=>{photo='';draw()};
    $('cxN').oninput=e=>ex.n=e.target.value;$('cxT').onchange=e=>ex.ty=e.target.value;$('cxE').onchange=e=>ex.eq=e.target.value;$('cxP').onchange=e=>ex.pm=[e.target.value];
    $('cxS').onclick=e=>{const b=e.target.closest('[data-m]');if(!b)return;const m=b.dataset.m;ex.sm=ex.sm.includes(m)?ex.sm.filter(x=>x!==m):[...ex.sm,m];b.setAttribute('aria-pressed',ex.sm.includes(m))};
    if($('cxDel'))$('cxDel').onclick=function(){if(!this.dataset.arm){this.dataset.arm=1;this.textContent='tap again';return}GLIB.custom=GLIB.custom.filter(c=>c.id!==ex.id);save('gym/lib',GLIB);removeDoc('gym/xp-'+ex.id);delete PHOTOS[ex.id];indexEx();closeSheet();renderGym()};
    $('cxSave').onclick=()=>{ex.n=(ex.n||'').trim();if(!ex.n){$('cxN').focus();return}const rec={id:ex.id,n:ex.n,pm:ex.pm,sm:ex.sm,eq:ex.eq,ty:ex.ty};
      const i=GLIB.custom.findIndex(c=>c.id===ex.id);if(i>=0)GLIB.custom[i]=rec;else GLIB.custom.push(rec);save('gym/lib',GLIB);
      if(photo){PHOTOS[ex.id]=photo;save('gym/xp-'+ex.id,{img:photo},true)}else if(PHOTOS[ex.id]){delete PHOTOS[ex.id];removeDoc('gym/xp-'+ex.id)}
      indexEx();flash('exercise_saved');if(done)done(EXMAP.get(ex.id));else{closeSheet();renderGym()}}};
  draw()}

/* ---------- library ---------- */
const LIBST={q:'',m:'',e:''};
async function renderLibrary(){await loadExDb();const el=$('g-exercises');
  el.innerHTML=`<div class="row" style="justify-content:space-between;margin-bottom:8px"><span class="tag">${EXMAP.size} exercises</span><button class="btn p" type="button" id="libNew">+ Custom exercise</button></div>${filterBar(LIBST).replace('id="pkQ"','id="libQ"').replace('id="pkM"','id="libM"').replace('id="pkE"','id="libE"')}<div class="picklist tall" id="libList"></div>`;
  const draw=()=>{$('libList').innerHTML=filteredEx(LIBST).slice(0,300).map(e=>exRow(e,false)).join('')};draw();
  $('libQ').oninput=e=>{LIBST.q=e.target.value;draw()};$('libM').onchange=e=>{LIBST.m=e.target.value;draw()};$('libE').onchange=e=>{LIBST.e=e.target.value;draw()};
  $('libNew').onclick=()=>editCustom(null,null,LIBST.q);
  $('libList').onclick=e=>{const b=e.target.closest('[data-pick]');if(b)openExercise(b.dataset.pick)}}

/* ---------- exercise detail: summary / history / charts / records ---------- */
let exAnim=null;
function openExercise(id,tab='summary'){const e=EXMAP.get(id)||exOf({id,n:id});const h=exHistory(e.id).reverse();const T=XTYPES[e.ty]||XTYPES.wr;const weighted=T.f.includes('kg');
  const tabs=['summary','history','charts','records'];
  const head=`<div class="exhero">${imgOf(e)?`<div class="exanim"><img id="exA" src="${esc(imgOf(e))}" alt="${esc(e.n)}"></div>`:''}<div><div class="dim">${esc(T.l)} · ${esc(e.eq||'')}</div><div><b>primary:</b> ${esc(e.pm.join(', '))}</div>${e.sm.length?`<div class="dim">secondary: ${esc(e.sm.join(', '))}</div>`:''}${e.custom?`<button class="iconbtn" type="button" id="exEdit" style="margin-top:6px">Edit exercise</button>`:''}</div></div>
    <div class="seg" style="margin:10px 0" id="exTabs">${tabs.map(t=>`<button type="button" data-t="${t}" aria-pressed="${t===tab}">${t}</button>`).join('')}</div>`;
  let body='';
  if(tab==='summary'){const b=bests(e.id);body=rlExBlock(e)+`<div class="wstats big">${weighted?`<div><span class="dim">Heaviest</span><b class="num">${b.kg?wU(e.id,b.kg):'—'}</b></div><div><span class="dim">best e1RM</span><b class="num">${b.e?wU(e.id,Math.round(b.e*10)/10):'—'}</b></div>`:`<div><span class="dim">Most reps</span><b class="num">${b.reps||'—'}</b></div>`}<div><span class="dim">Sessions</span><b class="num">${h.length}</b></div></div>
    ${e.how&&e.how.length?`<div class="tag" style="margin-top:14px">How to</div><ol class="howto">${e.how.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>`:''}`}
  if(tab==='history')body=h.slice().reverse().map(o=>`<div class="hx"><span class="dim">${esc(nice(o.w.date))} · ${esc(o.w.name)}</span><div class="hsets">${o.x.sets.filter(s=>s.done!==false).map((s,i,a)=>`<span class="set t-${s.t||'n'}">${setLabel(a,i)} · ${esc(fmtSet(o.x,s))}</span>`).join('')}</div>${o.x.note?`<div class="dim" style="font-size:12px">“${esc(o.x.note)}”</div>`:''}</div>`).join('')||'<div class="dim">Not logged yet.</div>';
  if(tab==='charts'){const metrics=weighted?[['e1rm','best est. 1RM'],['heavy','heaviest weight'],['setvol','best set volume'],['vol','session volume'],['reps','total reps']]:e.ty==='dur'?[['sec','longest time']]:e.ty==='dd'?[['km','distance'],['sec','time']]:[['best','most reps in a set'],['reps','total reps']];
    const m=openExercise.metric&&metrics.some(x=>x[0]===openExercise.metric)?openExercise.metric:metrics[0][0];
    const val=o=>{const ss=o.x.sets.filter(s=>s.done!==false&&s.t!=='w');const mx=f=>Math.max(0,...ss.map(f));return {e1rm:mx(e1),heavy:mx(s=>+s.kg||0),setvol:mx(s=>(+s.kg||0)*(+s.r||0)),vol:ss.reduce((a,s)=>a+(+s.kg||0)*(+s.r||0),0),reps:ss.reduce((a,s)=>a+(+s.r||0),0),best:mx(s=>+s.r||0),sec:mx(s=>+s.sec||0),km:mx(s=>+s.km||0)}[m]};
    const pts=h.map(val);body=`<div class="chips" id="exMet">${metrics.map(([k,l])=>`<button class="chip" type="button" data-k="${k}" aria-pressed="${k===m}">${l}</button>`).join('')}</div>${pts.length>1?spark(pts,{h:170,labels:[nice(h[0].w.date),nice(h[h.length-1].w.date)]}):'<div class="dim">Log this exercise twice to see a chart.</div>'}`}
  if(tab==='records'){const recs=[];if(weighted){const b=bests(e.id);recs.push(['estimated 1RM',b.e?wU(e.id,Math.round(b.e*10)/10):'—'],['heaviest weight',b.kg?wU(e.id,b.kg):'—'],['best set volume',b.vol?fmtVol(b.vol)+' kg':'—']);
      const bySess=Math.max(0,...h.map(o=>o.x.sets.filter(s=>s.t!=='w').reduce((a,s)=>a+(+s.kg||0)*(+s.r||0),0)));recs.push(['best session volume',bySess?fmtVol(bySess)+' kg':'—']);}
    const rr={};h.forEach(o=>o.x.sets.forEach(s=>{if(s.t==='w'||!(+s.r>0))return;const r=+s.r;if(r<=15)rr[r]=Math.max(rr[r]||0,+s.kg||0)}));
    body=`<div class="reclist">${recs.map(([k,v])=>`<div><span>${k}</span><b class="num">${v}</b></div>`).join('')}</div>${weighted&&Object.keys(rr).length?`<div class="tag" style="margin:14px 0 6px">Rep records · best weight for</div><div class="reclist">${Object.entries(rr).sort((a,b)=>a[0]-b[0]).map(([r,kg])=>`<div><span>${r} rep${r>1?'s':''}</span><b class="num">${wU(e.id,kg)}</b></div>`).join('')}</div>`:''}${!weighted?`<div class="reclist"><div><span>Sessions</span><b class="num">${h.length}</b></div></div>`:''}`}
  openSheet(e.n,head+`<div id="exBody">${body}</div>`);
  $('exTabs').onclick=ev=>{const b=ev.target.closest('[data-t]');if(b)openExercise(e.id,b.dataset.t)};
  if($('exMet'))$('exMet').onclick=ev=>{const b=ev.target.closest('[data-k]');if(b){openExercise.metric=b.dataset.k;openExercise(e.id,'charts')}};
  if($('exEdit'))$('exEdit').onclick=()=>editCustom(e.id);
  clearInterval(exAnim);if(e.img&&e.img.length>1&&!e.custom){let i=0;exAnim=setInterval(()=>{const im=$('exA');if(!im||!$('sheet').classList.contains('on')){clearInterval(exAnim);return}i^=1;im.src=IMGBASE+e.img[i]},900)}
}

/* ---------- history: list + calendar ---------- */
function renderHistory(){const el=$('g-history');
  const head=`<div class="row" style="justify-content:space-between;margin-bottom:10px"><div class="seg" id="hMode"><button type="button" data-h="list" aria-pressed="${HIST_MODE==='list'}">List</button><button type="button" data-h="cal" aria-pressed="${HIST_MODE==='cal'}">Calendar</button></div><span class="tag">${WORKOUTS.length} workouts</span></div>`;
  if(HIST_MODE==='list'){el.innerHTML=head+`<div class="wlist">${WORKOUTS.map(wCard).join('')||'<div class="dim">Finished workouts show up here.</div>'}</div>`}
  else{const base=HIST_MONTH?new Date(HIST_MONTH+'-01T12:00'):logical();const y=base.getFullYear(),mo=base.getMonth();const first=new Date(y,mo,1),days=new Date(y,mo+1,0).getDate();const off=(first.getDay()+6)%7;
    const byDay={};WORKOUTS.forEach(w=>(byDay[w.date]=byDay[w.date]||[]).push(w));const key=d=>`${y}-${pad(mo+1)}-${pad(d)}`;const inMonth=WORKOUTS.filter(w=>w.date.startsWith(`${y}-${pad(mo+1)}`));
    el.innerHTML=head+`<div class="panel"><div class="ph"><button class="iconbtn chev" type="button" data-cm="-1" aria-label="Previous month">‹</button><span class="tag">${first.toLocaleDateString('en-GB',{month:'long',year:'numeric'})} · ${inMonth.length} workouts</span><button class="iconbtn chev" type="button" data-cm="1" aria-label="Next month">›</button></div><div class="pb"><div class="calg">${['m','t','w','t','f','s','s'].map(d=>`<span class="cdh">${d}</span>`).join('')}${'<span></span>'.repeat(off)}${Array.from({length:days},(_,i)=>{const k=key(i+1);const ws=byDay[k]||[];return `<button type="button" class="cday${ws.length?' on':''}${k===ymd(logical())?' today':''}" data-cday="${k}" ${ws.length?'':'disabled'}>${i+1}${ws.length?'<i></i>':''}</button>`}).join('')}</div></div></div>
    <div class="wlist" style="margin-top:10px">${inMonth.map(wCard).join('')}</div>`}
}
$('g-history').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.h){HIST_MODE=b.dataset.h;return renderHistory()}
  if(b.dataset.cm){const base=HIST_MONTH?new Date(HIST_MONTH+'-01T12:00'):logical();base.setMonth(base.getMonth()+ +b.dataset.cm);HIST_MONTH=`${base.getFullYear()}-${pad(base.getMonth()+1)}`;return renderHistory()}
  if(b.dataset.cday){const ws=WORKOUTS.filter(w=>w.date===b.dataset.cday);if(ws.length)openWorkout(ws[0].id)}});
$('v-gym').addEventListener('click',e=>{const c=e.target.closest('.wcard[data-w]');if(!c||e.target.closest('button'))return;openWorkout(c.dataset.w)});
function openWorkout(id){const w=WORKOUTS.find(x=>x.id===id);if(!w)return;const dur=w.endedAt&&w.startedAt?fmtDur(new Date(w.endedAt)-new Date(w.startedAt)):'—';
  openSheet(w.name,`<div class="wd-date">${esc(nice(w.date))}</div>
  <div class="wd-stats"><div><span>Duration</span><b class="num">${esc(dur)}</b></div><div><span>Volume</span><b class="num">${fmtVol(w.vol||stats(w).vol)}<small> kg</small></b></div><div><span>Sets</span><b class="num">${NS(w)}</b></div></div>
  ${(WPH[w.id]||[]).length?`<div class="swgal">${WPH[w.id].map(s=>`<img src="${s}" alt="">`).join('')}</div>`:''}${w.note?`<div class="wd-note">${esc(w.note)}</div>`:''}
  ${(w.prs||[]).length?`<div class="wd-prs">${w.prs.map(p=>`<div><i>PR</i><span>${esc(p.n)} · ${esc(p.kind)}</span><b class="num">${esc(String(p.v))}</b></div>`).join('')}</div>`:''}
  ${(w.ex||[]).map(x=>{const e=exOf(x);return `<div class="wd-ex"><div class="wd-exh">${thumb(e,'rth')}<div><b>${esc(e.n)}</b>${x.ss?'<span class="wd-ss">Superset</span>':''}${x.note?`<small>${esc(x.note)}</small>`:''}</div></div>
    <div class="wd-sets">${x.sets.map((s,i)=>{const l=setLabel(x.sets,i);return `<div class="t-${s.t||'n'}"><span class="wd-n">${l}</span><span class="num">${esc(fmtSet(x,s))}</span></div>`}).join('')}</div></div>`}).join('')}
  <button class="wd-go" type="button" id="wRepeat">Repeat workout</button>
  <div class="wd-acts"><button type="button" id="wRoutine">Save routine</button><button type="button" id="wEdit">Edit</button><button type="button" class="d" id="wDel">Delete</button></div>`);
  $('wDel').onclick=function(){if(this.dataset.arm){removeDoc('gym/w-'+w.id);if(WPH[w.id]){removeDoc('gym/wp-'+w.id);delete WPH[w.id]}WORKOUTS=WORKOUTS.filter(x=>x.id!==w.id);recountUsed();closeSheet();renderGym()}else{this.dataset.arm=1;this.textContent='Tap again to delete'}};
  $('wEdit').onclick=()=>editWorkout(w);
  $('wRoutine').onclick=()=>{ROUTINES.list.push(routineFrom(w));save('gym/routines',ROUTINES);closeSheet();flash('saved')};
  $('wRepeat').onclick=()=>{if(ACTIVE){flash('finish_current_first');return}closeSheet();startWorkout({...routineFrom(w),id:null})};
}

/* ---------- statistics ---------- */
function muscleSets(ws){const m={};ws.forEach(w=>(w.ex||[]).forEach(x=>{const e=exOf(x);const n=x.sets.filter(s=>s.done!==false&&s.t!=='w').length;e.pm.forEach(p=>m[p]=(m[p]||0)+n);e.sm.forEach(p=>m[p]=(m[p]||0)+n*.5)}));return m}
function weekKeyN(n){const out=[];const now=logical();for(let i=n-1;i>=0;i--){const d=new Date(now);d.setDate(d.getDate()-i*7);out.push(isoWeek(d))}return out}
function streakWeeks(){const have=new Set(WORKOUTS.map(w=>isoWeek(new Date(w.date+'T12:00'))));let s=0;const now=logical();for(let i=0;i<260;i++){const d=new Date(now);d.setDate(d.getDate()-i*7);const k=isoWeek(d);if(have.has(k))s++;else if(i>0)break}return s}
const BM_SIL='M60 37 L54 37 C50 40 46 42 41 43 C35 44 31 48 30 56 C29 64 29 74 28 86 C27 96 25 106 24 118 C23 124 22 128 21 134 C22 138 26 138 27 134 L29 124 C31 112 33 102 35 92 C36 84 37 76 38 70 L40 70 C40 80 41 90 42 100 C42 106 41 112 40 120 C39 134 40 150 42 164 C42 174 41 186 43 198 C44 206 44 212 43 218 C42 222 44 224 48 224 L52 224 C54 223 54 220 53 216 C52 208 53 200 54 192 C55 182 56 174 56 166 C57 152 58 138 59 128 L60 126 Z';const BM_FRONT={ traps:'M54 39 C51 41 48 43 45 44 L51 45 C53 43 54.5 41 55 40 Z', shoulders:'M44 44.5 C37 44 32 49 31.5 57 C32 62 34 65 36.5 65 C37.5 58 41 51 46 47.5 Z', chest:'M47.5 47.5 C52 45.5 57 46 59.4 47.5 L59.4 61 C55 65.5 47.5 65.5 42.5 61 C41.5 55 43.5 50 47.5 47.5 Z', biceps:'M37.5 66 C35 72 34 79 34.5 86 C36.5 88.5 39 88 40 85.5 C40.8 78 40.8 72 40.5 66.5 Z', forearms:'M34.5 90 C31 99 28.5 109 27 120 L31 122 C34 113 37 103 39.5 92 C38 90.5 36 90 34.5 90 Z', abs:'M50.5 66 L59.4 66 L59.4 103 C55 105 52 103.5 50.5 100 Z M43.5 66 C45 75 46 88 47.5 100 L49.6 99.5 C49 88 49 76 49.4 66 Z', quads:'M44.5 116 C41.5 127 41.5 145 44.5 160 C47.5 163.5 52 162.5 53.5 158 C55.5 145 56.5 131 56.5 121 C53 117 49 115.5 44.5 116 Z', adductors:'M57 121.5 C57.5 129 58 136 58.3 143 L59.4 142 L59.4 124 Z', calves:'M43.5 170 C41.5 180 42.5 194 45.5 205 L49 205.5 C50.5 195 50.5 181 49 170.5 Z'};const BM_BACK={ traps:'M59.4 36.5 L55 38 C50 41 46 43 43.5 45 C49 47 53.5 51 56 56 L59.4 63.5 Z', shoulders:BM_FRONT.shoulders, 'upper back':'M55.5 57.5 C52 53 47.5 51 44 51.5 C43 57 45.5 62.5 51 64.5 L58.8 64.5 Z', lats:'M43 60 C41.5 70 43.5 82 49 92 L55 88.5 C54 79 52.5 71 52 65.5 C48 64.5 45 62.5 43 60 Z', triceps:'M37.5 64 C35 70 34 78 34.5 86 C36.5 88.5 39 88 40 85.5 C40.8 78 40.8 70 40.5 64.5 Z', forearms:BM_FRONT.forearms, 'lower back':'M53.5 86 L59.4 84 L59.4 104 L54.5 104 C53.5 98 53 92 53.5 86 Z', glutes:'M44.5 106 C42 112 42 120 45.5 126 C51 128.5 56.5 126.5 59.4 122.5 L59.4 106 C55 104.5 49 104.5 44.5 106 Z', hamstrings:'M45 129.5 C43 141 43.5 152 46 162.5 L52 162.5 C54 151 56 140 57 129.5 C53 131 49 131 45 129.5 Z', calves:'M44 168 C41 176 41.5 188 44.5 197 C46.5 199.5 50 198 51 191 C52 183 52 175 50.5 168 Z'};const BM_LINES='M50.8 74 L59.4 74 M50.8 82 L59.4 82 M50.8 91 L59.4 91';
function bodyMap(m){const mx=Math.max(1,...Object.values(m));const c=k=>{const v=(m[k]||0)/mx;return v?`rgba(255,42,109,${(.25+.75*v).toFixed(2)})`:'#2b2b31'};
  const half=(P,ab)=>`<path d="${BM_SIL}" fill="#1a1a1f"/>`+Object.entries(P).map(([k,d])=>`<path d="${d}" fill="${c(k)}" stroke="#0b0b0e" stroke-width=".7" stroke-linejoin="round"><title>${k}: ${kgs(m[k]||0)} sets</title></path>`).join('')+(ab?`<path d="${BM_LINES}" stroke="#0b0b0e" stroke-width=".8" fill="none"/>`:'');
  const fig=(P,lab,ab)=>{const h=half(P,ab);return `<figure><svg viewBox="16 6 88 222" role="img" aria-label="${lab}"><ellipse cx="60" cy="21" rx="10.5" ry="12.5" fill="#1a1a1f"/><rect x="54.5" y="30" width="11" height="9" rx="3" fill="#1a1a1f"/><g>${h}</g><g transform="matrix(-1 0 0 1 120 0)">${h}</g></svg><figcaption>${lab}</figcaption></figure>`};
  return `<div class="bodymap">${fig(BM_FRONT,'Front',1)}${fig(BM_BACK,'Back')}</div><div class="bm-key"><span>Fewer sets</span><i></i><span>More sets</span></div>`}
function renderStats(){const el=$('g-stats');const weeks=weekKeyN(STAT_P);const since=weeks[0];
  const ws=WORKOUTS.filter(w=>isoWeek(new Date(w.date+'T12:00'))>=since);
  const per=weeks.map(k=>WORKOUTS.filter(w=>isoWeek(new Date(w.date+'T12:00'))===k));
  const val=a=>({volume:a.reduce((s,w)=>s+(w.vol||stats(w).vol),0),sets:a.reduce((s,w)=>s+(NS(w)),0),duration:a.reduce((s,w)=>s+(w.endedAt&&w.startedAt?(new Date(w.endedAt)-new Date(w.startedAt))/60000:0),0),workouts:a.length})[STAT_M];
  const vals=per.map(val);const mx=Math.max(1,...vals);
  const tot={w:ws.length,vol:ws.reduce((s,w)=>s+(w.vol||stats(w).vol),0),sets:ws.reduce((s,w)=>s+(NS(w)),0),dur:ws.reduce((s,w)=>s+(w.endedAt&&w.startedAt?(new Date(w.endedAt)-new Date(w.startedAt)):0),0)};
  const m30=muscleSets(WORKOUTS.filter(w=>(Date.now()-new Date(w.date+'T12:00'))<30*864e5));const mList=Object.entries(m30).filter(([k])=>k!=='other').sort((a,b)=>b[1]-a[1]);const mmx=Math.max(1,...mList.map(x=>x[1]));
  const recs=[...new Set(WORKOUTS.flatMap(w=>(w.ex||[]).map(exKey)))].map(id=>{const e=EXMAP.get(id)||exOf({id});const b=bests(id);return {e,b}}).filter(o=>o.b.e>0).sort((a,b)=>b.b.e-a.b.e).slice(0,10);
  el.innerHTML=`<div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px"><div class="seg" id="stP">${[[4,'4 weeks'],[12,'3 months'],[52,'1 year']].map(([n,l])=>`<button type="button" data-p="${n}" aria-pressed="${STAT_P===n}">${l}</button>`).join('')}</div><span class="tag">${streakWeeks()} week streak</span></div>
  <div class="statcards"><div><span class="dim">Workouts</span><b class="num">${tot.w}</b></div><div><span class="dim">Volume</span><b class="num">${fmtVol(tot.vol)}<small> kg</small></b></div><div><span class="dim">Sets</span><b class="num">${tot.sets}</b></div><div><span class="dim">Time</span><b class="num">${Math.round(tot.dur/3600000)}<small> h</small></b></div><div><span class="dim">Avg / week</span><b class="num">${(tot.w/STAT_P).toFixed(1)}</b></div></div>
  <div class="panel" style="margin-top:12px"><div class="ph"><span class="tag">Per week</span><div class="chips" id="stM" style="margin:0">${['volume','sets','duration','workouts'].map(k=>`<button class="chip" type="button" data-m="${k}" aria-pressed="${STAT_M===k}">${k}</button>`).join('')}</div></div><div class="pb"><div class="wkbars" style="grid-template-columns:repeat(${weeks.length},1fr)">${vals.map((v,i)=>`<div class="d"><span class="p num">${v?(STAT_M==='volume'?Math.round(v/1000)+'k':Math.round(v)):''}</span><div class="b" style="height:${v/mx*100}%"></div><span class="l">${weeks.length<=12||i%4===0?weeks[i].slice(-3).toLowerCase():''}</span></div>`).join('')}</div></div></div>
  <div class="statsplit"><div class="panel"><div class="ph"><span class="tag">Muscles · last 30 days</span></div><div class="pb">${bodyMap(m30)}<div class="mbars">${mList.map(([m,v])=>`<div><span>${esc(m)}</span><i style="--w:${v/mmx*100}%"></i><b class="num">${kgs(v)}</b></div>`).join('')||'<span class="dim">No sets in the last 30 days.</span>'}</div></div></div>
  <div class="panel"><div class="ph"><span class="tag">strength · best est. 1RM</span></div><div class="pb"><div class="reclist">${recs.map(o=>`<button type="button" data-ex="${esc(o.e.id)}"><span>${thumb(o.e,'rth')} ${esc(o.e.n)}</span><b class="num">${kgs(Math.round(o.b.e*10)/10)} kg</b></button>`).join('')||'<span class="dim">Log some weighted sets to see records.</span>'}</div></div></div></div>`;
  if(FX)el.querySelectorAll('.wkbars .b').forEach((b,i)=>b.animate([{transform:'scaleY(0)'},{transform:'scaleY(1)'}],{duration:600,delay:i*30,easing:'cubic-bezier(.2,.9,.1,1)',fill:'backwards'}));
}
$('g-stats').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.p){STAT_P=+b.dataset.p;renderStats()}if(b.dataset.m){STAT_M=b.dataset.m;renderStats()}if(b.dataset.ex)openExercise(b.dataset.ex)});

/* --- bottom sheet used by gym + journal --- */
let sheetStack=0;
function openSheet(title,html){$('sheetTitle').textContent=title;$('sheetBody').innerHTML=html;$('sheetBody').oninput=null;$('sheetBody').onclick=null;$('sheetBody').onchange=null;$('sheet').classList.add('on');$('sheet').setAttribute('aria-hidden','false');$('scrim').classList.add('on');sheetStack=1;$('sheetBody').scrollTop=0}
function closeSheet(){$('sheet').classList.remove('on');$('sheet').setAttribute('aria-hidden','true');if(!$('drawer').classList.contains('on'))$('scrim').classList.remove('on');sheetStack=0}
$('sheetX').onclick=closeSheet;


function toggleUnit(id){GUNITS={...GUNITS};if(isLb(id))delete GUNITS[id];else GUNITS[id]='lb';save('gym/units',GUNITS);renderGym();flash(isLb(id)?'lbs':'kg')}
