/* ================= STREAKS (Streaks-app style habits) =================
   docs: habits/list {list:[habit]} · habits/log {d:{'YYYY-MM-DD':{habitId:count}}}
   habit: {id,n,ic,col,type:'daily'|'week'|'days'|'neg',per(times/week),days:[0-6],q(target per day),unit,remind:'HH:MM',created,arch} */
const HCOLS=['#ff2a6d','#05d9e8','#9b5cff','#57f5a8','#ffb000','#ff6b3d','#4da3ff','#e6e6e6'];
const HICONS='💪 🏋️ 🏃 🚶 🧘 💧 🥗 🍎 💊 🧴 🦷 🛏️ 📖 ✍️ 💻 🧠 🎯 🧹 🐈 ☀️ 🌙 🚿 🧊 📵 🚭 🍺 🍬 ☕ 🎧 🙏 💸 📞 🪥 ✂️ 👔 🔥 ⭐ ✅'.split(' ');
let HAB={list:[]},HLOG={d:{}},habLoaded=false,HSEL=null;
async function loadHabits(){if(habLoaded){renderHabits();return}const [l,g,dd]=await Promise.all([load('habits/list'),load('habits/log'),listDocs('days/d-')]);(dd||[]).forEach(r=>{if(r.data&&r.data.names)DNAMES[r.path.slice(7)]=r.data.names});HAB={list:[],...(l||{})};HLOG={d:{},...(g||{})};habLoaded=true;renderHabits()}
watch('habits/list',d=>{if(d){HAB={list:[],...d};if(cur==='streaks')renderHabits()}});
watch('habits/log',d=>{if(d){HLOG={d:{},...d};if(cur==='streaks'&&!hHold)renderHabits()}});
const hSave=()=>save('habits/list',HAB),hSaveLog=()=>{save('habits/log',HLOG);hWidget()};
/* habits linked to Today: every plan item except tasks/work/sleep/meals etc. Ticks live in the Today day docs (days/d-*), so ticking here or in Today is the same tick */
const HL_SKIP=new Set(['Task','Work','Sleep','Meal','Break','Leisure','Social','Research','Plan','Study']);
const HL_META={Habit:['✅','#57f5a8','habits'],Training:['🏋️','#ff2a6d','training'],Mindset:['🎯','#ffb000','mindset'],Circadian:['☀️','#ffb000','circadian']};Object.assign(HL_META,LX('hl',{}));
/* mindset streaks = these Today items only, whatever their plan type */
const HL_MIND=/chess|leet ?code|deep ?work/i;
let DNAMES={},dnLoaded=false;
const hlKind=d=>{const w=new Date(d+'T12:00').getDay();return w===0||w===6?'weekend':'weekday'};
const hlItems=(d,name)=>{if(!M.plans)return [];const dow=DOW[new Date(d+'T12:00').getDay()];return (M.plans[hlKind(d)]||[]).flatMap(b=>b.items).filter(i=>i.item.trim()===name&&(!i.days||i.days.has(dow)))};
function hLinked(){if(!M.plans)return [];const hide=new Set(HAB.hide||[]);const map=new Map();
  for(const kind of ['weekday','weekend'])(M.plans[kind]||[]).forEach(b=>b.items.forEach(i=>{if(!i.item)return;const n=i.item.trim();const mind=HL_MIND.test(n);if(!mind&&(HL_SKIP.has(i.type)||i.type==='Mindset'))return;const id='tl:'+n.toLowerCase();if(map.has(id))return;const m=mind?HL_META.Mindset:HL_META[i.type]||['⭐','#e6e6e6',(i.type||'other').toLowerCase()];
    map.set(id,{id,n,ic:m[0],col:m[1],grp:m[2],type:'daily',link:n,names:[n],created:hFirstDay()})}));
  /* combined habits: several Today items counted as one streak (config lives in habits/list .combo) */
  (HAB.combo||[]).forEach(c=>{const mem=(c.names||[]).map(n=>map.get('tl:'+String(n).trim().toLowerCase())).filter(Boolean);if(!mem.length)return;mem.forEach(x=>map.delete(x.id));const f=mem[0];map.set('cb:'+c.id,{id:'cb:'+c.id,n:c.n||f.n,ic:c.ic||f.ic,col:c.col||f.col,grp:f.grp,type:'daily',names:mem.map(x=>x.n),once:!!c.once,every:!!c.every,combo:c.id,created:hFirstDay()})});
  return [...map.values()].filter(h=>!hide.has(h.id))}
