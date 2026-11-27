/* ================= DAILY RULES BOX (Today, above the plan) =================
   today/dopa = {title, rules:[{id, t, hab}]} · dopa/log = {d:{'YYYY-MM-DD':[ruleId]}}
   A rule marked as a streak is also a habit (id 'dp-<ruleId>'), so it shows on Streaks and in the Streak widget.
   The rule words are yours: edit them in the box. The defaults are generic and can come from sys/lex (dopa). */
let DOPA=null,DPLOG={d:{}},dopaLoaded=false;
const DOPA_DEF=()=>({title:LW('dopat','Daily rules'),rules:LX('dopa',[]).map((t,i)=>({id:'r'+i,t,hab:false}))});
async function dopaLoad(){if(dopaLoaded)return;const [a,b]=await Promise.all([load('today/dopa'),load('dopa/log')].map(p=>p.catch(()=>null)));DOPA=a&&a.rules?a:DOPA_DEF();DPLOG={d:{},...(b||{})};dopaLoaded=true}
watch('today/dopa',d=>{if(d&&d.rules){DOPA=d;if(cur==='today')renderDopa()}});
watch('dopa/log',d=>{if(d){DPLOG={d:{},...d};if(cur==='today')renderDopa()}});
const dpHid=r=>'dp-'+r.id;
const dpOn=(r,day=DAYK)=>r.hab&&typeof HLOG!=='undefined'&&HLOG.d&&HLOG.d[day]&&HLOG.d[day][dpHid(r)]?true:((DPLOG.d[day]||[]).includes(r.id));
async function dpHabSync(){if(typeof loadHabits==='function'&&typeof habLoaded!=='undefined'&&!habLoaded){try{await loadHabits()}catch(e){}}if(typeof HAB==='undefined')return;let ch=false;
  DOPA.rules.filter(r=>r.hab).forEach(r=>{const id=dpHid(r),h=HAB.list.find(x=>x.id===id);if(!h){HAB.list.push({id,n:r.t,ic:'⛔',col:'#ff2a6d',type:'daily',q:1,created:DAYK});ch=true}else if(h.n!==r.t){h.n=r.t;ch=true}});
  if(ch){hSave();if(typeof hWidget==='function')hWidget()}}
let dpSynced=false;
async function renderDopa(){const el=$('todayDopa');if(!el)return;if(!dopaLoaded){await dopaLoad()}if(!dpSynced&&typeof booted!=='undefined'&&booted){dpSynced=true;dpHabSync().catch(e=>nxErr(e,'rules habits'))}
  const R=DOPA.rules||[];const n=R.filter(r=>dpOn(r)).length;
  el.innerHTML=`<div class="dp"><div class="dp-h"><b>${esc(DOPA.title||'Daily rules')}</b><span class="dim num">${n}/${R.length}</span><button type="button" class="dp-ed" id="dpEd">Edit</button></div>
    <div class="dp-l">${R.map(r=>`<button type="button" class="dp-r${dpOn(r)?' on':''}" data-dpr="${esc(r.id)}"><i></i><span>${esc(r.t)}</span>${r.hab?`<small>${(()=>{try{const h=typeof HAB!=='undefined'&&HAB.list.find(x=>x.id===dpHid(r));const s=h&&typeof hStreak==='function'?hStreak(h).n:0;return s?'🔥 '+s:'streak'}catch(e){return 'streak'}})()}</small>`:''}</button>`).join('')||'<div class="dim" style="font-size:12.5px">No rules yet. Tap Edit to add yours and pick which ones get a streak.</div>'}</div></div>`}
document.addEventListener('click',async e=>{
  const r=e.target.closest('#todayDopa [data-dpr]');
  if(r){const rule=DOPA.rules.find(x=>x.id===r.dataset.dpr);if(!rule)return;const on=!dpOn(rule);
    const L=new Set(DPLOG.d[DAYK]||[]);on?L.add(rule.id):L.delete(rule.id);DPLOG.d[DAYK]=[...L];save('dopa/log',DPLOG);
    if(rule.hab){await dpHabSync();if(typeof HLOG!=='undefined'){const d=HLOG.d[DAYK]=HLOG.d[DAYK]||{};if(on)d[dpHid(rule)]=1;else delete d[dpHid(rule)];hSaveLog();if(typeof hWidget==='function')hWidget()}}
    if(on){const b=r.getBoundingClientRect();if(typeof burst==='function')burst(b.left+20,b.top+b.height/2,18,true)}renderDopa();return}
  if(e.target.closest('#dpEd')){const rows=()=>DR.map((x,i)=>`<div class="dp-er"><input class="inp" data-dpt="${i}" value="${esc(x.t)}" placeholder="Rule"><label class="dp-sk"><input type="checkbox" data-dph="${i}"${x.hab?' checked':''}> streak</label><button type="button" class="iconbtn" data-dpx="${i}" aria-label="Remove">✕</button></div>`).join('');
    const DR=clone(DOPA.rules);
    const draw=()=>{$('dpRows').innerHTML=rows()};
    openSheet('Daily rules',`<label class="fl">Title<input class="inp" id="dpTi" value="${esc(DOPA.title||'')}"></label><div class="dim" style="font-size:12.5px;margin:6px 0 10px">Tick streak to give a rule its own streak on the Streaks page and in the Streak widget.</div><div id="dpRows" class="dp-ers"></div><button type="button" class="btn" id="dpAdd" style="margin-top:8px">+ Add rule</button><div class="bigbtns" style="margin-top:12px"><span style="flex:1"></span><button class="btn p" type="button" id="dpOk">Save</button></div>`);draw();
    const sb=$('sheetBody');const read=()=>{sb.querySelectorAll('[data-dpt]').forEach(x=>DR[+x.dataset.dpt].t=x.value.trim());sb.querySelectorAll('[data-dph]').forEach(x=>DR[+x.dataset.dph].hab=x.checked)};
    sb.onclick=ev=>{const x=ev.target.closest('[data-dpx]');if(x){read();DR.splice(+x.dataset.dpx,1);draw();return}
      if(ev.target.closest('#dpAdd')){read();DR.push({id:'r'+rid(),t:'',hab:false});draw();const ins=sb.querySelectorAll('[data-dpt]');ins[ins.length-1].focus();return}
      if(ev.target.closest('#dpOk')){read();DOPA={title:$('dpTi').value.trim()||'Daily rules',rules:DR.filter(x=>x.t)};save('today/dopa',DOPA);closeSheet();dpHabSync().then(renderDopa)}}}});
