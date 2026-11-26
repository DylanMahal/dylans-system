/* ================= LOOKS =================
   Labels are generic; your own words live in kv (routine steps, measurement names, the course item) or sys/lex.
   lk/r = {am:[step], pm:[step]} · lk/l = {d:{'YYYY-MM-DD':{am:[i], pm:[i]}}}
   lk/s = {course:{n, start, end}, r:[{d, s:1..10, note}]}
   measurements and monthly photos share body/meas + body/photos (group "looks"); a finished AM/PM routine ticks
   the "AM routine" / "PM routine" habits, so it shows on Streaks. */
let LKR={am:[],pm:[]},LKL={d:{}},LKS={course:null,r:[]},looksLoaded=false;
const LK_HAB={am:{id:'lk-am',n:'AM routine',ic:'☀️'},pm:{id:'lk-pm',n:'PM routine',ic:'🌙'}};
async function loadLooks(){if(!looksLoaded){const [r,l,s]=await Promise.all([load('lk/r'),load('lk/l'),load('lk/s'),progLoad()].map(p=>p.catch(()=>null)));
  LKR={am:[],pm:[],...(r||{})};LKL={d:{},...(l||{})};LKS={course:null,r:[],...(s||{})};looksLoaded=true}renderLooks()}
watch('lk/r',d=>{if(d){LKR={am:[],pm:[],...d};if(cur==='looks')renderLooks()}});
watch('lk/l',d=>{if(d){LKL={d:{},...d};if(cur==='looks')renderLooks()}});
watch('lk/s',d=>{if(d){LKS={course:null,r:[],...d};if(cur==='looks')renderLooks()}});
const lkDone=(d,sl)=>{const L=LKR[sl]||[],x=((LKL.d[d]||{})[sl])||[];return L.length>0&&L.every((_,i)=>x.includes(i))};
function lkStreak(sl){let n=0,d=DAYK;if(!lkDone(d,sl))d=addDays(d,-1);for(let i=0;i<999&&lkDone(d,sl);i++){n++;d=addDays(d,-1)}return n}
/* keep the matching habit in step: exists once a routine has steps, ticked when every step is */
async function lkHab(sl){const H=LK_HAB[sl];if(typeof habLoaded!=='undefined'&&!habLoaded&&typeof loadHabits==='function'){try{await loadHabits()}catch(e){}}if(typeof HAB==='undefined')return;
  if(!HAB.list.some(h=>h.id===H.id)){HAB.list.push({id:H.id,n:H.n,ic:H.ic,col:sl==='am'?'#ffb000':'#9b5cff',type:'daily',q:1,created:DAYK});hSave()}
  const d=HLOG.d[DAYK]=HLOG.d[DAYK]||{};const ok=lkDone(DAYK,sl);if(ok)d[H.id]=1;else delete d[H.id];hSaveLog()}
function lkRoutine(sl,label){const L=LKR[sl]||[],x=((LKL.d[DAYK]||{})[sl])||[];const st=lkStreak(sl);
  return `<div class="lk-rt"><div class="lk-rh"><b>${label}</b><span class="dim num">${x.filter(i=>i<L.length).length}/${L.length}${st?` · 🔥 ${st}`:''}</span><button type="button" class="lk-ed" data-lked="${sl}">Edit</button></div>
    ${L.length?L.map((t,i)=>`<button type="button" class="lk-step${x.includes(i)?' on':''}" data-lks="${sl}:${i}"><i></i><span>${esc(t)}</span></button>`).join(''):`<div class="dim" style="font-size:12.5px;padding:6px 0">No steps yet. Tap Edit to add yours.</div>`}</div>`}