const hName=h=>(HAB.ren&&HAB.ren[h.id])||hDisp(h.n);
const hDisp=n=>String(n).replace(/\s*[\(\[][^\)\]]*[\)\]]/g,'').replace(/\s{2,}/g,' ').trim()||String(n);
function hFirstDay(){const k=Object.keys(DNAMES).sort()[0];return k||DAYK}
function hTodayTicked(name){return visibleItems().filter(i=>i.item.trim()===name&&DAY.ticks[i.tk])}
const hItemsFor=(d,h)=>h.names.flatMap(n=>hlItems(d,n));
const hMan=(h,d)=>((HLOG.d[d]||{})[h.id])||0;
const hCnt=(h,d)=>{if(h.names){let c=hMan(h,d);if(d===DAYK&&M.plans)c+=visibleItems().filter(i=>h.names.includes(i.item.trim())&&DAY.ticks[i.tk]).length;else c+=(DNAMES[d]||[]).filter(x=>h.names.includes(String(x).trim())).length;return c}return hMan(h,d)};
const hTarget=(h,d)=>h.names?(h.once?1:Math.max(1,hItemsFor(d||DAYK,h).length)):Math.max(1,+h.q||1);
const hDone=(h,d)=>h.type==='neg'?hCnt(h,d)===0:hCnt(h,d)>=hTarget(h,d);
const hDue=(h,d)=>{if(h.names)return !!h.every||hItemsFor(d,h).length>0;const dow=new Date(d+'T12:00').getDay();return h.type==='days'?(h.days||[]).includes(dow):true};
const hAdd=(d,n)=>{const x=new Date(d+'T12:00');x.setDate(x.getDate()+n);return ymd(x)};
const hWeekStart=d=>{const x=new Date(d+'T12:00');const k=(x.getDay()+6)%7;x.setDate(x.getDate()-k);return ymd(x)};
function hWeekCount(h,d){const s=hWeekStart(d);let n=0;for(let i=0;i<7;i++){const k=hAdd(s,i);if(k>DAYK)break;if(hCnt(h,k)>=hTarget(h))n++}return n}
/* streak: days (or weeks for x-per-week habits) in a row; today doesn't break it until it's over */
function hStreak(h){const start=h.created||'2000-01-01';
  if(h.type==='week'){const per=+h.per||3;const ok=w=>{let c=0;for(let i=0;i<7;i++){const k=hAdd(w,i);if(k<=DAYK&&hCnt(h,k)>=hTarget(h))c++}return c>=per};let n=0,w=hWeekStart(DAYK);if(ok(w))n++;w=hAdd(w,-7);while(w>=hWeekStart(start)&&ok(w)){n++;w=hAdd(w,-7)}return {n,unit:'wk'}}
  let n=0,d=DAYK;if(!hDone(h,d)||!hDue(h,d))d=hAdd(d,-1);
  for(let i=0;i<2000&&d>=start;i++){if(!hDue(h,d)){d=hAdd(d,-1);continue}if(hDone(h,d)){n++;d=hAdd(d,-1)}else break}return {n,unit:'day'}}
