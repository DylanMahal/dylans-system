/* ================= PROTOCOLS — item tracker ================= */
/* data: tools/protocols {list:[item]}, tools/protolog {logs:[{id,cid,at,amt,unit,site,note}]} */
let PROTO={list:[]},PLOG={logs:[]},PROTOV='today',PROTO_SEL=null;
const UNITS=['mcg','mg','IU','ml','units','caps','tabs','drops'];
/* routes, spots and the words for this module come from the private word list (LX 'px') */
const PX=LX('px',{}),PT=(k,d)=>(PX.t&&PX.t[k])||d,PF=Object.assign({v:'qa',w:'qb',s:'qc',h:'qh'},PX.f||{});
const ROUTES=PX.routes||['oral','nasal','topical','sublingual'];
const isSpot=r=>(PX.spot||[]).includes(r);
const SITES=PX.sites||[];
const SITE_XY=PX.xy||{};
const PDOW=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const fmtAmt=(a,u)=>`${kgs(a)} ${u}`;

async function loadProto(){const [p,l,old]=await Promise.all([load('tools/protocols'),load('tools/protolog'),load('tools/trackers')]);PROTO={list:[],...(p||{})};PLOG={logs:[],...(l||{})};PROTO_READY=true;if(typeof todaySync==='function')todaySync();
  if(!p&&old&&old.list&&old.list.length){ // one-time move from the old pins + cycles trackers
    old.list.forEach(t=>{const c=protoNew(t.name);if(t.kind==='interval')c.sched={type:'every',n:t.every||1,start:t.last||DAYK};else c.sched={type:'cycle',on:t.on,off:t.off,start:t.start||DAYK,every:1};PROTO.list.push(c);if(t.last)PLOG.logs.push({id:rid(),cid:c.id,at:t.last+'T09:00:00',amt:c.dose,unit:c.unit,site:'',note:'imported'})});
    save('tools/protocols',PROTO);save('tools/protolog',PLOG)}}
watch('tools/protocols',d=>{if(d){PROTO={list:[],...d};PROTO_READY=true;if(typeof todaySync==='function')todaySync();if(cur==='tools'&&TOOLV==='protocols')renderProto()}});
watch('tools/protolog',d=>{if(d){PLOG={logs:[],...d};if(cur==='tools'&&TOOLV==='protocols')renderProto()}});
function protoNew(name){return {id:rid(),name:name||'',route:ROUTES[0],dose:250,unit:'mcg',times:['08:00'],sched:{type:'daily',start:DAYK},[PF.h]:null,color:['#ff2a6d','#05d9e8','#ffb000','#57f5a8','#b967ff'][PROTO.list.length%5],
  active:true,rotate:true,inv:{[PF.v]:null,[PF.w]:null,remainMg:null,stock:0,[PF.s]:100},notes:'',created:DAYK}}
function saveProto(){save('tools/protocols',PROTO);if(typeof todaySync==='function')todaySync()}function saveLog(){PLOG.logs.sort((a,b)=>a.at<b.at?1:-1);save('tools/protolog',PLOG)}

/* schedule maths */
function daysBetween2(a,b){return Math.round((new Date(b+'T12:00')-new Date(a+'T12:00'))/864e5)}
function scheduledOn(c,d){if(!c.active)return false;const s=c.sched||{type:'daily'};const st=s.start||c.created||DAYK;const k=daysBetween2(st,d);if(k<0)return false;if(s.end&&d>s.end)return false;
  if(s.type==='daily')return true;if(s.type==='every')return k%Math.max(1,s.n||1)===0;
  if(s.type==='days'){const dw=(new Date(d+'T12:00').getDay()+6)%7;return (s.days||[]).includes(dw)}
  if(s.type==='cycle'){const L=((s.on||1)+(s.off||0))*7;const pos=k%L;if(pos>=(s.on||1)*7)return false;return pos%Math.max(1,s.every||1)===0}
  if(s.type==='asneeded')return false;return false}
function cyclePhase(c,d=DAYK){const s=c.sched;if(!s||s.type!=='cycle')return null;const k=daysBetween2(s.start||DAYK,d);if(k<0)return {txt:'starts '+nice(s.start).toLowerCase()};const L=((s.on||1)+(s.off||0))*7;const pos=k%L;const on=pos<(s.on||1)*7;
  const left=on?(s.on||1)*7-pos:L-pos;return {on,txt:on?`ON · week ${Math.floor(pos/7)+1}/${s.on}`:`OFF · week ${Math.floor((pos-(s.on||1)*7)/7)+1}/${s.off}`,sub:`${on?'off':'on'} in ${left}d`}}
