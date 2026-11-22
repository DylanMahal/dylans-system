/* ================= BRICK — phone lockdown =================
   A web app can't block iPhone apps itself (only Apple's Screen Time API can, and that needs a native app).
   What this does instead: it drives an iOS Shortcut, which CAN turn on a Focus that hides and silences your apps —
   and if you own the real Brick, it runs that app's shortcut too. The app tracks the state, time and streaks. */
let BST={};/* daily screen time from the morning Shortcut, health/d-<day>.screentime */
const bSTh=v=>v<=0||isNaN(v)?null:v<=24?v:v<=1440?v/60:v/3600;   // accepts hours, minutes or seconds
let BRICK={on:false,since:null,until:null,sessions:[],strict:false,auto:false,sOn:'Brick On',sOff:'Brick Off'},brickLoaded=false,brickTick=null;
const bMin=(a,b)=>Math.max(0,Math.round((b-a)/60000));
async function loadBrick(){if(brickLoaded){renderBrick();return}
  try{const d=await load('tools/brick');if(d)BRICK={...BRICK,...d}}catch(e){}
  try{(await listDocs('health/d-')).forEach(r=>{const v=r.data&&(r.data.screentime??r.data.screen);if(v!=null)BST[r.path.slice(9)]=+v})}catch(e){}
  brickLoaded=true;
  if(BRICK.on&&BRICK.until&&Date.now()>BRICK.until)bEnd(true);   // ran out while the app was closed
  renderBrick()}
const bSave=()=>save('tools/brick',BRICK,true);
/* fire a Shortcut by name. Needs a real tap, so only call this from a click handler.
   An <a> click is used rather than location.href so a missing handler can't blank the page. */
const bIOS=()=>/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
function bRun(name,input){if(!name)return false;
  if(!bIOS()){bToast('Shortcuts only run on your iPhone — the timer still counts here.');return false}
  const a=document.createElement('a');a.href='shortcuts://run-shortcut?name='+encodeURIComponent(name)+(input?'&input=text&text='+encodeURIComponent(input):'');a.style.display='none';
  document.body.appendChild(a);a.click();setTimeout(()=>a.remove(),0);return true}
function bToast(msg){const t=document.createElement('div');t.className='bktoast';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),3200)}
function bStart(mins){const now=Date.now();BRICK.on=true;BRICK.since=now;BRICK.until=mins?now+mins*60000:null;bSave();
  const e=new Date(BRICK.until||now+864e5);bRun(BRICK.sOn,ymd(e)+' '+pad(e.getHours())+':'+pad(e.getMinutes()));renderBrick();try{navigator.vibrate&&navigator.vibrate([25,60,25])}catch(e){}}
function bEnd(auto){const now=Date.now();const min=BRICK.since?bMin(BRICK.since,Math.min(now,BRICK.until||now)):0;
  const broke=!auto&&BRICK.until&&now<BRICK.until;
  if(min>0)BRICK.sessions.unshift({d:DAYK,at:new Date(BRICK.since).toISOString(),min,broke:!!broke});
  BRICK.sessions=BRICK.sessions.slice(0,400);BRICK.on=false;BRICK.since=null;BRICK.until=null;bSave();
  if(!auto)bRun(BRICK.sOff);renderBrick()}
function bLeft(){return BRICK.on&&BRICK.until?Math.max(0,Math.round((BRICK.until-Date.now())/1000)):null}
const bToday=()=>BRICK.sessions.filter(s=>s.d===DAYK).reduce((a,s)=>a+s.min,0)+(BRICK.on&&BRICK.since?bMin(BRICK.since,Date.now()):0);
function bStreak(){let n=0;for(let i=0;;i++){const d=addDays(DAYK,-i);const m=BRICK.sessions.filter(s=>s.d===d).reduce((a,s)=>a+s.min,0)+(i===0&&BRICK.on&&BRICK.since?bMin(BRICK.since,Date.now()):0);
  if(m>=25)n++;else if(i>0)break;else if(!n&&i===0)break}return n}