function hBest(h){const start=h.created||DAYK;let best=0,cur=0;for(let d=start;d<=DAYK;d=hAdd(d,1)){if(!hDue(h,d))continue;if(hDone(h,d)){cur++;best=Math.max(best,cur)}else if(d!==DAYK)cur=0}return Math.max(best,hStreak(h).n)}
function hRate(h,days=30){let due=0,ok=0;for(let i=0;i<days;i++){const d=hAdd(DAYK,-i);if(d<(h.created||'0'))break;if(!hDue(h,d))continue;if(i===0&&!hDone(h,d))continue;due++;if(hDone(h,d))ok++}return due?Math.round(ok/due*100):0}
const hAll=()=>HAB.list.filter(h=>!h.arch).concat(hLinked());
const hGet=id=>HAB.list.find(z=>z.id===id)||hLinked().find(z=>z.id===id);
function renderHabits(){if(!habLoaded){loadHabits();return}const el=$('habBody');const L=HAB.list.filter(h=>!h.arch);const LK=hLinked();const ALL=L.concat(LK);
  const today=ALL.filter(h=>hDue(h,DAYK));const done=today.filter(h=>hDone(h,DAYK)).length;
  $('habSub').textContent=ALL.length?`${done}/${today.length} today · ${Math.max(0,...ALL.map(h=>hStreak(h).n))} best current streak`:'build streaks that stick';
  const grps=[];LK.forEach(h=>{let g=grps.find(x=>x.n===h.grp);if(!g)grps.push(g={n:h.grp,col:h.col,L:[]});g.L.push(h)});
  const gh=grps.map(g=>{const due=g.L.filter(h=>hDue(h,DAYK));const ok=due.filter(h=>hDone(h,DAYK)).length;const open=(HAB.open||[]).includes(g.n);
    return `<div class="panel hgrp${open?' open':''}"><button type="button" class="ph hgh" data-hg="${esc(g.n)}"><span class="tag" style="color:${g.col}">${esc(g.n)}</span><span class="num dim">${ok}/${due.length} today${due.length&&ok===due.length?' ✓':''} <span class="hchev">${open?'▾':'▸'}</span></span></button>${open?`<div class="pb"><div class="hgrid sm">${g.L.sort((a,b)=>hDue(b,DAYK)-hDue(a,DAYK)).map(hTile).join('')}</div></div>`:''}</div>`}).join('');
  el.innerHTML=`<div class="hgrid">${L.map(hTile).join('')}<button type="button" class="htile hnew" id="hNew"><span class="hring"><b>＋</b></span><span class="hn">new habit</span></button></div>
    ${gh?`<div class="flab" style="margin:16px 0 6px">from today · ticks sync both ways</div>${gh}`:''}
    ${ALL.length?`<div class="dim" style="font-size:11px;text-align:center;margin-top:10px">hold a habit to complete it · tap for stats</div>`:''}
    ${L.length?`<div class="panel" style="margin-top:14px"><div class="ph"><span class="tag">last 12 weeks</span><span class="dim">${Math.round(L.reduce((a,h)=>a+hRate(h,30),0)/Math.max(1,L.length))}% in the last 30 days</span></div><div class="pb">${hHeat(null)}</div></div>`:''}`;
  hBind()}
function hTile(h){const c=hCnt(h,DAYK),t=hTarget(h),due=hDue(h,DAYK),ok=hDone(h,DAYK);const st=hStreak(h);const p=h.type==='neg'?(ok?1:0):Math.min(1,c/t);const R=42,C=2*Math.PI*R;
  return `<button type="button" class="htile${ok?' ok':''}${due?'':' off'}${h.type==='neg'?' neg':''}" data-h="${h.id}" style="--hc:${h.col||HCOLS[0]}"><span class="hring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="${R}" class="hb"/><circle cx="50" cy="50" r="${R}" class="hf" style="stroke-dasharray:${C};stroke-dashoffset:${C*(1-p)}"/><circle cx="50" cy="50" r="${R}" class="hh" style="stroke-dasharray:${C};stroke-dashoffset:${C}"/></svg><b>${esc(h.ic||'⭐')}</b>${t>1&&h.type!=='neg'?`<em class="num">${c}/${t}</em>`:''}</span>
    <span class="hn">${esc(hName(h))}</span><span class="hs num">${st.n?`🔥 ${st.n} ${st.unit}${st.n>1?'s':''}`:h.type==='week'?`${hWeekCount(h,DAYK)}/${h.per||3} this week`:due?'start today':'rest day'}</span></button>`}
