/* ================= STACK ================= */
const STC=Object.fromEntries(STACK_CATS.map((c,i)=>[c,['#ff2a6d','#ffb000','#57f5a8','#05d9e8','#b18cff','#7a7a7a'][i]||'#7a7a7a']));
const STATUSL={active:'in plan',asneeded:'as needed',paused:'paused',notinplan:'not in plan'};
let stF='active',catF=null,sortK='monthly',sortD=-1;
/* focus group: a cross-cutting chip for everything that supports one goal. its name and the private part of its
   word list come from sys/lex (w.fx, fxk); the generic support compounds below are just the public fallback. */
const FXK_BASE=['tyrosine','zinc','magnesium','bromantane','memantine','theanine','citicoline','cdp choline','alpha gpc','alcar','acetyl l carnitine','nac','omega','fish oil','iron','vitamin d','caffeine','rhodiola','ginkgo','saffron','lions mane','uridine','phosphatidylserine','guanfacine','modafinil','astaxanthin','astax','nebivolol','taurine','9 me bc','9mebc','mexidol','lemborexant','nacet','n acetylcysteine ethyl','adhd','medikinet','vyvanse','elvanse','ritalin','methylphenidate','lisdexamfetamine'];
const fxN=x=>' '+norm(x).replace(/[^a-z0-9]+/g,' ').trim()+' ';
const fxMatch=s=>{const n=fxN(s.name),c=n.replace(/ /g,'');return [...new Set(FXK_BASE.concat(LX('fxk',[])))].some(k=>{const t=fxN(k);return t.length<=6?n.includes(t):c.includes(t.replace(/ /g,''))})};
/* sleep group: same idea, for anything that aids sleep. extra private names come from sys/lex (slk). */
const SLK_BASE=['melatonin','glycine','magnesium','theanine','lemborexant','apigenin','ashwagandha','gaba','valerian','tryptophan','5 htp','5htp','inositol','taurine','passionflower','lemon balm','magnolia','cbd','cbn','trazodone','doxylamine','diphenhydramine','mirtazapine','zopiclone','zolpidem','daridorexant','suvorexant','ramelteon','hydroxyzine','tart cherry','montmorency','kava','chamomile','lavender','sleep'];
const slMatch=s=>{const n=fxN(s.name),c=n.replace(/ /g,'');return [...new Set(SLK_BASE.concat(LX('slk',[])))].some(k=>{const t=fxN(k);return t.length<=6?n.includes(t):c.includes(t.replace(/ /g,''))})};
const stFilter=k=>s=>k==='all'||(k==='fx'?fxMatch(s):k==='sl'?slMatch(s):k==='inb'?s.inb:k==='opt'?!s.inb:k==='edited'?s.edited:s.status===k);
function renderStack(){
  const st=M.stack;const c=s=>st.filter(x=>x.status===s).length;
  $('stackSub').textContent=`${st.length} ${LW('items','items')}`;
  $('stackKv').innerHTML=[['budget',gbp(M.stackBudget,2),'/month · in budget = Yes'],['live budget',gbp(M.liveBudget,2),'/month · minus paused in v2'],['optional',gbp(M.stackOpt,2),'/month · in budget = No'],['in plan',String(c('active')),`${c('asneeded')} as needed · ${c('paused')} paused`]]
    .map(([k,v,s],i)=>`<div class="panel"><div class="ph"><span class="tag">${k}</span></div><div class="pb"><span class="v num ${i===1?'pink':''}" data-scr="${esc(v)}">${v}</span></div></div>`).join('');
  const pb=st.filter(s=>s.inb&&s.status==='paused'&&s.monthly>0);
  $('stackWarn').innerHTML='';
  const sts=[['all','all'],['active','in plan'],['asneeded','as needed'],['paused','paused'],['notinplan','not in plan'],['inb','in budget'],['opt','optional'],['fx',LW('fx','ADHD')],['sl',LW('sl','sleep')]];
  $('stChips').innerHTML=sts.map(([k,l])=>`<button class="chip" type="button" data-s="${k}" aria-pressed="${stF===k}">${l}<span class="c">${st.filter(stFilter(k)).length}</span></button>`).join('');
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
  ${s.monthly&&M.rate?`<div class="sect"><span class="tag">Costs you</span><span style="font-size:22px;font-weight:800" class="num">${(s.monthly/M.rate).toFixed(1)} h</span> <span class="dim">of work a month</span></div>`:''}`;
  $('drawer').classList.add('on');$('drawer').setAttribute('aria-hidden','false');$('scrim').classList.add('on');$('dClose').onclick=closeDrawer;$('dEdit').onclick=()=>editStack(s);$('dSt').onclick=e=>{const b=e.target.closest('[data-dst]');if(!b)return;setStackStatus(s.name,b.dataset.dst);openDrawer(key)};$('dClose').focus();
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
