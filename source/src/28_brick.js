/* ================= BRICK — phone lockdown =================
   A web app can't block iPhone apps itself (only Apple's Screen Time API can, and that needs a native app).
   What this does instead: it drives an iOS Shortcut, which CAN turn on a Focus that hides and silences your apps —
   and if you own the real Brick, it runs that app's shortcut too. The app tracks the state, time and streaks. */
let BRICK={on:false,since:null,until:null,sessions:[],strict:false,auto:false,sOn:'Brick On',sOff:'Brick Off'},brickLoaded=false,brickTick=null;
const bMin=(a,b)=>Math.max(0,Math.round((b-a)/60000));
async function loadBrick(){if(brickLoaded){renderBrick();return}
  try{const d=await load('tools/brick');if(d)BRICK={...BRICK,...d}}catch(e){}
  brickLoaded=true;
  if(BRICK.on&&BRICK.until&&Date.now()>BRICK.until)bEnd(true);   // ran out while the app was closed
  renderBrick()}
const bSave=()=>save('tools/brick',BRICK,true);
/* fire a Shortcut by name. Needs a real tap, so only call this from a click handler.
   An <a> click is used rather than location.href so a missing handler can't blank the page. */
const bIOS=()=>/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
function bRun(name){if(!name)return false;
  if(!bIOS()){bToast('Shortcuts only run on your iPhone — the timer still counts here.');return false}
  const a=document.createElement('a');a.href='shortcuts://run-shortcut?name='+encodeURIComponent(name);a.style.display='none';
  document.body.appendChild(a);a.click();setTimeout(()=>a.remove(),0);return true}
function bToast(msg){const t=document.createElement('div');t.className='bktoast';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),3200)}
function bStart(mins){const now=Date.now();BRICK.on=true;BRICK.since=now;BRICK.until=mins?now+mins*60000:null;bSave();
  bRun(BRICK.sOn);renderBrick();try{navigator.vibrate&&navigator.vibrate([25,60,25])}catch(e){}}
function bEnd(auto){const now=Date.now();const min=BRICK.since?bMin(BRICK.since,Math.min(now,BRICK.until||now)):0;
  const broke=!auto&&BRICK.until&&now<BRICK.until;
  if(min>0)BRICK.sessions.unshift({d:DAYK,at:new Date(BRICK.since).toISOString(),min,broke:!!broke});
  BRICK.sessions=BRICK.sessions.slice(0,400);BRICK.on=false;BRICK.since=null;BRICK.until=null;bSave();
  if(!auto)bRun(BRICK.sOff);renderBrick()}
function bLeft(){return BRICK.on&&BRICK.until?Math.max(0,Math.round((BRICK.until-Date.now())/1000)):null}
const bToday=()=>BRICK.sessions.filter(s=>s.d===DAYK).reduce((a,s)=>a+s.min,0)+(BRICK.on&&BRICK.since?bMin(BRICK.since,Date.now()):0);
function bStreak(){let n=0;for(let i=0;;i++){const d=addDays(DAYK,-i);const m=BRICK.sessions.filter(s=>s.d===d).reduce((a,s)=>a+s.min,0)+(i===0&&BRICK.on&&BRICK.since?bMin(BRICK.since,Date.now()):0);
  if(m>=25)n++;else if(i>0)break;else if(!n&&i===0)break}return n}