let hHold=null,hFired=0;
function hBind(){const el=$('habBody');
  el.onclick=e=>{if(e.target.closest('#hNew'))return hEdit(null);const g=e.target.closest('[data-hg]');if(g){const n=g.dataset.hg;const o=new Set(HAB.open||[]);o.has(n)?o.delete(n):o.add(n);HAB.open=[...o];hSave();renderHabits();return}const t=e.target.closest('[data-h]');if(!t)return;if(Date.now()-hFired<700)return;hDetail(t.dataset.h)};
  const start=(t,x)=>{if(hHold)return;const h=hGet(t.dataset.h);if(!h)return;const ring=t.querySelector('.hh');const C=2*Math.PI*42;
    ring.style.transition='none';ring.style.strokeDashoffset=C;void ring.offsetWidth;ring.style.transition='stroke-dashoffset .6s linear';ring.style.strokeDashoffset=0;t.classList.add('holding');
    hHold={t,x:x&&x.clientX,y:x&&x.clientY,timer:setTimeout(()=>{hFired=Date.now();hHold=null;t.classList.remove('holding');hTick(h,t)},600),ring,C}};
  const stop=()=>{if(!hHold)return;clearTimeout(hHold.timer);hHold.ring.style.transition='stroke-dashoffset .2s';hHold.ring.style.strokeDashoffset=hHold.C;hHold.t.classList.remove('holding');hHold=null};
  el.onpointerdown=e=>{const t=e.target.closest('[data-h]');if(t)start(t,e)};el.onpointerup=el.onpointercancel=stop;el.onpointermove=e=>{if(hHold&&hHold.x!=null&&Math.hypot(e.clientX-hHold.x,e.clientY-hHold.y)>12)stop()};
  el.oncontextmenu=e=>{if(e.target.closest('[data-h]'))e.preventDefault()}}
function hTick(h,tile){const fx=()=>{try{navigator.vibrate&&navigator.vibrate(hDone(h,DAYK)?[20,40,20]:10)}catch(e){}if(tile&&hDone(h,DAYK)&&h.type!=='neg'){const r=tile.getBoundingClientRect();burst(r.left+r.width/2,r.top+r.height/2,40,true)}};
  if(h.names){const its=visibleItems().filter(i=>h.names.includes(i.item.trim()));
    if(!its.length){const d=HLOG.d[DAYK]=HLOG.d[DAYK]||{};if(d[h.id])delete d[h.id];else d[h.id]=hTarget(h);hSaveLog()}
    else{const done=hDone(h,DAYK);const nx=its.find(i=>!DAY.ticks[i.tk]);
      if(!done&&nx)setTick(nx.tk,true);else{its.forEach(i=>{delete DAY.ticks[i.tk]});const m=HLOG.d[DAYK];if(m&&m[h.id]){delete m[h.id];hSaveLog()}persistDay();applyTicks()}}
    fx();renderHabits();hWidget();return}
  const d=HLOG.d[DAYK]=HLOG.d[DAYK]||{};const t=hTarget(h);
  if(h.type==='neg'){d[h.id]=(d[h.id]||0)?0:1}else{const c=d[h.id]||0;d[h.id]=c>=t?0:c+1}
  if(!d[h.id])delete d[h.id];hSaveLog();try{navigator.vibrate&&navigator.vibrate(hDone(h,DAYK)?[20,40,20]:10)}catch(e){}
  if(hDone(h,DAYK)&&h.type!=='neg'){const r=tile.getBoundingClientRect();burst(r.left+r.width/2,r.top+r.height/2,40,true)}
  renderHabits();if(typeof pushSync==='function')pushSync()}
