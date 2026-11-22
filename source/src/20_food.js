/* ================= FOOD (calories + macros, Lose It style) =================
   docs: food/profile · food/lib {custom,meals,recent,fav} · food/d-YYYY-MM-DD {m:{b,l,d,s},ex,w,note} · food/fast {cur,log}
   an entry stores per-100g values + grams eaten, so it can be re-portioned later */
const FMEALS=[['b','breakfast'],['l','lunch'],['d','dinner'],['s','snacks']];
const FACT=[[1.2,'sedentary (desk, little exercise)'],[1.375,'lightly active (1–3 workouts/wk)'],[1.55,'active (3–5 workouts/wk)'],[1.725,'very active (6–7 hard days)']];
const FRATE=[[-1,'lose 1 kg / week'],[-0.75,'lose 0.75 kg / week'],[-0.5,'lose 0.5 kg / week'],[-0.25,'lose 0.25 kg / week'],[0,'maintain'],[0.25,'gain 0.25 kg / week'],[0.5,'gain 0.5 kg / week']];
const FEX=[['weights / gym',5],['walking',3.5],['incline treadmill walk',6],['running',9.8],['cycling',7.5],['HIIT',8],['swimming',7],['football',7],['boxing / bag work',7.8],['stretching / yoga',2.5]];
let FPROF=null,FLIB={custom:[],meals:[],recent:[],fav:{}},FDAYS={},FFAST={cur:null,log:[]},FGEN=null,FV=LS.get('foodv')||'log',FD=null,foodLoaded=false;
const fK=d=>'food/d-'+d;
const fDay=d=>FDAYS[d]||(FDAYS[d]={m:{b:[],l:[],d:[],s:[]},ex:[],w:0,note:''});
const r1=x=>Math.round((+x||0)*10)/10;
function fNum(e,k){if(e.quick)return +e['q'+k]||0;return (+e[k]||0)*(+e.g||0)/100}
function fSum(list){const t={kcal:0,p:0,c:0,f:0,fi:0,su:0,na:0};list.forEach(e=>{t.kcal+=fNum(e,'k');t.p+=fNum(e,'p');t.c+=fNum(e,'c');t.f+=fNum(e,'f');t.fi+=fNum(e,'fi');t.su+=fNum(e,'su');t.na+=fNum(e,'na')});return t}
function dayItems(d){const x=fDay(d);return FMEALS.flatMap(([m])=>x.m[m]||[])}
function curKg(){const r=(typeof WT!=='undefined'&&WT.r)||[];return r.length?+r[r.length-1].kg:(FPROF&&+FPROF.kg)||80}
function fBudget(){const P=FPROF||{};if(P.override)return +P.override;const kg=curKg(),h=+P.hcm||178,a=+P.age||22;
  const bmr=10*kg+6.25*h-5*a+(P.sex==='f'?-161:5);const tdee=bmr*(+P.act||1.375);const b=tdee+(+P.rate||0)*7700/7;return Math.round(Math.max(P.sex==='f'?1200:1500,b)/10)*10}
function fTargets(){const P=FPROF||{},B=fBudget();if(P.mmode==='g')return {p:+P.gp||150,c:+P.gc||200,f:+P.gf||70};
  const pp=+P.mp||35,pc=+P.mc||35,pf=+P.mf||30;return {p:Math.round(B*pp/100/4),c:Math.round(B*pc/100/4),f:Math.round(B*pf/100/9)}}
function exKcal(d){return (fDay(d).ex||[]).reduce((a,e)=>a+(+e.k||0),0)}
async function loadFood(){
  if(foodLoaded){renderFood();return}
  const [p,l,f,rows,gen]=await Promise.all([load('food/profile'),load('food/lib'),load('food/fast'),listDocs('food/d-'),FGEN?FGEN:fetch('foods.json').then(r=>r.json()).catch(()=>[])]);
  FPROF=p||null;FLIB={custom:[],meals:[],recent:[],fav:{},...(l||{})};FFAST={cur:null,log:[],...(f||{})};
  rows.forEach(r=>{if(r.data)FDAYS[r.path.slice(7)]={m:{b:[],l:[],d:[],s:[]},ex:[],w:0,note:'',...r.data}});
  FGEN=gen.map((g,i)=>({id:'g'+i,n:g[0],k:g[1],p:g[2],c:g[3],f:g[4],fi:g[5],sv:g[6],src:'gen'}));
  foodLoaded=true;FD=FD||DAYK;renderFood()}
watchPrefix('food/d-',(evt,path,data)=>{const d=path.slice(7);if(evt==='DELETE')delete FDAYS[d];else if(data)FDAYS[d]={m:{b:[],l:[],d:[],s:[]},ex:[],w:0,note:'',...data};if(cur==='food'&&!$('sheet').classList.contains('on'))renderFood()});
watch('food/lib',d=>{if(d)FLIB={custom:[],meals:[],recent:[],fav:{},...d}});
watch('food/profile',d=>{if(d){FPROF=d;if(cur==='food')renderFood()}});
watch('food/fast',d=>{if(d){FFAST={cur:null,log:[],...d};if(cur==='food'&&FV==='fast')renderFood()}});
const saveDay=d=>save(fK(d),fDay(d));
const saveLib=()=>save('food/lib',FLIB);

