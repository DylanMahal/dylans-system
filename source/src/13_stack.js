/* ================= STACK ================= */
const STC=Object.fromEntries(STACK_CATS.map((c,i)=>[c,['#ff2a6d','#ffb000','#57f5a8','#05d9e8','#b18cff','#7a7a7a'][i]||'#7a7a7a']));
const STATUSL={active:'in plan',asneeded:'as needed',paused:'paused',notinplan:'not in plan'};
let stF='active',catF=null,sortK='monthly',sortD=-1;
/* focus group: a cross-cutting chip for everything that supports one goal. its name and its whole word list
   come from the private sys/lex (w.fx, fxk); nothing about what is in it lives in this public code. */
const FXK_BASE=[];
const fxN=x=>' '+norm(x).replace(/[^a-z0-9]+/g,' ').trim()+' ';
const fxAuto=s=>{const n=fxN(s.name),c=n.replace(/ /g,'');return [...new Set(FXK_BASE.concat(LX('fxk',[])))].some(k=>{const t=fxN(k);return t.length<=6?n.includes(t):c.includes(t.replace(/ /g,''))})};
/* second group: same idea; its word list is sys/lex slk. */
const SLK_BASE=[];
const slAuto=s=>{const n=fxN(s.name),c=n.replace(/ /g,'');return [...new Set(SLK_BASE.concat(LX('slk',[])))].some(k=>{const t=fxN(k);return t.length<=6?n.includes(t):c.includes(t.replace(/ /g,''))})};
/* hand edits on top of the keyword match: stack/groups = {fx:{in:[name], out:[name]}, sl:{…}} */
let STG={fx:{in:[],out:[]},sl:{in:[],out:[]}};
load('stack/groups').then(d=>{if(d)STG={fx:{in:[],out:[]},sl:{in:[],out:[]},...d};if(cur==='stack'&&typeof renderStack==='function')renderStack()}).catch(()=>{});
watch('stack/groups',d=>{if(d){STG={fx:{in:[],out:[]},sl:{in:[],out:[]},...d};if(cur==='stack'&&typeof renderStack==='function')renderStack()}});
const stgHas=(g,s)=>{const G=STG[g]||{},n=norm(s.name);if((G.out||[]).some(x=>norm(x)===n))return false;if((G.in||[]).some(x=>norm(x)===n))return true;return g==='fx'?fxAuto(s):slAuto(s)};
const fxMatch=s=>stgHas('fx',s),slMatch=s=>stgHas('sl',s);
function stgEdit(g){const all=((typeof M!=='undefined'&&M&&M.stack)||[]).slice().sort((a,b)=>a.name.localeCompare(b.name));const lab=g==='fx'?LW('fx','Focus'):LW('sl','sleep');
  openSheet('Edit '+lab+' group',`<div class="dim" style="font-size:12.5px;margin-bottom:10px">Tick what belongs in this group.</div><div class="stg-l">${all.map((s,i)=>`<label class="stg-i"><input type="checkbox" data-gi="${i}"${stgHas(g,s)?' checked':''}><span>${esc(s.name)}</span></label>`).join('')}</div><div class="bigbtns" style="margin-top:12px"><span style="flex:1"></span><button class="btn p" type="button" id="stgOk">Save</button></div>`);
  $('stgOk').onclick=()=>{const G={in:[],out:[]};document.querySelectorAll('#sheetBody [data-gi]').forEach(c=>{const s=all[+c.dataset.gi];const auto=g==='fx'?fxAuto(s):slAuto(s);if(c.checked&&!auto)G.in.push(s.name);if(!c.checked&&auto)G.out.push(s.name)});STG[g]=G;save('stack/groups',STG);closeSheet();renderStack()}}
