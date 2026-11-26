/* ================= WEEK ================= */
let WEEK={};
async function renderWeek(){if(typeof renderWeekChange==='function')renderWeekChange();if(typeof goalsLoad==='function'&&!goalsLoaded)goalsLoad().then(()=>{if(cur==='week')renderTargets(true)}).catch(e=>nxErr(e,'goals'));
  calInit();
  const L0=logical();const ds=[];for(let i=29;i>=0;i--){const d=new Date(L0);d.setDate(d.getDate()-i);ds.push(d)}
  const docs=await Promise.all(ds.map(d=>ymd(d)===DAYK?Promise.resolve(DAY):load('days/d-'+ymd(d))));
  const last7=ds.slice(-7),v7=docs.slice(-7);
  $('days').innerHTML=last7.map((d,i)=>{const v=v7[i];const p=v&&v.total?Math.round(v.done/v.total*100):null;const t=ymd(d)===DAYK;return `<div class="d${t?' t':''}"><div class="bw">${p===null?'<span class="nil"></span>':`<div class="b ${p>=80?'ok':p<50?'low':''}" style="height:${Math.max(3,p)}%"><span class="p num${p<14?' out':''}">${p}%</span></div>`}</div><span class="l">${t?'today':DOW[d.getDay()].toLowerCase()}</span></div>`}).join('');
  if(FX)document.querySelectorAll('#days .b').forEach((b,i)=>b.animate([{transform:'scaleY(0)'},{transform:'scaleY(1)'}],{duration:500,delay:i*60,easing:'cubic-bezier(.2,.9,.1,1)',fill:'backwards'}));
  const logged=v7.filter(v=>v&&v.total).length;$('daysNote').textContent=logged<2?'Fills in as you tick items on the today view.':`${logged} of 7 days logged · avg ${Math.round(avg(v7.filter(v=>v&&v.total).map(v=>v.done/v.total*100)))}%`;
  wkStreaks();renderReview();if(typeof renderWkFocus==='function')renderWkFocus().catch(e=>console.warn(e));
  WEEK=await load('weeks/w-'+WK)||WEEK||{};if(typeof wrReflFill==='function')wrReflFill();
  renderTargets();
  $('weekSub').textContent=`${WK} · review Sundays 19:00`;
}
/* weekly targets: each one is a count of completions this week (one notch = one done).
   the goal is the target's "times per week" field, else a number in its text ("4x"), else 7 (daily).
   counts live in the week's own doc, so a new week starts every bar at zero. */
