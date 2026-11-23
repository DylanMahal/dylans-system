/* ================= TODAY ================= */
let L=logical(),DAYK=ymd(L),DOWN=DOW[L.getDay()];
let planKind=(DOWN==='Sat'||DOWN==='Sun')?'weekend':'weekday',planForced=false;
let DAY={ticks:{},water:0,msg:{},dw:0};let filt='all';
/* injectables follow the protocols page: shown only on the days their protocol is due, hidden entirely until one exists */
let PROTO_READY=false;
function protoFor(i){if(!PROTO_READY)return null;const a=norm(i.item);return PROTO.list.find(c=>{const b=norm(c.name);return b&&(a===b||(Math.min(a.length,b.length)>=4&&(a.includes(b)||b.includes(a))))})||null}
function protoManaged(i){const r=norm(i.route||'');return !!r&&(PX.spot||[]).some(s=>norm(s)===r)}
function protoOk(i,d){if(!PROTO_READY)return true;const c=protoFor(i);if(c)return scheduledOn(c,d||DAYK);return !protoManaged(i)}
function eff(i){const c=protoFor(i);const tm=c&&c.times&&c.times[0];if(!tm||tm==='any'||tm===i.time)return i;const t=parseT(tm);return t===null?i:{...i,time:tm,t:t<300?t+1440:t}}
const onToday=i=>(!i.days||i.days.has(DOWN))&&protoOk(i);
function todaySync(){if(typeof M!=='undefined'&&M.plans&&M.plans[planKind]&&$('blocks'))renderToday()}
function visibleItems(){return M.plans[planKind].flatMap(b=>b.items.filter(onToday).map(eff))}
/* items flagged "doesn't count" stay on the list and can be ticked, but are left out of the day % */
let TITLES={};
load('today/titles').then(d=>{TITLES=d||{};if(typeof M!=='undefined'&&M.plans)rebuild()}).catch(()=>{});
watch('today/titles',d=>{TITLES=d||{};if(typeof M!=='undefined'&&M.plans)rebuild()});
window.addEventListener('sys-patch',e=>{try{const o=JSON.parse(e.detail);if(o.titles){TITLES={...TITLES,...o.titles};save('today/titles',TITLES)}
for(const [k,v] of Object.entries(o.p||{})){if(v===null)dropPatch(k);else patch(k,v,v._ctx)}
if(o.nopctReset)NOPCT={m:{}};(o.nopct||[]).forEach(k=>{NOPCT.m[k]=1});if(o.nopct)save('today/nopct',NOPCT,true);if(o.titles)rebuild();document.documentElement.dataset.patched=String(Date.now())}catch(x){document.documentElement.dataset.patched='err '+x.message}});
window.addEventListener('sys-kv',e=>{load(e.detail).then(d=>{document.documentElement.dataset.kv=JSON.stringify(d)}).catch(x=>{document.documentElement.dataset.kv='err '+x.message})});
window.addEventListener('sys-dump',()=>{const r={};for(const kind of ['weekday','weekend']){r[kind]={blocks:M.plans[kind].map(b=>({row:b.row,title:b.title,items:b.items.map(i=>({key:i.key,time:i.time,item:i.item,type:i.type,dose:i.dose,route:i.route,sched:i.sched,notes:i.notes,caution:i.caution}))})),extra:M.extra[kind]}}
document.documentElement.dataset.dump=JSON.stringify({r,t:TITLES,e:EDITS.p})});
let NOPCT={m:{}};
load('today/nopct').then(d=>{if(d)NOPCT={m:{},...d};if(typeof M!=='undefined'&&M.plans)updateCounts()}).catch(()=>{});
watch('today/nopct',d=>{NOPCT=d?{m:{},...d}:{m:{}};if(typeof M!=='undefined'&&M.plans&&$('pct'))updateCounts()});
function setNoPct(i,off){const key=typeof i==='string'?i:pctId(i);if(off)NOPCT.m[key]=1;else delete NOPCT.m[key];save('today/nopct',NOPCT,true);if($('pct'))updateCounts()}
function pctId(i){return (i.tk||'').toLowerCase().replace(/\s+/g,' ').trim()}
function noPct(i){return !!NOPCT.m[pctId(i)]}
function countedItems(){return visibleItems().filter(i=>!noPct(i))}
function nowM(){let m=mins(new Date());if(m<300)m+=1440;return m}
function itemRow(i){
  const ds=[i.dose&&i.dose!=='—'?i.dose:null,i.route&&i.route!=='—'?i.route:null].filter(Boolean).join(' · ');
  const sch=i.sched&&!/^(Daily|—|None)$/.test(i.sched)?i.sched:'';
  return `<div class="it" role="checkbox" tabindex="0" aria-checked="false" data-k="${esc(i.tk)}" data-t="${i.t??''}" data-cmp="${i.cmp?1:0}"><span class="box"></span><span class="t num">${esc(i.time||'')}</span><span><span class="nm">${esc(i.item)}</span>${i.edited?'<span class="delta">Δ</span>':''}${ds?`<span class="dd">${esc(ds)}</span>`:''}${sch?`<span class="dd">· ${esc(sch)}</span>`:''}${i.caution?'<span class="warnflag" title="Has a caution">⚠︎</span>':''}${i.notes?`<span class="nt">${esc(i.notes)}</span>`:''}${i.caution?`<span class="ca">${esc(i.caution)}</span>`:''}</span><span class="row" style="gap:6px;justify-content:flex-end"><button class="ed" type="button" data-edit="${esc(i.key)}">✎</button><span class="ty${i.cmp?' c':''}">${esc(i.type||'')}</span></span></div>`;
}
function renderToday(){if(typeof renderTodayTasks==='function')renderTodayTasks();if(typeof renderTodayCal==='function')renderTodayCal();
  const blocks=M.plans[planKind];
  
  $('pWd').setAttribute('aria-pressed',planKind==='weekday');$('pWe').setAttribute('aria-pressed',planKind==='weekend');
  const gym=(planKind==='weekday'&&(DOWN==='Tue'||DOWN==='Thu'))||(planKind==='weekend');
  const tdate=L.toLocaleDateString('en-GB',{weekday:'short',day:'2-digit',month:'short'}).toUpperCase();
  const late=mins(new Date())<300;
  $('dateline').innerHTML=`<span class="chipy">${planKind==='weekend'?'Weekend':'Weekday'} plan</span>${gym?`<button class="chipy hot" type="button" data-go="gym">Gym day · ${gymTypeFor()} <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>`:''}${planKind==='weekday'&&!gym?'<span class="chipy">Rest day · dinner 19:30</span>':''}${late?'<span class="chipy hot">after midnight · still logging '+esc(DOWN)+'</span>':''}`;
  $('strip').innerHTML=blocks.map(b=>`<button type="button" data-b="${b.bi}" style="flex:${Math.max(b.e-b.s,20)}"><span class="t num">${fmtM(b.s)}</span><span class="n">${esc(b.short.toLowerCase())}</span><span class="fill"></span></button>`).join('')+`<span class="nowline" id="nowline"></span>`;
  const open=new Set([...document.querySelectorAll('#blocks .blk.open')].map(e=>e.dataset.b));
  $('blocks').innerHTML=blocks.map(b=>{const its=b.items.filter(onToday).map(eff);
    return `<div class="blk${open.has(String(b.bi))?' open':''}" id="blk-${b.bi}" data-b="${b.bi}"><button class="bh" type="button" aria-expanded="${open.has(String(b.bi))}"><span class="ar">▸</span><span class="tm num">${fmtM(b.s)}–${fmtM(b.e)}</span><span class="ti">${esc(b.title)}</span><span class="ct num"></span><span class="mini"><span></span></span></button><div class="items">${its.map(itemRow).join('')}<button class="addrow" type="button" data-addblock="${b.row}">+ Add item to ${esc(b.short.toLowerCase())}</button></div></div>`}).join('');
  const ex=M.extra[planKind];const showK=Object.keys(ex).filter(k=>/^AS NEEDED/.test(k));
  $('todayExtra').innerHTML=showK.map(k=>`<div class="blk" data-x="1"><button class="bh" type="button" aria-expanded="false"><span class="ar">▸</span><span class="tm">${/WEEKLY/.test(k)?'weekly':'any time'}</span><span class="ti">Situational</span><span class="ct">${ex[k].length} items</span><span></span></button><div class="items">${ex[k].map(r=>`<div class="it" role="checkbox" tabindex="0" aria-checked="false" data-k="${esc(r.tk)}" data-cmp="${CMP.has(r.type)?1:0}"><span class="box"></span><span class="t">${esc(r.day||'—')}</span><span><span class="nm">${esc(r.item)}</span>${r.edited?'<span class="delta">Δ</span>':''}<span class="dd">${esc([r.dose,r.route,r.sched].filter(x=>x&&x!=='—').join(' · '))}</span>${r.caution?'<span class="warnflag">⚠︎</span>':''}${r.notes?`<span class="nt">${esc(r.notes)}</span>`:''}${r.caution?`<span class="ca">${esc(r.caution)}</span>`:''}</span><span class="row" style="gap:6px;justify-content:flex-end"><button class="ed" type="button" data-editx="${esc(r.key)}" data-sec="${esc(k)}">✎</button><span class="ty c">${esc(r.type||'')}</span></span></div>`).join('')}<button class="addrow" type="button" data-addsec="${esc(k)}">+ Add</button></div></div>`).join('');
  applyTicks();applyFilter();tickNow(true);
}
function applyTicks(){document.querySelectorAll('#v-today .it').forEach(el=>el.setAttribute('aria-checked',!!DAY.ticks[el.dataset.k]));updateCounts()}
function updateCounts(){
  const vis=countedItems();const total=vis.length;const done=vis.filter(i=>DAY.ticks[i.tk]).length;const p=total?Math.round(done/total*100):0;
  $('pct').textContent=p+'%';$('pct').className='pct num '+(p>=80?'ok':'');
  $('asc').innerHTML=`<span class="pbar${p>=80?' ok':''}"><i style="width:${Math.min(100,p)}%"></i><em></em></span>`;
  $('pctTxt').textContent=`${done}/${total} ticked · target 80%`;
  M.plans[planKind].forEach(b=>{const its=b.items.filter(onToday);const el=$('blk-'+b.bi);if(!el)return;const d=its.filter(i=>DAY.ticks[i.tk]).length;
    el.querySelector('.ct').textContent=`${d}/${its.length}`;el.querySelector('.mini span').style.width=(its.length?d/its.length*100:0)+'%';el.classList.toggle('done',its.length>0&&d===its.length);
    const sb=document.querySelector(`#strip button[data-b="${b.bi}"] .fill`);if(sb)sb.style.width=(its.length?d/its.length*100:0)+'%'});
  return {done,total,p};
}
function persistDay(){const {done,total}=updateCounts();const names=visibleItems().filter(i=>DAY.ticks[i.tk]).map(i=>i.item);DAY={...DAY,done,total,names,plan:planKind,dow:DOWN};save('days/d-'+DAYK,DAY);schedWidget()}
function setTick(k,on){if(on)DAY.ticks[k]=1;else delete DAY.ticks[k];document.querySelectorAll(`#v-today .it[data-k="${CSS.escape(k)}"]`).forEach(el=>el.setAttribute('aria-checked',on));persistDay()}
function autoTick(re){const it=visibleItems().find(i=>re.test(i.item));if(it&&!DAY.ticks[it.tk])setTick(it.tk,true)}
function toggle(el){
  const k=el.dataset.k;const on=!DAY.ticks[k];setTick(k,on);
  if(on){burstEl(el.querySelector('.box'),34);const nm=el.querySelector('.nm');scramble(nm,nm.textContent,300)}
  const c=updateCounts();const blk=el.closest('.blk');
  if(on&&blk&&!blk.dataset.x&&blk.classList.contains('done')){shake();flash('block_cleared');burstEl(blk.querySelector('.bh'),90,true)}
  if(on&&c.done===c.total&&c.total)setTimeout(()=>{flash('day_complete');shake();burst(innerWidth/2,innerHeight/2,200,true)},350);
}
$('v-today').addEventListener('click',e=>{
  const ed=e.target.closest('[data-edit]');if(ed){e.stopPropagation();const it=M.plans[planKind].flatMap(b=>b.items).find(i=>i.key===ed.dataset.edit);if(it)editPlanItem(planKind,it);return}
  const edx=e.target.closest('[data-editx]');if(edx){e.stopPropagation();const r=(M.extra[planKind][edx.dataset.sec]||[]).find(x=>x.key===edx.dataset.editx);if(r)editExtra(planKind,r);return}
  const ab=e.target.closest('[data-addblock]');if(ab){addPlanItem(planKind,+ab.dataset.addblock);return}
  const as=e.target.closest('[data-addsec]');if(as){addExtra(planKind,as.dataset.addsec);return}
  const g=e.target.closest('[data-go]');if(g){go(g.dataset.go);return}
  const it=e.target.closest('.it');if(it){toggle(it);return}
  const bh=e.target.closest('.bh');if(bh){const b=bh.parentElement;const o=!b.classList.contains('open');b.classList.toggle('open',o);bh.setAttribute('aria-expanded',o);return}
  const sb=e.target.closest('#strip button');if(sb)openBlock(+sb.dataset.b,true);
});
$('v-today').addEventListener('keydown',e=>{if((e.key===' '||e.key==='Enter')&&e.target.classList.contains('it')){e.preventDefault();toggle(e.target)}});
function openBlock(bi,scroll){const el=$('blk-'+bi);if(!el)return;el.classList.add('open');el.querySelector('.bh').setAttribute('aria-expanded',true);if(scroll){el.scrollIntoView({behavior:FX?'smooth':'auto',block:'start'});FX&&el.animate([{boxShadow:'0 0 0 2px #ff2a6d'},{boxShadow:'0 0 0 0 transparent'}],{duration:900})}}
$('filtSeg').onclick=e=>{const b=e.target.closest('button');if(!b)return;filt=b.dataset.f;$('filtSeg').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b));applyFilter()};
function applyFilter(){document.querySelectorAll('#v-today .it').forEach(el=>{const c=el.dataset.cmp==='1';el.classList.toggle('flt',filt==='cmp'&&!c||filt==='rtn'&&c)})}
function tog(id,cls,key){$(id).onclick=function(){const on=this.getAttribute('aria-pressed')!=='true';this.setAttribute('aria-pressed',on);$('v-today').classList.toggle(cls,on);LS.set(key,on)};if(LS.get(key)){$(id).setAttribute('aria-pressed',true);$('v-today').classList.add(cls)}}
tog('hideDone','hidedone','hideDone');document.body.classList.add('showinfo');
$('pWd').onclick=()=>{planKind='weekday';planForced=true;firstNow=true;renderToday();glitchAll()};
$('pWe').onclick=()=>{planKind='weekend';planForced=true;firstNow=true;renderToday();glitchAll()};
let resetArm=0;$('resetDay').onclick=function(){if(Date.now()-resetArm<2500){DAY.ticks={};applyTicks();persistDay();this.textContent='reset';glitchAll();resetArm=0}else{resetArm=Date.now();this.textContent='tap again';setTimeout(()=>{this.textContent='reset'},2500)}};