function hHeat(h){const weeks=12;const s=hAdd(hWeekStart(DAYK),-7*(weeks-1));const L=h?[h]:HAB.list.filter(x=>!x.arch);let cells='';
  for(let w=0;w<weeks;w++){cells+='<div class="hcol">';for(let i=0;i<7;i++){const d=hAdd(s,w*7+i);if(d>DAYK){cells+='<i class="fut"></i>';continue}
    const due=L.filter(x=>hDue(x,d)&&d>=(x.created||'0'));const ok=due.filter(x=>hDone(x,d)).length;const v=due.length?ok/due.length:0;
    cells+=`<i title="${d} · ${ok}/${due.length}" style="${v?`background:${h?h.col:'var(--pink)'};opacity:${.2+.8*v}`:''}" class="${d===DAYK?'td':''}"></i>`}cells+='</div>'}
  return `<div class="hheat">${cells}</div>`}
/* log / undo a past day for a Today-linked habit: edits that day's doc so Today and streaks stay one source */
async function hPast(h,d){if(d>DAYK)return;const p='days/d-'+d;const doc=(await load(p))||{};let nm=(doc.names||[]).slice();
  if(hDone(h,d)){nm=nm.filter(x=>!h.names.includes(String(x).trim()));const m=HLOG.d[d];if(m&&m[h.id]){delete m[h.id];if(!Object.keys(m).length)delete HLOG.d[d];hSaveLog()}}
  else{const need=hTarget(h,d)-hCnt(h,d);let pool=h.once?[h.names[0]]:h.names.flatMap(n=>Array(hlItems(d,n).length).fill(n));if(!pool.length)pool=[h.names[0]];nm=nm.concat(pool.slice(0,Math.max(1,need)))}
  doc.names=nm;DNAMES[d]=nm;save(p,doc);try{navigator.vibrate&&navigator.vibrate(10)}catch(e){}}
function hRename(h){openSheet('rename','');$('sheetBody').innerHTML=`<label class="fl">name<input class="inp" id="hrN" value="${esc(hName(h))}"></label><div class="bigbtns" style="margin-top:12px"><button class="btn" type="button" id="hrR">reset</button><span style="flex:1"></span><button class="btn p" type="button" id="hrOk">save</button></div>`;
  const done=()=>{hSave();hWidget();closeSheet();renderHabits()};
  $('hrOk').onclick=()=>{const v=($('hrN').value||'').trim();HAB.ren=HAB.ren||{};if(v&&v!==hDisp(h.n))HAB.ren[h.id]=v;else delete HAB.ren[h.id];done()};
  $('hrR').onclick=()=>{if(HAB.ren)delete HAB.ren[h.id];done()}}
function hSplit(h){HAB.combo=(HAB.combo||[]).filter(c=>c.id!==h.combo);hSave();closeSheet();renderHabits()}
function hCombo(h){const L=hLinked().filter(x=>!x.combo);const sel=new Set([h.id]);let nm=hDisp(h.n),once=false,every=false;
  const draw=()=>{$('sheetBody').innerHTML=`<label class="fl">name<input class="inp" id="hcN" value="${esc(nm)}"></label><div class="dim" style="font-size:11px;margin:8px 0 4px">combine with</div><div>${L.map(x=>`<button type="button" class="btn${sel.has(x.id)?' p':''}" data-cm="${x.id}" style="margin:2px">${esc(x.n)}</button>`).join('')}</div>
    <label class="fl" style="margin-top:10px"><input type="checkbox" id="hcO"${once?' checked':''}> count once a day (any one of them)</label><label class="fl"><input type="checkbox" id="hcE"${every?' checked':''}> due every day</label>
    <div class="bigbtns" style="margin-top:12px"><span style="flex:1"></span><button class="btn p" type="button" id="hcOk">combine</button></div>`};
  const read=()=>{nm=($('hcN').value||'').trim();once=$('hcO').checked;every=$('hcE').checked};
  openSheet('combine streaks','');draw();
  $('sheetBody').onclick=e=>{const b=e.target.closest('button');if(!b)return;
    if(b.dataset.cm){read();const id=b.dataset.cm;if(id!==h.id)sel.has(id)?sel.delete(id):sel.add(id);draw();return}
    if(b.id==='hcOk'){read();HAB.combo=(HAB.combo||[]).concat({id:rid(),n:nm||hDisp(h.n),names:L.filter(x=>sel.has(x.id)).map(x=>x.n),once,every});hSave();closeSheet();renderHabits()}}}