document.addEventListener('click',e=>{const b=e.target.closest('[data-stg]');if(b)stgEdit(b.dataset.stg)});
const stFilter=k=>s=>k==='all'||(k==='fx'?fxMatch(s):k==='sl'?slMatch(s):k==='inb'?s.inb:k==='opt'?!s.inb:k==='edited'?s.edited:s.status===k);
function renderStack(){
  const st=M.stack;const c=s=>st.filter(x=>x.status===s).length;
  $('stackSub').textContent=`${st.length} ${LW('items','items')}`;
  $('stackKv').innerHTML=[['budget',gbp(M.stackBudget,2),'/month · in budget = Yes'],['live budget',gbp(M.liveBudget,2),'/month · minus paused in v2'],['optional',gbp(M.stackOpt,2),'/month · in budget = No'],['in plan',String(c('active')),`${c('asneeded')} as needed · ${c('paused')} paused`]]
    .map(([k,v,s],i)=>`<div class="panel"><div class="ph"><span class="tag">${k}</span></div><div class="pb"><span class="v num ${i===1?'pink':''}" data-scr="${esc(v)}">${v}</span></div></div>`).join('');
  const pb=st.filter(s=>s.inb&&s.status==='paused'&&s.monthly>0);
  $('stackWarn').innerHTML='';
  const sts=[['all','all'],['active','in plan'],['asneeded','as needed'],['paused','paused'],['notinplan','not in plan'],['inb','in budget'],['opt','optional'],['fx',LW('fx','Focus')],['sl',LW('sl','sleep')]];
  $('stChips').innerHTML=sts.map(([k,l])=>`<button class="chip" type="button" data-s="${k}" aria-pressed="${stF===k}">${l}<span class="c">${st.filter(stFilter(k)).length}</span></button>`).join('')+(stF==='fx'||stF==='sl'?`<button class="chip" type="button" data-stg="${stF}">✎ Edit group</button>`:'');
  $('catChips').innerHTML=STACK_CATS.map(cc=>`<button class="chip" type="button" data-c="${esc(cc)}" aria-pressed="${catF===cc}"><i style="background:${STC[cc]}"></i>${esc(cc.split(' / ')[0].toLowerCase())}<span class="c">${st.filter(s=>s.cat===cc).length}</span></button>`).join('');
  renderStackTbl();
}
function renderStackTbl(){
  const q=norm($('q').value);
  let rows=M.stack.filter(stFilter(stF)).filter(s=>!catF||s.cat===catF).filter(s=>!q||[s.name,s.dose,s.route,s.sched,s.notes,s.src,s.cat].some(x=>norm(x).includes(q)));
  rows.sort((a,b)=>sortK==='name'?a.name.localeCompare(b.name)*sortD:((a[sortK]||0)-(b[sortK]||0))*sortD||a.name.localeCompare(b.name));
  const ar=k=>sortK===k?(sortD<0?' ↓':' ↑'):'';
  $('stackTbl').innerHTML=`<div class="tr hd"><button type="button" data-sort="name">name${ar('name')}</button><span class="dd2">Dose · route</span><span class="dd2">Schedule · when</span><button type="button" data-sort="monthly" style="text-align:right">£/month${ar('monthly')}</button><span style="text-align:right">Status</span></div>`+
  (rows.length?rows.map(s=>`<div class="tr ${s.status}" role="button" tabindex="0" data-k="${esc(s.key)}"><span class="nm"><i style="background:${STC[s.cat]||'#7a7a7a'}"></i><span>${esc(s.name)}</span>${s.edited?'<span class="delta">Δ</span>':''}${s.cau.length?'<span class="warn" title="Has cautions">⚠︎</span>':''}</span><span class="ds dd2">${esc([s.dose,s.route].filter(x=>x&&x!=='—').join(' · '))}</span><span class="ds dd2">${esc([s.sched&&s.sched!=='—'?s.sched:null,s.times.length?'@ '+s.times.join(', '):null].filter(Boolean).join(' '))}</span><span class="co num">${s.monthly?gbp(s.monthly,2):(s.price==='owned'?'<span class="dim">Owned</span>':'<span class="dim">—</span>')}</span><span class="row" style="justify-content:flex-end;gap:6px"><button class="ed" type="button" data-sed="${esc(s.key)}">✎</button><span class="st ${s.status}">${STATUSL[s.status]}</span></span></div>`).join(''):`<div class="tr hd" style="color:var(--dim)">no match for "${esc(q)}"</div>`);
}
$('stChips').onclick=e=>{const b=e.target.closest('.chip');if(!b)return;stF=b.dataset.s;renderStack();glitchAll()};
$('catChips').onclick=e=>{const b=e.target.closest('.chip');if(!b)return;catF=catF===b.dataset.c?null:b.dataset.c;renderStack();glitchAll()};
$('q').oninput=renderStackTbl;$('addCmp').onclick=addStack;
$('stackTbl').onclick=e=>{const h=e.target.closest('[data-sort]');if(h){const k=h.dataset.sort;if(sortK===k)sortD*=-1;else{sortK=k;sortD=k==='name'?1:-1}renderStackTbl();return}
  const ed=e.target.closest('[data-sed]');if(ed){e.stopPropagation();editStack(M.stack.find(x=>x.key===ed.dataset.sed));return}
  const r=e.target.closest('.tr[data-k]');if(r)openDrawer(r.dataset.k)};
