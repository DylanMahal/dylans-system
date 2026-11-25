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
watch('tools/protocols',d=>{if(d){PROTO={list:[],...d};PROTO_READY=true;if(typeof todaySync==='function')todaySync();if(cur==='stack'&&STACKV==='protocols')renderProto()}});
watch('tools/protolog',d=>{if(d){PLOG={logs:[],...d};if(cur==='stack'&&STACKV==='protocols')renderProto()}});
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
function undoLog(l){PLOG.logs=PLOG.logs.filter(x=>x.id!==l.id);const c=PROTO.list.find(x=>x.id===l.cid);const mg=c&&(l.unit==='mg'?+l.amt:l.unit==='mcg'?l.amt/1000:null);if(c&&mg&&c.inv&&c.inv.remainMg!=null){c.inv.remainMg=Math.round((c.inv.remainMg+mg)*1e4)/1e4;saveProto()}saveLog();renderProto();toolCardSubs()}
function logDose(c,btn,extra){const site=c.rotate&&isSpot(c.route)?nextSpot(c):'';
  openSheet('log · '+c.name,`<div class="row" style="gap:10px;flex-wrap:wrap;align-items:end"><label class="dim">Amount<input class="inp num" id="ldA" value="${c.dose}" inputmode="decimal" style="width:90px"></label><label class="dim">Unit<select class="inp" id="ldU">${UNITS.map(u=>`<option ${u===c.unit?'selected':''}>${u}</option>`).join('')}</select></label><label class="dim">Time<input class="inp" id="ldT" type="datetime-local" value="${new Date(Date.now()-new Date().getTimezoneOffset()*6e4).toISOString().slice(0,16)}"></label></div>
   ${isSpot(c.route)?`<div class="dim" style="margin:12px 0 4px;font-size:12px">${PT('spot','spot')}${site?' · suggested: '+esc(spotName(site)):''}</div>${spotMap(c,site,true)}`:''}
   <label class="dim">Note<input class="inp" id="ldN" placeholder="Optional"></label>
   <div class="bigbtns" style="margin-top:12px"><span style="flex:1"></span><button class="btn p" type="button" id="ldGo">Log dose</button></div>`);
  let chosen=site;$('sheetBody').onclick=e=>{const s=e.target.closest('[data-site]');if(s){chosen=s.dataset.site;$('sheetBody').querySelectorAll('[data-site]').forEach(x=>x.classList.toggle('sel',x.dataset.site===chosen))}};
  $('ldGo').onclick=()=>{const amt=+$('ldA').value||0,unit=$('ldU').value;const at=new Date($('ldT').value||Date.now()).toISOString();PLOG.logs.push({id:rid(),cid:c.id,at,amt,unit,site:chosen||'',note:$('ldN').value||''});
    const mg=unit==='mg'?amt:unit==='mcg'?amt/1000:null;if(mg&&c.inv&&c.inv.remainMg!=null){c.inv.remainMg=Math.max(0,Math.round((c.inv.remainMg-mg)*1e4)/1e4);saveProto()}
    saveLog();closeSheet();flash('dose_logged');try{autoTick(new RegExp('^'+c.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'))}catch(e){}renderProto();toolCardSubs()}}
function protoPick(cb){openSheet(PT('which','which item?'),`<div class="optlist">${PROTO.list.map(c=>`<button class="opt" type="button" data-c="${esc(c.id)}"><i class="cdot" style="background:${c.color}"></i>${esc(c.name)}</button>`).join('')||'<div class="dim">Add an item first.</div>'}</div>`);$('sheetBody').onclick=e=>{const b=e.target.closest('[data-c]');if(b)cb(PROTO.list.find(c=>c.id===b.dataset.c))}}

function schedText(c){const s=c.sched||{};const t=(c.times||[]).join(', ');const base=s.type==='daily'?'daily':s.type==='every'?`every ${s.n} days`:s.type==='days'?(s.days||[]).map(i=>PDOW[i]).join(' '):s.type==='cycle'?`${s.on} wk on / ${s.off} off${s.every>1?' · every '+s.every+'d':''}`:'as needed';return base+(t&&s.type!=='asneeded'?' · '+t:'')}
function stackSuggestions(){if(!M||!M.plans)return [];const have=new Set(PROTO.list.map(c=>norm(c.name)));const out=[];
  M.plans.weekday.forEach(b=>b.items.forEach(i=>{if(!CMP.has(i.type)||have.has(norm(i.item))||out.some(o=>o.name===i.item))return;const s=String(i.sched||'')+' '+String(i.notes||'');let m,sched={type:'daily',start:DAYK};
    if((m=s.match(/Every (\d+) days/i)))sched={type:'every',n:+m[1],start:DAYK};else if(/\bEOD\b/.test(s))sched={type:'every',n:2,start:DAYK};else if(/\bWeekly\b/i.test(s))sched={type:'every',n:7,start:DAYK};
    if((m=s.match(/(\d+)-week cycles? (\d+) off/i)))sched={type:'cycle',on:+m[1],off:+m[2],start:DAYK,every:sched.n||1};
    const dm=String(i.dose||'').match(/([\d.]+)\s*(mcg|mg|iu|ml)/i);const route=((PX.rx||[]).find(([re])=>new RegExp(re,'i').test(i.route||''))||[0,PX.rdef||ROUTES[0]])[1];
    out.push({name:i.item,patch:{sched,route,dose:dm?+dm[1]:0,unit:dm?(dm[2].toLowerCase()==='iu'?'IU':dm[2].toLowerCase()):'mg',times:[fmtM(i.t)||'08:00']}})}));return out}
function protoDetail(cid){const c=PROTO.list.find(x=>x.id===cid);if(!c)return;PROTO_SEL=cid;const i=invInfo(c);const a=adherence(c);const logs=logsFor(c.id).slice(0,40);
  const now=Date.now();let chart='';if(c[PF.h]){const pts=[];const labels=[];for(let h=-24*14;h<=24*7;h+=6){pts.push(levelAt(c,now+h*3600e3))}chart=`<div class="tag" style="margin:12px 0 4px">estimated amount active (${esc(c.unit)}) · 14 days back, 7 ahead</div>${spark(pts,{h:150,labels:['-14d','+7d']})}<div class="dim" style="font-size:11px">${PT('lvln','Rough estimate from your logged doses.')}</div>`}
  openSheet(c.name,`<div class="cstats big"><div><span class="dim">Dose</span><b class="num">${fmtAmt(c.dose,c.unit)}</b></div><div><span class="dim">Schedule</span><b>${esc(schedText(c))}</b></div><div><span class="dim">Adherence 30d</span><b class="num">${a==null?'—':a+'%'}</b></div></div>
  ${chart}
  <div class="tag" style="margin:14px 0 6px">Inventory</div><div class="reclist"><div><span>${PT('cur','current')}</span><b class="num">${i.remain!=null?kgs(Math.round(i.remain*100)/100)+' mg left':'—'}</b></div><div><span>Doses left</span><b class="num">${i.dosesLeft??'—'}</b></div><div><span>Days of supply</span><b class="num">${i.daysLeft??'—'}</b></div><div><span>${PT('unop','unopened')}</span><b class="num">${(c.inv&&c.inv.stock)||0}</b></div>${i.conc?`<div><span>Concentration</span><b class="num">${kgs(Math.round(i.conc*1000)/1000)} mg/ml</b></div><div><span>Per dose</span><b class="num">${kgs(Math.round(i.units*10)/10)} units · ${kgs(Math.round(i.ml*1000)/1000)} ml</b></div>`:''}</div>
  <div class="bigbtns" style="margin-top:8px"><button class="btn" type="button" id="cdNewPk">${PT('newpk','new one opened')}</button><button class="btn" type="button" id="cdLog">Log dose now</button></div>
  <div class="tag" style="margin:14px 0 6px">History</div>${logs.map(l=>`<div class="hx row" style="justify-content:space-between"><span class="dim">${new Date(l.at).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span><span>${fmtAmt(l.amt,l.unit)}${l.site?' · '+esc(spotName(l.site)):''}${l.note?' · '+esc(l.note):''}</span><button class="iconbtn" type="button" data-ldel="${esc(l.id)}">✕</button></div>`).join('')||'<div class="dim">No doses logged yet.</div>'}
  ${c.notes?`<div class="dim" style="margin-top:10px">“${esc(c.notes)}”</div>`:''}
  <div class="bigbtns" style="margin-top:14px"><button class="btn d" type="button" id="cdDel">Delete</button><span style="flex:1"></span><button class="btn" type="button" id="cdPause">${c.active?'pause':'resume'}</button><button class="btn p" type="button" id="cdEdit">Edit</button></div>`);
  $('cdEdit').onclick=()=>protoEdit(c);$('cdLog').onclick=()=>logDose(c);
  $('cdPause').onclick=()=>{c.active=!c.active;saveProto();protoDetail(cid);renderProto()};
  $('cdNewPk').onclick=()=>{c.inv=c.inv||{};if(!c.inv[PF.v]){flash('set_size_in_edit');return protoEdit(c)}c.inv.remainMg=c.inv[PF.v];if(c.inv.stock>0)c.inv.stock--;c.inv.openedAt=DAYK;saveProto();flash('opened');protoDetail(cid)};
  $('cdDel').onclick=function(){if(!this.dataset.arm){this.dataset.arm=1;this.textContent='tap again';return}PROTO.list=PROTO.list.filter(x=>x.id!==cid);PLOG.logs=PLOG.logs.filter(l=>l.cid!==cid);saveProto();saveLog();closeSheet();renderProto()};
  $('sheetBody').addEventListener('click',e=>{const d=e.target.closest('[data-ldel]');if(!d)return;if(!d.dataset.arm){d.dataset.arm=1;d.textContent='?';return}const l=PLOG.logs.find(x=>x.id===d.dataset.ldel);if(l)undoLog(l);protoDetail(cid)});
}
function protoEdit(c0,isNew){const c=clone(c0||protoNew(''));isNew=isNew||!c0;c.sched=c.sched||{type:'daily',start:DAYK};c.inv=c.inv||{};
  const draw=()=>{const s=c.sched;openSheet(isNew?'add '+PT('item','item'):'edit · '+c.name,`<input class="inp" id="ceN" value="${esc(c.name)}" placeholder="Name (e.g. BPC-157)" style="font-size:16px;margin-bottom:8px">
  <div class="row" style="gap:8px;flex-wrap:wrap"><label class="dim">Dose<input class="inp num" id="ceD" value="${c.dose??''}" inputmode="decimal" style="width:90px"></label><label class="dim">Unit<select class="inp" id="ceU">${UNITS.map(u=>`<option ${u===c.unit?'selected':''}>${u}</option>`).join('')}</select></label><label class="dim">Route<select class="inp" id="ceR">${ROUTES.map(u=>`<option ${u===c.route?'selected':''}>${u}</option>`).join('')}</select></label><label class="dim">Colour<input type="color" id="ceC" value="${c.color}" class="inp" style="width:56px;padding:2px"></label></div>
  <div class="tag" style="margin:14px 0 6px">Schedule</div>
  <div class="seg" id="ceST">${[['daily','daily'],['every','every N days'],['days','days of week'],['cycle','cycle on/off'],['asneeded','as needed']].map(([k,l])=>`<button type="button" data-st="${k}" aria-pressed="${s.type===k}">${l}</button>`).join('')}</div>
  <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:8px">${s.type==='every'?`<label class="dim">every N days<input class="inp num" id="ceEv" value="${s.n||2}" style="width:70px"></label>`:''}
   ${s.type==='days'?`<div class="chips" id="ceDays">${PDOW.map((d,i)=>`<button class="chip" type="button" data-dw="${i}" aria-pressed="${(s.days||[]).includes(i)}">${d}</button>`).join('')}</div>`:''}
   ${s.type==='cycle'?`<label class="dim">Weeks on<input class="inp num" id="ceOn" value="${s.on||8}" style="width:60px"></label><label class="dim">Weeks off<input class="inp num" id="ceOff" value="${s.off??4}" style="width:60px"></label><label class="dim">dose every N days while on<input class="inp num" id="ceEv2" value="${s.every||1}" style="width:60px"></label>`:''}
   <label class="dim">Start<input class="inp" type="date" id="ceS" value="${s.start||DAYK}"></label><label class="dim">End (optional)<input class="inp" type="date" id="ceE" value="${s.end||''}"></label></div>
  ${s.type!=='asneeded'?`<label class="dim">Times (comma separated)<input class="inp" id="ceT" value="${esc((c.times||[]).join(', '))}" placeholder="08:00, 20:00"></label>`:''}
  <div class="tag" style="margin:14px 0 6px">${PT('pk','timing (optional)')}</div><label class="dim">${PT('hl','decay in hours')}<input class="inp num" id="ceH" value="${c[PF.h]??''}" inputmode="decimal" placeholder="E.g. 4"></label>
  <label class="dim" style="display:flex;gap:8px;align-items:center;margin-top:8px"><input type="checkbox" id="ceRot" ${c.rotate?'checked':''} style="width:auto;display:inline"> ${PT('rot','rotate spots')}</label>
  <div class="tag" style="margin:14px 0 6px">Inventory</div><div class="row" style="gap:8px;flex-wrap:wrap"><label class="dim">${PT('mpv','mg per unit')}<input class="inp num" id="ceVm" value="${c.inv[PF.v]??''}" inputmode="decimal" style="width:80px"></label><label class="dim">${PT('wa','added (ml)')}<input class="inp num" id="ceVw" value="${c.inv[PF.w]??''}" inputmode="decimal" style="width:80px"></label><label class="dim">${PT('mlc','mg left in current')}<input class="inp num" id="ceVr" value="${c.inv.remainMg??''}" inputmode="decimal" style="width:90px"></label><label class="dim">${PT('unop','unopened')}<input class="inp num" id="ceVs" value="${c.inv.stock||0}" inputmode="numeric" style="width:70px"></label><label class="dim">${PT('sc','scale')}<select class="inp" id="ceSy">${[100,50,30].map(u=>`<option value="${u}" ${(c.inv[PF.s]||100)==u?'selected':''}>${PT('u','')}${u}</option>`).join('')}</select></label></div>
  <label class="dim">Notes<textarea class="inp" id="ceNo" rows="2">${esc(c.notes||'')}</textarea></label>
  <div class="bigbtns" style="margin-top:12px"><span style="flex:1"></span><button class="btn" type="button" id="ceX">Cancel</button><button class="btn p" type="button" id="ceOk">Save</button></div>`);
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
  return `<svg class="sitemap" viewBox="0 0 240 196">${body(0,'front')}${body(120,'back')}${Object.keys(SITE_XY).map(dot).join('')}</svg><div class="dim" style="font-size:11px;display:flex;gap:12px;flex-wrap:wrap"><span><i class="lg" style="background:#ff2a6d"></i>&lt;2 days</span><span><i class="lg" style="background:#ffb000"></i>2–4 days</span><span><i class="lg" style="background:#57f5a8"></i>Rested</span><span><i class="lg" style="background:#2a2a30"></i>Never</span></div>`}
const PI={check:FZSV('<path d="M5 12.5l4.2 4.2L19 7"/>'),calc:FZSV('<rect x="4" y="2" width="16" height="20" rx="3"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15v3M8 18h4"/>'),
  map:FZSV('<path d="M12 21s-7-5.7-7-11a7 7 0 0 1 14 0c0 5.3-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>'),clock:FZSV('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  warn:FZSV('<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>')};
function renderProto(){const el=$('t-protocols');if(!el)return;
  const due=dueToday(),left=due.filter(x=>!x.done).length,n=due.length,pct=n?Math.round((n-left)/n*100):0;
  const act=PROTO.list.filter(c=>c.active),hasSpots=PROTO.list.some(c=>isSpot(c.route));
  const low=act.map(c=>({c,i:invInfo(c)})).filter(o=>o.i.daysLeft!=null&&o.i.daysLeft<=7);
  const nextUp=due.find(x=>!x.done);const week=[...Array(7)].map((_,i)=>addDays(DAYK,i));
  const phases=act.map(c=>({c,ph:cyclePhase(c)})).filter(o=>o.ph);
  el.innerHTML=`<div class="pr-grid"><div class="pr-col">
    <div class="panel pr-hero"><div class="pb">
      <div class="pr-sum"><div class="pr-ring"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" class="t"/><circle cx="20" cy="20" r="17" class="f" pathLength="100" style="stroke-dasharray:${pct} 100"/></svg><b class="num">${n-left}<small>/${n}</small></b></div>
        <div class="pr-st"><b>${!n?'Nothing due today':left?left+' left today':'All done today'}</b><span>${nextUp?'Next: '+esc(nextUp.c.name)+(nextUp.t!=='any'?' at '+nextUp.t:''):act.length+' active'}</span></div>
        <button class="pr-plus" type="button" id="pLogExtra" aria-label="Log an extra dose">${FI.plus}</button></div>
      <div class="pr-week">${week.map(d=>{const cs=PROTO.list.filter(c=>scheduledOn(c,d));return `<div class="${d===DAYK?'on':''}"><span>${new Date(d+'T12:00').toLocaleDateString('en-GB',{weekday:'narrow'})}</span><b class="num">${+d.slice(8)}</b><p>${cs.slice(0,4).map(c=>`<i style="background:${c.color}"></i>`).join('')}</p></div>`}).join('')}</div>
      ${phases.length?`<div class="pr-phases">${phases.map(o=>`<span style="--c:${o.c.color}"><i></i>${esc(o.c.name)} · ${esc(o.ph.txt)}</span>`).join('')}</div>`:''}
    </div></div>
    ${low.length?`<div class="pr-warn">${PI.warn}<span><b>Running low</b>${low.map(o=>`${esc(o.c.name)} · ${o.i.daysLeft} day${o.i.daysLeft===1?'':'s'} left`).join('<br>')}</span></div>`:''}
    <div class="pr-sec"><span>Today</span></div>
    <div class="pr-list">${due.map(x=>{const i=invInfo(x.c);const sub=[fmtAmt(x.c.dose,x.c.unit),x.c.route,x.done&&x.log.site?spotName(x.log.site):'',!x.done&&x.c.rotate&&isSpot(x.c.route)?PT('next','next')+': '+spotName(nextSpot(x.c)):'',i.units?'draw '+kgs(Math.round(i.units*10)/10)+' units':''].filter(Boolean).map(esc).join(' · ');
      return `<div class="pr-row${x.done?' done':''}" style="--c:${x.c.color}"><span class="pr-time num">${x.t==='any'?'Any':x.t}</span><span class="pr-t"><b>${esc(x.c.name)}</b><small>${sub}</small></span><button class="pr-chk" type="button" data-dlog="${esc(x.c.id)}:${x.i}" aria-pressed="${x.done}" aria-label="${x.done?'Undo':'Mark done'}">${PI.check}</button></div>`}).join('')||'<div class="pr-empty">Nothing scheduled today</div>'}</div>
  </div><div class="pr-col">
    <div class="pr-sec"><span>${esc(PT('items','Items'))}</span><button class="pr-link" type="button" id="cNew">${FI.plus}Add</button></div>
    <div class="pr-list">${PROTO.list.map(c=>{const i=invInfo(c),a=adherence(c),ph=cyclePhase(c);return `<button type="button" class="pr-row tap${c.active?'':' off'}" data-cid="${esc(c.id)}" style="--c:${c.color}"><span class="pr-dot"></span><span class="pr-t"><b>${esc(c.name)}</b><small>${esc([fmtAmt(c.dose,c.unit),schedText(c),c.active?(ph?ph.txt:''):'paused'].filter(Boolean).join(' · '))}</small></span><span class="pr-meta"><b class="num">${a==null?'—':a+'%'}</b><small>${i.daysLeft!=null?i.daysLeft+'d supply':'adherence'}</small></span><span class="fz-chev">${FI.chev}</span></button>`}).join('')||`<div class="pr-empty">Nothing added yet</div>`}</div>
    <div class="pr-sec"><span>Tools</span></div>
    <div class="pr-list">
      <button type="button" class="pr-row tap" id="prCalc"><span class="fz-ic b">${PI.calc}</span><span class="pr-t"><b>${esc(PT('calct','Calculator'))}</b><small>${esc(PT('calcs','')||'How much to draw')}</small></span><span class="fz-chev">${FI.chev}</span></button>
      ${hasSpots?`<button type="button" class="pr-row tap" id="prSpots"><span class="fz-ic g">${PI.map}</span><span class="pr-t"><b>${esc(PT('spots','Rotation'))}</b><small>${esc(PT('nxt','Next spot per item'))}</small></span><span class="fz-chev">${FI.chev}</span></button>`:''}
      <button type="button" class="pr-row tap" id="prHist"><span class="fz-ic">${PI.clock}</span><span class="pr-t"><b>History</b><small>${PLOG.logs.length} logged</small></span><span class="fz-chev">${FI.chev}</span></button>
    </div>
  </div></div>`;
  el.onclick=e=>{const t=e.target;
    const b=t.closest('[data-dlog]');if(b){const [cid,i]=b.dataset.dlog.split(':');const c=PROTO.list.find(x=>x.id===cid);const x=dueToday().find(y=>y.c.id===cid&&y.i===+i);if(x&&x.done)undoLog(x.log);else logDose(c,b);return}
    const r=t.closest('[data-cid]');if(r)return protoDetail(r.dataset.cid);
    const id=(t.closest('button')||{}).id;
    if(id==='cNew')return protoEdit(null);if(id==='pLogExtra')return protoPick(c=>logDose(c,null,true));
    if(id==='prCalc')return protoCalc();if(id==='prSpots')return protoSpots();if(id==='prHist')return protoHistory()};
}
function protoSpots(){const inj=PROTO.list.filter(c=>isSpot(c.route));const recent=PLOG.logs.filter(l=>l.site).slice(0,12);
  openSheet(PT('spots','Rotation'),`<div class="pr-map">${spotMap(null,null,false)}</div>
  <div class="pr-sec"><span>${esc(PT('nxt','Next spot per item'))}</span></div><div class="pr-list">${inj.map(c=>`<div class="pr-row" style="--c:${c.color}"><span class="pr-dot"></span><span class="pr-t"><b>${esc(c.name)}</b></span><span class="pr-val">${esc(spotName(nextSpot(c)))}</span></div>`).join('')||'<div class="pr-empty">Nothing to rotate</div>'}</div>
  <div class="pr-sec"><span>Recent</span></div><div class="pr-list">${recent.map(l=>{const c=PROTO.list.find(x=>x.id===l.cid);return `<div class="pr-row"><span class="pr-t"><b>${esc(spotName(l.site))}</b><small>${esc(c?c.name:'')}</small></span><span class="pr-val dim">${new Date(l.at).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</span></div>`}).join('')||'<div class="pr-empty">Nothing yet</div>'}</div>`)}
function protoCalc(){const st=LS.get('pcalc')||{mg:5,ml:2,dose:250,unit:'mcg',sy:100};
  openSheet(PT('calct','Calculator'),`<div class="pr-form">
    <label><span>${esc(PT('amt','amount (mg)'))}</span><input class="inp num" data-r="mg" value="${st.mg}" inputmode="decimal"></label>
    <label><span>${esc(PT('wa','added (ml)'))}</span><input class="inp num" data-r="ml" value="${st.ml}" inputmode="decimal"></label>
    <label><span>Dose</span><div class="pr-in2"><input class="inp num" data-r="dose" value="${st.dose}" inputmode="decimal"><div class="fz-seg sm" id="rcUnit">${['mcg','mg'].map(u=>`<button type="button" data-u="${u}" aria-pressed="${st.unit===u}">${u}</button>`).join('')}</div></div></label>
    <label><span>${esc(PT('sc','scale'))}</span><div class="fz-seg sm" id="rcSy">${[100,50,30].map(u=>`<button type="button" data-sy="${u}" aria-pressed="${st.sy==u}">${esc(PT('u',''))}${u}</button>`).join('')}</div></label>
  </div><div id="rcOut"></div>`);
  const draw=()=>{const conc=st.mg/st.ml,doseMg=st.unit==='mg'?st.dose:st.dose/1000,ml=doseMg/conc,units=ml*st.sy,per=Math.floor(st.mg/doseMg+1e-9);const f=v=>isFinite(v)&&v>0;
    $('rcOut').innerHTML=`<div class="pr-res"><span>Draw to</span><b class="num">${f(units)?kgs(Math.round(units*10)/10):'—'}<small> units</small></b></div>
    <div class="pr-syr"><div class="pr-syr-f" style="width:${f(units)?Math.min(100,units/st.sy*100):0}%"></div>${[...Array(11)].map((_,i)=>`<i style="left:${i*10}%"${i%5?'':' class="maj"'}></i>`).join('')}</div><div class="pr-syr-l num">${[0,.5,1].map(x=>`<span>${Math.round(st.sy*x)}</span>`).join('')}</div>
    ${units>st.sy?`<div class="pr-warn sm">${PI.warn}<span>${esc(PT('over','That dose is more than one full scale.'))}</span></div>`:''}
    <div class="pr-list pr-stats"><div class="pr-row"><span class="pr-t"><b>Volume</b></span><span class="pr-val num">${f(ml)?kgs(Math.round(ml*1000)/1000):'—'} ml</span></div><div class="pr-row"><span class="pr-t"><b>Concentration</b></span><span class="pr-val num">${f(conc)?kgs(Math.round(conc*1000)/1000):'—'} mg/ml</span></div><div class="pr-row"><span class="pr-t"><b>${esc(PT('dpu','Doses per unit'))}</b></span><span class="pr-val num">${f(per)?per:'—'}</span></div></div>`;LS.set('pcalc',st)};
  const sb=$('sheetBody');sb.oninput=e=>{const k=e.target.dataset.r;if(!k)return;st[k]=+e.target.value||0;draw()};
  sb.onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.u){st.unit=b.dataset.u;$('rcUnit').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b))}if(b.dataset.sy){st.sy=+b.dataset.sy;$('rcSy').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b))}draw()};draw()}
function protoHistory(){const days={};PLOG.logs.forEach(l=>{const d=ymd(logical(new Date(l.at)));(days[d]=days[d]||[]).push(l)});
  openSheet('History',Object.entries(days).sort((a,b)=>a[0]<b[0]?1:-1).slice(0,60).map(([d,ls])=>`<div class="pr-sec"><span>${esc(nice(d))}</span></div><div class="pr-list">${ls.map(l=>{const c=PROTO.list.find(x=>x.id===l.cid);return `<div class="pr-row" style="--c:${c?c.color:'#555'}"><span class="pr-dot"></span><span class="pr-t"><b>${esc(c?c.name:'?')}</b><small>${esc(fmtAmt(l.amt,l.unit))}${l.site?' · '+esc(spotName(l.site)):''}</small></span><span class="pr-val dim num">${new Date(l.at).toTimeString().slice(0,5)}</span></div>`}).join('')}</div>`).join('')||'<div class="pr-empty">No doses logged yet</div>')}