function bHMS(s){return (s>=3600?Math.floor(s/3600)+':':'')+pad(Math.floor(s/60)%60)+':'+pad(s%60)}
const bHM=m=>m>=60?Math.floor(m/60)+'h '+pad(m%60)+'m':m+'m';
function bLife(){const ks=Object.keys(BST).sort().slice(-7),vals=ks.map(k=>bSTh(BST[k])).filter(x=>x!=null);
  const st=vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length*10)/10:null,age=+BRICK.age||null,goal=BRICK.goalH==null?2:+BRICK.goalH;
  if(st==null)return `<div class="bk-card bk-life"><div class="bk-h"><span>Your phone life</span></div>
    <p class="bk-p">Waiting for your screen time. Add one line to your morning sleep Shortcut and this fills in by itself:</p>
    <ol class="sl-steps"><li>In the sleep Shortcut, before the last Text block, add Jomo's <b>screen time</b> action for <i>yesterday</i>.</li><li>In the last Text block add a new line: <code>Screen Time|</code> then insert that result.</li></ol></div>`;
  if(!age)return `<div class="bk-card bk-life"><div class="bk-h"><span>Your phone life</span></div><div class="bk-big num">${st}<small> h a day</small></div>
    <p class="bk-p">Your average over the last ${vals.length} day${vals.length===1?'':'s'}. One last thing — how old are you?</p>
    <div class="bk-goal" style="background:rgba(255,255,255,.04)"><div><span>Age</span><div class="bk-step"><button type="button" data-age="-1" aria-label="Younger">−</button><b class="num">${BRICK.ageTmp||21}</b><button type="button" data-age="1" aria-label="Older">+</button></div></div><button class="btn p sm" type="button" id="bkAgeOk">Done</button></div></div>`;
  const left=Math.max(1,80-age),yrs=left*st/24,goalY=left*Math.min(st,goal)/24,back=Math.max(0,yrs-goalY),waking=Math.round(st/16*100);
  const sl=left*8/24,free=left-sl-yrs;const W=x=>(x/left*100).toFixed(2)+'%';
  return `<div class="bk-card bk-life"><div class="bk-h"><span>Your phone life</span><em>${vals.length}-day average</em></div>
    <div class="bk-big num">${yrs.toFixed(1)}<small> years</small></div>
    <p class="bk-p">of the rest of your life will be spent looking at your phone, at <b>${st}h a day</b> from ${age} to 80. That's <b>${waking}%</b> of every waking hour.</p>
    <div class="bk-lifebar"><i style="width:${W(yrs)};background:var(--pink)"></i><i style="width:${W(sl)};background:#5e5ce6"></i><i style="width:${W(Math.max(0,free))};background:rgba(255,255,255,.14)"></i></div>
    <div class="bk-keys"><span><i style="background:var(--pink)"></i>phone ${yrs.toFixed(1)}y</span><span><i style="background:#5e5ce6"></i>sleep ${sl.toFixed(0)}y</span><span><i style="background:rgba(255,255,255,.3)"></i>everything else ${Math.max(0,free).toFixed(1)}y</span></div>
    <div class="bk-goal"><div><span>Cut it to</span><div class="bk-step"><button type="button" data-gh="-0.5" aria-label="Less">−</button><b class="num">${String(goal).replace(/\.0$/,'')}h</b><button type="button" data-gh="0.5" aria-label="More">+</button></div><span>a day</span></div>
      <div class="bk-back"><b class="num">+${back.toFixed(1)} years</b><span>of your life back</span></div></div></div>`}