let lastMin=-1,firstNow=true;
function tickNow(force){if(!M||!M.plans||!M.plans[planKind]||!M.plans[planKind].length)return;
  if(!booted||!M.plans)return;
  const n=new Date();const hm=pad(n.getHours())+':'+pad(n.getMinutes());const ce=$('clock');
  if(ce.textContent!==hm){if(!force&&FX)scramble(ce,hm,420);else ce.textContent=hm;ce.dataset.text=hm}
  $('secs').textContent=pad(n.getSeconds());
  const m=nowM();if(m===lastMin&&!force)return;lastMin=m;
  const nl=logical();if(ymd(nl)!==DAYK){L=nl;DAYK=ymd(L);DOWN=DOW[L.getDay()];if(!planForced)planKind=(DOWN==='Sat'||DOWN==='Sun')?'weekend':'weekday';firstNow=true;loadDay();return}
  const blocks=M.plans[planKind];const cur=blocks.find(b=>m>=b.s&&m<b.e);
  const vis=visibleItems().filter(i=>i.t!==null).sort((a,b)=>a.t-b.t);
  const past=vis.filter(i=>i.t<=m);const nowT=past.length?past[past.length-1].t:null;const nowItems=vis.filter(i=>i.t===nowT);const next=vis.find(i=>i.t>m);
  const sleeping=m>=1440||m<480;
  $('nowBlk').textContent=cur?fmtM(cur.s)+'–'+fmtM(cur.e):(sleeping?'00:00–08:00':'');
  const nowName=sleeping&&m>=1440?'sleep · lights out was 00:00':cur?cur.short.toLowerCase():'free time';
  if($('nowItem').dataset.v!==nowName){$('nowItem').dataset.v=nowName;scramble($('nowItem'),nowName)}
  $('nowSub').textContent=nowItems.length&&!sleeping?`${fmtM(nowT)} · ${nowItems.slice(0,3).map(i=>i.item).join(', ')}${nowItems.length>3?' +'+(nowItems.length-3):''}`:(sleeping?'next up is the 08:00 wake':'');
  if(next){const dt=next.t-m;const prev=nowT??(cur?cur.s:m);const same=vis.filter(i=>i.t===next.t);const nn=same.length>1?`${next.item} +${same.length-1}`:next.item;
    if($('nextItem').dataset.v!==nn){$('nextItem').dataset.v=nn;scramble($('nextItem'),nn)}
    $('nextAt').textContent=fmtM(next.t);$('eta').textContent=dt>=60?`${Math.floor(dt/60)}h${pad(dt%60)}`:`${dt}m`;$('etaBar').style.width=Math.min(100,Math.max(2,(m-prev)/Math.max(1,next.t-prev)*100))+'%';
  }else{$('nextItem').textContent='wake · 08:00';$('nextAt').textContent='08:00';const dt=(1440+480-m)%1440;$('eta').textContent=`${Math.floor(dt/60)}h${pad(dt%60)}`;$('etaBar').style.width='100%'}
  const btns=[...$('strip').querySelectorAll('button')];btns.forEach(b=>{const bl=blocks[+b.dataset.b];b.classList.toggle('cur',bl===cur);b.classList.toggle('past',m>=bl.e)});
  const nl2=$('nowline');if(nl2){const tot=btns.reduce((s,b)=>s+parseFloat(b.style.flex),0);let acc=0,pos=null;for(const b of btns){const bl=blocks[+b.dataset.b];const w=parseFloat(b.style.flex);if(m>=bl.s&&m<bl.e){pos=acc+(m-bl.s)/(bl.e-bl.s)*w;break}acc+=w}if(pos===null)pos=m<blocks[0].s?0:tot;nl2.style.left=`calc(${pos/tot*100}% - 1px)`}
  document.querySelectorAll('#blocks .blk').forEach(el=>{const bl=blocks[+el.dataset.b];const isCur=bl===cur;el.classList.toggle('cur',isCur);if(isCur&&firstNow){el.classList.add('open');el.querySelector('.bh').setAttribute('aria-expanded',true)}});
  if(firstNow&&!cur){if(sleeping&&m>=1440){const all=document.querySelectorAll('#blocks .blk');all.length&&all[all.length-1].classList.add('open')}else{const f=document.querySelector('#blocks .blk');f&&f.classList.add('open')}}
  firstNow=false;
  document.querySelectorAll('#blocks .it').forEach(el=>el.classList.toggle('nowit',el.dataset.t!==''&&+el.dataset.t===nowT&&!sleeping));
}
setInterval(()=>{if(!document.hidden)tickNow(false)},1000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)tickNow(false)});
async function loadDay(){
  const p='days/d-'+DAYK;const d=await load(p);DAY={ticks:{},water:0,msg:{},dw:0,...(d||{})};
  renderToday();renderTools();watch(p,dd=>{if(p!=='days/d-'+DAYK)return;DAY={ticks:{},water:0,msg:{},dw:0,...dd};applyTicks();renderTools();if(cur==='streaks'&&typeof renderHabits==='function'&&!hHold)renderHabits()});
}