$('stackTbl').onkeydown=e=>{if(e.key==='Enter'&&e.target.dataset.k)openDrawer(e.target.dataset.k)};
function openDrawer(key){
  const s=M.stack.find(x=>x.key===key);if(!s)return;
  const row=(k,v)=>v!==null&&v!==undefined&&v!==''&&v!=='—'?`<dt>${k}</dt><dd>${esc(v)}</dd>`:'';
  const wk=s.monthly?s.monthly*12/52:0;
  $('drawer').innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center"><span class="tag" style="color:${STC[s.cat]||'#7a7a7a'}">${esc(s.cat||'')}</span><span class="row"><button class="btn p" type="button" id="dEdit">Edit</button><button class="iconbtn" type="button" id="dClose">esc ✕</button></span></div>
  <h3 class="glitch" data-text="${esc(s.name)}">${esc(s.name)}</h3>
  <div class="chips" id="dSt" style="margin:0 0 6px">${['active','asneeded','paused','notinplan'].map(x=>`<button class="chip" type="button" data-dst="${x}" aria-pressed="${s.status===x}">${STATUSL[x]}</button>`).join('')}</div><span class="dim" style="display:block;font-size:11px;margin-bottom:14px">${s.inb?'in budget':'optional'}${s.edited?' · edited':''}</span>
  <dl>${row('dose',s.dose)}${row('route',s.route)}${row('schedule',s.sched)}${row('taken at',s.times.join(', '))}${row('source',s.src)}${row('pack price',isNum(s.price)?gbp(s.price,2):s.price)}${row('units / pack',s.units)}${row('used / week',s.perweek)}${row('weekly',wk?gbp(wk,2):'')}${row('monthly',s.monthly?gbp(s.monthly,2):'')}${row('yearly',s.monthly?gbp(s.monthly*12,0):'')}</dl>
  ${s.notes?`<div class="sect"><span class="tag">Notes</span>${esc(s.notes)}</div>`:''}
  ${s.cau.length?`<div class="sect"><span class="tag">Interactions & cautions · from your plan</span>${s.cau.map(c=>`<div class="ca">${esc(c)}</div>`).join('')}</div>`:''}
  ${trialBox(s)}
  ${s.monthly&&M.rate?`<div class="sect"><span class="tag">Costs you</span><span style="font-size:22px;font-weight:800" class="num">${(s.monthly/M.rate).toFixed(1)} h</span> <span class="dim">of work a month</span></div>`:''}`;
  $('drawer').classList.add('on');$('drawer').setAttribute('aria-hidden','false');$('scrim').classList.add('on');$('dClose').onclick=closeDrawer;$('dEdit').onclick=()=>editStack(s);$('dSt').onclick=e=>{const b=e.target.closest('[data-dst]');if(!b)return;setStackStatus(s.name,b.dataset.dst);openDrawer(key)};$('dClose').focus();
  const tb=$('dTrialBox');if(tb){tb.onchange=e=>{const f=e.target.dataset.trf;if(f){stdSet(s.name,f,e.target.value);openDrawer(key)}};tb.onclick=e=>{if(e.target.closest('#dTrRev')){stdSet(s.name,'reviewed',DAYK);openDrawer(key);if(typeof renderTodayNudges==='function')renderTodayNudges()}}}
  if(stdOf(s.name).start)trialHtml(s).then(h=>{const el=$('dTrial');if(el)el.innerHTML=h}).catch(e=>console.warn(e));
}
function closeDrawer(){$('drawer').classList.remove('on');$('drawer').setAttribute('aria-hidden','true');$('scrim').classList.remove('on')}
$('scrim').onclick=()=>{closeDrawer();closeSheet()};
function openPendDrawer(){
  const ent=Object.entries(EDITS.p);
  const where=k=>{const [a,b]=k.split(':');const sheet=SHEET_OF[a];return b==='n'?`${sheet} · new row`:a==='inc'?`${sheet} · income`:`${sheet} · row ${b}`};
  const label=(k,p)=>{if(k==='inc:')return 'income';return p.name||p.item||findName(k)||(p._was)||k};
  const what=p=>p._del?'delete row':p._new?'add row':Object.keys(p).filter(x=>x[0]!=='_').map(f=>f+' → '+(p[f]===true?'Yes':p[f]===false?'No':p[f]??'blank')).join(', ');
  const stTxt={live:'<b class="ok">● live</b> · your laptop is linked to Stack Budget.xlsx. Edits from any device go into Excel within about 30 seconds, and changes made in Excel show up here.',
    err:'<b class="bad">! problem</b> · '+esc(XLMSG),
    off:'<b>· laptop not linked right now</b>'+(XLMSG?' · '+esc(XLMSG):'')+' · edits are saved and show everywhere; they go into Excel as soon as the laptop is on and the sync agent is running.'}[XLSTATE]||'';
  $('drawer').innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center"><span class="tag pink">Excel sync</span><button class="iconbtn" type="button" id="dClose">esc ✕</button></div>
  <h3>${ent.length?ent.length+' edit'+(ent.length===1?'':'s')+' queued':'all synced'}</h3>
  <p style="font-size:12px;margin:0 0 10px;line-height:1.6">${stTxt}</p>
  <p class="dim" style="font-size:12px;margin:0 0 14px">Sheet data from ${esc(GMETA.src==='excel'?'Excel':'the build snapshot')} · ${esc(ago(GMETA.at)||'—')}</p>
  <ul class="pl">${ent.map(([k,p])=>`<li><span><b>${esc(label(k,p))}</b></span><button class="iconbtn" type="button" data-undo="${esc(k)}">Undo</button><span class="s">${esc(where(k))} · ${esc(what(p))}${p._err?`<br><span class="bad">${esc(p._err)}</span>`:''}${p._lost?'<br><span class="bad">This row was removed or renamed in Excel, so the edit has nowhere to go. Undo it or redo it on the new row.</span>':''}</span>${p._err?`<button class="iconbtn" type="button" data-retry="${esc(k)}">Retry</button>`:''}</li>`).join('')}</ul>`;
  $('drawer').classList.add('on');$('drawer').setAttribute('aria-hidden','false');$('scrim').classList.add('on');$('dClose').onclick=closeDrawer;
  $('drawer').querySelectorAll('[data-undo]').forEach(b=>b.onclick=()=>{dropPatch(b.dataset.undo);openPendDrawer()});
  $('drawer').querySelectorAll('[data-retry]').forEach(b=>b.onclick=()=>{const p=EDITS.p[b.dataset.retry];if(p){delete p._err;EDITS.p[b.dataset.retry]={...p,_retry:Date.now()};saveEdits();lastOpsJson='';publishOps();openPendDrawer()}});
}
function findName(k){const [a,b]=k.split(':');const row=+b;if(a==='wd'||a==='we'){const P=D[a==='wd'?'weekday':'weekend'];for(const bl of P.blocks)for(const i of bl.items)if(i.row===row)return i.item}
  if(a==='wx'||a==='ex'){const P=D[a==='wx'?'weekday':'weekend'];for(const rows of Object.values(P.extra))for(const r of rows)if(r.row===row)return r.cells[1]}
  if(a==='xp'){const e=D.expenses.find(x=>x.row===row);return e&&e.name}return null}


