/* ================= GOALS: up to five goals measured from the app's own data · Trends · the monthly review =================
   goals/list = {goals:[{id,name,area,src,key,start,target,from,due,woop:{o,ob,p},targets:[],ms:[{t,done}],man:[{d,v}],status,color}]}
   review/m-YYYY-MM = {at, q1, q2, change, goal, done, snap}. Pace = straight line from start (on `from`) to target (on `due`). */
let GOALS={goals:[]},GOALV=LS.get('goalv')||'goals',GSEL=null,goalsLoaded=false,GD={at:0};
const G_AREAS=['Body','Strength','Career','Money','Mind','Sleep','Other'];
const G_COLS={Body:'#ff2a6d',Strength:'#05d9e8',Career:'#bf5af2',Money:'#ffd60a',Mind:'#30d158',Sleep:'#7d7aff',Other:'#ff9f0a'};
const G_SRC=[['weight','Weight trend · Body'],['waist','Waist · Body'],['e1rm','Lift e1RM · Gym'],['leet','LeetCode solved'],['apps','Applications sent · Career'],['sleep','Sleep score, 14-day average'],['mood','Mood, 14-day average'],['ms','Milestones I tick off'],['man','A number I update']];
async function goalsLoad(){if(goalsLoaded)return;GOALS={goals:[],...((await load('goals/list'))||{})};goalsLoaded=true}
watch('goals/list',d=>{if(d){GOALS={goals:[],...d};if(cur==='goals')renderGoals();if(cur==='week'&&typeof renderTargets==='function')renderTargets(true)}});
function goalsSave(){save('goals/list',GOALS);if(typeof schedWidget==='function')schedWidget()}
const gActive=()=>GOALS.goals.filter(g=>g.status!=='done'&&g.status!=='paused');

/* ---------- data: one loader feeds goals and trends ---------- */
async function gData(force){if(!force&&GD.at&&Date.now()-GD.at<90e3)return GD;
  const safe=p=>p.catch(e=>{nxErr(e,'goals data');return null});
  const [wt,wa,gym,sl,mo,he,fo,lt,ap]=await Promise.all([safe(load('body/wt')),safe(load('body/waist')),safe((typeof gymLoaded!=='undefined'&&gymLoaded)?Promise.resolve(WORKOUTS):listDocs('gym/w-').then(r=>r.map(x=>x.data).filter(Boolean))),
    safe(listDocs('sleep/w-')),safe(listDocs('mood/d-')),safe(listDocs('health/d-')),safe(load('tools/focus')),safe(load('tools/leet')),safe(load('career/apps'))]);
  if(typeof SSET!=='undefined'&&!SSET){try{const ss=await load('sleep/settings');SSET={wake:'07:30',bed:'23:00',goal:8,miss:'math',diff:2,shakes:30,snd:'rise',code:'',...(ss||{})}}catch(_){}}
  const byDay=(rows,f)=>{const m={};rows.forEach(([d,v])=>{if(d&&v!=null&&isFinite(v))m[d]=v});return Object.keys(m).sort().map(d=>[d,m[d]])};
  GD={at:Date.now()};
  GD.wtRaw=byDay(((wt&&wt.r)||[]).filter(x=>x.kg).map(x=>[String(x.t).slice(0,10),+x.kg]));
  GD.wt=gEma(GD.wtRaw,.1);
  GD.waist=byDay(((wa&&wa.r)||[]).map(x=>[String(x.t).slice(0,10),+x.cm]));
  GD.gym=(gym||[]).filter(w=>w&&w.date&&w.endedAt!==null);
  GD.sleep=byDay((sl||[]).map(r=>{try{return [r.path.slice(8),sQ(r.data)||null]}catch(_){return [null,null]}}));
  GD.mood=byDay((mo||[]).map(r=>{const xs=((r.data&&r.data.in)||[]).filter(x=>x.m);return [r.path.slice(7),xs.length?nxAvg(xs.map(x=>x.m)):null]}));
  GD.screen=byDay((he||[]).map(r=>[r.path.slice(9),r.data&&r.data.screentime!=null?r.data.screentime/3600:null]));
  const fm={};((fo&&fo.sessions)||[]).forEach(s=>{if(s.d)fm[s.d]=(fm[s.d]||0)+(+s.min||0)});GD.focus=Object.keys(fm).sort().map(d=>[d,fm[d]/60]);
  const sv=[];Object.values((lt&&lt.items)||{}).forEach(it=>(it.attempts||[]).filter(a=>a.ok&&a.d).forEach(a=>sv.push(a.d)));GD.leet=gCum(sv);
  GD.apps=gCum(((ap&&ap.apps)||[]).filter(a=>a.applied&&a.status!=='saved').map(a=>a.applied));
  return GD}
function gEma(raw,a){if(!raw.length)return [];const out=[];let d=raw[0][0],t=raw[0][1],i=0;const end=DAYK;
  while(d<=end){while(i<raw.length&&raw[i][0]===d){t=t+a*(raw[i][1]-t);i++}out.push([d,t]);d=addDays(d,1);if(out.length>2000)break}return out}
function gCum(days){days=days.filter(Boolean).sort();const out=[];let n=0;days.forEach(d=>{n++;if(out.length&&out[out.length-1][0]===d)out[out.length-1][1]=n;else out.push([d,n])});return out}
function gRoll(s,n){return s.map((p,i)=>[p[0],nxAvg(s.filter(q=>q[0]>addDays(p[0],-n)&&q[0]<=p[0]).map(q=>q[1]))])}
function gLifts(){const m={};(GD.gym||[]).forEach(w=>(w.ex||[]).forEach(x=>{const k=norm(x.n||'');if(!k)return;const e=(x.sets||[]).filter(s=>s.t!=='w'&&s.done!==false).reduce((a,s)=>Math.max(a,(+s.kg||0)*(1+(+s.r||0)/30)),0);if(e>0){(m[k]=m[k]||{n:x.n,c:0,pts:{}});m[k].c++;m[k].pts[w.date]=Math.max(m[k].pts[w.date]||0,e)}}));
  return Object.entries(m).map(([k,v])=>({k,n:v.n,c:v.c,s:Object.keys(v.pts).sort().map(d=>[d,v.pts[d]])})).sort((a,b)=>b.c-a.c)}