function hDetail(id){const h=hGet(id);if(!h)return;const st=hStreak(h);
  const hist=[...Array(28)].map((_,i)=>{const d=hAdd(DAYK,-27+i);return `<button type="button" class="hday${hDone(h,d)?' ok':''}${hDue(h,d)?'':' off'}" data-hd="${d}" style="--hc:${h.col}"><span>${new Date(d+'T12:00').toLocaleDateString('en-GB',{weekday:'narrow'})}</span><b>${new Date(d+'T12:00').getDate()}</b></button>`}).join('');
  openSheet(`${h.ic||''} ${hName(h)}`,`<div class="hstats num"><div><b style="color:${h.col}">${st.n}</b><span>current ${st.unit}s</span></div><div><b>${hBest(h)}</b><span>best</span></div><div><b>${hRate(h,30)}%</b><span>last 30 days</span></div><div><b>${h.link?Object.keys(DNAMES).filter(d=>hDone(h,d)).length:Object.values(HLOG.d).filter(x=>x[h.id]).length}</b><span>${h.type==='neg'?'slips':'total'}</span></div></div>
    ${hHeat(h)}<div class="dim" style="font-size:11px;margin:12px 0 6px">last 28 days — tap a day to log or fix it</div><div class="hdays">${hist}</div>
    <div class="dim" style="font-size:11px;margin-top:10px">${h.type==='neg'?'avoid it — hold the tile if you slipped':h.type==='week'?`${h.per||3}× a week`:h.type==='days'?'on '+(h.days||[]).map(i=>DOW[i]).join(' '):'every day'}${hTarget(h)>1?` · ${hTarget(h)} ${esc(h.unit||'times')} a day`:''}${h.remind?` · reminder ${h.remind}`:''}</div>
    <div class="bigbtns" style="margin-top:14px">${h.names?`<button class="btn" type="button" id="hRn">rename</button><button class="btn" type="button" id="hCb">${h.combo?'split':'combine'}</button><button class="btn" type="button" id="hHide">hide</button>`:'<button class="btn" type="button" id="hEd">edit</button>'}<span style="flex:1"></span><button class="btn p" type="button" id="hOk">done</button></div>`);
  $('hOk').onclick=closeSheet;if($('hRn'))$('hRn').onclick=()=>hRename(h);if($('hCb'))$('hCb').onclick=()=>h.combo?hSplit(h):hCombo(h);if($('hEd'))$('hEd').onclick=()=>hEdit(h);if($('hHide'))$('hHide').onclick=()=>{HAB.hide=(HAB.hide||[]).concat(h.id);hSave();closeSheet();renderHabits()};
  $('sheetBody').onclick=e=>{const b=e.target.closest('[data-hd]');if(!b)return;const d=b.dataset.hd;if(h.names){(d===DAYK?Promise.resolve(hTick(h)):hPast(h,d)).then(()=>{hDetail(id);renderHabits()});return}const o=HLOG.d[d]=HLOG.d[d]||{};if(h.type==='neg')o[h.id]=o[h.id]?0:1;else o[h.id]=hDone(h,d)?0:hTarget(h);if(!o[h.id])delete o[h.id];hSaveLog();hDetail(id);renderHabits()}}