/* status lives in the app now (not the Excel plan): tap a status in an item's panel to change it */
let STOVR={map:{}};
async function loadStackStatus(){const d=await load('stack/status');STOVR={map:{},...(d||{})};
  if(!STOVR.v&&(M.stack||[]).length){/* first run: anything sitting "paused" but still counted in budget becomes "not in plan" */
    (M.stack||[]).filter(s=>s.status==='paused'&&s.inb).forEach(s=>STOVR.map[norm(s.name)]='notinplan');STOVR.v=1;save('stack/status',STOVR)}
  rebuild()}
function setStackStatus(name,st){STOVR.map[norm(name)]=st;save('stack/status',STOVR);rebuild()}
watch('stack/status',d=>{if(d){STOVR={map:{},...d};rebuild()}});

/* ---- personal trial: a start and a review date per item, and sleep / mood / recovery before vs since ---- */
let STD={map:{}};load('stack/dates').then(d=>{if(d)STD={map:{},...d}}).catch(()=>{});watch('stack/dates',d=>{if(d)STD={map:{},...d}});
const stdOf=n=>STD.map[norm(n)]||{};
function stdSet(n,f,v){const k=norm(n);STD.map[k]={...(STD.map[k]||{}),[f]:v||null};if(f==='review')delete STD.map[k].reviewed;save('stack/dates',STD)}
function trialBox(s){const t=stdOf(s.name);const dn=t.start?Math.max(0,Math.round((new Date(DAYK+'T12:00')-new Date(t.start+'T12:00'))/864e5))+1:null;
  const rv=t.review?Math.round((new Date(t.review+'T12:00')-new Date(DAYK+'T12:00'))/864e5):null;
  return `<div class="sect" id="dTrialBox"><span class="tag">Personal trial</span>
    <div class="row trf" style="gap:8px;flex-wrap:wrap"><label class="dim">Started<input class="inp" type="date" data-trf="start" value="${esc(t.start||'')}"></label><label class="dim">Review on<input class="inp" type="date" data-trf="review" value="${esc(t.review||'')}"></label></div>
    ${t.start?`<div class="dim" style="font-size:12px;margin-top:6px">Day ${dn}${rv!=null?rv>0?` · review in ${rv} day${rv>1?'s':''}`:t.reviewed?' · reviewed '+esc(nice(t.reviewed)):' · <b style="color:#ffd60a">review due</b>':''}</div>`:'<div class="dim" style="font-size:12px;margin-top:6px">Set a start date to compare sleep, mood and recovery before and after.</div>'}
    ${t.review&&t.review<=DAYK&&!t.reviewed?'<button type="button" class="btn" id="dTrRev" style="margin-top:8px">Mark reviewed</button>':''}
    <div id="dTrial">${t.start?'<div class="dim" style="font-size:12px;margin-top:8px">Reading your data…</div>':''}</div></div>`}