/* ---------- shell ---------- */
function renderFood(){if(!foodLoaded){loadFood();return}
  document.querySelectorAll('#foodSeg [data-fv]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.fv===FV));
  $('foodSub').textContent=FPROF?`${fBudget()} kcal budget · ${(FRATE.find(r=>r[0]===+FPROF.rate)||[0,'maintain'])[1]}`:'set up your goal';
  if(!FPROF&&FV!=='goals'){FV='goals'}
  ({log:fLog,progress:fProgress,fast:fFast,goals:fGoals}[FV]||fLog)()}
document.addEventListener('click',e=>{const b=e.target.closest('#foodSeg [data-fv]');if(!b)return;FV=b.dataset.fv;LS.set('foodv',FV);renderFood()});

/* ---------- log (the main daily screen) ---------- */
function fLog(){const el=$('foodBody');FD=FD||DAYK;const x=fDay(FD),B=fBudget(),T=fTargets(),items=dayItems(FD),S=fSum(items),EX=FPROF&&FPROF.noEx?0:exKcal(FD);
  const left=Math.round(B+EX-S.kcal),pct=Math.min(1,S.kcal/Math.max(1,B+EX)),over=left<0;
  const R=58,C=2*Math.PI*R;const isToday=FD===DAYK;
  const mbar=(lab,v,t,col)=>`<div class="fmac"><div class="row" style="justify-content:space-between"><span>${lab}</span><span class="num"><b>${Math.round(v)}</b><span class="dim"> / ${t} g</span></span></div><div class="fmbar"><i style="width:${Math.min(100,v/Math.max(1,t)*100)}%;background:${col}"></i></div></div>`;
  el.innerHTML=`<div class="fdate"><button class="iconbtn chev" type="button" data-fd="-1" aria-label="Previous day">‹</button><b>${isToday?'today':esc(nice(FD).toLowerCase())}</b><button class="iconbtn chev" type="button" data-fd="1" aria-label="Next day" ${isToday?'disabled':''}>›</button></div>
  <div class="fh2"><div class="fh2-top">
    <div class="fh2-ring${over?' over':''}"><svg viewBox="0 0 200 200"><defs><linearGradient id="fhg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${over?'#ff453a':'#ff2a6d'}"/><stop offset="1" stop-color="${over?'#ff9f0a':'#ff7ab0'}"/></linearGradient></defs><circle cx="100" cy="100" r="86" class="tr"/>${pct>0?`<circle cx="100" cy="100" r="86" class="fl" pathLength="100" stroke-dasharray="${Math.min(100,pct*100).toFixed(2)} 100"/>`:''}</svg>
      <div class="in"><b class="num">${Math.abs(left).toLocaleString('en-GB')}</b><span>${over?'kcal over':'kcal left'}</span></div></div>
    <div class="fh2-stats">
      <div class="fh2-st"><i style="--c:#a1a1a6"><svg viewBox="0 0 24 24"><path d="M5 21V8l7-5 7 5v13M9 21v-6h6v6"/></svg></i><span>Budget</span><b class="num">${B.toLocaleString('en-GB')}</b></div>
      <div class="fh2-st"><i style="--c:#ff2a6d"><svg viewBox="0 0 24 24"><path d="M7 3v8a3 3 0 0 0 6 0V3M10 3v18M17 3c-1.7 0-3 2.2-3 5.5S15.3 13 17 13v8"/></svg></i><span>Eaten</span><b class="num">${Math.round(S.kcal).toLocaleString('en-GB')}</b></div>
      <div class="fh2-st"><i style="--c:#ff9f0a"><svg viewBox="0 0 24 24"><path d="M12 3c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .3 2 1.5 3 2.5 3 0-3-1-6 0-9z"/></svg></i><span>Burned</span><b class="num">${EX.toLocaleString('en-GB')}</b></div>
    </div></div>
    <div class="fh2-macs">${[['Protein',S.p,T.p,'#ff2a6d'],['Carbs',S.c,T.c,'#5ac8fa'],['Fat',S.f,T.f,'#ffd60a']].map(([l,v,t,c])=>`<div class="fh2-mac" style="--c:${c}"><div class="h"><span>${l}</span><b class="num">${Math.round(v)}<small> / ${t}g</small></b></div><div class="bar"><i style="width:${Math.min(100,v/Math.max(1,t)*100).toFixed(1)}%"></i></div><em>${Math.max(0,Math.round(t-v))}g left</em></div>`).join('')}</div>
    <div class="fquick"><button type="button" class="btn p" data-fadd="${fAutoMeal()}"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>Log food</button><button type="button" class="btn" id="fScanTop"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 9v6M11 9v6M14 9v6M17 9v6"/></svg>Scan barcode</button></div>
    <div class="fh2-nut num"><span>Fibre <b>${r1(S.fi)}</b>/${(FPROF&&FPROF.fib)||30}g</span><span>Sugar <b>${r1(S.su)}</b>g</span><span>Sodium <b>${Math.round(S.na)}</b>/${(FPROF&&FPROF.na)||2300}mg</span></div></div>
  ${FMEALS.map(([m,lab])=>{const L=x.m[m]||[],s=fSum(L);return `<div class="panel fmeal"><div class="ph"><span class="tag">${lab}</span><span class="row" style="gap:6px"><span class="num fkc">${Math.round(s.kcal)} kcal</span><button class="iconbtn" type="button" data-fmenu="${m}">⋯</button></span></div><div class="pb">
    ${L.map((e,i)=>`<button type="button" class="frow" data-fe="${m}:${i}"><span><b>${esc(e.n)}</b><span class="dim">${esc(fAmt(e))}${e.b?' · '+esc(e.b):''}</span></span><span class="num">${Math.round(fNum(e,'k'))}</span></button>`).join('')}
    <button class="addrow" type="button" data-fadd="${m}">+ add food</button></div></div>`}).join('')}
  <div class="panel fmeal"><div class="ph"><span class="tag">exercise</span><span class="num">${EX} kcal</span></div><div class="pb">${(x.ex||[]).map((e,i)=>`<button type="button" class="frow" data-fx="${i}"><span><b>${esc(e.n)}</b><span class="dim">${e.min?e.min+' min':''}</span></span><span class="num">${e.k}</span></button>`).join('')}<button class="addrow" type="button" id="fAddEx">+ add exercise</button></div></div>
  <div class="panel"><div class="ph"><span class="tag">water</span><span class="num">${x.w||0} / ${(FPROF&&FPROF.water)||2500} ml</span></div><div class="pb"><div class="fwater">${[...Array(Math.ceil(((FPROF&&FPROF.water)||2500)/250))].map((_,i)=>`<button type="button" class="${(x.w||0)>=(i+1)*250?'on':''}" data-fw="${(i+1)*250}" aria-label="${(i+1)*250} ml"></button>`).join('')}</div></div></div>
  <div class="panel"><div class="ph"><span class="tag">notes</span></div><div class="pb"><textarea class="inp" id="fNote" rows="2" placeholder="how did today go?">${esc(x.note||'')}</textarea></div></div>`;
  el.onclick=fLogClick;el.oninput=e=>{if(e.target.id==='fNote'){x.note=e.target.value;clearTimeout(fLog.t);fLog.t=setTimeout(()=>saveDay(FD),600)}}}
function fAutoMeal(){const h=new Date().getHours();return h>=5&&h<11?'b':h<15?'l':h>=17&&h<22?'d':'s'}
function fAmt(e){if(e.quick)return 'quick add';const q=+e.q||1;return e.u&&e.u!=='g'?`${r1(q)} × ${e.u}`:`${Math.round(e.g)} g`}
function fLogClick(e){const b=e.target.closest('button');if(!b)return;const x=fDay(FD);
  if(b.dataset.fd){const d=new Date(FD+'T12:00');d.setDate(d.getDate()+(+b.dataset.fd));const k=ymd(d);if(k>DAYK)return;FD=k;renderFood();return}
  if(b.dataset.fadd)return fAdd(b.dataset.fadd);
  if(b.dataset.fe){const [m,i]=b.dataset.fe.split(':');return fPortion(x.m[m][+i],{meal:m,idx:+i})}
  if(b.dataset.fmenu)return fMealMenu(b.dataset.fmenu);
  if(b.dataset.fw){const v=+b.dataset.fw;x.w=(x.w||0)>=v?v-250:v;saveDay(FD);fLog();return}
  if(b.id==='fAddEx')return fExercise();
  if(b.id==='fScanTop')return fScan(fAutoMeal());
  if(b.dataset.fx){const i=+b.dataset.fx;openSheet('exercise',`<p>${esc(x.ex[i].n)} · ${x.ex[i].k} kcal</p><div class="bigbtns"><button class="btn d" type="button" id="fxDel">remove</button><button class="btn p" type="button" id="fxOk">done</button></div>`);$('fxOk').onclick=closeSheet;$('fxDel').onclick=()=>{x.ex.splice(i,1);saveDay(FD);closeSheet();fLog()}}}
function fMealMenu(m){const lab=FMEALS.find(z=>z[0]===m)[1];const x=fDay(FD);const y=new Date(FD+'T12:00');y.setDate(y.getDate()-1);const yk=ymd(y);const yl=(fDay(yk).m[m]||[]);
  openSheet(lab,`<div class="bigbtns col"><button class="btn" type="button" id="fmCopy" ${yl.length?'':'disabled'}>copy yesterday's ${lab} (${yl.length} item${yl.length===1?'':'s'})</button><button class="btn" type="button" id="fmSave" ${(x.m[m]||[]).length?'':'disabled'}>save this ${lab} as a meal</button><button class="btn d" type="button" id="fmClear" ${(x.m[m]||[]).length?'':'disabled'}>clear ${lab}</button></div>`);
  $('fmCopy').onclick=()=>{x.m[m]=(x.m[m]||[]).concat(clone(yl).map(e=>({...e,id:rid()})));saveDay(FD);closeSheet();fLog()};
  $('fmSave').onclick=()=>{const n=prompt('name this meal',lab+' '+nice(FD).toLowerCase());if(!n)return;FLIB.meals.unshift({id:rid(),n,items:clone(x.m[m])});saveLib();closeSheet()};
  $('fmClear').onclick=function(){if(!this.dataset.arm){this.dataset.arm=1;this.textContent='tap again to clear';return}x.m[m]=[];saveDay(FD);closeSheet();fLog()}}

/* ---------- add food: search, recent, frequent, my foods, meals, barcode, quick add ---------- */
let FTAB='recent',fSeq=0;
function fAdd(meal){const lab=FMEALS.find(z=>z[0]===meal)[1];
  openSheet('add to '+lab,`<div class="fsearch"><input class="inp" id="fQ" placeholder="search foods & brands…" autocomplete="off" enterkeyhint="search"><button class="btn" type="button" id="fScan" aria-label="Scan barcode">▥ scan</button></div>
  <div class="seg mini" id="fTabs" style="margin:8px 0">${[['recent','recent'],['freq','frequent'],['mine','my foods'],['meals','meals']].map(([k,l])=>`<button type="button" data-ft="${k}" aria-pressed="${FTAB===k}">${l}</button>`).join('')}</div>
  <div class="row" style="gap:6px;margin-bottom:8px"><button class="iconbtn" type="button" id="fQuick">+ quick add</button><button class="iconbtn" type="button" id="fCreate">+ create food</button></div>
  <div id="fRes" class="fres"></div>`);
  const sb=$('sheetBody');const list=()=>{const q=$('fQ').value.trim();if(q)return fSearch(q,meal);$('fRes').innerHTML=fTabList(FTAB)};list();
  sb.oninput=e=>{if(e.target.id==='fQ'){clearTimeout(fAdd.t);fAdd.t=setTimeout(list,250)}};
  sb.onclick=e=>{const b=e.target.closest('button');if(!b)return;
    if(b.dataset.ft){FTAB=b.dataset.ft;sb.querySelectorAll('[data-ft]').forEach(z=>z.setAttribute('aria-pressed',z===b));$('fQ').value='';list();return}
    if(b.id==='fScan')return fScan(meal);if(b.id==='fQuick')return fQuickAdd(meal);if(b.id==='fCreate')return fCreate(meal);
    if(b.dataset.fmeal){const M=FLIB.meals.find(z=>z.id===b.dataset.fmeal);if(!M)return;const x=fDay(FD);x.m[meal]=(x.m[meal]||[]).concat(clone(M.items).map(e=>({...e,id:rid()})));saveDay(FD);closeSheet();fLog();return}
    if(b.dataset.fdelmeal){FLIB.meals=FLIB.meals.filter(z=>z.id!==b.dataset.fdelmeal);saveLib();list();return}
    if(b.dataset.fpick){const f=fFind(b.dataset.fpick);if(f)fPortion(f,{meal,isNew:true});return}}}
let FCACHE={};
function fFind(id){return FCACHE[id]||FLIB.custom.find(f=>f.id===id)||FGEN.find(f=>f.id===id)||(FLIB.recent.find(f=>f.id===id))}
function fRow(f){FCACHE[f.id]=f;const s=(f.sv&&f.sv[0])||['100 g',100];const k=Math.round((+f.k||0)*s[1]/100);
  return `<button type="button" class="frow" data-fpick="${esc(f.id)}">${f.img?`<img src="${esc(f.img)}" alt="" loading="lazy">`:''}<span><b>${esc(f.n)}${FLIB.fav[f.id]?' ★':''}</b><span class="dim">${esc([f.b,s[0]].filter(Boolean).join(' · '))}</span></span><span class="num">${k}<small> kcal</small></span></button>`}
function fTabList(t){
  if(t==='meals')return FLIB.meals.length?FLIB.meals.map(M=>{const s=fSum(M.items);return `<div class="row" style="gap:6px"><button type="button" class="frow" data-fmeal="${esc(M.id)}" style="flex:1"><span><b>${esc(M.n)}</b><span class="dim">${M.items.length} items · P ${Math.round(s.p)} C ${Math.round(s.c)} F ${Math.round(s.f)}</span></span><span class="num">${Math.round(s.kcal)}</span></button><button class="iconbtn" type="button" data-fdelmeal="${esc(M.id)}">✕</button></div>`}).join(''):'<div class="dim fempty">Save a meal from a meal\'s ⋯ menu to add it here in one tap.</div>';
  if(t==='mine')return FLIB.custom.length?FLIB.custom.map(fRow).join(''):'<div class="dim fempty">Foods you create show here.</div>';
  const R=[...FLIB.recent];if(t==='freq')R.sort((a,b)=>(b.cnt||0)-(a.cnt||0));else R.sort((a,b)=>(b.last||'')>(a.last||'')?1:-1);
  const fav=R.filter(f=>FLIB.fav[f.id]);const rest=R.filter(f=>!FLIB.fav[f.id]);
  return (R.length?(fav.length?'<div class="flab">favourites</div>'+fav.map(fRow).join(''):'')+rest.slice(0,40).map(fRow).join(''):'<div class="dim fempty">Search above, scan a barcode, or pick from common foods:</div>'+FGEN.slice(0,30).map(fRow).join(''))}
const offStr=v=>Array.isArray(v)?v.join(', '):v==null?'':String(v);
function offToFood(p){try{return offToFood0(p)}catch(e){return null}}
function offToFood0(p){p={...p,brands:offStr(p.brands),product_name:offStr(p.product_name),product_name_en:offStr(p.product_name_en),quantity:offStr(p.quantity),serving_size:offStr(p.serving_size)};const n=p.nutriments||{};let k=n['energy-kcal_100g'];if(k==null&&n['energy_100g']!=null)k=n['energy_100g']/4.184;if(k==null)return null;
  const sq=+p.serving_quantity||0;const sv=[];if(sq>0)sv.push([p.serving_size||('serving · '+sq+' g'),sq]);if(p.quantity&&/^\s*\d+(\.\d+)?\s*g\s*$/i.test(p.quantity))sv.push(['pack · '+p.quantity.trim(),parseFloat(p.quantity)]);sv.push(['100 g',100]);
  return {id:'off'+p.code,code:p.code,n:(p.product_name_en||p.product_name||'').trim()||'unnamed product',b:(p.brands||'').split(',')[0].trim(),k:+k,p:+n.proteins_100g||0,c:+n.carbohydrates_100g||0,f:+n.fat_100g||0,fi:+n.fiber_100g||0,su:+n.sugars_100g||0,na:n.sodium_100g!=null?+n.sodium_100g*1000:(n.salt_100g!=null?+n.salt_100g*400:0),sv,img:p.image_small_url||'',src:'off'}}
async function offCall(body){const C=window.APP_CONFIG||{};let tok='';try{tok=JSON.parse(localStorage.getItem('ds-auth')||'{}').access_token||''}catch(e){}
  const url=(C.supabaseUrl||'').replace(/\/$/,'')+'/functions/v1/food';
  for(let a=0;a<2;a++){const ac=new AbortController();const to=setTimeout(()=>ac.abort(),a?20000:12000);
    try{const r=await fetch(url,{method:'POST',signal:ac.signal,headers:{'content-type':'application/json',apikey:C.supabaseKey,authorization:'Bearer '+(tok||C.supabaseKey)},body:JSON.stringify(body)});clearTimeout(to);
      if(r.status===401&&!a){try{const s=await Promise.race([SB.auth.refreshSession(),new Promise(z=>setTimeout(z,4000))]);tok=(s&&s.data&&s.data.session&&s.data.session.access_token)||tok}catch(e){}continue}
      if(!r.ok)continue;const j=await r.json();return j.items||[]}catch(e){clearTimeout(to)}}
  return null}
async function fSearch(q,meal){const my=++fSeq;const ql=q.toLowerCase(),words=ql.split(/\s+/);const hit=f=>{const s=(f.n+' '+(f.b||'')).toLowerCase();return words.every(w=>s.includes(w))};
  const seen=new Set();const loc=[...FLIB.custom,...FLIB.recent,...FGEN].filter(f=>{if(seen.has(f.id)||!hit(f))return false;seen.add(f.id);return true}).slice(0,25);
  $('fRes').innerHTML=(loc.length?loc.map(fRow).join(''):'')+'<div class="flab" id="fOnl">searching online…</div>';
  const items=await offCall({q});if(my!==fSeq||!$('fRes'))return;try{
  const on=(items||[]).map(offToFood).filter(Boolean).filter(f=>!seen.has(f.id));
  const lab=$('fOnl');if(!lab)return;lab.outerHTML=items===null?'<div class="dim fempty">Online search unavailable right now — use create food or quick add.</div>':on.length?'<div class="flab">from Open Food Facts</div>'+on.map(fRow).join(''):(loc.length?'':'<div class="dim fempty">Nothing found. Try another word, scan the barcode, or create it.</div>')}catch(e){const l=$('fOnl');if(l)l.outerHTML='<div class="dim fempty">Online search hit an error — try again.</div>'}}

/* portion editor (used for new picks and for editing logged entries) */
function fPortion(f,{meal,idx,isNew}){const ent=!isNew;const sv=(f.sv&&f.sv.length?f.sv:[['100 g',100]]).concat([['g',1]]);
  let u=ent?(f.u||'g'):sv[0][0],q=ent?(+f.q||(f.u==='g'?f.g:1)):1,m=meal;
  if(f.quick){return fQuickAdd(meal,idx)}
  const gr=()=>{const s=sv.find(z=>z[0]===u)||['g',1];return q*s[1]};
  const draw=()=>{const g=gr(),K=(+f.k||0)*g/100,P=(+f.p||0)*g/100,Cc=(+f.c||0)*g/100,F=(+f.f||0)*g/100,tot=P*4+Cc*4+F*9||1;
    $('fpOut').innerHTML=`<div class="fpk num"><b>${Math.round(K)}</b><span>kcal</span></div><div class="fpm num"><span><b>${r1(P)}</b> g protein</span><span><b>${r1(Cc)}</b> g carbs</span><span><b>${r1(F)}</b> g fat</span></div><div class="fpbar"><i style="flex:${P*4/tot};background:var(--pink)"></i><i style="flex:${Cc*4/tot};background:var(--cyan)"></i><i style="flex:${F*9/tot};background:#ffb000"></i></div><div class="dim" style="font-size:11px;margin-top:6px">${Math.round(g)} g · fibre ${r1((+f.fi||0)*g/100)} g · sugar ${r1((+f.su||0)*g/100)} g · sodium ${Math.round((+f.na||0)*g/100)} mg</div>`};
  openSheet(ent?'edit food':'add food',`${f.img?`<img class="fpimg" src="${esc(f.img)}" alt="">`:''}<b style="font-size:17px">${esc(f.n)}</b>${f.b?`<div class="dim">${esc(f.b)}</div>`:''}
    <div class="row" style="gap:8px;margin:12px 0"><input class="inp num" id="fpQ" value="${r1(q)}" inputmode="decimal" style="width:90px;text-align:center"><select class="inp" id="fpU" style="flex:1">${sv.map(s=>`<option value="${esc(s[0])}" ${s[0]===u?'selected':''}>${esc(s[0]==='g'?'grams':s[0]+(s[1]!==100||s[0]!=='100 g'?` (${r1(s[1])} g)`:''))}</option>`).join('')}</select></div>
    <div id="fpOut"></div>
    <div class="seg mini" id="fpMeal" style="margin-top:12px">${FMEALS.map(([k,l])=>`<button type="button" data-fpm="${k}" aria-pressed="${k===m}">${l}</button>`).join('')}</div>
    <div class="bigbtns" style="margin-top:14px">${ent?'<button class="btn d" type="button" id="fpDel">delete</button>':''}<button class="iconbtn" type="button" id="fpFav">${FLIB.fav[f.fid||f.id]?'★ favourite':'☆ favourite'}</button><span style="flex:1"></span><button class="btn p" type="button" id="fpOk">${ent?'save':'add'}</button></div>`);
  draw();const sb=$('sheetBody');
  sb.oninput=e=>{if(e.target.id==='fpQ'){q=parseFloat(e.target.value.replace(',','.'))||0;draw()}};
  sb.onchange=e=>{if(e.target.id==='fpU'){const old=gr();u=e.target.value;const s=sv.find(z=>z[0]===u);q=u==='g'?Math.round(old):r1(old/s[1])||1;$('fpQ').value=q;draw()}};
  sb.onclick=e=>{const b=e.target.closest('button');if(!b)return;
    if(b.dataset.fpm){m=b.dataset.fpm;sb.querySelectorAll('[data-fpm]').forEach(z=>z.setAttribute('aria-pressed',z===b));return}
    if(b.id==='fpFav'){const id=f.fid||f.id;FLIB.fav[id]=!FLIB.fav[id];if(!FLIB.fav[id])delete FLIB.fav[id];b.textContent=FLIB.fav[id]?'★ favourite':'☆ favourite';fRemember(f);saveLib();return}
    if(b.id==='fpDel'){const x=fDay(FD);x.m[meal].splice(idx,1);saveDay(FD);closeSheet();fLog();return}
    if(b.id==='fpOk'){const x=fDay(FD);const e2={id:ent?f.id:rid(),fid:f.fid||f.id,n:f.n,b:f.b||'',k:f.k,p:f.p,c:f.c,f:f.f,fi:f.fi||0,su:f.su||0,na:f.na||0,sv:f.sv,img:f.img||'',code:f.code||'',src:f.src||'',q,u,g:gr(),t:new Date().toISOString()};
      if(ent){x.m[meal].splice(idx,1)}x.m[m]=(x.m[m]||[]);if(ent&&m===meal)x.m[m].splice(idx,0,e2);else x.m[m].push(e2);
      fRemember(f);saveLib();saveDay(FD);closeSheet();fLog()}}}
function fRemember(f){const id=f.fid||f.id;const keep={id,n:f.n,b:f.b||'',k:f.k,p:f.p,c:f.c,f:f.f,fi:f.fi||0,su:f.su||0,na:f.na||0,sv:f.sv,img:f.img||'',code:f.code||'',src:f.src||''};
  const i=FLIB.recent.findIndex(z=>z.id===id);const cnt=i>=0?(FLIB.recent[i].cnt||0)+1:1;if(i>=0)FLIB.recent.splice(i,1);FLIB.recent.unshift({...keep,cnt,last:new Date().toISOString()});FLIB.recent=FLIB.recent.slice(0,150)}
function fQuickAdd(meal,idx){const x=fDay(FD);const e=idx!=null?x.m[meal][idx]:{qk:'',qp:'',qc:'',qf:'',n:'quick add'};
  openSheet('quick add',`<label class="fl">name<input class="inp" id="qaN" value="${esc(e.n||'quick add')}"></label><div class="fgrid4"><label class="fl">kcal<input class="inp num" id="qaK" inputmode="decimal" value="${e.qk||''}"></label><label class="fl">protein g<input class="inp num" id="qaP" inputmode="decimal" value="${e.qp||''}"></label><label class="fl">carbs g<input class="inp num" id="qaC" inputmode="decimal" value="${e.qc||''}"></label><label class="fl">fat g<input class="inp num" id="qaF" inputmode="decimal" value="${e.qf||''}"></label></div>
  <div class="dim" style="font-size:11px">Leave kcal empty and it's worked out from the macros.</div><div class="bigbtns" style="margin-top:12px">${idx!=null?'<button class="btn d" type="button" id="qaDel">delete</button>':''}<span style="flex:1"></span><button class="btn p" type="button" id="qaOk">${idx!=null?'save':'add'}</button></div>`);
  $('qaK').focus();
  if($('qaDel'))$('qaDel').onclick=()=>{x.m[meal].splice(idx,1);saveDay(FD);closeSheet();fLog()};
  $('qaOk').onclick=()=>{const P=+$('qaP').value||0,C=+$('qaC').value||0,F=+$('qaF').value||0;let K=+$('qaK').value;if(!K)K=Math.round(P*4+C*4+F*9);if(!K)return;
    const ne={id:e.id||rid(),quick:1,n:$('qaN').value.trim()||'quick add',qk:K,qp:P,qc:C,qf:F,t:new Date().toISOString()};if(idx!=null)x.m[meal][idx]=ne;else(x.m[meal]=x.m[meal]||[]).push(ne);saveDay(FD);closeSheet();fLog()}}
function fCreate(meal,pre={}){openSheet('create food',`<label class="fl">name<input class="inp" id="cfN" value="${esc(pre.n||'')}"></label><label class="fl">brand (optional)<input class="inp" id="cfB" value="${esc(pre.b||'')}"></label>
  <div class="fgrid4"><label class="fl">serving name<input class="inp" id="cfS" value="${esc(pre.sn||'serving')}"></label><label class="fl">serving size g<input class="inp num" id="cfG" inputmode="decimal" value="${pre.sg||100}"></label></div>
  <div class="dim" style="font-size:11px;margin:4px 0 6px">nutrition per serving — copy it straight off the label</div>
  <div class="fgrid4">${[['K','kcal'],['P','protein g'],['C','carbs g'],['F','fat g'],['Fi','fibre g'],['Su','sugar g'],['Na','sodium mg']].map(([k,l])=>`<label class="fl">${l}<input class="inp num" id="cf${k}" inputmode="decimal"></label>`).join('')}</div>
  <div class="row" style="gap:10px;align-items:center;margin-top:10px"><button class="iconbtn" type="button" id="cfPicB">📷 add photo</button><input type="file" id="cfPic" accept="image/*" hidden><img id="cfPrev" alt="" style="width:52px;height:52px;object-fit:cover;border:1px solid var(--line2);display:none"></div>
  <div class="bigbtns" style="margin-top:12px"><span style="flex:1"></span><button class="btn p" type="button" id="cfOk">save + add</button></div>`);
  /* a photo for the food: taken or picked, shrunk to a thumbnail so the library stays light */
  let cfImg=pre.img||'';if(cfImg){$('cfPrev').src=cfImg;$('cfPrev').style.display='block'}
  $('cfPicB').onclick=()=>$('cfPic').click();
  $('cfPic').onchange=e=>{const fl=e.target.files&&e.target.files[0];if(!fl)return;const im=new Image();
    im.onload=()=>{const m=176,k=Math.min(1,m/Math.max(im.width,im.height)),cv=document.createElement('canvas');cv.width=Math.round(im.width*k);cv.height=Math.round(im.height*k);
      cv.getContext('2d').drawImage(im,0,0,cv.width,cv.height);cfImg=cv.toDataURL('image/jpeg',.68);URL.revokeObjectURL(im.src);
      $('cfPrev').src=cfImg;$('cfPrev').style.display='block';$('cfPicB').textContent='📷 retake'};
    im.src=URL.createObjectURL(fl)};
  $('cfOk').onclick=()=>{const n=$('cfN').value.trim();const g=+$('cfG').value||100;const v=k=>(+$('cf'+k).value||0)*100/g;if(!n||!$('cfK').value){$('cfN').focus();return}
    const f={id:'c-'+rid(),n,b:$('cfB').value.trim(),k:v('K'),p:v('P'),c:v('C'),f:v('F'),fi:v('Fi'),su:v('Su'),na:v('Na'),sv:[[$('cfS').value.trim()||'serving',g],['100 g',100]],code:pre.code||'',src:'mine',img:cfImg};
    FLIB.custom.unshift(f);saveLib();fPortion(f,{meal,isNew:true})}}

/* barcode: native BarcodeDetector where available, otherwise ZXing (loaded only when you scan) */
let fStream=null,fZX=null;
function fScanStop(){try{fZX&&fZX.reset()}catch(e){}fZX=null;if(fStream){fStream.getTracks().forEach(t=>t.stop());fStream=null}}
async function fScan(meal){openSheet('scan barcode',`<div class="fscan"><video id="fsV" playsinline muted></video><i class="fsline"></i></div><div class="dim" id="fsMsg" style="margin-top:8px">point the camera at the barcode…</div><div class="row" style="gap:8px;margin-top:8px"><input class="inp num" id="fsCode" placeholder="or type the barcode number" inputmode="numeric" style="flex:1"><button class="btn" type="button" id="fsGo">look up</button></div>`);
  const done=async code=>{fScanStop();$('fsMsg').textContent='looking up '+code+'…';const items=await offCall({code});const f=items&&items[0]?offToFood(items[0]):null;
    if(f){FCACHE[f.id]=f;fPortion(f,{meal,isNew:true})}else{$('fsMsg').innerHTML='Not in the database yet — <button class="iconbtn" type="button" id="fsNew">create it</button>';$('fsNew').onclick=()=>fCreate(meal,{code})}};
  $('fsGo').onclick=()=>{const c=$('fsCode').value.replace(/\D/g,'');if(c)done(c)};
  const obs=new MutationObserver(()=>{if(!$('fsV')){fScanStop();obs.disconnect()}});obs.observe($('sheetBody'),{childList:true});
  $('sheetX')&&$('sheetX').addEventListener('click',fScanStop,{once:true});
  try{const v=$('fsV');
    if('BarcodeDetector' in window){fStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});v.srcObject=fStream;await v.play();const det=new BarcodeDetector({formats:['ean_13','ean_8','upc_a','upc_e']});
      const loop=async()=>{if(!fStream||!$('fsV'))return;try{const r=await det.detect(v);if(r[0]){done(r[0].rawValue);return}}catch(e){}requestAnimationFrame(loop)};loop()}
    else{if(!window.ZXing)await new Promise((res,rej)=>{const s=document.createElement('script');s.src='vendor/zxing.min.js';s.onload=res;s.onerror=rej;document.head.appendChild(s)});
      const hints=new Map();hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS,[ZXing.BarcodeFormat.EAN_13,ZXing.BarcodeFormat.EAN_8,ZXing.BarcodeFormat.UPC_A,ZXing.BarcodeFormat.UPC_E]);
      fZX=new ZXing.BrowserMultiFormatReader(hints);fZX.decodeFromConstraints({video:{facingMode:'environment'}},'fsV',(res)=>{if(res&&fZX){const c=res.getText();done(c)}})}}
  catch(e){$('fsMsg').textContent='Camera unavailable — type the barcode number instead.'}}