function gSeries(g){switch(g.src){case 'weight':return GD.wt||[];case 'waist':return GD.waist||[];
  case 'e1rm':{const l=gLifts().find(x=>x.k===g.key);return l?l.s:[]}
  case 'leet':return GD.leet||[];case 'apps':return GD.apps||[];case 'sleep':return gRoll(GD.sleep||[],14);case 'mood':return gRoll(GD.mood||[],14);
  case 'man':return (g.man||[]).map(x=>[x.d,+x.v]).sort((a,b)=>a[0]<b[0]?-1:1);case 'ms':return [];default:return []}}
function gUnit(g){return {weight:'kg',waist:'cm',e1rm:'kg',leet:'solved',apps:'sent',sleep:'',mood:'/ 5',ms:'',man:g.unit||''}[g.src]||''}
function gFmt(g,v){if(v==null||!isFinite(v))return '–';if(g.src==='money'||/£/.test(g.unit||''))return '£'+Math.round(v).toLocaleString('en-GB');return ['leet','apps','ms'].includes(g.src)?String(Math.round(v)):(Math.abs(v)>=100?Math.round(v).toLocaleString('en-GB'):(Math.round(v*10)/10).toString())}
/* where the goal stands: now, % done, % of time gone, weekly rate, ETA */
function gState(g){
  if(g.src==='ms'){const ms=g.ms||[],done=ms.filter(x=>x.done).length,tot=ms.length||1;const pace=gPaceP(g);const pct=done/tot;return {now:done,pct,pace,status:gStatus(pct,pace),label:done+' of '+ms.length,series:[],rate:null,eta:null,need:null}}
  const s=gSeries(g),now=s.length?s[s.length-1][1]:+g.start;const span=(+g.target)-(+g.start);
  const pct=span?Math.max(0,Math.min(1,(now-(+g.start))/span)):0,pace=gPaceP(g);
  const recent=s.filter(p=>p[0]>=addDays(DAYK,-56));let rate=null;if(recent.length>=3){const x0=recent[0][0];const xs=recent.map(p=>nxDays(x0,p[0])),ys=recent.map(p=>p[1]);const mx=nxAvg(xs),my=nxAvg(ys);let nu=0,de=0;xs.forEach((x,i)=>{nu+=(x-mx)*(ys[i]-my);de+=(x-mx)**2});if(de>0)rate=nu/de*7}
  const left=Math.max(0,(+g.target)-now),weeksLeft=Math.max(.1,nxDays(DAYK,g.due)/7);const need=((+g.target)-now)/weeksLeft;
  let eta=null;if(rate&&Math.sign(rate)===Math.sign((+g.target)-now)&&Math.abs(rate)>1e-6){const wks=((+g.target)-now)/rate;if(wks<520)eta=addDays(DAYK,Math.round(wks*7))}
  return {now,pct,pace,status:gStatus(pct,pace),label:gFmt(g,now)+' '+gUnit(g),series:s,rate,eta,need,left}}
function gPaceP(g){const tot=nxDays(g.from,g.due);return tot>0?Math.max(0,Math.min(1,nxDays(g.from,DAYK)/tot)):1}
function gStatus(pct,pace){if(pct>=1)return 'Done';if(pct>=pace+.05)return 'Ahead';if(pct>=pace-.05)return 'On pace';return 'Behind'}
const gPill=s=>({'On pace':'nx-ok','Ahead':'nx-cy','Behind':'nx-bad','Done':'nx-ok'}[s]||'');