let TRD=null,TRDT=0;
async function trialData(){if(TRD&&Date.now()-TRDT<6e4)return TRD;const q=p=>listDocs(p).catch(()=>[]);const [sl,md,hd,jr]=await Promise.all([q('sleep/w-'),q('mood/d-'),q('health/d-'),q('journal/e-')]);
  const day={};const D=k=>day[k]||(day[k]={});
  sl.forEach(r=>{const k=r.path.slice(8),n=r.data;if(!n)return;if(n.asleep)D(k).asleep=+n.asleep;try{const v=typeof sQ==='function'?sQ(n):null;if(v)D(k).sq=v}catch(e){}});
  md.forEach(r=>{const k=r.path.slice(7);const xs=((r.data&&r.data.in)||[]).filter(x=>x.m!=null);if(xs.length)D(k).mood=avg(xs.map(moodV));const es=xs.map(x=>+x.e).filter(Boolean);if(es.length)D(k).en=avg(es)});
  jr.forEach(r=>{const k=r.path.slice(10);if(r.data&&r.data.mood!=null&&!(day[k]&&day[k].mood!=null))D(k).mood=+r.data.mood});
  hd.forEach(r=>{const h=r.data||{},k=r.path.slice(9);if(+h.hrv)D(k).hrv=+h.hrv;if(+h.rhr)D(k).rhr=+h.rhr});
  TRD=day;TRDT=Date.now();return day}