function renderBrick(){const el=$('t-brick');if(!el)return;if(!brickLoaded){loadBrick();return}
  const l=bLeft(),today=bToday(),streak=bStreak();
  const days=[...Array(7)].map((_,i)=>addDays(DAYK,i-6));
  const per=days.map(d=>BRICK.sessions.filter(s=>s.d===d).reduce((a,s)=>a+s.min,0)+(d===DAYK&&BRICK.on&&BRICK.since?bMin(BRICK.since,Date.now()):0));
  const week=per.reduce((a,b)=>a+b,0),mx=Math.max(60,...per),log=BRICK.sessions.filter(s=>s.d===DAYK).slice(0,8);
  const all=BRICK.sessions.reduce((a,s)=>a+s.min,0)+(BRICK.on&&BRICK.since?bMin(BRICK.since,Date.now()):0);
  const ready=!!BRICK.sOn,pre=BRICK.pre?BRICK.pre:25;
  const tot=BRICK.on&&BRICK.until?(BRICK.until-BRICK.since)/1000:0,pct=tot?Math.max(0,Math.min(100,(1-l/tot)*100)):0;
  const sw=(id,on,t,s)=>`<label class="bk-frow"><span>${t}<small>${s}</small></span><input type="checkbox" class="sl-sw" id="${id}" ${on?'checked':''}></label>`;
  const hero=BRICK.on?`<div class="bk-card bk-hero on">
      <div class="bk-ringw"><div class="sl-ring" style="width:210px;height:210px"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" class="tr" stroke-width="5"/><circle id="bkRing" cx="50" cy="50" r="46" class="fl" stroke="var(--pink)" stroke-width="5" pathLength="100" stroke-dasharray="${(l!=null?pct:100).toFixed(2)} 100"/></svg>
        <div class="in"><svg viewBox="0 0 24 24" width="22" height="22" class="bk-lk"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2"/></svg><b class="num" id="bkLeft">${l!=null?bHMS(l):bHM(bMin(BRICK.since,Date.now()))}</b><span>${l!=null?'until '+new Date(BRICK.until).toTimeString().slice(0,5):'bricked · open-ended'}</span></div></div></div>
      <div class="bk-title">Phone bricked</div><p class="bk-p c">Stay with it. Everything unlocks by itself at ${l!=null?new Date(BRICK.until).toTimeString().slice(0,5):'the end'}.</p>
      <div class="bk-sealed"><svg viewBox="0 0 24 24" width="15" height="15"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>No way out until it ends</div></div>`
    :`<div class="bk-card bk-hero">
      <div class="bk-lock"><svg viewBox="0 0 24 24" width="40" height="40"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 10.5V8a4 4 0 0 1 7.6-1.7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="15.5" r="1.4" fill="currentColor"/></svg></div>
      <div class="bk-title">Phone is open</div><p class="bk-p c">${today?bHM(today)+' bricked today':'Nothing bricked yet today'}</p>
      <div class="bk-lab">Duration</div>
      <div class="seg bk-pre" id="bkPre">${[25,50,90,180].map(m=>`<button type="button" data-m="${m}" aria-pressed="${pre===m}">${m>=60?(m/60+'h').replace('.5h','½h'):m+'m'}</button>`).join('')}<button type="button" data-m="custom" aria-pressed="${![25,50,90,180].includes(pre)}">${![25,50,90,180].includes(pre)?pre+'m':'Custom'}</button></div>
      <button class="btn p bk-wide bk-go" type="button" id="bkOn"${ready?'':' disabled'}>Brick my phone</button>
      ${ready?'':'<div class="bk-warn">Set up the shortcuts first, see Setup below.</div>'}
      <div class="bk-form bk-opts">${sw('bkAuto',BRICK.auto,'Brick with focus timer','Locks when a focus timer starts')}</div></div>`;
  const tile=(lab,v,s)=>`<div class="sl-tile"><span>${lab}</span><b class="num">${v}</b><em>${s}</em></div>`;
  el.innerHTML=`<div class="bk-grid"><div class="bk-col">${hero}
    <div class="sl-tiles bk-tiles">${tile('Today',bHM(today),log.length+' session'+(log.length===1?'':'s'))}${tile('Streak',streak+'<small> day'+(streak===1?'':'s')+'</small>','25 min+ a day')}${tile('This week',bHM(week),'last 7 days')}${tile('Reclaimed',(all/60).toFixed(all<600?1:0)+'<small> h</small>','≈ '+(all/1440).toFixed(1)+' days, all time')}</div></div>
    <div class="bk-col">${bLife()}
    <div class="bk-card"><div class="bk-h"><span>Last 7 days</span><em>${bHM(week)}</em></div>
      <div class="bk-bars">${per.map((v,i)=>`<div><em class="num">${v?(v/60).toFixed(1)+'h':''}</em><span style="height:${(v/mx*100).toFixed(1)}%"${days[i]===DAYK?' class="t"':''}></span><small>${new Date(days[i]+'T12:00').toLocaleDateString('en-GB',{weekday:'narrow'})}</small></div>`).join('')}</div>
      ${log.length?`<div class="sl-rows bk-log">${log.map(s=>`<div><span><i class="dot" style="background:${s.broke?'#ff453a':'#30d158'}"></i>${new Date(s.at).toTimeString().slice(0,5)}<small>${s.broke?'ended early':'completed'}</small></span><b class="num">${bHM(s.min)}</b></div>`).join('')}</div>`:''}</div>
    <div class="bk-card"><details class="sl-det bk-setup"${ready?'':' open'}><summary>Setup</summary>
      <ol class="sl-steps">
        <li><b>Jomo</b> (free): Rules → Start blocking → pick the apps to block, turn on <b>Strict Mode</b>, save it as <b>Brick</b>.</li>
        
        <li>Shortcuts app → new shortcut <b>Brick On</b> → Jomo <i>Start Session</i> → Brick, Timing <i>Until Date</i>, Date = <i>Shortcut Input</i>, Show When Run off.</li>
        <li>Tap <b>Test lock</b> below. Your blocked apps grey out for about a minute, then unlock by themselves.</li></ol>
      <div class="bk-form" style="margin-top:12px"><label class="bk-frow"><span>Lock shortcut</span><input class="inp" id="bkSOn" value="${esc(BRICK.sOn||'')}" placeholder="Brick On"></label></div>
      <div class="sl-btns"><button class="btn" type="button" id="bkTestOn">Test lock</button></div>
      <div class="sl-note">The name must match your Shortcut exactly. Your app tells Jomo when to unlock, so a brick can't be ended early. The blocking itself is done by Jomo through Apple's Screen Time. This app is the switch and the record.</div></details></div>
  </div></div>`;
  bindBrick();if(typeof toolCardSubs==='function')toolCardSubs();clearInterval(brickTick);if(BRICK.on)brickTick=setInterval(()=>{if(cur==='tools'&&TOOLV==='brick'&&!document.hidden){const x=bLeft();if(x===0){bEnd(true);return}const t=$('bkLeft');if(!t)return;if(x!=null){t.textContent=bHMS(x);const r=$('bkRing'),T=(BRICK.until-BRICK.since)/1000;if(r)r.setAttribute('stroke-dasharray',Math.max(0,Math.min(100,(1-x/T)*100)).toFixed(2)+' 100')}else t.textContent=bHM(bMin(BRICK.since,Date.now()))}},1000)}