/* ---------- views ---------- */
function setGoalV(v){if(!['goals','trends','review'].includes(v))v='goals';GOALV=v;LS.set('goalv',v);if(v!=='goals')GSEL=null;document.querySelectorAll('#goalSeg [data-gv]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.gv===v));return renderGoals()}
NX_SUB.goals=setGoalV;
document.addEventListener('click',e=>{const b=e.target.closest('#goalSeg [data-gv]');if(b){GSEL=null;setGoalV(b.dataset.gv).then(()=>{if(typeof staggerIn==='function')staggerIn($('goalPane'))})}});
async function renderGoals(){const el=$('goalPane');if(!el)return;document.querySelectorAll('#goalSeg [data-gv]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.gv===GOALV));
  if(!goalsLoaded||!GD.at)el.innerHTML='<div class="nx"><div class="nx-card nx-s">Reading your data…</div></div>';
  try{await goalsLoad();await gData()}catch(e){nxErr(e,'goals')}
  $('goalsSub').textContent=gActive().length+' active';
  if(GOALV==='trends')return renderTrends(el);if(GOALV==='review')return goalReview(el);
  if(GSEL)return renderGoal(el,GOALS.goals.find(g=>g.id===GSEL));
  const act=gActive(),st=act.map(g=>[g,gState(g)]);const good=st.filter(([,s])=>s.status!=='Behind').length;
  const links=new Set(act.flatMap(g=>g.targets||[]));const tg=(typeof M!=='undefined'&&M.targets)?M.targets.filter(r=>typeof TGK!=='function'||TGK(r)!=='hide'):[];
  const behind=st.filter(([,s])=>s.status==='Behind').map(([g])=>g.name);
  let h='<div class="nx">';
  if(act.length)h+=`<div class="nx-card" style="display:flex;align-items:center;gap:14px;padding:14px 16px">${nxRing(good/act.length,58,7,good===act.length?NXC.green:NXC.yellow,`<b style="font-size:16px">${good}/${act.length}</b>`)}<div style="flex:1;min-width:0"><div class="nx-t2">${good} of ${act.length} goal${act.length===1?'':'s'} on pace or ahead</div><div class="nx-s" style="margin-top:3px">${behind.length?esc(behind.join(', '))+(behind.length===1?' is':' are')+' slipping. ':'Everything is on track. '}${links.size?`${tg.filter(r=>links.has(r.key)).length+(links.has('auto:gym')?1:0)} weekly target${links.size===1?'':'s'} feed a goal.`:'Link weekly targets to a goal to see what moves it.'}</div></div></div>`;
  h+=`<div class="nx-sec">Active · ${act.length} of 5</div>`;
  h+=st.map(([g,s])=>goalCard(g,s)).join('')||'<div class="nx-card"><div class="nx-t2">Set your first goal</div><div class="nx-s" style="margin-top:6px">Three to five goals for the next 6 to 12 months, each measured from data the app already has. Specific, hard goals with feedback beat vague ones in study after study.</div></div>';
  if(act.length<5)h+=`<button type="button" class="nx-card dash" id="gNew"><span style="font-size:18px;color:#ff2a6d">+</span> New goal <span class="nx-xs" style="font-weight:400">· ${5-act.length} slot${5-act.length===1?'':'s'} left</span></button>`;
  const old=GOALS.goals.filter(g=>g.status==='done'||g.status==='paused');if(old.length)h+=`<div class="nx-sec">Done and paused</div><div class="nx-card nx-rows">${old.map(g=>`<button type="button" class="nx-row" data-gopen="${g.id}"><span>${esc(g.name)}</span><span class="nx-pill">${g.status==='done'?'Done':'Paused'}</span></button>`).join('')}</div>`;
  h+=`<div class="nx-note">The white tick on each bar is where you'd be today if you hit the target exactly on the deadline. Fewer goals, more progress: the app caps you at five.</div></div>`;
  el.innerHTML=h;el.onclick=goalClick}
function goalCard(g,s){const col=g.color||G_COLS[g.area]||NXC.pink;
  return `<button type="button" class="nx-card" data-gopen="${g.id}" style="padding:15px 16px 14px;border:0;color:inherit;font:inherit;text-align:left;width:100%;cursor:pointer;display:block">
  <span class="nx-split" style="align-items:flex-start;display:flex"><span style="display:flex;gap:12px;align-items:center;min-width:0"><span class="nx-ic" style="background:${col}">${G_ICO[g.area]||G_ICO.Other}</span><span style="min-width:0"><span class="nx-t2" style="display:block">${esc(g.name)}</span><span class="nx-s">${esc(g.area)} · by ${nxDate(g.due)}</span></span></span><span class="nx-pill ${gPill(s.status)}">${s.status}</span></span>
  <span class="nx-split" style="margin:14px 0 9px;align-items:flex-end;display:flex"><span><span class="nx-mid num">${g.src==='ms'?s.label:gFmt(g,s.now)+(gUnit(g)&&g.src!=='ms'?' <small>'+esc(gUnit(g))+'</small>':'')}</span> <span class="nx-s">&nbsp;${g.src==='ms'?'milestones':'of '+gFmt(g,+g.target)+' '+esc(gUnit(g))}</span></span><span style="width:92px;display:block">${nxSpark(s.series.filter(p=>p[0]>=addDays(DAYK,-90)).map(p=>p[1]),{w:92,h:30,col})}</span></span>
  <span class="nx-bar" style="display:block"><i style="width:${(s.pct*100).toFixed(0)}%;background:${col}"></i><b style="left:${(s.pace*100).toFixed(0)}%"></b></span>
  <span class="nx-split" style="margin-top:10px;display:flex"><span class="nx-xs">${esc(gFoot(g,s))}</span><span class="nx-xs num">${Math.round(s.pct*100)}% · pace ${Math.round(s.pace*100)}%</span></span></button>`}
function gFoot(g,s){if(g.src==='ms'){const n=(g.ms||[]).find(x=>!x.done);return n?'Next · '+n.t:'All milestones done'}
  if(s.status==='Behind'&&s.need!=null)return 'Needs '+nxSign(s.need,Math.abs(s.need)<10?1:0)+' '+gUnit(g)+' a week from here';
  if(s.rate!=null)return 'Last 8 weeks · '+nxSign(s.rate,Math.abs(s.rate)<10?1:0)+' '+gUnit(g)+' a week';return 'Started '+nxDate(g.from)}
function renderGoal(el,g){if(!g){GSEL=null;return renderGoals()}const s=gState(g),col=g.color||G_COLS[g.area]||NXC.pink,tot=nxDays(g.from,g.due);
  const months=[];for(let d=g.from;d<=g.due;d=addDays(d,1)){if(d.slice(8)==='01'||d===g.from)months.push([nxDays(g.from,d),new Date(d+'T12:00').toLocaleDateString('en-GB',{month:'short'})]);if(months.length>14)break}
  const pts=s.series.filter(p=>p[0]>=g.from).map(p=>[nxDays(g.from,p[0]),p[1]]);const thin=pts.length>120?pts.filter((p,i)=>i%Math.ceil(pts.length/120)===0||i===pts.length-1):pts;
  const dots=g.src==='weight'?(GD.wtRaw||[]).filter(p=>p[0]>=g.from).map(p=>[nxDays(g.from,p[0]),p[1]]):null;
  const tg=(typeof M!=='undefined'&&M.targets)?M.targets.filter(r=>(g.targets||[]).includes(r.key)):[];if((g.targets||[]).includes('auto:gym')&&!tg.some(r=>TGK(r)==='gym'))tg.push({key:'auto:gym',item:'train 4x a week',builtin:true});
  let h=`<div class="nx"><button type="button" class="nx-back" data-gback>‹ Goals</button>
  <div class="nx-card"><div class="nx-split" style="align-items:flex-start"><div style="display:flex;gap:12px;align-items:center;min-width:0"><div class="nx-ic" style="background:${col}">${G_ICO[g.area]||G_ICO.Other}</div><div style="min-width:0"><div class="nx-t1">${esc(g.name)}</div><div class="nx-s">${esc(g.area)} · ${nxDate(g.from)} to ${nxDate(g.due)}</div></div></div><span class="nx-pill ${gPill(s.status)}">${s.status}</span></div>
    <div class="nx-grid3" style="margin-top:16px"><div><div class="nx-xs">Now</div><div class="nx-mid num">${g.src==='ms'?s.label:gFmt(g,s.now)}${g.src!=='ms'&&gUnit(g)?`<small> ${esc(gUnit(g))}</small>`:''}</div></div>
    <div><div class="nx-xs">Since start</div><div class="nx-mid num" style="color:${g.src==='ms'||(s.now-(+g.start))*((+g.target)-(+g.start))>=0?NXC.green:NXC.red}">${g.src==='ms'?Math.round(s.pct*100)+'%':nxSign(s.now-(+g.start),Math.abs(s.now-(+g.start))<10?1:0)}</div></div>
    <div><div class="nx-xs">At this rate</div><div class="nx-mid num">${s.eta?nxDate(s.eta):'–'}</div></div></div></div>`;
  if(g.src==='ms')h+=`<div class="nx-card"><div class="nx-h"><span>Milestones</span><em>tap to tick</em></div>${(g.ms||[]).map((m,i)=>`<div class="nx-lvl"><button type="button" class="nx-tick" data-gms="${i}" aria-pressed="${!!m.done}" aria-label="done"></button><div style="flex:1;font-size:13.5px;color:#f2f2f7;font-weight:600">${esc(m.t)}</div></div>`).join('')}</div>`;
  else h+=`<div class="nx-card"><div class="nx-h"><span>Trajectory</span><em>${dots?'dots = weigh-ins · line = trend':'line = progress · dashes = plan'}</em></div>${nxTraj(thin,{start:+g.start,target:+g.target,total:tot,col,dots,labels:months})}
    <div class="nx-split" style="margin-top:10px"><span class="nx-s">${s.rate!=null?`Moving <b style="color:#fff">${nxSign(s.rate,Math.abs(s.rate)<10?2:0)} ${esc(gUnit(g))} a week</b> · plan needs ${nxSign(((+g.target)-(+g.start))/Math.max(.1,tot/7),2)}`:'Not enough data for a rate yet'}</span></div>
    ${g.src==='man'?`<div class="nx-btns" style="margin-top:12px"><input class="nx-inp num" id="gManV" type="number" inputmode="decimal" placeholder="today's value"><button type="button" class="nx-btn2 pk" id="gManAdd" style="flex:0 0 96px">Update</button></div>`:''}</div>`;
  h+=`<div class="nx-card"><div class="nx-h"><span>Lead targets this week</span><em>from Week</em></div>${tg.length?`<div class="nx-rows">${tg.map(r=>{const k=typeof TGK==='function'?TGK(r):null,A=k&&typeof TGA!=='undefined'&&TGA[k];const n=(A&&A.n)||(typeof tgGoal==='function'?tgGoal(r):7),v=A?A.v:(typeof tgCount==='function'?tgCount(r,n):0),p=n?v/n:0;
    return `<div class="nx-row"><div class="nx-l"><span class="nx-dot" style="background:${p>=1?NXC.green:p>=.5?NXC.yellow:NXC.red}"></span><div><div>${esc(A&&A.lab||String(r.item||'').toLowerCase())}</div><div class="nx-xs">${esc(A?A.sub:(r.notes||''))}</div></div></div><span class="nx-pill ${p>=1?'nx-ok':p>=.5?'nx-mid2':'nx-bad'}">${v}/${n}</span></div>`}).join('')}</div>`:'<div class="nx-s">No weekly targets linked yet. Edit the goal to link the ones that move it.</div>'}</div>`;
  const w=g.woop||{};h+=`<div class="nx-card"><div class="nx-h"><span>Your plan</span><em>outcome · obstacle · if-then</em></div>${w.o||w.ob||w.p?`<div class="nx-woop">
    <b style="background:${NXC.pink}">W</b><span><small>Wish</small>${esc(g.name)}</span>${w.o?`<b style="background:${NXC.cyan}">O</b><span><small>Best outcome</small>${esc(w.o)}</span>`:''}${w.ob?`<b style="background:${NXC.yellow}">O</b><span><small>Obstacle</small>${esc(w.ob)}</span>`:''}${w.p?`<b style="background:${NXC.green}">P</b><span><small>If, then</small>${esc(w.p)}</span>`:''}</div>`:'<div class="nx-s">Add the best outcome, the main obstacle and an if-then plan for it. Pairing a goal with a plan for its obstacle beats positive thinking alone.</div>'}</div>`;
  h+=`<div class="nx-btns"><button type="button" class="nx-btn2" data-gedit="${g.id}">Edit goal</button><button type="button" class="nx-btn2" data-gstat="${g.status==='paused'?'active':'paused'}">${g.status==='paused'?'Resume':'Pause'}</button><button type="button" class="nx-btn2" data-gstat="${g.status==='done'?'active':'done'}">${g.status==='done'?'Reopen':'Mark done'}</button></div></div>`;
  el.innerHTML=h;el.onclick=goalClick}
function goalClick(e){const o=e.target.closest('[data-gopen]');if(o){GSEL=o.dataset.gopen;renderGoals();window.scrollTo(0,0);return}
  if(e.target.closest('[data-gback]')){GSEL=null;renderGoals();return}if(e.target.closest('#gNew')){goalEdit(null);return}
  const ed=e.target.closest('[data-gedit]');if(ed){goalEdit(ed.dataset.gedit);return}
  const g=GOALS.goals.find(x=>x.id===GSEL);if(!g)return;
  const st=e.target.closest('[data-gstat]');if(st){if(st.dataset.gstat==='active'&&gActive().length>=5&&g.status!=='active'){nxErr('five active goals already · pause one first','goals');return}g.status=st.dataset.gstat;goalsSave();renderGoals();return}
  const ms=e.target.closest('[data-gms]');if(ms){const m=g.ms[+ms.dataset.gms];m.done=!m.done;m.at=m.done?DAYK:null;goalsSave();renderGoals();if(m.done&&typeof burstEl==='function')burstEl(ms,30);return}
  if(e.target.closest('#gManAdd')){const v=+$('gManV').value;if(!$('gManV').value)return;g.man=(g.man||[]).filter(x=>x.d!==DAYK).concat({d:DAYK,v});goalsSave();renderGoals()}}
const G_ICO={Body:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M8 9.5a5.5 5.5 0 0 1 8 0M12 9.5l1.6-2"/></svg>',
  Strength:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.2" stroke-linecap="round"><path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11"/></svg>',
  Career:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7"/></svg>',
  Money:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.2" stroke-linecap="round"><path d="M12 3v18M16.5 7.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3 2 2.6 4.5 3 4.5 1.3 4.5 3-2 3-4.5 3-4.5-1.3-4.5-3"/></svg>',
  Mind:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5q3.5 3 7 0M9 9.5h.01M15 9.5h.01"/></svg>',
  Sleep:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.2" stroke-linecap="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/></svg>',
  Other:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/></svg>'};

/* ---------- new / edit goal ---------- */
function goalEdit(id){const ex=id&&GOALS.goals.find(x=>x.id===id);if(!ex&&gActive().length>=5){nxErr('five active goals already · pause one first','goals');return}
  const g=ex?JSON.parse(JSON.stringify(ex)):{id:rid(),name:'',area:'Body',src:'weight',key:'',start:'',target:'',from:DAYK,due:addDays(DAYK,182),woop:{},targets:[],ms:[],man:[],status:'active'};
  const lifts=gLifts();const tg=(typeof M!=='undefined'&&M.targets)?M.targets.filter(r=>typeof TGK!=='function'||TGK(r)!=='hide'):[];const tgAll=tg.concat(tg.some(r=>typeof TGK==='function'&&TGK(r)==='gym')?[]:[{key:'auto:gym',item:'train 4x a week'}]);
  /* the start value is where the measure stood on the From date (or now, for a goal starting today) */
  const startOf=()=>{const t={...g,src:$('gS').value,key:$('gK')?$('gK').value:''};const s=gSeries(t);if(!s.length)return null;const f=$('gF').value||DAYK;const at=s.find(p=>p[0]>=f);return at?at[1]:s[s.length-1][1]};
  openSheet(ex?'edit goal':'new goal',`<div class="nx" style="padding:0;gap:14px">
    <div class="nx-field"><label for="gN">Goal</label><input class="nx-inp" id="gN" value="${esc(g.name)}" placeholder="e.g. squat 140 kg" autocomplete="off"></div>
    <div class="nx-grid2"><div class="nx-field"><label for="gA">Area</label><select class="nx-inp" id="gA">${G_AREAS.map(a=>`<option ${a===g.area?'selected':''}>${a}</option>`).join('')}</select></div>
      <div class="nx-field"><label for="gS">Measured by</label><select class="nx-inp" id="gS">${G_SRC.map(([v,l])=>`<option value="${v}" ${v===g.src?'selected':''}>${l}</option>`).join('')}</select></div></div>
    <div class="nx-field" id="gKw" ${g.src==='e1rm'?'':'hidden'}><label for="gK">Lift</label><select class="nx-inp" id="gK">${lifts.length?lifts.map(l=>`<option value="${esc(l.k)}" ${l.k===g.key?'selected':''}>${esc(l.n)} · ${l.c} sessions</option>`).join(''):'<option value="">log a workout first</option>'}</select></div>
    <div class="nx-field" id="gMsw" ${g.src==='ms'?'':'hidden'}><label for="gMs">Milestones · one per line</label><textarea class="nx-inp" id="gMs" rows="5" placeholder="CV finished&#10;Portfolio live&#10;50 applications sent">${esc((g.ms||[]).map(m=>m.t).join('\n'))}</textarea></div>
    <div class="nx-grid3" id="gNums" ${g.src==='ms'?'hidden':''}><div class="nx-field"><label for="gSt">Start</label><input class="nx-inp num" id="gSt" type="number" inputmode="decimal" value="${esc(g.start)}"></div><div class="nx-field"><label for="gT">Target</label><input class="nx-inp num" id="gT" type="number" inputmode="decimal" value="${esc(g.target)}"></div><div class="nx-field"><label for="gU">Unit</label><input class="nx-inp" id="gU" value="${esc(g.src==='man'?(g.unit||''):gUnit(g))}" ${g.src==='man'?'':'disabled'}></div></div>
    <div class="nx-grid2"><div class="nx-field"><label for="gF">From</label><input class="nx-inp" id="gF" type="date" value="${esc(g.from)}"></div><div class="nx-field"><label for="gD">By</label><input class="nx-inp" id="gD" type="date" value="${esc(g.due)}"></div></div>
    <div class="nx-card" id="gReal" style="background:rgba(255,255,255,.04)"></div>
    <div class="nx-sec" style="margin:4px 0 -4px">Your plan</div>
    <div class="nx-field"><label for="gO">Best outcome</label><textarea class="nx-inp" id="gO" rows="2">${esc((g.woop||{}).o||'')}</textarea></div>
    <div class="nx-field"><label for="gOb">Biggest obstacle</label><textarea class="nx-inp" id="gOb" rows="2">${esc((g.woop||{}).ob||'')}</textarea></div>
    <div class="nx-field"><label for="gP">If, then</label><textarea class="nx-inp" id="gP" rows="2" placeholder="If it's leg day and I'm tired, then I do just the squats and leave">${esc((g.woop||{}).p||'')}</textarea></div>
    <div class="nx-field"><span class="nx-lab">Link weekly targets</span><div class="nx-chips">${tgAll.map(r=>`<button type="button" class="nx-ch" data-glink="${esc(r.key)}" aria-pressed="${(g.targets||[]).includes(r.key)}">${esc(String(r.item||'').toLowerCase())}</button>`).join('')||'<span class="nx-s">Add targets on Week first.</span>'}</div></div>
    <button type="button" class="nx-btnp" id="gSave">Save goal</button>${ex?'<button type="button" class="nx-btn2 red" id="gDel">Delete goal</button>':''}</div>`);
  const real=()=>{const src=$('gS').value;$('gKw').hidden=src!=='e1rm';$('gMsw').hidden=src!=='ms';$('gNums').hidden=src==='ms';$('gU').disabled=src!=='man';if(src!=='man')$('gU').value=gUnit({src});
    const n=startOf();if(n!=null&&!ex&&(!$('gSt').value||$('gSt')._auto)){$('gSt').value=Math.round(n*10)/10;$('gSt')._auto=true}
    const st=+$('gSt').value,tg2=+$('gT').value,f=$('gF').value,d=$('gD').value,box=$('gReal');
    if(src==='ms'||!$('gT').value||!d||!f){box.innerHTML='<div class="nx-s">Set a target and a date and you get a reality check here.</div>';return}
    const wks=Math.max(.1,nxDays(f,d)/7),need=(tg2-st)/wks;const t={...g,src,key:$('gK')?$('gK').value:'',start:st,target:tg2,from:f,due:d};const s=gSeries(t).filter(p=>p[0]>=addDays(DAYK,-56));
    let rate=null;if(s.length>=3){rate=(s[s.length-1][1]-s[0][1])/Math.max(1,nxDays(s[0][0],s[s.length-1][0]))*7}
    const ratio=rate!=null&&need?rate/need:null;const lab=ratio==null?['nx-pill','No history to compare yet']:ratio>=2?['nx-pill nx-cy','Easy, consider a harder target']:ratio>=.8?['nx-pill nx-ok','Challenging, doable']:ratio>0?['nx-pill nx-mid2','A real stretch']:['nx-pill nx-bad','Moving the wrong way lately'];
    box.innerHTML=`<div class="nx-split"><span class="nx-t2">Reality check</span><span class="${lab[0]}">${lab[1]}</span></div><div class="nx-s" style="margin-top:6px">Needs <b style="color:#fff">${nxSign(need,Math.abs(need)<10?2:0)} ${esc(gUnit({src,unit:$('gU').value}))} a week</b>.${rate!=null?` Your last 8 weeks averaged ${nxSign(rate,Math.abs(rate)<10?2:0)}.`:''} Goals that are hard but reachable work best.</div>`};
  const sb=$('sheetBody');sb.oninput=e=>{if(e.target.id==='gSt')e.target._auto=false;real()};sb.onchange=real;real();
  sb.onclick=e=>{const l=e.target.closest('[data-glink]');if(l){l.setAttribute('aria-pressed',l.getAttribute('aria-pressed')!=='true');return}
    if(e.target.closest('#gDel')){GOALS.goals=GOALS.goals.filter(x=>x.id!==g.id);goalsSave();GSEL=null;closeSheet();renderGoals();return}
    if(!e.target.closest('#gSave'))return;const name=$('gN').value.trim();if(!name){$('gN').focus();return}
    const src=$('gS').value;Object.assign(g,{name,area:$('gA').value,src,key:src==='e1rm'?$('gK').value:'',from:$('gF').value||DAYK,due:$('gD').value||addDays(DAYK,182),
      woop:{o:$('gO').value.trim(),ob:$('gOb').value.trim(),p:$('gP').value.trim()},targets:[...sb.querySelectorAll('[data-glink][aria-pressed="true"]')].map(b=>b.dataset.glink),color:G_COLS[$('gA').value]});
    if(src==='ms'){const old=g.ms||[];g.ms=$('gMs').value.split('\n').map(x=>x.trim()).filter(Boolean).map(t=>old.find(m=>m.t===t)||{t,done:false});g.start=0;g.target=g.ms.length}
    else{g.start=+$('gSt').value||0;g.target=+$('gT').value||0;if(src==='man')g.unit=$('gU').value.trim()}
    if(g.due<=g.from){$('gD').focus();return}
    const i=GOALS.goals.findIndex(x=>x.id===g.id);if(i>=0)GOALS.goals[i]=g;else GOALS.goals.push(g);goalsSave();GSEL=g.id;closeSheet();renderGoals()}}

/* Week: each linked target shows which goal it feeds */
function goalChip(key){if(!goalsLoaded)return '';const g=gActive().find(x=>(x.targets||[]).includes(key));return g?`<span class="nx-pill" style="margin-left:6px;font-size:10.5px;padding:1px 7px;vertical-align:1px;background:${(g.color||NXC.pink)}22;color:${g.color||NXC.pink}">${esc(g.name.length>22?g.name.slice(0,21)+'…':g.name)}</span>`:''}

/* ---------- Trends: slow numbers, this month vs last ---------- */
function tMonth(s,off){const d=new Date(DAYK+'T12:00');d.setDate(1);d.setMonth(d.getMonth()-off);const a=ymd(d).slice(0,7);return s.filter(p=>p[0].slice(0,7)===a)}
function tTile(lab,s,{unit='',mode='last',good='up',col=NXC.pink,dec=1,fmt}={}){
  const cur=tMonth(s,0),prev=tMonth(s,1);const val=a=>!a.length?null:mode==='avg'?nxAvg(a.map(p=>p[1])):mode==='sum'?a.reduce((x,p)=>x+p[1],0):a[a.length-1][1];
  const v=val(cur)??(s.length?s[s.length-1][1]:null),pv=val(prev);if(v==null)return {html:'',up:null};const d=pv!=null?v-pv:null;const up=d==null?null:(good==='up'?d>=0:d<=0);
  const f=fmt||(x=>Math.abs(x)>=100?Math.round(x).toLocaleString('en-GB'):x.toFixed(dec));
  return {up,html:`<div class="nx-tile"><span>${lab}</span><b class="num">${f(v)}${unit?`<small> ${unit}</small>`:''}</b><em class="${up==null?'':up?'nx-up':'nx-dn'}">${d==null?'this month':(d>0?'▲ ':d<0?'▼ ':'')+f(Math.abs(d))+' vs last month'}</em><div style="margin-top:6px">${nxSpark(s.filter(p=>p[0]>=addDays(DAYK,-90)).map(p=>p[1]),{w:150,h:34,col,sw:1.8})}</div></div>`}}
async function renderTrends(el){const lifts=gLifts().slice(0,2);
  const wk=s=>{const m={};s.forEach(([d,v])=>{const k=addDays(d,-(((new Date(d+'T12:00').getDay()||7))-1));m[k]=(m[k]||0)+v});return Object.keys(m).sort().map(k=>[k,m[k]])};
  const groups=[['Body',[tTile('Weight trend',GD.wt||[],{unit:'kg',good:(gActive().find(g=>g.src==='weight')||{}).target>((gActive().find(g=>g.src==='weight')||{}).start)?'up':'down'}),tTile('Waist',GD.waist||[],{unit:'cm',good:'down'})]],
    ['Strength · e1RM',lifts.map(l=>tTile(l.n,l.s,{unit:'kg',col:NXC.cyan,dec:0}))],
    ['Sleep and mind',[tTile('Sleep score',GD.sleep||[],{mode:'avg',col:'#7d7aff',dec:0,unit:'avg'}),tTile('Mood',GD.mood||[],{mode:'avg',col:NXC.green,unit:'/ 5'}),tTile('Screen time',GD.screen||[],{mode:'avg',good:'down',col:NXC.orange,unit:'h / day'}),tTile('Deep work',wk(GD.focus||[]),{mode:'avg',col:NXC.yellow,unit:'h / week'})]],
    ['Career',[tTile('Applications',GD.apps||[],{col:NXC.purple,dec:0,unit:'sent'}),tTile('LeetCode',GD.leet||[],{col:NXC.purple,dec:0,unit:'solved'})]]];
  if(typeof M!=='undefined'&&M.inc&&+M.inc.take)groups.push(['Money',[{up:null,html:`<div class="nx-tile"><span>Planned savings rate</span><b class="num">${Math.round((+M.save||0)/(+M.inc.take)*100)}<small> %</small></b><em>of take-home, from Money</em></div>`}]]);
  const areas=groups.map(([n,ts])=>{const u=ts.filter(t=>t.up!=null);return [n,u.length?u.filter(t=>t.up).length>=u.length/2:null]}).filter(a=>a[1]!=null);
  const mName=new Date(DAYK+'T12:00').toLocaleDateString('en-GB',{month:'long'}),pName=(()=>{const d=new Date(DAYK+'T12:00');d.setDate(1);d.setMonth(d.getMonth()-1);return d.toLocaleDateString('en-GB',{month:'long'})})();
  let h=`<div class="nx"><div class="nx-card" style="padding:14px 16px"><div class="nx-split"><span class="nx-t2">${mName} vs ${pName}</span>${areas.length?`<span class="nx-pill ${areas.filter(a=>a[1]).length>=areas.length/2?'nx-ok':'nx-mid2'}">${areas.filter(a=>a[1]).length} of ${areas.length} areas up</span>`:''}</div>
    ${areas.length?`<div style="display:flex;gap:6px;margin-top:12px">${areas.map(([n,u])=>`<div style="flex:1;text-align:center;min-width:0"><div style="height:6px;border-radius:3px;background:${u?NXC.green:NXC.red}"></div><div class="nx-xs" style="margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(n.split(' ')[0])}</div></div>`).join('')}</div>`:'<div class="nx-s" style="margin-top:6px">Trends fill in as you log weight, workouts, sleep and mood.</div>'}</div>`;
  groups.forEach(([n,ts])=>{const t=ts.filter(x=>x.html);if(!t.length)return;h+=`<div class="nx-sec">${n}</div><div class="nx-grid2">${t.map(x=>x.html).join('')}</div>`});
  h+=`<div class="nx-note">Only numbers that move slowly live here. Daily ticks stay on Today and Week. Weight is a smoothed trend, so one salty dinner doesn't move it.</div></div>`;el.innerHTML=h;el.onclick=null}

/* ---------- monthly review (last Sunday of the month, 19:00) ---------- */
function lastSunday(dk){const d=new Date(dk+'T12:00');d.setMonth(d.getMonth()+1,0);while(d.getDay()!==0)d.setDate(d.getDate()-1);return ymd(d)}
let REVIEW=null;
function reviewDueOn(dk){return dk===lastSunday(dk)&&!(REVIEW&&REVIEW.m===dk.slice(0,7)&&REVIEW.done)}
load('review/m-'+DAYK.slice(0,7)).then(d=>{REVIEW=d?{m:DAYK.slice(0,7),...d}:null;renderWeekChange()}).catch(()=>{});
async function goalReview(el){const mon=DAYK.slice(0,7);let R0=(await load('review/m-'+mon))||{};REVIEW={m:mon,...R0};
  const prevM=(()=>{const d=new Date(DAYK+'T12:00');d.setDate(1);d.setMonth(d.getMonth()-1);return ymd(d).slice(0,7)})();const P0=(await load('review/m-'+prevM))||null;
  const act=gActive(),st=act.map(g=>[g,gState(g)]);const ls=lastSunday(DAYK),mName=new Date(DAYK+'T12:00').toLocaleDateString('en-GB',{month:'long'});
  /* three lines written from the data */
  const lines=[];const lifts=gLifts().slice(0,3).map(l=>{const c=tMonth(l.s,0),p=tMonth(l.s,1);return c.length&&p.length?[l.n,Math.max(...c.map(x=>x[1]))-Math.max(...p.map(x=>x[1]))]:null}).filter(Boolean).sort((a,b)=>b[1]-a[1]);
  const ahead=st.filter(([,s])=>s.status==='Ahead'||s.status==='Done').map(([g])=>g.name),behind=st.filter(([,s])=>s.status==='Behind');
  if(lifts.length&&lifts[0][1]>0)lines.push(['nx-ok','Win',`${lifts[0][0]} e1RM up ${Math.round(lifts[0][1])} kg on last month.`]);else if(ahead.length)lines.push(['nx-ok','Win',`${ahead[0]} is ahead of pace.`]);
  if(behind.length){const [g,s]=behind[0];lines.push(['nx-bad','Slip',`${g.name} is behind pace${s.need!=null&&g.src!=='ms'?`, needs ${nxSign(s.need,Math.abs(s.need)<10?1:0)} ${gUnit(g)} a week from here`:''}.`])}
  if(typeof moodData==='function'&&typeof moodEffects==='function'){try{if(!MI)MI=await moodData();const ef=moodEffects(MI).filter(x=>x.d>0)[0];if(ef)lines.push(['nx-cy','Pattern',`Your best days followed: ${ef.l.toLowerCase()} (${nxSign(ef.d)} mood).`])}catch(e){}}
  if(P0&&P0.change)lines.push(['','Last month',`Your one change was: ${P0.change}${P0.kept!=null?(P0.kept?' · kept':' · not kept'):''}`]);
  const R1=REVIEW;
  el.innerHTML=`<div class="nx"><div class="nx-card" style="background:radial-gradient(120% 100% at 0% 0%,rgba(255,42,109,.16),transparent 60%),rgba(255,255,255,.045)">
    <div class="nx-xs" style="text-transform:uppercase;letter-spacing:.06em;font-weight:600">Monthly review · ${nxDate(ls)}</div><div class="nx-t1" style="font-size:22px;margin-top:4px">${mName}</div>
    <div class="nx-s" style="margin-top:4px">${R1.done?'Done for this month. You can still edit it.':DAYK<ls?`Opens properly on ${nxDate(ls)}, but you can fill it in any time. About 15 minutes.`:'About 15 minutes. The numbers are filled in, you answer three questions.'}</div></div>
  ${st.length?`<div class="nx-card"><div class="nx-h"><span>Goals this month</span><em>pace</em></div><div class="nx-rows">${st.map(([g,s])=>`<div class="nx-row"><span>${esc(g.name)}</span><span class="nx-pill ${gPill(s.status)}">${s.status}</span></div>`).join('')}</div></div>`:''}
  ${lines.length?`<div class="nx-card"><div class="nx-h"><span>What the data says</span></div><div style="display:grid;gap:12px">${lines.map(([c,l,t])=>`<div style="display:flex;gap:12px"><span class="nx-pill ${c}" style="height:fit-content;min-width:64px;justify-content:center">${l}</span><span style="font-size:13.5px;color:#d1d1d6">${esc(t)}</span></div>`).join('')}</div></div>`:''}
  ${P0&&P0.change&&P0.kept==null?`<div class="nx-card"><div class="nx-split"><span class="nx-t2">Did you keep last month's change?</span></div><div class="nx-s" style="margin:6px 0 10px">${esc(P0.change)}</div><div class="nx-btns"><button type="button" class="nx-btn2" data-rkept="1">Kept it</button><button type="button" class="nx-btn2" data-rkept="0">Didn't</button></div></div>`:''}
  <div class="nx-field"><label for="rQ1">What worked?</label><textarea class="nx-inp" id="rQ1" rows="3">${esc(R1.q1||'')}</textarea></div>
  <div class="nx-field"><label for="rQ2">What didn't?</label><textarea class="nx-inp" id="rQ2" rows="3">${esc(R1.q2||'')}</textarea></div>
  <div class="nx-field"><label for="rCh">One change for next month</label><textarea class="nx-inp" id="rCh" rows="2" placeholder="One specific change beats several vague ones">${esc(R1.change||'')}</textarea></div>
  ${act.length?`<div class="nx-field"><label for="rG">It serves</label><select class="nx-inp" id="rG"><option value="">no goal in particular</option>${act.map(g=>`<option value="${g.id}" ${R1.goal===g.id?'selected':''}>${esc(g.name)}</option>`).join('')}</select></div>`:''}
  <div class="nx-card" style="padding:12px 14px;display:flex;align-items:center;gap:12px"><span class="nx-pill nx-pk">Becomes</span><span class="nx-s" style="color:#d1d1d6">A card at the top of Week all next month, so you see it every time you plan.</span></div>
  <button type="button" class="nx-btnp" id="rDone">${R1.done?'Save changes':'Finish review'}</button></div>`;
  const persist=()=>{REVIEW={...REVIEW,q1:$('rQ1').value,q2:$('rQ2').value,change:$('rCh').value.trim(),goal:$('rG')?$('rG').value:'',at:new Date().toISOString()};const {m,...doc}=REVIEW;save('review/m-'+mon,doc)};
  el.oninput=e=>{if(e.target.matches('textarea,select')){clearTimeout(el._t);el._t=setTimeout(persist,700)}};el.onchange=persist;
  el.onclick=async e=>{const k=e.target.closest('[data-rkept]');if(k&&P0){P0.kept=k.dataset.rkept==='1';save('review/m-'+prevM,P0);goalReview(el);return}
    if(e.target.closest('#rDone')){persist();REVIEW.done=true;REVIEW.snap={goals:st.map(([g,s])=>({id:g.id,n:g.name,st:s.status,pct:Math.round(s.pct*100)}))};const {m,...doc}=REVIEW;save('review/m-'+mon,doc,true);
      if(typeof pushCancel==='function')pushCancel('rev:'+ls);if(typeof burstEl==='function')burstEl(e.target.closest('#rDone'),60,true);goalReview(el);renderWeekChange()}}}
/* Week: this month's one change sits at the top (it comes from last month's review) */
async function renderWeekChange(){const el=$('weekChange');if(!el)return;try{const prevM=(()=>{const d=new Date(DAYK+'T12:00');d.setDate(1);d.setMonth(d.getMonth()-1);return ymd(d).slice(0,7)})();
  const P0=await load('review/m-'+prevM);if(!P0||!P0.change){el.innerHTML='';return}await goalsLoad();const g=GOALS.goals.find(x=>x.id===P0.goal);
  el.innerHTML=`<div class="nx" style="padding:0"><div class="nx-card" style="display:flex;gap:12px;align-items:flex-start;background:radial-gradient(120% 120% at 0% 0%,rgba(255,42,109,.14),transparent 60%),rgba(255,255,255,.045)"><span class="nx-pill nx-pk" style="flex:none">This month</span><div style="min-width:0"><div class="nx-t2">${esc(P0.change)}</div><div class="nx-xs" style="margin-top:3px">Your one change from the ${new Date(prevM+'-15T12:00').toLocaleDateString('en-GB',{month:'long'})} review${g?' · for '+esc(g.name):''}</div></div></div></div>`}catch(e){nxErr(e,'week')}}
nxCmd('new goal','goals',()=>{go('goals');setGoalV('goals').then(()=>goalEdit(null))});
nxCmd('monthly review','goals',()=>{go('goals');setGoalV('review')});
nxCmd('trends','goals',()=>{go('goals');setGoalV('trends')});
