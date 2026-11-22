/* ================= WEEK IN REVIEW =================
   Pulls every part of the app into one weekly summary, compared with the same days of last week.
   A one-line snapshot is kept in weeks/w-<isoweek>.sum so past reviews still show their numbers. */
let WRV=null,wrBusy=false;
const wrDays=(off)=>{const L0=logical(),dn=L0.getDay()||7,m=new Date(L0);m.setDate(m.getDate()-(dn-1)+off*7);const out=[];for(let i=0;i<7;i++){const d=new Date(m);d.setDate(m.getDate()+i);out.push(ymd(d))}return out};
const wrAvg=a=>{a=a.filter(x=>x!=null&&!isNaN(x));return a.length?a.reduce((x,y)=>x+y,0)/a.length:null};
async function wrStats(days){
  const S={},has=d=>days.includes(d),safe=async f=>{try{await f()}catch(e){}};
  await safe(async()=>{const docs=await Promise.all(days.map(d=>d===DAYK?Promise.resolve(DAY):load('days/d-'+d)));
    const ps=docs.map(v=>v&&v.total?v.done/v.total*100:null);S.adh=wrAvg(ps);S.adhDays=ps;S.adh80=ps.filter(p=>p!=null&&p>=80).length});
  await safe(async()=>{const rows=(await listDocs('sleep/w-')).filter(r=>r.data&&has(r.path.slice(8))).map(r=>r.data);
    S.sleep=wrAvg(rows.map(n=>n.asleep));S.sq=wrAvg(rows.map(n=>sQ(n)));S.deep=wrAvg(rows.map(n=>n.deep));S.nights=rows.length});
  await safe(async()=>{const hs=(await Promise.all(days.map(d=>load('health/d-'+d)))).map(h=>h||{});
    S.hrv=wrAvg(hs.map(h=>h.hrv));S.rhr=wrAvg(hs.map(h=>h.rhr));S.steps=wrAvg(hs.map(h=>h.steps));S.akcal=wrAvg(hs.map(h=>h.kcal));
    const st=hs.map(h=>h.screentime!=null?+h.screentime/60:null);S.screen=wrAvg(st)});
  await safe(async()=>{const fo=(FOCUS&&FOCUS.sessions&&FOCUS.sessions.length?FOCUS:await load('tools/focus'))||{};S.dw=(fo.sessions||[]).filter(x=>has(x.d)).reduce((a,x)=>a+(+x.min||0),0)});
  await safe(async()=>{const ws=(typeof gymLoaded!=='undefined'&&gymLoaded)?WORKOUTS:(await listDocs('gym/w-')).map(r=>r.data).filter(Boolean);
    const W=ws.filter(w=>w&&has(w.date));S.gym=W.length;S.vol=W.reduce((a,w)=>a+(w.vol!=null?+w.vol:stats(w).vol),0);S.sets=W.reduce((a,w)=>a+(w.nsets!=null?+w.nsets:stats(w).n),0)});
  await safe(async()=>{if(!FPROF){const p=await load('food/profile');if(p&&!FPROF)FPROF=p}
    const fd=(await Promise.all(days.map(d=>load('food/d-'+d)))).map(f=>f&&f.m?fSum(['b','l','d','s'].flatMap(k=>f.m[k]||[])):null).filter(t=>t&&t.kcal>0);
    S.kcal=wrAvg(fd.map(t=>t.kcal));S.prot=wrAvg(fd.map(t=>t.p));S.fdays=fd.length;try{S.budget=fBudget()}catch(e){}});
  await safe(async()=>{const wt=await load('body/wt');const r=((wt&&wt.r)||[]).filter(x=>has(String(x.t).slice(0,10)));if(r.length){S.kg0=+r[0].kg;S.kg1=+r[r.length-1].kg;S.kg=S.kg1}});
  await safe(async()=>{const bk=(typeof brickLoaded!=='undefined'&&brickLoaded)?BRICK:await load('tools/brick');S.brick=((bk&&bk.sessions)||[]).filter(x=>has(x.d)).reduce((a,x)=>a+(+x.min||0),0)});
  await safe(async()=>{const js=(await Promise.all(days.map(d=>load('journal/e-'+d)))).filter(Boolean);S.jn=js.length;S.mood=wrAvg(js.map(e=>e.mood?+e.mood:null))});
  await safe(async()=>{const t=await load('tasks/all');S.tasks=((t&&t.list)||[]).filter(x=>x.done&&has(String(x.done).slice(0,10))).length});
  await safe(async()=>{if(!habLoaded)await loadHabits();let due=0,hit=0;hAll().forEach(h=>days.filter(d=>d<=DAYK).forEach(d=>{if(hDue(h,d)){due++;if(hDone(h,d))hit++}}));S.hab=due?hit/due*100:null});
  await safe(async()=>{if(typeof loadLeet==='function'&&!Object.keys(LEET.items||{}).length)await loadLeet();S.leet=solves().filter(a=>has(a.d)).length});
  return S}