function logsFor(cid,day){return PLOG.logs.filter(l=>l.cid===cid&&(!day||ymd(logical(new Date(l.at)))===day))}
function dueToday(){const out=[];PROTO.list.forEach(c=>{if(!scheduledOn(c,DAYK))return;const done=logsFor(c.id,DAYK);(c.times&&c.times.length?c.times:['any']).forEach((t,i)=>out.push({c,t,i,done:!!done[i],log:done[i]}))});return out.sort((a,b)=>(a.done-b.done)||(a.t>b.t?1:-1))}
function protoDueCount(){return dueToday().filter(x=>!x.done).length}
function nextSpot(c){const used={};PLOG.logs.filter(l=>l.cid===c.id&&l.site).forEach(l=>{if(!used[l.site]||l.at>used[l.site])used[l.site]=l.at});const pool=SITES.filter(s=>new RegExp((PX.pool||{})[c.route]||(PX.pool||{})._||'.').test(s[0]));
  return pool.slice().sort((a,b)=>(used[a[0]]||'')>(used[b[0]]||'')?1:-1)[0][0]}
function spotName(k){const s=SITES.find(x=>x[0]===k);return s?s[1]:k||''}
/* estimated amount still active: one-compartment exponential decay from each logged dose */
function levelAt(c,t){if(!c[PF.h])return null;const k=Math.LN2/(c[PF.h]*3600e3);let sum=0;PLOG.logs.forEach(l=>{if(l.cid!==c.id)return;const dt=t-new Date(l.at);if(dt>=0)sum+=(+l.amt||0)*Math.exp(-k*dt)});return sum}
function adherence(c,days=30){let due=0,done=0;for(let i=0;i<days;i++){const d=addDays(DAYK,-i);if(scheduledOn(c,d)){const n=(c.times||['x']).length;due+=n;done+=Math.min(n,logsFor(c.id,d).length)}}return due?Math.round(done/due*100):null}
function invInfo(c){const v=c.inv||{};const conc=v[PF.v]&&v[PF.w]?v[PF.v]/v[PF.w]:null;const doseMg=c.unit==='mg'?c.dose:c.unit==='mcg'?c.dose/1000:null;
  const ml=conc&&doseMg?doseMg/conc:null;const units=ml!=null?ml*(v[PF.s]||100):null;const remain=v.remainMg;
  const perDay=perDayAvg(c);const dosesLeft=remain!=null&&doseMg?Math.floor(remain/doseMg+1e-9):null;const daysLeft=dosesLeft!=null&&perDay?Math.floor(dosesLeft/perDay):null;
  return {conc,ml,units,remain,dosesLeft,daysLeft,doseMg}}
function perDayAvg(c){let n=0;for(let i=0;i<28;i++)if(scheduledOn(c,addDays(DAYK,i)))n+=(c.times||['x']).length;return n/28}