function fExercise(){const kg=curKg();openSheet('add exercise',`<div class="fexl">${FEX.map(([n,met],i)=>`<button type="button" class="chip" data-fxp="${i}">${n}</button>`).join('')}</div>
  <div class="fgrid4" style="margin-top:10px"><label class="fl">activity<input class="inp" id="exN" value="weights / gym"></label><label class="fl">minutes<input class="inp num" id="exM" inputmode="numeric" value="60"></label><label class="fl">kcal burned<input class="inp num" id="exK" inputmode="numeric"></label></div>
  <div class="dim" style="font-size:11px">kcal is estimated from the activity, time and your weight (${r1(kg)} kg) — overwrite it if your watch says different.</div>
  <div class="bigbtns" style="margin-top:12px"><span style="flex:1"></span><button class="btn p" type="button" id="exOk">add</button></div>`);
  let met=5;const est=()=>{$('exK').value=Math.round(met*kg*(+$('exM').value||0)/60)};est();
  $('sheetBody').onclick=e=>{const b=e.target.closest('[data-fxp]');if(!b)return;const p=FEX[+b.dataset.fxp];met=p[1];$('exN').value=p[0];est()};
  $('exM').oninput=est;
  $('exOk').onclick=()=>{const x=fDay(FD);(x.ex=x.ex||[]).push({id:rid(),n:$('exN').value.trim()||'exercise',min:+$('exM').value||0,k:Math.round(+$('exK').value||0)});saveDay(FD);closeSheet();fLog()}}