const wrHM=m=>m==null?'—':Math.floor(m/60)+'h '+pad(Math.round(m%60))+'m';
const WRT=[ /* key, label, format, higher-is-better, colour, view */
  ['adh','Plan done',v=>Math.round(v)+'<small>%</small>',1,'#ff2a6d','today'],
  ['sq','Sleep score',v=>Math.round(v),1,'#8e5cff','sleep'],
  ['sleep','Avg sleep',v=>wrHM(v),1,'#4f7cff','sleep'],
  ['hrv','HRV',v=>Math.round(v)+'<small> ms</small>',1,'#5ac8fa','sleep'],
  ['dw','Deep work',v=>wrHM(v),1,'#ff9f0a','tools'],
  ['gym','Workouts',v=>v+'<small> · '+(WRV&&WRV.cur.vol?Math.round(WRV.cur.vol/1000*10)/10+'t':'0t')+'</small>',1,'#30d158','gym'],
  ['kcal','Avg calories',v=>Math.round(v).toLocaleString('en-GB'),0,'#ffd60a','food'],
  ['prot','Avg protein',v=>Math.round(v)+'<small> g</small>',1,'#ff6b6b','food'],
  ['screen','Screen time',v=>wrHM(v)+'<small>/day</small>',0,'#ff375f','tools'],
  ['brick','Phone-free',v=>wrHM(v),1,'#bf5af2','tools'],
  ['hab','Habits hit',v=>Math.round(v)+'<small>%</small>',1,'#64d2ff','streaks'],
  ['tasks','Tasks done',v=>v,1,'#a1a1a6','journal'],
  ['leet','LeetCode',v=>v+'<small> solved</small>',1,'#ffcc00','tools'],
  ['mood','Journal mood',v=>(Math.round(v*10)/10)+'<small>/10</small>',1,'#5e5ce6','journal'],
];
function wrDelta(k,c,p,hi){if(c==null||p==null||!p)return '';const d=(c-p)/Math.abs(p)*100;if(Math.abs(d)<3)return '<em class="eq">≈ last week</em>';const good=hi?d>0:d<0;return `<em class="${good?'up':'dn'}">${d>0?'↑':'↓'} ${Math.round(Math.abs(d))}%</em>`}
async function renderReview(){const el=$('wkReview');if(!el||wrBusy)return;wrBusy=true;
  if(!WRV)el.innerHTML='<div class="wr-card wr-load">Reading your week…</div>';
  try{const cd=wrDays(0).filter(d=>d<=DAYK),n=cd.length,pd=wrDays(-1).slice(0,n);
    const [cur,prev]=await Promise.all([wrStats(cd),wrStats(pd)]);WRV={cur,prev,cd};
    /* week score = how far along every weekly target is */
    const tg=Object.values(typeof TGA!=='undefined'?TGA:{}).filter(a=>a&&a.n);const score=tg.length?Math.round(wrAvg(tg.map(a=>Math.min(1,a.v/a.n)))*100):null;
    const tiles=WRT.filter(([k])=>cur[k]!=null&&!(cur[k]===0&&!prev[k]));
    const hl=[];const ad=cur.adhDays||[];const bi=ad.reduce((b,v,i)=>v!=null&&(b<0||v>ad[b])?i:b,-1);
    if(bi>=0)hl.push(['star',`Best day: <b>${new Date(cd[bi]+'T12:00').toLocaleDateString('en-GB',{weekday:'long'})}</b>, ${Math.round(ad[bi])}% of your plan done`]);
    const ch=WRT.map(([k,l,,hi])=>{const c=cur[k],p=prev[k];if(c==null||p==null||!p)return null;const d=(c-p)/Math.abs(p)*100;return {l,d:hi?d:-d,raw:d}}).filter(x=>x&&Math.abs(x.raw)>=8).sort((a,b)=>b.d-a.d);
    if(ch[0]&&ch[0].d>0)hl.push(['up',`Biggest gain: <b>${ch[0].l.toLowerCase()}</b> ${ch[0].raw>0?'up':'down'} ${Math.round(Math.abs(ch[0].raw))}% on last week`]);
    const lo=ch[ch.length-1];if(lo&&lo.d<0)hl.push(['dn',`Slipped: <b>${lo.l.toLowerCase()}</b> ${lo.raw>0?'up':'down'} ${Math.round(Math.abs(lo.raw))}% on last week`]);
    if(tg.length){const full=tg.filter(a=>a.v>=a.n).length;hl.push(['tg',`<b>${full} of ${tg.length}</b> weekly targets already hit`])}
    if(cur.kg0!=null&&cur.kg1!=null&&cur.kg0!==cur.kg1)hl.push(['kg',`Weight <b>${cur.kg1>cur.kg0?'+':''}${(cur.kg1-cur.kg0).toFixed(1)} kg</b> this week (${cur.kg1} kg now)`]);
    if(cur.sleep!=null&&SSET&&SSET.goal){const debt=n*SSET.goal*60-cur.sleep*cur.nights;if(cur.nights&&Math.abs(debt)>30)hl.push([debt>0?'dn':'up',`Sleep ${debt>0?'debt':'surplus'}: <b>${wrHM(Math.abs(debt))}</b> against your ${SSET.goal}h goal`])}
    const IC={star:'<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>',up:'<path d="M5 15l7-7 7 7"/>',dn:'<path d="M5 9l7 7 7-7"/>',tg:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/>',kg:'<path d="M4 20h16M6 20l2-12h8l2 12M9 8a3 3 0 0 1 6 0"/>'};
    const D0=new Date(cd[0]+'T12:00'),D1=new Date(wrDays(0)[6]+'T12:00'),range=D0.getDate()+(D0.getMonth()!==D1.getMonth()?' '+D0.toLocaleDateString('en-GB',{month:'short'}):'')+' – '+D1.getDate()+' '+D1.toLocaleDateString('en-GB',{month:'short'});
    el.innerHTML=`<div class="wr-card"><div class="wr-top"><div><div class="wr-eye">Week in review · ${esc(WK)}</div><div class="wr-title">${range}</div><div class="wr-sub">${n} day${n>1?'s':''} in · compared with the same days last week</div></div>
      ${score!=null?sRing(score,score>=80?'#30d158':score>=50?'#ffd60a':'#ff2a6d',92,9,`<b class="num">${score}</b><span>week score</span>`):''}</div>
      ${hl.length?`<div class="wr-hl">${hl.map(([i,t])=>`<div class="wr-hli ${i}"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${IC[i]}</svg><span>${t}</span></div>`).join('')}</div>`:''}
      <div class="wr-tiles">${tiles.map(([k,l,f,hi,c,v])=>`<button type="button" class="wr-tile" data-go="${v}" style="--c:${c}"><span><i></i>${l}</span><b class="num">${f(cur[k])}</b>${wrDelta(k,cur[k],prev[k],hi)||'<em class="eq">&nbsp;</em>'}</button>`).join('')||'<div class="sl-note">Nothing logged yet this week.</div>'}</div><div id="wkPast"></div></div>`;
    el.onclick=e=>{const b=e.target.closest('[data-go]');if(b)go(b.dataset.go)};
    /* keep a snapshot with the week so past reviews keep their numbers */
    const sum=[cur.adh!=null&&Math.round(cur.adh)+'% plan',cur.sq!=null&&'sleep '+Math.round(cur.sq),cur.dw&&wrHM(cur.dw)+' deep work',cur.gym&&cur.gym+' workouts',cur.screen!=null&&wrHM(cur.screen)+'/day screen',score!=null&&'score '+score].filter(Boolean).join(' · ');
    if(sum&&WEEK&&WEEK.sum!==sum){WEEK={...WEEK,sum};save('weeks/w-'+WK,WEEK)}
    wrPast()}catch(e){el.innerHTML='<div class="wr-card wr-load">Could not read the week.</div>'}
  wrBusy=false}
async function wrPast(){const el=$('wkPast');if(!el)return;try{
  const rows=(await listDocs('weeks/w-')).filter(r=>r.data&&r.path.slice(8)!==WK&&r.data.sum).sort((a,b)=>a.path<b.path?1:-1);
  
  el.innerHTML=rows.length?`<details class="sl-det"><summary>Past reviews · ${rows.length}</summary><div class="wr-past">${rows.slice(0,26).map(r=>`<div><b>${esc(r.path.slice(8))}</b>${r.data.sum?`<span>${esc(r.data.sum)}</span>`:''}${r.data.notes?`<p>${esc(r.data.notes)}</p>`:''}</div>`).join('')}</div></details>`:''}catch(e){}}