function renderBrick(){const el=$('t-brick');if(!el)return;if(!brickLoaded){loadBrick();return}
  const l=bLeft(),today=bToday();
  const days=[...Array(7)].map((_,i)=>addDays(DAYK,i-6));
  const per=days.map(d=>BRICK.sessions.filter(s=>s.d===d).reduce((a,s)=>a+s.min,0)+(d===DAYK&&BRICK.on&&BRICK.since?bMin(BRICK.since,Date.now()):0));
  const mx=Math.max(60,...per);const log=BRICK.sessions.filter(s=>s.d===DAYK).slice(0,8);
  const ready=BRICK.sOn&&BRICK.sOff;
  el.innerHTML=`<div class="focusgrid">
    <div class="panel bkcard${BRICK.on?' on':''}"><div class="ph"><span class="tag">${BRICK.on?'bricked':'unbricked'}</span><span class="dim">${esc(BRICK.sOn||'no shortcut set')}</span></div><div class="pb">
      <div class="bkslab">
        <svg viewBox="0 0 120 150" class="bkico" aria-hidden="true"><rect x="18" y="34" width="84" height="104" rx="12" fill="none" stroke="currentColor" stroke-width="5"/><path d="M38 34V22a22 22 0 0 1 44 0v12" fill="none" stroke="currentColor" stroke-width="5" ${BRICK.on?'':'transform="rotate(26 82 34)"'}/><circle cx="60" cy="80" r="8" fill="currentColor"/><rect x="56" y="86" width="8" height="22" rx="4" fill="currentColor"/></svg>
        <div class="bkstate"><b>${BRICK.on?(l!=null?pad(Math.floor(l/3600))+':'+pad(Math.floor(l/60)%60)+':'+pad(l%60):'locked'):'phone is open'}</b>
          <span class="dim">${BRICK.on?(l!=null?'until '+new Date(BRICK.until).toTimeString().slice(0,5):'open-ended · end it when you’re done'):(today?Math.floor(today/60)+'h '+pad(today%60)+'m bricked today':'nothing bricked today')}</span></div>
      </div>
      ${BRICK.on?`<div class="bigbtns" style="justify-content:center;margin-top:4px"><button class="btn${BRICK.strict&&l?'':' p'} fbig" type="button" id="bkOff">${BRICK.strict&&l?'break the brick':'unbrick'}</button></div>`
        :`<div class="seg fpresets" id="bkPre">${[25,50,90,180].map(m=>`<button type="button" data-m="${m}">${m>=60?m/60+'h':m+'m'}</button>`).join('')}<button type="button" data-m="0">open</button><button type="button" data-m="custom">…</button></div>
          <div class="bigbtns" style="justify-content:center;margin-top:14px"><button class="btn p fbig" type="button" id="bkOn"${ready?'':' disabled'}>brick my phone</button></div>
          ${ready?'':'<div class="dim bkwarn">set up the shortcut first — see the panel on the right</div>'}`}
      <div class="bkrow"><label class="bkchk"><input type="checkbox" id="bkAuto" ${BRICK.auto?'checked':''}> brick when a focus timer starts</label>
        <label class="bkchk"><input type="checkbox" id="bkStrict" ${BRICK.strict?'checked':''}> strict · confirm before ending early</label></div>
      <div style="margin-top:14px"><div class="dim" style="font-size:11px;margin-bottom:4px">bricked today · ${Math.floor(today/60)}h ${pad(today%60)}m${bStreak()?` · ${bStreak()} day streak`:''}</div><div class="meter"><span style="width:${Math.min(100,today/120*100)}%"></span></div></div>
    </div></div>
    <div class="fside">
      <div class="panel"><div class="ph"><span class="tag">last 7 days</span><span class="dim">${log.length} session${log.length===1?'':'s'} today</span></div><div class="pb">
        <div class="wkbars" style="grid-template-columns:repeat(7,1fr);height:100px">${per.map((v,i)=>`<div class="d"><span class="p num">${v?Math.round(v/6)/10+'h':''}</span><div class="b" style="height:${v/mx*100}%"></div><span class="l">${new Date(days[i]+'T12:00').toLocaleDateString('en-GB',{weekday:'short'}).toLowerCase()}</span></div>`).join('')}</div>
        <div class="flog">${log.map(s=>`<div><span class="num">${new Date(s.at).toTimeString().slice(0,5)}</span><span>${s.broke?'ended early':'full session'}</span><b class="num">${s.min}m</b></div>`).join('')||'<div class="dim" style="font-size:11px">no sessions yet today</div>'}</div>
      </div></div>
      <div class="panel"><div class="ph"><span class="tag">shortcuts</span><span class="dim">iphone</span></div><div class="pb">
        <div class="fl"><span>shortcut that locks the phone</span><input class="inp" id="bkSOn" value="${esc(BRICK.sOn||'')}" placeholder="Brick On"></div>
        <div class="fl"><span>shortcut that unlocks it</span><input class="inp" id="bkSOff" value="${esc(BRICK.sOff||'')}" placeholder="Brick Off"></div>
        <div class="chips" style="margin-top:8px"><button class="chip" type="button" id="bkTestOn">test lock</button><button class="chip" type="button" id="bkTestOff">test unlock</button></div>
        <div class="dim bknote">The name must match the Shortcut on your iPhone exactly. If you own the real Brick, use its own shortcuts here.</div>
      </div></div>
      <div class="panel"><div class="ph"><span class="tag">how to set it up</span></div><div class="pb">
        <ol class="bksteps">
          <li><b>Make a Focus.</b> Settings → Focus → + → Custom, call it <b>Brick</b>. Allow no apps and no people to notify you.</li>
          <li><b>Hide the apps.</b> In that Focus, under Home Screen, turn on Custom Pages and pick a page with only what you need (phone, maps, this app). Everything else disappears while it's on.</li>
          <li><b>Lock the escape hatch.</b> Settings → Screen Time → turn on a passcode you don't know by heart (or have someone else set it), then App Limits for the apps you lose hours to.</li>
          <li><b>Two shortcuts.</b> In the Shortcuts app make <b>Brick On</b> = "Set Focus → Brick → On", and <b>Brick Off</b> = "Set Focus → Brick → Off".</li>
          <li><b>Come back here</b> and tap test lock. Your phone should go quiet and the apps should vanish.</li>
        </ol>
        <div class="dim bknote">Honest limit: this app can't block apps by itself — only Apple's Screen Time can, and that's native-app territory. The Focus above hides and silences them, Screen Time enforces the hard limits, and this screen is the switch and the record.</div>
      </div></div>
    </div></div>`;
  bindBrick();if(typeof toolCardSubs==='function')toolCardSubs();clearInterval(brickTick);if(BRICK.on)brickTick=setInterval(()=>{if(cur==='tools'&&TOOLV==='brick'&&!document.hidden){const x=bLeft();if(x===0)bEnd(true);else renderBrick()}},1000)}