function hEdit(h){const isNew=!h;h=h?clone(h):{id:rid(),n:'',ic:'💪',col:HCOLS[HAB.list.length%HCOLS.length],type:'daily',per:3,days:[1,2,3,4,5],q:1,unit:'',remind:'',created:DAYK};
  const draw=()=>{$('sheetBody').innerHTML=`<label class="fl">habit<input class="inp" id="heN" value="${esc(h.n)}" placeholder="e.g. gym, skincare, no sugar"></label>
    <div class="dim" style="font-size:11px;margin:4px 0">icon</div><div class="hicons">${HICONS.map(i=>`<button type="button" data-hi="${i}" class="${h.ic===i?'on':''}">${i}</button>`).join('')}</div>
    <div class="dim" style="font-size:11px;margin:10px 0 4px">colour</div><div class="hcols">${HCOLS.map(c=>`<button type="button" data-hc="${c}" class="${h.col===c?'on':''}" style="background:${c}"></button>`).join('')}</div>
    <div class="dim" style="font-size:11px;margin:10px 0 4px">type</div><div class="seg mini">${[['daily','every day'],['days','some days'],['week','x per week'],['neg','break a habit']].map(([k,l])=>`<button type="button" data-ht="${k}" aria-pressed="${h.type===k}">${l}</button>`).join('')}</div>
    ${h.type==='days'?`<div class="hdow">${[1,2,3,4,5,6,0].map(i=>`<button type="button" data-hw="${i}" class="${(h.days||[]).includes(i)?'on':''}">${DOW[i]}</button>`).join('')}</div>`:''}
    ${h.type==='week'?`<label class="fl" style="margin-top:8px">times per week<input class="inp num" id="heP" value="${h.per||3}" inputmode="numeric"></label>`:''}
    ${h.type!=='neg'?`<div class="fgrid4" style="margin-top:8px"><label class="fl">times a day<input class="inp num" id="heQ" value="${h.q||1}" inputmode="numeric"></label><label class="fl">unit (optional)<input class="inp" id="heU" value="${esc(h.unit||'')}" placeholder="glasses, pages…"></label></div>`:''}
    <label class="fl" style="margin-top:8px">🔔 reminder<input type="time" class="inp" id="heR" value="${h.remind||''}"></label>
    <div class="bigbtns" style="margin-top:12px">${isNew?'':'<button class="btn d" type="button" id="heDel">delete</button>'}<span style="flex:1"></span><button class="btn p" type="button" id="heOk">${isNew?'add habit':'save'}</button></div>`};
  openSheet(isNew?'new habit':'edit habit','');draw();
  const read=()=>{const v=id=>$(id)?$(id).value:null;h.n=(v('heN')||'').trim();if(v('heP')!=null)h.per=Math.max(1,Math.min(7,+v('heP')||3));if(v('heQ')!=null)h.q=Math.max(1,+v('heQ')||1);if(v('heU')!=null)h.unit=v('heU').trim();h.remind=v('heR')||''};
  $('sheetBody').onclick=e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;
    if(d.hi||d.hc||d.ht||d.hw){read();if(d.hi)h.ic=d.hi;if(d.hc)h.col=d.hc;if(d.ht)h.type=d.ht;if(d.hw){const i=+d.hw;h.days=(h.days||[]).includes(i)?h.days.filter(x=>x!==i):(h.days||[]).concat(i)}draw();return}
    if(b.id==='heDel'){if(!b.dataset.arm){b.dataset.arm=1;b.textContent='tap again';return}HAB.list=HAB.list.filter(x=>x.id!==h.id);hSave();closeSheet();renderHabits();return}
    if(b.id==='heOk'){read();if(!h.n){$('heN').focus();return}const i=HAB.list.findIndex(x=>x.id===h.id);if(i>=0)HAB.list[i]=h;else HAB.list.push(h);hSave();hWidget();closeSheet();renderHabits();if(typeof pushSync==='function')pushSync()}}}
/* widget feed: a small summary doc any future widget can read */
function hWidget(){const L=hAll();save('widget/streaks',{at:new Date().toISOString(),day:DAYK,items:L.map(h=>({n:hName(h),ic:h.ic,col:h.col,streak:hStreak(h).n,unit:hStreak(h).unit,done:hDone(h,DAYK),due:hDue(h,DAYK),c:hCnt(h,DAYK),t:hTarget(h)}))})}