/* ---------- UI ---------- */
function renderProto(){const el=$('t-protocols');if(!el)return;
  const tabs=[['today','today'],['items',PT('items','items')],['spots',PT('spots','spots')],['calc',PT('calc','calc')],['history','history']];
  el.innerHTML=`<div class="seg gseg" id="protoSeg">${tabs.map(([k,l])=>`<button type="button" data-pv="${k}" aria-pressed="${PROTOV===k}">${l}</button>`).join('')}</div><div id="protoBody"></div>`;
  $('protoSeg').onclick=e=>{const b=e.target.closest('[data-pv]');if(!b)return;PROTOV=b.dataset.pv;renderProto()};
  ({today:protoToday,items:protoItems,spots:protoSpots,calc:protoCalc,history:protoHistory})[PROTOV]();
}
function protoToday(){const due=dueToday();const left=due.filter(x=>!x.done).length;const strip=[...Array(14)].map((_,i)=>addDays(DAYK,i));
  const low=PROTO.list.filter(c=>c.active).map(c=>({c,i:invInfo(c)})).filter(o=>o.i.daysLeft!=null&&o.i.daysLeft<=7);
  $('protoBody').innerHTML=`<div class="protohead"><div><b class="num">${due.length-left}/${due.length}</b><span class="dim">doses today</span></div>${PROTO.list.filter(c=>c.active).map(c=>{const ph=cyclePhase(c);return ph?`<div class="phchip" style="--c:${c.color}"><b>${esc(c.name)}</b><span>${esc(ph.txt)}</span></div>`:''}).join('')}</div>
  ${low.length?`<div class="panel"><div class="pb warn" style="font-size:12px">⚠ running low: ${low.map(o=>`${esc(o.c.name)} (${o.i.daysLeft}d left)`).join(', ')}</div></div>`:''}
  <div class="dosel">${due.map(x=>`<div class="dose${x.done?' done':''}" style="--c:${x.c.color}"><span class="dt num">${x.t==='any'?'any':x.t}</span><div class="dn"><b>${esc(x.c.name)}</b><span class="dim">${fmtAmt(x.c.dose,x.c.unit)} · ${esc(x.c.route)}${x.done&&x.log.site?' · '+esc(spotName(x.log.site)):''}${!x.done&&x.c.rotate&&isSpot(x.c.route)?' · '+PT('next','next')+': '+esc(spotName(nextSpot(x.c))):''}</span>${(()=>{const i=invInfo(x.c);return i.units?`<span class="dim">draw ${kgs(Math.round(i.units*10)/10)} units (${kgs(Math.round(i.ml*1000)/1000)} ml)</span>`:''})()}</div>
    <button class="scheck" type="button" data-dlog="${esc(x.c.id)}:${x.i}" aria-pressed="${x.done}">✓</button></div>`).join('')||'<div class="dim" style="padding:10px 0">Nothing scheduled today.</div>'}</div>
  <div class="panel" style="margin-top:12px"><div class="ph"><span class="tag">next 14 days</span></div><div class="pb"><div class="strip14">${strip.map(d=>{const cs=PROTO.list.filter(c=>scheduledOn(c,d));return `<div class="s14${d===DAYK?' today':''}"><span class="dim">${new Date(d+'T12:00').toLocaleDateString('en-GB',{weekday:'narrow'})}</span><b class="num">${+d.slice(8)}</b><div>${cs.map(c=>`<i style="background:${c.color}" title="${esc(c.name)}"></i>`).join('')}</div></div>`}).join('')}</div></div></div>
  <div class="bigbtns" style="margin-top:12px"><button class="btn" type="button" id="pLogExtra">+ log an extra dose</button></div>`;
  $('protoBody').onclick=e=>{const b=e.target.closest('[data-dlog]');if(b){const [cid,i]=b.dataset.dlog.split(':');const c=PROTO.list.find(x=>x.id===cid);const x=dueToday().find(y=>y.c.id===cid&&y.i===+i);if(x&&x.done){undoLog(x.log)}else logDose(c,b)}};
  $('pLogExtra').onclick=()=>protoPick(c=>logDose(c,null,true));
}
function undoLog(l){PLOG.logs=PLOG.logs.filter(x=>x.id!==l.id);const c=PROTO.list.find(x=>x.id===l.cid);const mg=c&&(l.unit==='mg'?+l.amt:l.unit==='mcg'?l.amt/1000:null);if(c&&mg&&c.inv&&c.inv.remainMg!=null){c.inv.remainMg=Math.round((c.inv.remainMg+mg)*1e4)/1e4;saveProto()}saveLog();renderProto();toolCardSubs()}
function logDose(c,btn,extra){const site=c.rotate&&isSpot(c.route)?nextSpot(c):'';
  openSheet('log · '+c.name,`<div class="row" style="gap:10px;flex-wrap:wrap;align-items:end"><label class="dim">amount<input class="inp num" id="ldA" value="${c.dose}" inputmode="decimal" style="width:90px"></label><label class="dim">unit<select class="inp" id="ldU">${UNITS.map(u=>`<option ${u===c.unit?'selected':''}>${u}</option>`).join('')}</select></label><label class="dim">time<input class="inp" id="ldT" type="datetime-local" value="${new Date(Date.now()-new Date().getTimezoneOffset()*6e4).toISOString().slice(0,16)}"></label></div>
   ${isSpot(c.route)?`<div class="dim" style="margin:12px 0 4px;font-size:12px">${PT('spot','spot')}${site?' · suggested: '+esc(spotName(site)):''}</div>${spotMap(c,site,true)}`:''}
   <label class="dim">note<input class="inp" id="ldN" placeholder="optional"></label>
   <div class="bigbtns" style="margin-top:12px"><span style="flex:1"></span><button class="btn p" type="button" id="ldGo">log dose</button></div>`);
  let chosen=site;$('sheetBody').onclick=e=>{const s=e.target.closest('[data-site]');if(s){chosen=s.dataset.site;$('sheetBody').querySelectorAll('[data-site]').forEach(x=>x.classList.toggle('sel',x.dataset.site===chosen))}};
  $('ldGo').onclick=()=>{const amt=+$('ldA').value||0,unit=$('ldU').value;const at=new Date($('ldT').value||Date.now()).toISOString();PLOG.logs.push({id:rid(),cid:c.id,at,amt,unit,site:chosen||'',note:$('ldN').value||''});
    const mg=unit==='mg'?amt:unit==='mcg'?amt/1000:null;if(mg&&c.inv&&c.inv.remainMg!=null){c.inv.remainMg=Math.max(0,Math.round((c.inv.remainMg-mg)*1e4)/1e4);saveProto()}
    saveLog();closeSheet();flash('dose_logged');try{autoTick(new RegExp('^'+c.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'))}catch(e){}renderProto();toolCardSubs()}}
function protoPick(cb){openSheet(PT('which','which item?'),`<div class="optlist">${PROTO.list.map(c=>`<button class="opt" type="button" data-c="${esc(c.id)}"><i class="cdot" style="background:${c.color}"></i>${esc(c.name)}</button>`).join('')||'<div class="dim">Add an item first.</div>'}</div>`);$('sheetBody').onclick=e=>{const b=e.target.closest('[data-c]');if(b)cb(PROTO.list.find(c=>c.id===b.dataset.c))}}

function schedText(c){const s=c.sched||{};const t=(c.times||[]).join(', ');const base=s.type==='daily'?'daily':s.type==='every'?`every ${s.n} days`:s.type==='days'?(s.days||[]).map(i=>PDOW[i]).join(' '):s.type==='cycle'?`${s.on} wk on / ${s.off} off${s.every>1?' · every '+s.every+'d':''}`:'as needed';return base+(t&&s.type!=='asneeded'?' · '+t:'')}
function protoItems(){const sugg=stackSuggestions();
  $('protoBody').innerHTML=`<div class="row" style="justify-content:space-between;margin-bottom:10px"><span class="tag">${PROTO.list.length} ${PT('items','items')}</span><button class="btn p" type="button" id="cNew">+ add ${PT('item','item')}</button></div>
  <div class="ccards">${PROTO.list.map(c=>{const i=invInfo(c);const a=adherence(c);const lv=levelAt(c,Date.now());const ph=cyclePhase(c);return `<button type="button" class="ccard${c.active?'':' off'}" data-cid="${esc(c.id)}" style="--c:${c.color}"><div class="rtop"><b>${esc(c.name)}</b><span class="dim">${esc(c.route)}</span></div>
    <span class="dim">${fmtAmt(c.dose,c.unit)} · ${esc(schedText(c))}</span>${ph?`<span class="phtxt">${esc(ph.txt)}</span>`:''}
    <div class="cstats"><div><span class="dim">adherence</span><b class="num">${a==null?'—':a+'%'}</b></div><div><span class="dim">${PT('lvl','active now')}</span><b class="num">${lv==null?'—':kgs(Math.round(lv*10)/10)}</b></div><div><span class="dim">supply</span><b class="num">${i.daysLeft!=null?i.daysLeft+'d':'—'}</b></div></div></button>`}).join('')||'<div class="dim">Nothing yet.</div>'}</div>
  ${sugg.length?`<div class="tag" style="margin:16px 0 6px">from your stack</div><div class="chips">${sugg.map((s,i)=>`<button class="chip" type="button" data-sg="${i}">+ ${esc(s.name)}</button>`).join('')}</div>`:''}`;
  $('cNew').onclick=()=>protoEdit(null);
  $('protoBody').onclick=e=>{const b=e.target.closest('[data-cid]');if(b)return protoDetail(b.dataset.cid);const s=e.target.closest('[data-sg]');if(s){const g=sugg[+s.dataset.sg];const c=protoNew(g.name);Object.assign(c,g.patch);protoEdit(c,true)}};
}
function stackSuggestions(){if(!M||!M.plans)return [];const have=new Set(PROTO.list.map(c=>norm(c.name)));const out=[];
  M.plans.weekday.forEach(b=>b.items.forEach(i=>{if(!CMP.has(i.type)||have.has(norm(i.item))||out.some(o=>o.name===i.item))return;const s=String(i.sched||'')+' '+String(i.notes||'');let m,sched={type:'daily',start:DAYK};
    if((m=s.match(/Every (\d+) days/i)))sched={type:'every',n:+m[1],start:DAYK};else if(/\bEOD\b/.test(s))sched={type:'every',n:2,start:DAYK};else if(/\bWeekly\b/i.test(s))sched={type:'every',n:7,start:DAYK};
    if((m=s.match(/(\d+)-week cycles? (\d+) off/i)))sched={type:'cycle',on:+m[1],off:+m[2],start:DAYK,every:sched.n||1};
    const dm=String(i.dose||'').match(/([\d.]+)\s*(mcg|mg|iu|ml)/i);const route=((PX.rx||[]).find(([re])=>new RegExp(re,'i').test(i.route||''))||[0,PX.rdef||ROUTES[0]])[1];
    out.push({name:i.item,patch:{sched,route,dose:dm?+dm[1]:0,unit:dm?(dm[2].toLowerCase()==='iu'?'IU':dm[2].toLowerCase()):'mg',times:[fmtM(i.t)||'08:00']}})}));return out}
function protoDetail(cid){const c=PROTO.list.find(x=>x.id===cid);if(!c)return;PROTO_SEL=cid;const i=invInfo(c);const a=adherence(c);const logs=logsFor(c.id).slice(0,40);
  const now=Date.now();let chart='';if(c[PF.h]){const pts=[];const labels=[];for(let h=-24*14;h<=24*7;h+=6){pts.push(levelAt(c,now+h*3600e3))}chart=`<div class="tag" style="margin:12px 0 4px">estimated amount active (${esc(c.unit)}) · 14 days back, 7 ahead</div>${spark(pts,{h:150,labels:['-14d','+7d']})}<div class="dim" style="font-size:11px">${PT('lvln','Rough estimate from your logged doses.')}</div>`}
  openSheet(c.name,`<div class="cstats big"><div><span class="dim">dose</span><b class="num">${fmtAmt(c.dose,c.unit)}</b></div><div><span class="dim">schedule</span><b>${esc(schedText(c))}</b></div><div><span class="dim">adherence 30d</span><b class="num">${a==null?'—':a+'%'}</b></div></div>
  ${chart}
  <div class="tag" style="margin:14px 0 6px">inventory</div><div class="reclist"><div><span>${PT('cur','current')}</span><b class="num">${i.remain!=null?kgs(Math.round(i.remain*100)/100)+' mg left':'—'}</b></div><div><span>doses left</span><b class="num">${i.dosesLeft??'—'}</b></div><div><span>days of supply</span><b class="num">${i.daysLeft??'—'}</b></div><div><span>${PT('unop','unopened')}</span><b class="num">${(c.inv&&c.inv.stock)||0}</b></div>${i.conc?`<div><span>concentration</span><b class="num">${kgs(Math.round(i.conc*1000)/1000)} mg/ml</b></div><div><span>per dose</span><b class="num">${kgs(Math.round(i.units*10)/10)} units · ${kgs(Math.round(i.ml*1000)/1000)} ml</b></div>`:''}</div>
  <div class="bigbtns" style="margin-top:8px"><button class="btn" type="button" id="cdNewPk">${PT('newpk','new one opened')}</button><button class="btn" type="button" id="cdLog">log dose now</button></div>
  <div class="tag" style="margin:14px 0 6px">history</div>${logs.map(l=>`<div class="hx row" style="justify-content:space-between"><span class="dim">${new Date(l.at).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span><span>${fmtAmt(l.amt,l.unit)}${l.site?' · '+esc(spotName(l.site)):''}${l.note?' · '+esc(l.note):''}</span><button class="iconbtn" type="button" data-ldel="${esc(l.id)}">✕</button></div>`).join('')||'<div class="dim">No doses logged yet.</div>'}
  ${c.notes?`<div class="dim" style="margin-top:10px">“${esc(c.notes)}”</div>`:''}
  <div class="bigbtns" style="margin-top:14px"><button class="btn d" type="button" id="cdDel">delete</button><span style="flex:1"></span><button class="btn" type="button" id="cdPause">${c.active?'pause':'resume'}</button><button class="btn p" type="button" id="cdEdit">edit</button></div>`);
  $('cdEdit').onclick=()=>protoEdit(c);$('cdLog').onclick=()=>logDose(c);
  $('cdPause').onclick=()=>{c.active=!c.active;saveProto();protoDetail(cid);renderProto()};
  $('cdNewPk').onclick=()=>{c.inv=c.inv||{};if(!c.inv[PF.v]){flash('set_size_in_edit');return protoEdit(c)}c.inv.remainMg=c.inv[PF.v];if(c.inv.stock>0)c.inv.stock--;c.inv.openedAt=DAYK;saveProto();flash('opened');protoDetail(cid)};
  $('cdDel').onclick=function(){if(!this.dataset.arm){this.dataset.arm=1;this.textContent='tap again';return}PROTO.list=PROTO.list.filter(x=>x.id!==cid);PLOG.logs=PLOG.logs.filter(l=>l.cid!==cid);saveProto();saveLog();closeSheet();renderProto()};
  $('sheetBody').addEventListener('click',e=>{const d=e.target.closest('[data-ldel]');if(!d)return;if(!d.dataset.arm){d.dataset.arm=1;d.textContent='?';return}const l=PLOG.logs.find(x=>x.id===d.dataset.ldel);if(l)undoLog(l);protoDetail(cid)});
}
function protoEdit(c0,isNew){const c=clone(c0||protoNew(''));isNew=isNew||!c0;c.sched=c.sched||{type:'daily',start:DAYK};c.inv=c.inv||{};
  const draw=()=>{const s=c.sched;openSheet(isNew?'add '+PT('item','item'):'edit · '+c.name,`<input class="inp" id="ceN" value="${esc(c.name)}" placeholder="name (e.g. BPC-157)" style="font-size:16px;margin-bottom:8px">
  <div class="row" style="gap:8px;flex-wrap:wrap"><label class="dim">dose<input class="inp num" id="ceD" value="${c.dose??''}" inputmode="decimal" style="width:90px"></label><label class="dim">unit<select class="inp" id="ceU">${UNITS.map(u=>`<option ${u===c.unit?'selected':''}>${u}</option>`).join('')}</select></label><label class="dim">route<select class="inp" id="ceR">${ROUTES.map(u=>`<option ${u===c.route?'selected':''}>${u}</option>`).join('')}</select></label><label class="dim">colour<input type="color" id="ceC" value="${c.color}" class="inp" style="width:56px;padding:2px"></label></div>
  <div class="tag" style="margin:14px 0 6px">schedule</div>
  <div class="seg" id="ceST">${[['daily','daily'],['every','every N days'],['days','days of week'],['cycle','cycle on/off'],['asneeded','as needed']].map(([k,l])=>`<button type="button" data-st="${k}" aria-pressed="${s.type===k}">${l}</button>`).join('')}</div>
  <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:8px">${s.type==='every'?`<label class="dim">every N days<input class="inp num" id="ceEv" value="${s.n||2}" style="width:70px"></label>`:''}
   ${s.type==='days'?`<div class="chips" id="ceDays">${PDOW.map((d,i)=>`<button class="chip" type="button" data-dw="${i}" aria-pressed="${(s.days||[]).includes(i)}">${d}</button>`).join('')}</div>`:''}
   ${s.type==='cycle'?`<label class="dim">weeks on<input class="inp num" id="ceOn" value="${s.on||8}" style="width:60px"></label><label class="dim">weeks off<input class="inp num" id="ceOff" value="${s.off??4}" style="width:60px"></label><label class="dim">dose every N days while on<input class="inp num" id="ceEv2" value="${s.every||1}" style="width:60px"></label>`:''}
   <label class="dim">start<input class="inp" type="date" id="ceS" value="${s.start||DAYK}"></label><label class="dim">end (optional)<input class="inp" type="date" id="ceE" value="${s.end||''}"></label></div>
  ${s.type!=='asneeded'?`<label class="dim">times (comma separated)<input class="inp" id="ceT" value="${esc((c.times||[]).join(', '))}" placeholder="08:00, 20:00"></label>`:''}
  <div class="tag" style="margin:14px 0 6px">${PT('pk','timing (optional)')}</div><label class="dim">${PT('hl','decay in hours')}<input class="inp num" id="ceH" value="${c[PF.h]??''}" inputmode="decimal" placeholder="e.g. 4"></label>
  <label class="dim" style="display:flex;gap:8px;align-items:center;margin-top:8px"><input type="checkbox" id="ceRot" ${c.rotate?'checked':''} style="width:auto;display:inline"> ${PT('rot','rotate spots')}</label>
  <div class="tag" style="margin:14px 0 6px">inventory</div><div class="row" style="gap:8px;flex-wrap:wrap"><label class="dim">${PT('mpv','mg per unit')}<input class="inp num" id="ceVm" value="${c.inv[PF.v]??''}" inputmode="decimal" style="width:80px"></label><label class="dim">${PT('wa','added (ml)')}<input class="inp num" id="ceVw" value="${c.inv[PF.w]??''}" inputmode="decimal" style="width:80px"></label><label class="dim">${PT('mlc','mg left in current')}<input class="inp num" id="ceVr" value="${c.inv.remainMg??''}" inputmode="decimal" style="width:90px"></label><label class="dim">${PT('unop','unopened')}<input class="inp num" id="ceVs" value="${c.inv.stock||0}" inputmode="numeric" style="width:70px"></label><label class="dim">${PT('sc','scale')}<select class="inp" id="ceSy">${[100,50,30].map(u=>`<option value="${u}" ${(c.inv[PF.s]||100)==u?'selected':''}>${PT('u','')}${u}</option>`).join('')}</select></label></div>
  <label class="dim">notes<textarea class="inp" id="ceNo" rows="2">${esc(c.notes||'')}</textarea></label>
  <div class="bigbtns" style="margin-top:12px"><span style="flex:1"></span><button class="btn" type="button" id="ceX">cancel</button><button class="btn p" type="button" id="ceOk">save</button></div>`);
  const sb=$('sheetBody');
  const read=()=>{const g=id=>$(id)?$(id).value:undefined;c.name=g('ceN');c.dose=+g('ceD')||0;c.unit=g('ceU');c.route=g('ceR');c.color=g('ceC');s.start=g('ceS')||DAYK;s.end=g('ceE')||null;
    if($('ceEv'))s.n=Math.max(1,+g('ceEv')||1);if($('ceOn')){s.on=Math.max(1,+g('ceOn')||1);s.off=Math.max(0,+g('ceOff')||0);s.every=Math.max(1,+g('ceEv2')||1)}
    if($('ceT'))c.times=g('ceT').split(/[,\s]+/).map(x=>x.trim()).filter(x=>/^\d{1,2}:\d{2}$/.test(x)).map(x=>x.padStart(5,'0'));c[PF.h]=+g('ceH')||null;c.rotate=$('ceRot').checked;
    c.inv[PF.v]=+g('ceVm')||null;c.inv[PF.w]=+g('ceVw')||null;c.inv.remainMg=g('ceVr')===''?null:+g('ceVr');c.inv.stock=+g('ceVs')||0;c.inv[PF.s]=+g('ceSy')||100;c.notes=g('ceNo')};
  sb.onclick=e=>{const st=e.target.closest('[data-st]');if(st){read();s.type=st.dataset.st;if(s.type==='days'&&!s.days)s.days=[0,2,4];draw();return}
    const dw=e.target.closest('[data-dw]');if(dw){const k=+dw.dataset.dw;s.days=(s.days||[]).includes(k)?s.days.filter(x=>x!==k):[...(s.days||[]),k].sort();dw.setAttribute('aria-pressed',s.days.includes(k));return}
    if(e.target.id==='ceX')closeSheet();
    if(e.target.id==='ceOk'){read();c.name=(c.name||'').trim();if(!c.name){$('ceN').focus();return}const i=PROTO.list.findIndex(x=>x.id===c.id);if(i>=0)PROTO.list[i]=c;else PROTO.list.push(c);saveProto();closeSheet();PROTOV='items';renderProto();flash('saved')}}};
  draw()}

/* spot map */
function spotMap(c,sel,pick){const last={};PLOG.logs.filter(l=>!c||l.cid===c.id).forEach(l=>{if(l.site&&(!last[l.site]||l.at>last[l.site]))last[l.site]=l.at});
  const age=k=>last[k]?Math.floor((Date.now()-new Date(last[k]))/864e5):null;
  const dot=(k)=>{const [x,y]=SITE_XY[k];const a=age(k);const col=a==null?'#2a2a30':a<2?'#ff2a6d':a<5?'#ffb000':'#57f5a8';return `<g class="sdot${k===sel?' sel':''}" data-site="${k}" style="cursor:${pick?'pointer':'default'}"><circle cx="${x}" cy="${y}" r="6.5" fill="${col}" stroke="#000" stroke-width="1"/><title>${spotName(k)}${a!=null?` · ${a}d ago`:' · never'}</title></g>`};
  const body=(ox,lab)=>`<g transform="translate(${ox},0)"><circle cx="60" cy="20" r="11" fill="#16161a"/><path d="M42 34h36l8 40-6 30H40l-6-30z" fill="#16161a"/><path d="M42 104h16l-2 70H44zM62 104h16l-2 70H64z" fill="#16161a"/><path d="M34 36l-10 50h8l8-40zM86 36l10 50h-8l-8-40z" fill="#16161a"/><text x="60" y="190" fill="#555" font-size="8" text-anchor="middle">${lab}</text></g>`;
  return `<svg class="sitemap" viewBox="0 0 240 196">${body(0,'front')}${body(120,'back')}${Object.keys(SITE_XY).map(dot).join('')}</svg><div class="dim" style="font-size:11px;display:flex;gap:12px;flex-wrap:wrap"><span><i class="lg" style="background:#ff2a6d"></i>&lt;2 days</span><span><i class="lg" style="background:#ffb000"></i>2–4 days</span><span><i class="lg" style="background:#57f5a8"></i>rested</span><span><i class="lg" style="background:#2a2a30"></i>never</span></div>`}
function protoSpots(){const inj=PROTO.list.filter(c=>isSpot(c.route));const recent=PLOG.logs.filter(l=>l.site).slice(0,12);
  $('protoBody').innerHTML=`<div class="statsplit" style="margin-top:0"><div class="panel"><div class="ph"><span class="tag">${PT('all','all spots')}</span></div><div class="pb">${spotMap(null,null,false)}</div></div>
  <div class="panel"><div class="ph"><span class="tag">${PT('nxt','next spot per item')}</span></div><div class="pb"><div class="reclist">${inj.map(c=>`<div><span><i class="cdot" style="background:${c.color}"></i> ${esc(c.name)}</span><b>${esc(spotName(nextSpot(c)))}</b></div>`).join('')||'<span class="dim">Nothing to rotate.</span>'}</div>
  <div class="tag" style="margin:14px 0 6px">recent</div><div class="reclist">${recent.map(l=>{const c=PROTO.list.find(x=>x.id===l.cid);return `<div><span class="dim">${new Date(l.at).toLocaleDateString('en-GB',{day:'numeric',month:'short'})} · ${esc(c?c.name:'')}</span><span>${esc(spotName(l.site))}</span></div>`}).join('')||'<span class="dim">Nothing yet.</span>'}</div></div></div></div>`}
function protoCalc(){const st=LS.get('pcalc')||{mg:5,ml:2,dose:250,unit:'mcg',sy:100};
  const draw=()=>{const conc=st.mg/st.ml;const doseMg=st.unit==='mg'?st.dose:st.dose/1000;const ml=doseMg/conc;const units=ml*st.sy;const per=Math.floor(st.mg/doseMg+1e-9);
    $('rcOut').innerHTML=`<div class="statcards"><div><span class="dim">draw to</span><b class="num">${isFinite(units)?kgs(Math.round(units*10)/10):'—'}<small> units</small></b></div><div><span class="dim">volume</span><b class="num">${isFinite(ml)?kgs(Math.round(ml*1000)/1000):'—'}<small> ml</small></b></div><div><span class="dim">concentration</span><b class="num">${isFinite(conc)?kgs(Math.round(conc*1000)/1000):'—'}<small> mg/ml</small></b></div><div><span class="dim">${PT('dpu','doses per unit')}</span><b class="num">${isFinite(per)?per:'—'}</b></div></div>
    <div class="dbar"><div class="sfill" style="width:${Math.min(100,units/st.sy*100)}%"></div>${[...Array(11)].map((_,i)=>`<span style="left:${i*10}%">${Math.round(st.sy*i/10)}</span>`).join('')}</div>${units>st.sy?'<div class="pb warn" style="font-size:12px">'+PT('over','That dose is more than one full scale.')+'</div>':''}`;LS.set('pcalc',st)};
  $('protoBody').innerHTML=`<div class="panel"><div class="ph"><span class="tag">${PT('calct','calculator')}</span><span class="dim">${PT('calcs','')}</span></div><div class="pb">
  <div class="row" style="gap:10px;flex-wrap:wrap;align-items:end"><label class="dim">${PT('amt','amount (mg)')}<input class="inp num" data-r="mg" value="${st.mg}" inputmode="decimal" style="width:100px"></label><label class="dim">${PT('wa','added (ml)')}<input class="inp num" data-r="ml" value="${st.ml}" inputmode="decimal" style="width:100px"></label><label class="dim">dose<input class="inp num" data-r="dose" value="${st.dose}" inputmode="decimal" style="width:100px"></label><label class="dim">unit<select class="inp" data-r="unit"><option ${st.unit==='mcg'?'selected':''}>mcg</option><option ${st.unit==='mg'?'selected':''}>mg</option></select></label><label class="dim">${PT('sc','scale')}<select class="inp" data-r="sy">${[100,50,30].map(u=>`<option value="${u}" ${st.sy==u?'selected':''}>${PT('u','')}${u}</option>`).join('')}</select></label></div>
  <div id="rcOut" style="margin-top:14px"></div></div></div>`;
  $('protoBody').oninput=$('protoBody').onchange=e=>{const k=e.target.dataset.r;if(!k)return;st[k]=k==='unit'?e.target.value:+e.target.value||0;draw()};draw()}
function protoHistory(){const days={};PLOG.logs.forEach(l=>{const d=ymd(logical(new Date(l.at)));(days[d]=days[d]||[]).push(l)});
  $('protoBody').innerHTML=Object.entries(days).sort((a,b)=>a[0]<b[0]?1:-1).slice(0,60).map(([d,ls])=>`<div class="hx"><b>${esc(nice(d))}</b><div class="hsets">${ls.map(l=>{const c=PROTO.list.find(x=>x.id===l.cid);return `<span class="set" style="border-color:${c?c.color:'#333'}">${new Date(l.at).toTimeString().slice(0,5)} · ${esc(c?c.name:'?')} · ${fmtAmt(l.amt,l.unit)}${l.site?' · '+esc(spotName(l.site)):''}</span>`}).join('')}</div></div>`).join('')||'<div class="dim">No doses logged yet.</div>'}