function bindBrick(){
  if($('bkOn'))$('bkOn').onclick=()=>{bStart(BRICK.pre==null?25:BRICK.pre)};
  if($('bkPre'))$('bkPre').onclick=e=>{const b=e.target.closest('button');if(!b)return;let m=b.dataset.m;
    if(m==='custom'){m=parseInt(prompt('Brick for how many minutes?','60')||'');if(!(m>0))return}
    BRICK.pre=+m;bSave();renderBrick()};
  if($('bkOff'))$('bkOff').onclick=()=>{const l=bLeft();
    if(BRICK.strict&&l){openSheet('end early?',`<div class="gc-det"><p>${Math.ceil(l/60)} minutes left. Ending now goes in the log as a broken session.</p><div class="bigbtns"><button class="btn" type="button" id="bkYes">end it anyway</button><button class="btn p" type="button" id="bkNo">keep going</button></div></div>`);
      $('sheetBody').onclick=e=>{if(e.target.id==='bkYes'){closeSheet();bEnd(false)}if(e.target.id==='bkNo')closeSheet()};return}
    bEnd(false)};
  if($('bkAuto'))$('bkAuto').onchange=e=>{BRICK.auto=e.target.checked;bSave()};
  if($('bkStrict'))$('bkStrict').onchange=e=>{BRICK.strict=e.target.checked;bSave()};
  const nm=(id,k)=>{const n=$(id);if(n)n.oninput=e=>{BRICK[k]=e.target.value.trim();clearTimeout(bindBrick['t'+k]);bindBrick['t'+k]=setTimeout(bSave,700)}};
  nm('bkSOn','sOn');nm('bkSOff','sOff');
  if($('bkTestOn'))$('bkTestOn').onclick=()=>{const e=new Date(Date.now()+12e4);bRun($('bkSOn').value.trim(),ymd(e)+' '+pad(e.getHours())+':'+pad(e.getMinutes()))};
  if($('bkTestOff'))$('bkTestOff').onclick=()=>bRun($('bkSOff').value.trim());
  document.querySelectorAll('#t-brick [data-age]').forEach(b=>b.onclick=()=>{BRICK.ageTmp=Math.max(10,Math.min(90,(BRICK.ageTmp||21)+ +b.dataset.age));renderBrick()});
  if($('bkAgeOk'))$('bkAgeOk').onclick=()=>{BRICK.age=BRICK.ageTmp||21;delete BRICK.ageTmp;bSave();renderBrick()};
  document.querySelectorAll('#t-brick [data-gh]').forEach(b=>b.onclick=()=>{BRICK.goalH=Math.max(0,Math.min(12,(BRICK.goalH==null?2:+BRICK.goalH)+ +b.dataset.gh));bSave();renderBrick()});}
/* called by the focus timer */
function brickAuto(on,mins){if(!BRICK.auto||!BRICK.sOn)return;
  if(on){if(!BRICK.on&&mins>0)bStart(mins)}else if(BRICK.on)bEnd(true)}