function tgGoal(r){const g=+r.goal;if(g>0)return Math.min(50,Math.round(g));const m=/(\d+)\s*(?:x|×|times|\/\s*w)|(?:x|×)\s*(\d+)/i.exec((r.item||'')+' '+(r.notes||''));const n=m?+(m[1]||m[2]):0;return n>0&&n<=50?n:7}
function tgCount(r,n){const w=WEEK||{};if(w.tc&&w.tc[r.key]!=null)return Math.max(0,Math.min(n,+w.tc[r.key]||0));const p=w.tp&&+w.tp[r.key];return p?Math.round(Math.min(100,p)/100*n):0}
/* auto targets: a target whose name matches one of these is filled from the app's own data, not by hand */
const TGK=r=>{const t=String(r.item||'').toLowerCase();return /wake/.test(t)?'hide':/sleep/.test(t)?'sleep':/deep|focus/.test(t)?'dw':/leet/.test(t)?'leet':/adher/.test(t)?'adh':/gym|train|workout|lift/.test(t)?'gym':null};
let TGA={},tgBusy=false;
function tgWeekDays(){const L0=logical(),dn=L0.getDay()||7,m=new Date(L0);m.setDate(m.getDate()-(dn-1));const out=[];for(let i=0;i<7;i++){const d=new Date(m);d.setDate(m.getDate()+i);const k=ymd(d);if(k<=DAYK)out.push(k)}return out}
async function tgAuto(){if(tgBusy)return;tgBusy=true;const days=tgWeekDays(),A={};
  try{const docs=await Promise.all(days.map(d=>d===DAYK?Promise.resolve(DAY):load('days/d-'+d)));const ps=docs.map(v=>v&&v.total?v.done/v.total*100:null);
    A.adh={v:ps.filter(p=>p!=null&&p>=80).length,sub:ps.some(p=>p!=null)?'days at 80%+ · avg '+Math.round(avg(ps.filter(p=>p!=null)))+'%':'days at 80%+ on Today'}}catch(e){nxErr(e,'week targets')}
  try{if(typeof SSET!=='undefined'&&!SSET){const ss=await load('sleep/settings');SSET={wake:'07:30',bed:'23:00',goal:8,miss:'math',diff:2,shakes:30,snd:'rise',code:'',...(ss||{})}}const rows=await listDocs('sleep/w-');const N=rows.filter(r=>r.data&&days.includes(r.path.slice(8))).map(r=>sQ(r.data));
    A.sleep={v:N.filter(q=>q>=75).length,n:6,lab:'sleep score 75+',sub:N.length?'nights this week · avg score '+Math.round(avg(N)):'nights this week, from the Sleep section'}}catch(e){A.sleep={v:0,n:6,lab:'sleep score 75+',sub:'couldn’t read sleep data'}}
  try{const fs=((FOCUS&&FOCUS.sessions&&FOCUS.sessions.length?FOCUS:await load('tools/focus'))||{}).sessions||[];const m=fs.filter(x=>days.includes(x.d)).reduce((a,x)=>a+(+x.min||0),0);const goal=Math.round(DW_TARGET*5/60);
    A.dw={v:Math.round(m/6)/10,n:goal,unit:'h',sub:'hours from the focus timer · '+Math.floor(m/60)+'h '+pad(m%60)+'m'}}catch(e){nxErr(e,'week targets')}
  try{if(typeof loadLeet==='function'&&!Object.keys(LEET.items||{}).length)await loadLeet();A.leet={v:leetWeek(),n:LEET.target||8,sub:'problems solved this week'}}catch(e){nxErr(e,'week targets')}
  try{const ws=(typeof gymLoaded!=='undefined'&&gymLoaded)?WORKOUTS:(await listDocs('gym/w-')).map(r=>r.data).filter(Boolean);
    A.gym={v:ws.filter(w=>w&&days.includes(w.date)&&w.endedAt!==null).length,sub:'workouts logged in Gym'}}catch(e){nxErr(e,'week targets')}
  TGA=A;tgBusy=false;renderTargets(true)}
function renderTargets(fromAuto){
  const rows=(M.targets||[]).filter(r=>TGK(r)!=='hide');const kinds=new Set(rows.map(TGK));
  const all=rows.concat(kinds.has('gym')?[]:[{key:'auto:gym',item:'train 4x a week',builtin:true}]);
  $('targets').innerHTML=all.map(r=>{const k=TGK(r),A=k&&TGA[k];
    if(k&&k!=='hide'){const n=(A&&A.n)||tgGoal(r)||7,v=A?A.v:0,full=v>=n,pc=Math.min(100,v/n*100);
      return `<div class="tg2 tgw tga${full?' full':''}"><b>${esc(A&&A.lab||String(r.item||'').toLowerCase())}${typeof goalChip==='function'?goalChip(r.key):''}</b><span>${esc(A?A.sub:'syncing…')}</span>${r.builtin?'<span></span>':`<button class="ed" type="button" data-tg="${esc(r.key)}">✎</button>`}
        <div class="tgs"><span class="pbar${full?' ok':''}"><i style="width:${pc.toFixed(1)}%"></i></span><span class="num tgv">${v}${A&&A.unit||''}/${n}${A&&A.unit||''}</span></div></div>`}
    const n=tgGoal(r),v=tgCount(r,n),pc=v/n*100;
    return `<div class="tg2 tgw${v>=n?' full':''}"><b>${esc(String(r.item||'').toLowerCase())}${r.edited?'<span class="delta">Δ</span>':''}${typeof goalChip==='function'?goalChip(r.key):''}</b><span>${esc(r.notes||'')}</span><button class="ed" type="button" data-tg="${esc(r.key)}">✎</button>
      <div class="tgs"><button class="tgb" type="button" data-tgd="${esc(r.key)}" data-d="-1" aria-label="undo one">−</button><input type="range" min="0" max="${n}" step="1" value="${v}" data-tgp="${esc(r.key)}" data-n="${n}" style="--v:${pc}%;--n:${n}" aria-label="done this week"><button class="tgb" type="button" data-tgd="${esc(r.key)}" data-d="1" aria-label="log one">+</button><span class="num tgv">${v}/${n}</span></div></div>`}).join('');
  if(!fromAuto)tgAuto()}