function lkSkin(){const c=LKS.course,R=(LKS.r||[]).slice().sort((a,b)=>a.d<b.d?-1:1);const t=R.find(r=>r.d===DAYK);
  const dn=c&&c.start?Math.max(0,Math.round((new Date(DAYK+'T12:00')-new Date(c.start+'T12:00'))/864e5))+1:null;
  const pts=R.filter(r=>!c||!c.start||r.d>=addDays(c.start,-14));let chart='';
  if(pts.length>1){const W=330,H=90,t0=+new Date(pts[0].d+'T12:00'),t1=+new Date(pts[pts.length-1].d+'T12:00'),X=d=>4+(+new Date(d+'T12:00')-t0)/(t1-t0||1)*(W-8),Y=v=>6+(1-(v-1)/9)*(H-20);
    chart=`<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Score trend">${c&&c.start&&c.start>=pts[0].d?`<line x1="${X(c.start).toFixed(1)}" x2="${X(c.start).toFixed(1)}" y1="0" y2="${H-14}" stroke="#ffb000" stroke-dasharray="3 3"/><text x="${(X(c.start)+4).toFixed(1)}" y="10" font-size="9.5" fill="#ffb000">start</text>`:''}
      <path d="M${pts.map(p=>X(p.d).toFixed(1)+','+Y(p.s).toFixed(1)).join(' L')}" fill="none" stroke="#05d9e8" stroke-width="2" stroke-linejoin="round"/>${pts.map(p=>`<circle cx="${X(p.d).toFixed(1)}" cy="${Y(p.s).toFixed(1)}" r="2.3" fill="#05d9e8"><title>${p.d} · ${p.s}${p.note?' · '+esc(p.note):''}</title></circle>`).join('')}
      <text x="4" y="${H-2}" font-size="9.5" fill="#6e6e73">${esc(nice(pts[0].d))}</text><text x="${W-4}" y="${H-2}" font-size="9.5" fill="#6e6e73" text-anchor="end">${esc(nice(pts[pts.length-1].d))}</text></svg>`}
  const f2=R.filter(r=>c&&c.start&&r.d>=c.start).slice(0,14),l2=R.slice(-14);
  const stack=(typeof M!=='undefined'&&M&&M.stack||[]).map(s=>s.name);
  return `<div class="lk-course">${c&&c.n?`<div class="lk-ch"><b>${esc(c.n)}</b><span class="dim">${c.start?`day ${dn} · since ${esc(nice(c.start))}`:'no start date'}${c.end?' · ends '+esc(nice(c.end)):''}</span><button type="button" class="lk-ed" data-lkc="1">Edit</button></div>`
      :`<div class="lk-ch"><span class="dim">Tie the log to a course (any item from your stack) to see it from day one.</span><button type="button" class="lk-ed" data-lkc="1">Set course</button></div>`}</div>
    <div class="lk-score"><span>Today</span><input type="range" min="1" max="10" step="1" id="lkSkinR" value="${t?t.s:5}" aria-label="Score today, 1 to 10"><b class="num" id="lkSkinV">${t?t.s:'–'}</b></div>
    <input class="inp" id="lkSkinN" placeholder="${esc(LW('lknote','Note'))}" value="${esc(t&&t.note||'')}" maxlength="140">
    ${chart}${f2.length>=5&&l2.length>=5&&R.length>=12?`<div class="dim" style="font-size:12px;margin-top:6px">First two weeks of the course ${avg(f2.map(r=>r.s)).toFixed(1)} → last two weeks ${avg(l2.map(r=>r.s)).toFixed(1)}</div>`:''}
    <datalist id="lkStack">${stack.map(n=>`<option value="${esc(n)}">`).join('')}</datalist>`}
function renderLooks(){const el=$('lkBody');if(!el)return;if(!looksLoaded){el.innerHTML='<div class="dim" style="padding:20px 0">Loading…</div>';loadLooks().catch(e=>console.warn(e));return}
  el.innerHTML=`<div class="panel"><div class="ph"><span class="tag">Routine</span><span class="dim">counts toward Streaks</span></div><div class="pb lk-rts">${lkRoutine('am','Morning')}${lkRoutine('pm','Evening')}</div></div>
    <div class="panel"><div class="ph"><span class="tag">${esc(LW('lklog','Daily log'))}</span></div><div class="pb">${lkSkin()}</div></div>
    <div class="panel"><div class="ph"><span class="tag">Measurements</span></div><div class="pb">${(()=>{const bf=bfEst();return bf!=null?`<div class="pg-bf"><b class="num">${bf}%</b><span>estimated body fat<small>from the waist and neck in Food › Progress</small></span></div>`:''})()}${measPanel('looks')}</div></div>
    <div class="panel"><div class="ph"><span class="tag">Monthly photos</span></div><div class="pb">${photoPanel('looks')}</div></div>`;
  progBind(el,renderLooks);lkBind(el)}