/* ---------- progress: weight, calories, macros, streak, insights ---------- */
function fProgress(){const el=$('foodBody');const P=FPROF||{},B=fBudget(),T=fTargets();
  const ws=((typeof WT!=='undefined'&&WT.r)||[]).slice(-60);const startKg=+P.startKg||(ws[0]&&+ws[0].kg)||curKg(),goal=+P.goalKg||0,now=curKg();
  const days=[...Array(14)].map((_,i)=>{const d=new Date(DAYK+'T12:00');d.setDate(d.getDate()-13+i);const k=ymd(d);const it=FDAYS[k]?dayItems(k):[];const s=fSum(it);const ex=FDAYS[k]&&!(P.noEx)?exKcal(k):0;return {k,kcal:s.kcal,p:s.p,c:s.c,f:s.f,b:B+ex,has:it.length>0}});
  const wk=days.slice(-7),logged=wk.filter(d=>d.has);const wkEat=logged.reduce((a,d)=>a+d.kcal,0),wkBud=logged.reduce((a,d)=>a+d.b,0);
  let streak=0;for(let i=0;i<400;i++){const d=new Date(DAYK+'T12:00');d.setDate(d.getDate()-i);const k=ymd(d);if(FDAYS[k]&&dayItems(k).length)streak++;else if(i>0)break}
  const avg=k=>logged.length?logged.reduce((a,d)=>a+d[k],0)/logged.length:0;const ap=avg('p'),ac=avg('c'),af=avg('f'),tot=ap*4+ac*4+af*9||1;
  const mx=Math.max(...days.map(d=>Math.max(d.kcal,d.b)),1);
  const need=goal?now-goal:0,rate=Math.abs(+P.rate||0);const eta=goal&&rate&&Math.sign(need)===Math.sign(-(+P.rate))?new Date(Date.now()+Math.abs(need)/rate*7*864e5):null;
  const top={};Object.keys(FDAYS).filter(k=>k>ymd(new Date(Date.now()-30*864e5))).forEach(k=>dayItems(k).forEach(e=>{const n=e.n;top[n]=(top[n]||0)+fNum(e,'k')}));const tops=Object.entries(top).sort((a,b)=>b[1]-a[1]).slice(0,5);
  el.innerHTML=`<div class="statcards"><div class="panel"><div class="pb"><span class="dim">current</span><b class="num">${r1(now)} kg</b></div></div><div class="panel"><div class="pb"><span class="dim">${now<=startKg?'lost':'gained'}</span><b class="num ${now<=startKg?'ok':''}">${r1(Math.abs(startKg-now))} kg</b></div></div><div class="panel"><div class="pb"><span class="dim">goal</span><b class="num">${goal?r1(goal)+' kg':'—'}</b></div></div><div class="panel"><div class="pb"><span class="dim">logging streak</span><b class="num pink">${streak} 🔥</b></div></div></div>
  <div class="panel"><div class="ph"><span class="tag">weight</span><span class="dim">${eta?'on pace for goal ~'+eta.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}).toLowerCase():'log weight on today ↓'}</span></div><div class="pb">${typeof spark==='function'?spark(ws.map(x=>+x.kg),{refs:goal?[{v:goal,l:'goal'}]:[]}):''}
    <form class="row" id="fWt" style="gap:6px;margin-top:8px"><input class="inp num" id="fWtIn" inputmode="decimal" placeholder="weigh in (kg)" style="flex:1"><button class="btn p" type="submit">log</button></form></div></div>
  <div class="panel"><div class="ph"><span class="tag">calories · last 14 days</span><span class="dim num">this week ${logged.length?(wkEat<=wkBud?gbp0(wkBud-wkEat)+' under':gbp0(wkEat-wkBud)+' over'):'—'}</span></div><div class="pb"><div class="fbars">${days.map(d=>`<div class="${d.k===DAYK?'on':''}"><span class="b ${d.kcal>d.b?'over':''}" style="height:${d.kcal/mx*100}%"></span><i style="bottom:${d.b/mx*100}%"></i><span class="l">${new Date(d.k+'T12:00').toLocaleDateString('en-GB',{weekday:'narrow'})}</span></div>`).join('')}</div>
    <div class="dim" style="font-size:11px;margin-top:6px">dashed line = your budget that day (incl. exercise) · ${logged.length} of 7 days logged this week · ${Math.round(wkEat)} eaten of ${Math.round(wkBud)} budgeted</div></div></div>
  <div class="grid2"><div class="panel"><div class="ph"><span class="tag">macros · 7-day average</span></div><div class="pb fdonut"><svg viewBox="0 0 42 42">${(()=>{let o=25;return [[ap*4,'var(--pink)'],[ac*4,'var(--cyan)'],[af*9,'#ffb000']].map(([v,c])=>{const p=v/tot*100;const s=`<circle cx="21" cy="21" r="15.9" fill="none" stroke="${c}" stroke-width="5" stroke-dasharray="${p} ${100-p}" stroke-dashoffset="${o}"/>`;o-=p;return s}).join('')})()}</svg>
    <div class="num"><div><b style="color:var(--pink)">${Math.round(ap)} g</b> protein <span class="dim">/ ${T.p} · ${Math.round(ap*4/tot*100)}%</span></div><div><b style="color:var(--cyan)">${Math.round(ac)} g</b> carbs <span class="dim">/ ${T.c} · ${Math.round(ac*4/tot*100)}%</span></div><div><b style="color:#ffb000">${Math.round(af)} g</b> fat <span class="dim">/ ${T.f} · ${Math.round(af*9/tot*100)}%</span></div></div></div></div>
  <div class="panel"><div class="ph"><span class="tag">insights</span></div><div class="pb fins">${logged.length?[ap<T.p*0.9?`protein is averaging <b>${Math.round(ap)} g</b> — ${Math.round(T.p-ap)} g a day under your target`:`protein on target — averaging <b>${Math.round(ap)} g</b>`,`average day: <b>${Math.round(wkEat/Math.max(1,logged.length))} kcal</b> vs a <b>${B}</b> budget`,tops.length?`biggest calorie sources this month: ${tops.map(([n,k])=>`<b>${esc(n)}</b> (${Math.round(k)})`).join(', ')}`:''].filter(Boolean).map(t=>`<div>▸ ${t}</div>`).join(''):'<div class="dim">Log a few days and patterns show up here.</div>'}</div></div></div>`;
  $('fWt').onsubmit=e=>{e.preventDefault();const kg=parseFloat($('fWtIn').value.replace(',','.'));if(!kg)return;WT.r.push({t:new Date().toISOString(),kg});save('body/wt',WT);if(typeof renderBody==='function')renderBody();fProgress()}}