function bindBrick(){
  if($('bkOn'))$('bkOn').onclick=()=>{bStart(BRICK.pre==null?25:BRICK.pre)};
  if($('bkPre'))$('bkPre').onclick=e=>{const b=e.target.closest('button');if(!b)return;let m=b.dataset.m;
    if(m==='custom'){m=parseInt(prompt('Brick for how many minutes?','60')||'');if(!(m>0))return}
    BRICK.pre=+m;$('bkPre').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x.dataset.m===String(m)));bStart(+m)};
  if($('bkOff'))$('bkOff').onclick=()=>{const l=bLeft();
    if(BRICK.strict&&l){openSheet('end early?',`<div class="gc-det"><p>${Math.ceil(l/60)} minutes left. Ending now goes in the log as a broken session.</p><div class="bigbtns"><button class="btn" type="button" id="bkYes">end it anyway</button><button class="btn p" type="button" id="bkNo">keep going</button></div></div>`);
      $('sheetBody').onclick=e=>{if(e.target.id==='bkYes'){closeSheet();bEnd(false)}if(e.target.id==='bkNo')closeSheet()};return}
    bEnd(false)};
  if($('bkAuto'))$('bkAuto').onchange=e=>{BRICK.auto=e.target.checked;bSave()};
  if($('bkStrict'))$('bkStrict').onchange=e=>{BRICK.strict=e.target.checked;bSave()};
  const nm=(id,k)=>{const n=$(id);if(n)n.oninput=e=>{BRICK[k]=e.target.value.trim();clearTimeout(bindBrick['t'+k]);bindBrick['t'+k]=setTimeout(bSave,700)}};
  nm('bkSOn','sOn');nm('bkSOff','sOff');
  if($('bkTestOn'))$('bkTestOn').onclick=()=>bRun($('bkSOn').value.trim());
  if($('bkTestOff'))$('bkTestOff').onclick=()=>bRun($('bkSOff').value.trim());}
/* called by the focus timer */
function brickAuto(on,mins){if(!BRICK.auto||!BRICK.sOn)return;
  if(on){if(!BRICK.on)bStart(mins||null)}else if(BRICK.on)bEnd(true)}