const TRM=[['sq','Sleep score',v=>Math.round(v),1],['asleep','Time asleep',v=>Math.floor(v/60)+'h '+pad(Math.round(v%60))+'m',1],['mood','Mood',v=>v.toFixed(1),1],['en','Energy',v=>v.toFixed(1),1],['hrv','HRV',v=>Math.round(v)+' ms',1],['rhr','Resting HR',v=>Math.round(v)+' bpm',-1]];
async function trialHtml(s){const t=stdOf(s.name);if(!t.start)return '';const end=t.review&&t.review<DAYK?t.review:DAYK;const day=await trialData();const b0=addDays(t.start,-28);
  const pick=(a,b,f)=>Object.keys(day).filter(k=>k>=a&&k<b&&day[k][f]!=null).map(k=>day[k][f]);
  const rows=TRM.map(([f,l,fm,dir])=>{const B=pick(b0,t.start,f),A=pick(t.start,addDays(end,1),f);if(B.length<3||A.length<3)return null;const b=avg(B),a=avg(A),d=(a-b)/Math.abs(b||1)*100;const good=d*dir>0;
    return `<div><span>${l}<small>${B.length} vs ${A.length} days</small></span><b class="num">${fm(b)} → ${fm(a)} <em class="${Math.abs(d)<2?'eq':good?'up':'dn'}">${d>0?'+':''}${d.toFixed(0)}%</em></b></div>`}).filter(Boolean);
  return rows.length?`<div class="reclist trl" style="margin-top:10px">${rows.join('')}</div><div class="dim" style="font-size:11px;margin-top:6px">28 days before the start vs since. One person, no placebo: a nudge to look closer, not proof.</div>`:'<div class="dim" style="font-size:12px;margin-top:8px">Needs at least 3 days of sleep or mood data on each side of the start date.</div>'}
/* Today: trials due a review and protocols running low */
function extraNudges(){let h='';
  if(typeof M!=='undefined'&&M&&M.stack)Object.entries(STD.map).forEach(([k,t])=>{if(!t||!t.review||t.review>DAYK||t.reviewed)return;const s=M.stack.find(x=>norm(x.name)===k);if(!s)return;
    h+=`<button type="button" class="nx-card nx-row" data-trgo="${esc(s.key)}" style="display:flex;align-items:center;gap:12px;padding:12px 16px;border:0"><span class="nx-ic" style="background:#5e5ce6">✓</span><span style="flex:1;min-width:0"><span class="nx-t2">Review ${esc(s.name)}</span><span class="nx-xs" style="display:block">Trial review date reached · see before vs after</span></span><span class="nx-pill">Open</span></button>`});
  if(typeof PROTO!=='undefined'&&typeof invInfo==='function')PROTO.list.filter(c=>c.active).forEach(c=>{let i;try{i=invInfo(c)}catch(e){return}if(i.daysLeft==null||i.daysLeft>7)return;
    h+=`<button type="button" class="nx-card nx-row" data-lowgo="1" style="display:flex;align-items:center;gap:12px;padding:12px 16px;border:0"><span class="nx-ic" style="background:${i.daysLeft<=3?'#ff453a':'#ff9f0a'}">!</span><span style="flex:1;min-width:0"><span class="nx-t2">${esc(c.name)} running low</span><span class="nx-xs" style="display:block">${i.daysLeft} day${i.daysLeft===1?'':'s'} left at your current dose</span></span><span class="nx-pill">Restock</span></button>`});
  return h}
document.addEventListener('click',e=>{const t=e.target.closest('#todayNudges [data-trgo]'),l=e.target.closest('#todayNudges [data-lowgo]');
  if(t){const k=t.dataset.trgo;go('stack');setTimeout(()=>openDrawer(k),350)}if(l)go('stack/protocols')});