let tgT=null;
function tgSet(s,v){const n=+s.dataset.n;v=Math.max(0,Math.min(n,v));const was=+s.value;s.value=v;
  s.style.setProperty('--v',v/n*100+'%');const row=s.closest('.tg2');row.querySelector('.tgv').textContent=v+'/'+n;row.classList.toggle('full',v>=n);
  WEEK={...WEEK,tc:{...((WEEK&&WEEK.tc)||{}),[s.dataset.tgp]:v}};
  clearTimeout(tgT);tgT=setTimeout(()=>save('weeks/w-'+WK,WEEK),500);return was}
$('targets').oninput=e=>{const s=e.target.closest('[data-tgp]');if(s)tgSet(s,+s.value)};
$('targets').onchange=e=>{const s=e.target.closest('[data-tgp]');if(s&&+s.value>=+s.dataset.n&&typeof burstEl==='function')burstEl(s,30,true)};
$('targets').onclick=e=>{const d=e.target.closest('[data-tgd]');if(d){const s=d.parentNode.querySelector('[data-tgp]');const v=+s.value+(+d.dataset.d);const was=tgSet(s,v);if(+s.value>=+s.dataset.n&&was<+s.value&&typeof burstEl==='function')burstEl(s,30,true);return}const b=e.target.closest('[data-tg]');if(!b)return;const r=M.targets.find(x=>x.key===b.dataset.tg);editExtra('weekday',r)};
$('addTarget').onclick=()=>addExtra('weekday','DAILY TARGETS – review Sundays 19:00');


/* top streaks — same engine as the Streaks section, so the numbers always match */
function wkStreaks(){const el=$('streaks');if(!el)return;if(!habLoaded){loadHabits().then(()=>{if(cur==='week')wkStreaks()});return}
  const L=hAll().map(h=>({h,s:hStreak(h).n,r:hRate(h)})).filter(x=>x.s>0||x.r>0).sort((a,b)=>b.s-a.s||((b.r||0)-(a.r||0))).slice(0,8);
  el.innerHTML=L.length?L.map(({h,s,r})=>{const marks=[];for(let i=13;i>=0;i--){const d=hAdd(DAYK,-i);marks.push(!hDue(h,d)?'s':hDone(h,d)?'y':i===0?'p':'n')}
    return `<button type="button" class="streak" data-go="streaks"><span class="tag dim">${esc(h.ic||'')} ${esc(dn(h.n))}</span><b class="num ${s>=3?'hot':''}">${s}</b><span class="dim" style="font-size:11px">day streak${r!=null?` · ${Math.round(r)}% last 30d`:''}</span><div class="dots">${marks.map(m=>`<i class="${m}"></i>`).join('')}</div></button>`}).join('')
    :'<div class="dim">Tick things off in Today or Streaks and your best streaks show up here.</div>';
  el.onclick=e=>{if(e.target.closest('[data-go]'))go('streaks')}}