function lkBind(el){if(el._lk)return;el._lk=1;
  el.addEventListener('click',e=>{const s=e.target.closest('[data-lks]'),ed=e.target.closest('[data-lked]'),c=e.target.closest('[data-lkc]');
    if(s){const [sl,i]=s.dataset.lks.split(':');const d=LKL.d[DAYK]=LKL.d[DAYK]||{};const x=new Set(d[sl]||[]);x.has(+i)?x.delete(+i):x.add(+i);d[sl]=[...x];save('lk/l',LKL);
      const was=s.classList.contains('on');renderLooks();if(!was&&lkDone(DAYK,sl)){const r=s.getBoundingClientRect();burst(r.left+r.width/2,r.top+r.height/2,40,true)}lkHab(sl).catch(er=>console.warn(er));return}
    if(ed){const sl=ed.dataset.lked;openSheet(sl==='am'?'Morning routine':'Evening routine',`<label class="fl">One step per line<textarea class="inp" id="lkSteps" rows="8" style="min-height:180px">${esc((LKR[sl]||[]).join('\n'))}</textarea></label><div class="bigbtns" style="margin-top:12px"><span style="flex:1"></span><button class="btn p" type="button" id="lkSv">Save</button></div>`);
      $('lkSv').onclick=()=>{LKR[sl]=$('lkSteps').value.split('\n').map(x=>x.trim()).filter(Boolean).slice(0,30);save('lk/r',LKR);const d=LKL.d[DAYK];if(d&&d[sl]){d[sl]=d[sl].filter(i=>i<LKR[sl].length);save('lk/l',LKL)}closeSheet();renderLooks();lkHab(sl).catch(er=>console.warn(er))};return}
    if(c){const C=LKS.course||{};openSheet('Course',`<label class="fl">Item<input class="inp" id="lkCn" list="lkStack" value="${esc(C.n||'')}" placeholder="Pick from your stack or type"></label><label class="fl">Started<input class="inp" type="date" id="lkCs" value="${esc(C.start||'')}"></label><label class="fl">Planned end<input class="inp" type="date" id="lkCe" value="${esc(C.end||'')}"></label><datalist id="lkStack">${((typeof M!=='undefined'&&M&&M.stack)||[]).map(s2=>`<option value="${esc(s2.name)}">`).join('')}</datalist><div class="bigbtns" style="margin-top:12px"><span style="flex:1"></span><button class="btn p" type="button" id="lkCsv">Save</button></div>`);
      $('lkCn').onchange=()=>{const st=typeof stdOf==='function'?stdOf($('lkCn').value):{};if(st.start&&!$('lkCs').value)$('lkCs').value=st.start};
      $('lkCsv').onclick=()=>{const n=$('lkCn').value.trim();LKS.course=n?{n,start:$('lkCs').value||null,end:$('lkCe').value||null}:null;save('lk/s',LKS);if(n&&$('lkCs').value&&typeof stdSet==='function'&&!stdOf(n).start)stdSet(n,'start',$('lkCs').value);closeSheet();renderLooks()};return}});
  el.addEventListener('input',e=>{if(e.target.id==='lkSkinR')$('lkSkinV').textContent=e.target.value});
  el.addEventListener('change',e=>{if(e.target.id!=='lkSkinR'&&e.target.id!=='lkSkinN')return;const sV=+$('lkSkinR').value,n=$('lkSkinN').value.trim();
    LKS.r=(LKS.r||[]).filter(r=>r.d!==DAYK).concat({d:DAYK,s:sV,note:n});save('lk/s',LKS);renderLooks()})}