const gbp0=n=>Math.round(n)+' kcal';

/* ---------- fasting ---------- */
function fFast(){const el=$('foodBody');const P=FPROF||{};const H=+P.fastH||16;const c=FFAST.cur;const now=Date.now();
  const el_=c?(now-new Date(c.s))/36e5:0;const pct=Math.min(1,el_/(c?c.h:H));const R=86,C=2*Math.PI*R;
  const zone=h=>h<4?'fed — digesting':h<12?'early fast':h<16?'fat-burning window':h<24?'deep fast':'extended fast';
  el.innerHTML=`<div class="panel ffast"><div class="pb"><div class="fdring big"><svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="${R}" class="rb"/><circle cx="100" cy="100" r="${R}" class="rf" style="stroke-dasharray:${C};stroke-dashoffset:${C*(1-pct)}"/></svg><div><span class="dim">${c?'fasting':'not fasting'}</span><b class="num" id="ffT">${c?fmtH(el_):H+':00'}</b><span class="dim" id="ffZ">${c?zone(el_):'target'}</span></div></div>
    ${c?`<div class="dim num" style="text-align:center">started ${new Date(c.s).toLocaleString('en-GB',{weekday:'short',hour:'2-digit',minute:'2-digit'})} · goal ${c.h} h · ends ${new Date(new Date(c.s).getTime()+c.h*36e5).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</div>`:''}
    <div class="seg mini" id="ffH" style="justify-content:center;margin:12px 0">${[12,14,16,18,20,24].map(h=>`<button type="button" data-ffh="${h}" aria-pressed="${(c?c.h:H)===h}">${h===24?'OMAD':h+':'+(24-h)}</button>`).join('')}</div>
    <div class="bigbtns" style="justify-content:center"><button class="btn p" type="button" id="ffGo">${c?'end fast':'start fast'}</button>${c?'':'<button class="btn" type="button" id="ffBack">started earlier…</button>'}</div></div></div>
  <div class="panel"><div class="ph"><span class="tag">recent fasts</span><span class="dim">${FFAST.log.length} logged</span></div><div class="pb">${FFAST.log.slice(-10).reverse().map(f=>{const h=(new Date(f.e)-new Date(f.s))/36e5;return `<div class="frow" style="cursor:default"><span><b>${new Date(f.s).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}).toLowerCase()}</b><span class="dim">goal ${f.h} h</span></span><span class="num ${h>=f.h?'ok':''}">${fmtH(h)} ${h>=f.h?'✓':''}</span></div>`}).join('')||'<div class="dim">No fasts yet.</div>'}</div></div>`;
  el.onclick=e=>{const b=e.target.closest('button');if(!b)return;
    if(b.dataset.ffh){const h=+b.dataset.ffh;if(FFAST.cur){FFAST.cur.h=h;save('food/fast',FFAST)}else{FPROF={...(FPROF||{}),fastH:h};save('food/profile',FPROF)}fFast();return}
    if(b.id==='ffGo'){if(FFAST.cur){FFAST.log.push({...FFAST.cur,e:new Date().toISOString()});FFAST.log=FFAST.log.slice(-200);FFAST.cur=null}else FFAST.cur={s:new Date().toISOString(),h:H};save('food/fast',FFAST);if(FFAST.cur&&nOn('fast'))pushOne('fast',new Date(FFAST.cur.s).getTime()+FFAST.cur.h*36e5,'Fasting goal reached',FFAST.cur.h+' h complete. Break your fast when ready.','./#food');else pushCancel('fast');fFast();return}
    if(b.id==='ffBack'){const t=prompt('when did you start? (HH:MM)','20:00');if(!t||!/^\d{1,2}:\d{2}$/.test(t))return;const [hh,mm]=t.split(':').map(Number);const d=new Date();d.setHours(hh,mm,0,0);if(d>new Date())d.setDate(d.getDate()-1);FFAST.cur={s:d.toISOString(),h:H};save('food/fast',FFAST);fFast()}};
  clearInterval(fFast.t);if(c)fFast.t=setInterval(()=>{if(!$('ffT')||FV!=='fast'||!FFAST.cur){clearInterval(fFast.t);return}const h=(Date.now()-new Date(FFAST.cur.s))/36e5;$('ffT').textContent=fmtH(h);$('ffZ').textContent=zone(h)},1000)}
const fmtH=h=>{const s=Math.max(0,Math.floor(h*3600));return Math.floor(s/3600)+':'+pad(Math.floor(s%3600/60))+':'+pad(s%60)};

/* ---------- goals ---------- */
function fGoals(){const el=$('foodBody');const P={sex:'m',age:'',hcm:'',kg:curKg(),goalKg:'',rate:-0.5,act:1.375,mmode:'pct',mp:35,mc:35,mf:30,gp:'',gc:'',gf:'',water:2500,fib:30,na:2300,fastH:16,...(FPROF||{})};
  const sel=(id,opts,v)=>`<select class="inp" id="${id}">${opts.map(([k,l])=>`<option value="${k}" ${String(k)===String(v)?'selected':''}>${l}</option>`).join('')}</select>`;
  el.innerHTML=`${FPROF?'':'<div class="panel"><div class="pb"><b>set up your calorie budget</b><div class="dim">A few details and the app works out your daily budget and macros, the same way Lose It does.</div></div></div>'}
  <div class="grid2"><div class="panel"><div class="ph"><span class="tag">you</span></div><div class="pb fform">
    <label class="fl">sex${sel('gSex',[['m','male'],['f','female']],P.sex)}</label><label class="fl">age<input class="inp num" id="gAge" inputmode="numeric" value="${P.age}"></label>
    <label class="fl">height (cm)<input class="inp num" id="gH" inputmode="decimal" value="${P.hcm}"></label><label class="fl">current weight (kg)<input class="inp num" id="gKg" inputmode="decimal" value="${r1(P.kg)}"></label>
    <label class="fl">goal weight (kg)<input class="inp num" id="gGoal" inputmode="decimal" value="${P.goalKg}"></label><label class="fl">plan${sel('gRate',FRATE,P.rate)}</label>
    <label class="fl" style="grid-column:1/-1">activity (outside logged exercise)${sel('gAct',FACT,P.act)}</label>
    <label class="fl" style="grid-column:1/-1"><span><input type="checkbox" id="gNoEx" ${P.noEx?'':'checked'}> add logged exercise calories back to my budget</span></label></div></div>
  <div class="panel"><div class="ph"><span class="tag">daily budget</span></div><div class="pb"><div class="fdbig num" id="gOut"></div>
    <label class="fl">override budget (optional)<input class="inp num" id="gOv" inputmode="numeric" value="${P.override||''}" placeholder="auto"></label>
    <div class="seg mini" id="gMode" style="margin:10px 0">${[['pct','macro %'],['g','macro grams']].map(([k,l])=>`<button type="button" data-gm="${k}" aria-pressed="${P.mmode===k}">${l}</button>`).join('')}</div>
    <div class="fgrid4" id="gMac"></div>
    <div class="fgrid4" style="margin-top:6px"><label class="fl">water ml<input class="inp num" id="gW" value="${P.water}"></label><label class="fl">fibre g<input class="inp num" id="gFi" value="${P.fib}"></label><label class="fl">sodium mg<input class="inp num" id="gNa" value="${P.na}"></label></div>
    <div class="bigbtns" style="margin-top:12px"><span style="flex:1"></span><button class="btn p" type="button" id="gSave">save goals</button></div></div></div></div>`;
  let mode=P.mmode;const macHtml=()=>{$('gMac').innerHTML=mode==='pct'?`<label class="fl">protein %<input class="inp num" id="gMp" value="${P.mp}"></label><label class="fl">carbs %<input class="inp num" id="gMc" value="${P.mc}"></label><label class="fl">fat %<input class="inp num" id="gMf" value="${P.mf}"></label>`:`<label class="fl">protein g<input class="inp num" id="gGp" value="${P.gp||fTargets().p}"></label><label class="fl">carbs g<input class="inp num" id="gGc" value="${P.gc||fTargets().c}"></label><label class="fl">fat g<input class="inp num" id="gGf" value="${P.gf||fTargets().f}"></label>`};macHtml();
  const read=()=>{const v=id=>$(id)?$(id).value:'';const n={...P,sex:v('gSex'),age:+v('gAge')||'',hcm:+v('gH')||'',kg:+v('gKg')||P.kg,goalKg:+v('gGoal')||'',rate:+v('gRate'),act:+v('gAct'),noEx:!$('gNoEx').checked,override:+v('gOv')||null,mmode:mode,water:+v('gW')||2500,fib:+v('gFi')||30,na:+v('gNa')||2300};
    if(mode==='pct'){n.mp=+v('gMp')||35;n.mc=+v('gMc')||35;n.mf=+v('gMf')||30}else{n.gp=+v('gGp')||0;n.gc=+v('gGc')||0;n.gf=+v('gGf')||0}if(!n.startKg)n.startKg=n.kg;return n};
  const show=()=>{const keep=FPROF;FPROF=read();const b=fBudget(),t=fTargets();FPROF=keep;const sum=mode==='pct'?(+$('gMp').value||0)+(+$('gMc').value||0)+(+$('gMf').value||0):100;
    $('gOut').innerHTML=`<b>${b}</b><span> kcal / day</span><div class="dim" style="font-size:12px">protein ${t.p} g · carbs ${t.c} g · fat ${t.f} g${sum!==100?` · <span class="bad">macros add to ${sum}%</span>`:''}</div>`};show();
  el.oninput=show;el.onchange=show;
  el.onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.gm){mode=b.dataset.gm;el.querySelectorAll('[data-gm]').forEach(z=>z.setAttribute('aria-pressed',z===b));macHtml();show();return}
    if(b.id==='gSave'){const n=read();if(!n.age||!n.hcm){(!n.age?$('gAge'):$('gH')).focus();return}const kgChanged=Math.abs(n.kg-curKg())>0.05;FPROF=n;save('food/profile',FPROF);
      if(kgChanged&&typeof WT!=='undefined'){WT.r.push({t:new Date().toISOString(),kg:n.kg});save('body/wt',WT)}FV='log';LS.set('foodv',FV);renderFood()}}}
