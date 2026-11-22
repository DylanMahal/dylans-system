/* ================= TOOLS: focus · protocols · leetcode ================= */
let lc=0,WK=isoWeek(logical()),SET={},TOOLV=LS.get('toolv')||'focus';
function renderTools(){
  $('toolSeg').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.t===TOOLV));
  ['focus','protocols','leetcode','brick'].forEach(v=>$('t-'+v).hidden=v!==TOOLV);
  $('toolsSub').textContent=nice(DAYK).toLowerCase();
  if(TOOLV==='focus')renderFocus();else if(TOOLV==='protocols')renderProto();else if(TOOLV==='brick')renderBrick();else renderLeet();
  toolCardSubs();
}
function toolCardSubs(){const dw=DAY.dw||0;$('tcFocus').textContent=`${Math.floor(dw/60)}h ${pad(dw%60)}m today`;
  if(typeof protoDueCount==='function'){const n=protoDueCount();$('tcProto').textContent=n?`${n} due today`:'nothing due'}
  if(typeof leetWeek==='function')$('tcLeet').textContent=`${leetWeek()} solved this week`;
  if(typeof bToday==='function'&&$('tcBrick')){const m=bToday();$('tcBrick').textContent=BRICK.on?'bricked now':(m?Math.floor(m/60)+'h '+pad(m%60)+'m today':'lock the phone')}}
$('toolSeg').onclick=e=>{const b=e.target.closest('[data-t]');if(!b)return;TOOLV=b.dataset.t;LS.set('toolv',TOOLV);renderTools();staggerIn($('t-'+TOOLV))};

/* ---------------- FOCUS ---------------- */
let TM=LS.get('timer')||{len:90,end:null,left:90*60};if(!TM.phase)TM.phase='focus';
let FOCUS={sessions:[],pomo:false,brk:10,task:''},MUSIC={list:[],cur:null,vol:60,shuffle:false};
const DW_TARGET=260;
function tmLeft(){return TM.end?Math.max(0,Math.round((TM.end-Date.now())/1000)):TM.left}
function tmTotal(){return (TM.phase==='break'?FOCUS.brk:TM.len)*60}
function logDw(minutes,task){if(minutes<1)return;DAY.dw=(DAY.dw||0)+minutes;persistDay();FOCUS.sessions.unshift({d:DAYK,at:new Date().toISOString(),min:minutes,task:task||FOCUS.task||''});FOCUS.sessions=FOCUS.sessions.slice(0,600);save('tools/focus',FOCUS);if(TOOLV==='focus'&&cur==='tools')renderFocus();toolCardSubs()}
function renderFocus(){const el=$('t-focus');if(!el)return;const live=YTP&&$('mBox')&&el.contains($('mBox'))?$('mBox').closest('.panel'):null;
  const today=FOCUS.sessions.filter(s=>s.d===DAYK);const dw=DAY.dw||0;
  const days=[...Array(7)].map((_,i)=>addDays(DAYK,i-6));const per=days.map(d=>FOCUS.sessions.filter(s=>s.d===d).reduce((a,s)=>a+s.min,0)+(d===DAYK?0:0));per[6]=Math.max(per[6],dw);const mx=Math.max(DW_TARGET,...per);
  const html=`<div class="focusgrid">
  <div class="panel fcard"><div class="ph"><span class="tag" id="fPhase">${TM.phase==='break'?'break':'focus'}</span><span class="row" style="gap:6px"><button class="iconbtn" type="button" id="fPomo" aria-pressed="${FOCUS.pomo}">auto-break ${FOCUS.pomo?'on':'off'}</button><button class="iconbtn" type="button" id="fFull">⤢ focus mode</button></span></div><div class="pb">
    <input class="fintent" id="fTask" placeholder="what are you working on?" value="${esc(FOCUS.task||'')}">
    <div class="fring"><svg viewBox="0 0 220 220"><circle cx="110" cy="110" r="100" class="rbg"/><circle cx="110" cy="110" r="100" class="rfg" id="fRing"/></svg><div class="ftime num" id="timer">--:--</div></div>
    <div class="seg fpresets" id="tmPresets">${[90,75,50,25].map(m=>`<button type="button" data-m="${m}">${m}</button>`).join('')}<button type="button" data-m="custom">…</button></div>
    <div class="bigbtns" style="margin-top:14px;justify-content:center"><button class="btn p fbig" type="button" id="tmGo">start</button><button class="btn" type="button" id="tmReset">stop + log</button></div>
    <div style="margin-top:16px"><div class="dim" style="font-size:11px;margin-bottom:4px">deep work today · ${Math.floor(dw/60)}h ${pad(dw%60)}m of ${Math.floor(DW_TARGET/60)}h ${pad(DW_TARGET%60)}m</div><div class="meter"><span style="width:${Math.min(100,dw/DW_TARGET*100)}%"></span></div></div>
  </div></div>
  <div class="fside">
    <div class="panel"><div class="ph"><span class="tag">audio deck</span></div><div class="pb${MUSIC.showVid?' showvid':''}" id="mBox">${musicHTML()}</div></div>
    <div class="panel"><div class="ph"><span class="tag">ambient</span></div><div class="pb"><div class="chips" id="ambBtns" style="margin:0 0 8px">${['rain','brown','pink','white','cafe'].map(k=>`<button class="chip" type="button" data-amb="${k}" aria-pressed="${AMB.kind===k}">${k}</button>`).join('')}</div><input type="range" id="ambVol" min="0" max="100" value="${AMB.vol}" class="vol"></div></div>
    <div class="panel"><div class="ph"><span class="tag">last 7 days</span><span class="dim">${today.length} session${today.length===1?'':'s'} today</span></div><div class="pb"><div class="wkbars" style="grid-template-columns:repeat(7,1fr);height:100px">${per.map((v,i)=>`<div class="d"><span class="p num">${v?Math.round(v/6)/10+'h':''}</span><div class="b" style="height:${v/mx*100}%"></div><span class="l">${new Date(days[i]+'T12:00').toLocaleDateString('en-GB',{weekday:'short'}).toLowerCase()}</span></div>`).join('')}</div>
      <div class="flog">${today.map(s=>`<div><span class="num">${new Date(s.at).toTimeString().slice(0,5)}</span><span>${esc(s.task||'focus')}</span><b class="num">${s.min}m</b></div>`).join('')}</div></div></div>
  </div></div>`;
  if(live){/* swap in everything except the audio deck, so whatever is playing keeps playing */
    const tmp=document.createElement('div');tmp.innerHTML=html;const fresh=tmp.querySelector('#mBox').closest('.panel');fresh.replaceWith(document.createComment('deck'));
    const oldGrid=el.querySelector('.focusgrid');const newGrid=tmp.querySelector('.focusgrid');
    oldGrid.querySelector('.fcard').replaceWith(newGrid.querySelector('.fcard'));
    const side=oldGrid.querySelector('.fside');[...side.children].forEach(ch=>{if(ch!==live)ch.remove()});[...newGrid.querySelector('.fside').childNodes].forEach(n=>{if(n.nodeType===8)side.appendChild(live);else side.appendChild(n)});
  }else el.innerHTML=html;
  drawTimer();bindFocus(!!live);
}
function bindFocus(keepDeck){
  $('tmGo').onclick=()=>{if(TM.end){TM.left=tmLeft();TM.end=null;pushCancel('focus')}else{TM.end=Date.now()+TM.left*1000;if(typeof brickAuto==='function'&&TM.phase==='focus')brickAuto(true,Math.ceil(TM.left/60));if(nOn('focus'))pushOne('focus',TM.end,TM.phase==='break'?'break over':'focus session done ✓',TM.phase==='break'?'back to work':(FOCUS.task||'take a break'),'./#tools')}LS.set('timer',TM);drawTimer();glitchAll()};
  $('tmReset').onclick=()=>{if(TM.phase==='focus'){const done=Math.floor((TM.len*60-tmLeft())/60);logDw(done)}TM={len:TM.len,end:null,left:TM.len*60,phase:'focus'};LS.set('timer',TM);drawTimer()};
  $('tmPresets').onclick=e=>{const b=e.target.closest('button');if(!b)return;let m=b.dataset.m;if(m==='custom'){m=parseInt(prompt('Minutes?',TM.len)||'');if(!(m>0))return}TM={len:+m,end:null,left:+m*60,phase:'focus'};LS.set('timer',TM);drawTimer()};
  $('fTask').oninput=e=>{FOCUS.task=e.target.value;clearTimeout(bindFocus.t);bindFocus.t=setTimeout(()=>save('tools/focus',FOCUS),600)};
  $('fPomo').onclick=()=>{FOCUS.pomo=!FOCUS.pomo;save('tools/focus',FOCUS);renderFocus()};
  $('fFull').onclick=openFocusMode;
  $('mBox').onclick=musicClick;vizAttach($('vizC'));
  $('ambBtns').onclick=e=>{const b=e.target.closest('[data-amb]');if(!b)return;ambient(AMB.kind===b.dataset.amb?null:b.dataset.amb);$('ambBtns').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x.dataset.amb===AMB.kind))};
  $('ambVol').oninput=e=>{AMB.vol=+e.target.value;LS.set('amb',{vol:AMB.vol});if(AMB.g)AMB.g.gain.value=AMB.vol/100*.6};
  if(deckSrc()&&!keepDeck)ensureYT();
}
function drawTimer(){const l=tmLeft();const tot=tmTotal();const txt=pad(Math.floor(l/60))+':'+pad(l%60);
  ['timer','fmTime'].forEach(id=>{const t=$(id);if(t){t.textContent=txt;t.classList.toggle('run',!!TM.end)}});
  const ring=$('fRing');if(ring){const C=628.3;ring.style.strokeDasharray=C;ring.style.strokeDashoffset=C*(l/tot);ring.classList.toggle('brk',TM.phase==='break')}
  if($('tmGo'))$('tmGo').textContent=TM.end?'pause':(l<tot?'resume':'start');if($('fmGo'))$('fmGo').textContent=TM.end?'pause':'start';
  if($('fPhase'))$('fPhase').textContent=TM.phase==='break'?'break':'focus';
  if($('tmPresets'))$('tmPresets').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.m===TM.len));
  if(TM.end&&l===0){chime();if(TM.phase==='focus'){logDw(TM.len);if(typeof brickAuto==='function')brickAuto(false);flash('block_done');shake();burst(innerWidth/2,innerHeight/2,160,true);
      TM=FOCUS.pomo?{len:TM.len,phase:'break',left:FOCUS.brk*60,end:Date.now()+FOCUS.brk*60*1000}:{len:TM.len,end:null,left:TM.len*60,phase:'focus'}}
    else{flash('back_to_work');TM={len:TM.len,end:null,left:TM.len*60,phase:'focus'}}LS.set('timer',TM);drawTimer()}}
setInterval(drawTimer,1000);
function chime(){try{const A=window.AudioContext||window.webkitAudioContext;const a=new A();[523,659,784,1046].forEach((f,i)=>{const o=a.createOscillator(),g=a.createGain();o.type='sine';o.frequency.value=f;const t=a.currentTime+i*.14;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.2,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+.9);o.connect(g);g.connect(a.destination);o.start(t);o.stop(t+1)})}catch(e){}try{navigator.vibrate&&navigator.vibrate([200,80,200])}catch(e){}}

/* focus mode (full screen) */
function openFocusMode(){let fm=$('focusMode');if(!fm){fm=document.createElement('div');fm.id='focusMode';fm.className='focusmode';document.body.appendChild(fm)}
  fm.innerHTML=`<button class="iconbtn fmx" type="button" id="fmX">exit</button><div class="fmtask">${esc(FOCUS.task||'deep work')}</div>${DECKS[deckNow()].audio&&deckSrc()?'<canvas class="viz fmviz" id="fmViz"></canvas>':''}<div class="fmtime num" id="fmTime"></div><div class="bigbtns" style="justify-content:center"><button class="btn p" type="button" id="fmGo">start</button>${deckSrc()?'<button class="btn" type="button" id="fmMus">⏯ audio</button><button class="btn" type="button" id="fmVid">⛶ video</button>':''}</div><div class="fmnow" id="fmNow"></div>`;
  fm.classList.add('on');try{fm.requestFullscreen&&fm.requestFullscreen().catch(()=>{})}catch(e){}
  $('fmX').onclick=()=>{fm.classList.remove('on');try{document.fullscreenElement&&document.exitFullscreen()}catch(e){}};
  $('fmGo').onclick=()=>$('tmGo')?$('tmGo').click():null;if($('fmMus'))$('fmMus').onclick=()=>ytToggle();if($('fmVid'))$('fmVid').onclick=()=>vidFull(true);drawTimer();ytNow();vizAttach($('fmViz'))}

/* music deck: lofi / private picks (audio + visualiser) · jvscholz (random livestream, video) · mine (other playlists) */
const SCHOLZ='UULVMwo6hT5hI3R56rO2HYP-wQ'; /* James Scholz — live streams uploads list */
const DECKS={lofi:{label:'lofi',sub:'your lofi playlist',audio:true},[LX('dk','picks')]:{label:LX('dk','picks'),sub:LW('dks','your private picks'),audio:true,random:true},scholz:{label:'jvscholz',sub:'random old pomodoro stream',audio:false,random:true},mine:{label:'custom',sub:'your other playlists',audio:true}};
let VLIST={},VHIST=[];const DSEEN=new Set();
function ytPlaying(){try{return !!YTP&&YTP.getPlayerState()===1}catch(e){return false}}
/* remember exactly where each deck was, so switching away and back carries on */
function savePos(){try{const s=deckSrc();if(!YTP||!s||s.deck==='mine')return;const v=(YTP.getVideoData()||{}).video_id,t=YTP.getCurrentTime();if(v){DPOS[s.deck]={key:s.key,v,t};LS.set('deckpos',DPOS)}}catch(e){}}
let YTP=null,ytReady=false,ytLoading=false,ytQ=null,ytTries=0;
const DPOS=LS.get('deckpos')||{};
function parseYT(url){try{const u=new URL(url.trim());const list=u.searchParams.get('list');let v=u.searchParams.get('v');if(!v&&/youtu\.be$/.test(u.hostname))v=u.pathname.slice(1);if(!v&&u.pathname.startsWith('/shorts/'))v=u.pathname.split('/')[2];return list?{type:'list',key:list,v}:v?{type:'video',key:v}:null}catch(e){return null}}
const deckNow=()=>DECKS[MUSIC.deck]?MUSIC.deck:'lofi';
function deckSrc(){const d=deckNow();if((d===LX('dk','picks')||d==='lofi')&&VLIST[d]&&VLIST[d].length)return {type:'vids',key:d+'-vids',ids:VLIST[d],deck:d};if(d==='mine'){const s=MUSIC.list.find(x=>x.id===MUSIC.cur);return s?{...s,deck:'mine'}:null}const l=d==='scholz'?SCHOLZ:(MUSIC.decks||{})[d];return l?{type:'list',key:l,deck:d}:null}
/* phones show the video by default (their own setting, not the synced one) */
const PHONE=/iPhone|iPod/.test(navigator.userAgent)||(navigator.maxTouchPoints>0&&matchMedia('(max-width:520px)').matches);
function showVidNow(){if(!PHONE)return !!MUSIC.showVid;const o=LS.get('phonevid');return o===null||o===undefined?true:!!o}
/* the deck's video across the whole screen — over focus mode too; the timer keeps running behind it */
function vidFull(on){const b=$('mVidBox');if(!b)return;if(on===undefined)on=!b.classList.contains('vfull');
  b.classList.toggle('vfull',on);document.body.classList.toggle('vfullon',on);let x=$('vfX');
  if(on){if(!x){x=document.createElement('button');x.id='vfX';x.type='button';x.className='vfx';x.textContent='✕ exit';x.onclick=e=>{e.stopPropagation();vidFull(false)};b.appendChild(x)}
    try{if(b.requestFullscreen){b._fs=true;b.requestFullscreen().catch(()=>{b._fs=false})}}catch(e){}}
  else{if(x)x.remove();try{if(document.fullscreenElement===b)document.exitFullscreen()}catch(e){}b._fs=false}}
document.addEventListener('fullscreenchange',()=>{const b=$('mVidBox');if(b&&b._fs&&b.classList.contains('vfull')&&document.fullscreenElement!==b)vidFull(false)});
addEventListener('keydown',e=>{if(e.key==='Escape'&&$('mVidBox')&&$('mVidBox').classList.contains('vfull'))vidFull(false)});
function openMode(d){return (MUSIC.open||{})[d]||(d==='scholz'?'random':'resume')}
function musicHTML(){const d=deckNow(),D=DECKS[d],src=deckSrc();
  const seg=`<div class="seg deckseg" id="deckSeg">${Object.keys(DECKS).map(k=>`<button type="button" data-deck="${k}" aria-pressed="${k===d}">${DECKS[k].label}</button>`).join('')}</div>`;
  if(!src&&d!=='mine')return seg+`<div class="dsetup"><div class="dim">Paste your ${D.label} playlist link. It has to be <b>Public</b> or <b>Unlisted</b> on YouTube — private playlists won't play outside YouTube. The link is saved to your account only, not the app's code.</div><div class="row" style="gap:6px;margin-top:8px"><input class="inp" id="dkUrl" placeholder="https://music.youtube.com/playlist?list=…" style="flex:1"><button class="btn p" type="button" id="dkSave">set</button></div></div>`;
  const mine=d==='mine'?`<div class="mlist">${MUSIC.list.map(s=>`<div class="mstn${s.id===MUSIC.cur?' on':''}"><button type="button" data-ms="${esc(s.id)}"><span class="mthumb" style="background-image:url(${s.thumb?esc(s.thumb):''})"></span><span>${esc(s.name)}</span></button><button class="iconbtn" type="button" data-mdel="${esc(s.id)}" aria-label="Remove">✕</button></div>`).join('')}</div><button class="iconbtn" type="button" id="mAdd" style="margin-top:8px">+ add playlist</button>`:'';
  if(!src)return seg+mine;
  const om=openMode(d);
  return seg+`<div class="deck ${D.audio?'aud':'vid'}"><div class="dscreen">${D.audio?`<canvas class="viz" id="vizC"></canvas><div class="dhud"><span id="dHudL">> ${esc(D.label)}.stream</span><span id="dHudR" class="num"></span></div>`:''}<div class="mvid${D.audio?' mini':''}" id="mVidBox"><div id="ytFrame"></div></div></div>
    <div class="mmeta"><b id="mTitle">loading…</b><span class="dim" id="mArtist"></span><div class="mprog seek" id="mSeek"><i id="mBar"></i><b id="mKnob"></b></div><div class="row" style="justify-content:space-between"><span class="dim num" id="mTime" style="font-size:10px"></span><span class="dim num" id="mIdx" style="font-size:10px"></span></div>
    <div class="mctl"><button type="button" data-mc="prev" aria-label="Previous">⏮</button><button type="button" data-mc="play" class="mplay" id="mPlay" aria-label="Play">▶</button><button type="button" data-mc="next" aria-label="Next">⏭</button>${d==='mine'?`<button type="button" data-mc="shuf" aria-pressed="${MUSIC.shuffle}" aria-label="Shuffle">⤮</button>`:''}<input type="range" min="0" max="100" value="${MUSIC.vol}" id="mVol" class="vol" aria-label="Volume"></div>
    <div class="mskip"><button type="button" data-sk="-10">−10s</button><button type="button" data-sk="30">+30s</button><button type="button" data-sk="120">+2m</button><button type="button" data-sk="300">+5m</button></div>
    ${d!=='mine'?`<div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap"><span class="dim" style="font-size:10px">on open:</span><div class="seg mini" id="dkOpen"><button type="button" data-om="resume" aria-pressed="${om==='resume'}">resume</button><button type="button" data-om="random" aria-pressed="${om==='random'}">random</button></div>${D.audio?`<button class="iconbtn" type="button" id="dkVid">${showVidNow()?'hide':'show'} video</button>`:''}<button class="iconbtn" type="button" id="dkFull">⛶ fullscreen</button>${d==='lofi'&&src.type!=='vids'?`<button class="iconbtn" type="button" id="dkEdit">change playlist</button>`:''}</div>`:''}</div></div>`+mine}
function addStation(){openEditor({title:'add playlist',fields:[{k:'url',label:'YouTube Music / YouTube link'},{k:'name',label:'name (optional)'}],values:{url:'',name:''},isNew:true,
  hint:'Open the playlist in YouTube Music → Share → Copy link, and paste it here.',onSave:v=>{const p=parseYT(v.url||'');if(!p){flash('not_a_youtube_link');return}
    const s={id:rid(),name:(v.name||'').trim()||(p.type==='list'?'playlist':'track'),...p,thumb:p.v||p.type==='video'?`https://i.ytimg.com/vi/${p.v||p.key}/hqdefault.jpg`:''};MUSIC.list.push(s);MUSIC.cur=s.id;MUSIC.deck='mine';save('tools/music',MUSIC);renderFocus()}})}
function musicRender(play,mode){if(!$('mBox'))return;try{YTP&&YTP.destroy()}catch(e){}YTP=null;ytReady=false;if($('deckSub'))$('deckSub').textContent=DECKS[deckNow()].sub;$('mBox').innerHTML=musicHTML();$('mBox').classList.toggle('showvid',showVidNow());vizAttach($('vizC'));ensureYT(play,mode);
  const ds=$('mBox').querySelector('.dscreen');if(ds){let lt=0;ds.ondblclick=()=>vidFull();ds.addEventListener('touchend',()=>{const n=Date.now();if(n-lt<320)vidFull();lt=n})}}
function musicClick(e){const b=e.target.closest('button');if(!b)return;
  if(b.dataset.sk&&YTP){try{const t=YTP.getCurrentTime()+(+b.dataset.sk);YTP.seekTo(Math.max(0,Math.min(t,YTP.getDuration()-1)),true)}catch(x){}return}
  if(b.dataset.deck){if(b.dataset.deck===deckNow())return;const was=ytPlaying();savePos();MUSIC.deck=b.dataset.deck;save('tools/music',MUSIC);musicRender(was,DSEEN.has(MUSIC.deck)?'resume':undefined);return}
  if(b.id==='mAdd')return addStation();
  if(b.id==='dkSave'){const p=parseYT($('dkUrl').value||'');if(!p||p.type!=='list'){flash('paste_a_playlist_link');return}MUSIC.decks={...(MUSIC.decks||{}),[deckNow()]:p.key};delete DPOS[deckNow()];LS.set('deckpos',DPOS);save('tools/music',MUSIC);musicRender(false);return}
  if(b.id==='dkEdit'){const d=deckNow();const old=(MUSIC.decks||{})[d];MUSIC.decks={...MUSIC.decks};delete MUSIC.decks[d];musicRender(false);if(old)$('dkUrl').value='https://music.youtube.com/playlist?list='+old;MUSIC.decks[d]=old;return}
  if(b.id==='dkVid'){const nv=!showVidNow();if(PHONE)LS.set('phonevid',nv);else{MUSIC.showVid=nv;save('tools/music',MUSIC)}$('mBox').classList.toggle('showvid',nv);b.textContent=(nv?'hide':'show')+' video';return}
  if(b.id==='dkFull'){vidFull(true);return}
  if(b.id==='vfX')return;
  if(b.dataset.om){MUSIC.open={...(MUSIC.open||{}),[deckNow()]:b.dataset.om};$('dkOpen').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b));save('tools/music',MUSIC);return}
  if(b.dataset.ms){MUSIC.cur=b.dataset.ms;save('tools/music',MUSIC);musicRender(true);return}
  if(b.dataset.mdel){if(!b.dataset.arm){b.dataset.arm=1;b.textContent='?';return}MUSIC.list=MUSIC.list.filter(x=>x.id!==b.dataset.mdel);if(MUSIC.cur===b.dataset.mdel)MUSIC.cur=null;save('tools/music',MUSIC);musicRender(false);return}
  const c=b.dataset.mc;if(!c||!YTP)return;
  if(c==='play')ytToggle();
  if(c==='next'){if(DECKS[deckNow()].random)ytRandom();else if(ytVids())vidStep(1);else YTP.nextVideo&&YTP.nextVideo()}
  if(c==='prev'){try{if(YTP.getCurrentTime()>8)YTP.seekTo(0,true);else if(ytVids())vidBack();else YTP.previousVideo()}catch(x){}}
  if(c==='rnd')ytRandom();
  if(c==='shuf'){MUSIC.shuffle=!MUSIC.shuffle;YTP.setShuffle&&YTP.setShuffle(MUSIC.shuffle);b.setAttribute('aria-pressed',MUSIC.shuffle);save('tools/music',MUSIC)}}
let mSeekDrag=false;
function bindSeek(){const el=$('mSeek');if(!el)return;const frac=e=>{const r=el.getBoundingClientRect();return Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))};
  const show=f=>{$('mBar').style.width=f*100+'%';$('mKnob').style.left=f*100+'%';try{if($('mTime'))$('mTime').textContent=fmtT(f*YTP.getDuration())+' / '+fmtT(YTP.getDuration())}catch(x){}};
  el.onpointerdown=e=>{if(!YTP)return;mSeekDrag=true;el.setPointerCapture(e.pointerId);show(frac(e));e.preventDefault()};
  el.onpointermove=e=>{if(mSeekDrag)show(frac(e))};
  el.onpointerup=el.onpointercancel=e=>{if(!mSeekDrag)return;mSeekDrag=false;try{YTP.seekTo(frac(e)*YTP.getDuration(),true)}catch(x){}}}
function ytToggle(){if(!YTP||!YTP.getPlayerState)return;const st=YTP.getPlayerState();if(st===1||st===3){YTP.pauseVideo();ytBtn(false);return}YTP.playVideo();ytBtn(true);ytKick()}
/* the play button follows the player itself, not just its change events — those get dropped */
function ytBtn(on){if($('mPlay')){$('mPlay').textContent=on?'⏸':'▶';$('mPlay').setAttribute('aria-label',on?'Pause':'Play')}if($('fmMus'))$('fmMus').textContent=on?'⏸ audio':'▶ audio'}
/* iOS sometimes needs one tap on the actual video before the API can start it: reveal it if play didn't take */
function ytKick(){clearTimeout(ytKick.t);ytKick.t=setTimeout(()=>{try{const st=YTP.getPlayerState();if(st!==1&&st!==3&&$('mBox')&&!$('mBox').classList.contains('showvid')){$('mBox').classList.add('showvid');flash('tap_the_video_once')}}catch(e){}},2500)}
function ensureYT(play,mode){const s=deckSrc();if(!s||!$('ytFrame'))return;
  if(window.YT&&window.YT.Player){ytLoad(s,play,mode);return}ytQ=[play,mode];if(ytLoading)return;ytLoading=true;window.onYouTubeIframeAPIReady=()=>{ytLoading=false;const s2=deckSrc();if(s2&&$('ytFrame'))ytLoad(s2,ytQ[0],ytQ[1])};const sc=document.createElement('script');sc.src='https://www.youtube.com/iframe_api';document.head.appendChild(sc)}
function ytLoad(s,play,mode){if(!window.YT||!window.YT.Player||!$('ytFrame'))return ensureYT(play,mode);
  DSEEN.add(s.deck);const pos=DPOS[s.deck];mode=mode||(s.type==='list'&&s.deck!=='mine'?openMode(s.deck):null);if(mode==='resume'&&!(pos&&pos.key===s.key))mode=DECKS[s.deck].random?'random':null;
  const pv={controls:0,playsinline:1,rel:0,modestbranding:1,iv_load_policy:3,disablekb:1};if(s.type==='list'){pv.listType='playlist';pv.list=s.key}
  let vStart=0;if(s.type==='vids'){let v=mode==='resume'&&pos&&s.ids.includes(pos.v)?pos.v:null;if(v)vStart=Math.max(0,(pos.t||0)-3);else v=s.ids[Math.floor(Math.random()*s.ids.length)];s={...s,type:'video',key:v,vids:true};VHIST=[v];pv.start=Math.floor(vStart)}
  ytTries=0;const opts={width:'100%',height:'100%',playerVars:pv};if(s.type==='video')opts.videoId=s.key;YTP=new YT.Player('ytFrame',{...opts,events:{
    onReady:async()=>{ytReady=true;if(s.type==='list')setTimeout(async()=>{const pl=await ytPlaylist();if(!pl.length&&$('mTitle'))$('mTitle').textContent='can\u2019t load this playlist \u2014 set it to Unlisted (not Private) on YouTube'},4000);try{YTP.setVolume(MUSIC.vol);if(s.deck==='mine'&&MUSIC.shuffle&&YTP.setShuffle)YTP.setShuffle(true)}catch(e){}
      if(s.type==='list'&&mode){const pl=await ytPlaylist();let i=-1,t=0;if(mode==='resume'){i=pl.indexOf(pos.v);t=Math.max(0,(pos.t||0)-3)}if(i<0&&(mode==='random'||DECKS[s.deck].random))i=Math.floor(Math.random()*pl.length);
        if(i>=0){YTP[play?'loadPlaylist':'cuePlaylist']({list:s.key,listType:'playlist',index:i,startSeconds:t});ytNow();return}}
      if(play)YTP.playVideo();ytNow()},
    onStateChange:e=>{if(e&&e.data===1)ytTries=0;if(e&&e.data===0&&ytVids())vidStep(0);ytNow()},
    onError:()=>{if(++ytTries>6)return;setTimeout(()=>{if(ytVids())vidStep(DECKS[deckNow()].random?2:1);else try{YTP.nextVideo()}catch(e){}},400)}}});
  bindSeek();$('mBox').oninput=e=>{if(e.target.id==='mVol'){MUSIC.vol=+e.target.value;try{YTP.setVolume(MUSIC.vol)}catch(x){}clearTimeout(ytLoad.t);ytLoad.t=setTimeout(()=>save('tools/music',MUSIC),800)}}}
async function ytPlaylist(){for(let i=0;i<24;i++){let pl=null;try{pl=YTP.getPlaylist()}catch(e){}if(pl&&pl.length)return pl;await new Promise(r=>setTimeout(r,250))}return []}
const ytVids=()=>{const s=deckSrc();return s&&s.type==='vids'?s.ids:null};
/* id-list decks: next = random unheard, back = history */
function vidStep(dir){const ids=ytVids();if(!ids||!YTP)return;if(dir===1||(dir===0&&!DECKS[deckNow()].random)){let cur='';try{cur=YTP.getVideoData().video_id}catch(e){}const i=(ids.indexOf(cur)+1)%ids.length;VHIST.push(ids[i]);try{YTP.loadVideoById(ids[i])}catch(e){}return}const recent=new Set(VHIST.slice(-40));const pool=ids.filter(v=>!recent.has(v));const pick=(pool.length?pool:ids)[Math.floor(Math.random()*(pool.length||ids.length))];VHIST.push(pick);try{YTP.loadVideoById(pick)}catch(e){}}
function vidBack(){if(VHIST.length<2||!YTP)return;VHIST.pop();try{YTP.loadVideoById(VHIST[VHIST.length-1])}catch(e){}}
async function ytRandom(){if(!YTP)return;if(ytVids())return vidStep(2);const pl=await ytPlaylist();if(!pl.length){try{YTP.nextVideo()}catch(e){}return}let cur=-1;try{cur=YTP.getPlaylistIndex()}catch(e){}let i=Math.floor(Math.random()*pl.length);if(i===cur&&pl.length>1)i=(i+1)%pl.length;try{YTP.playVideoAt(i)}catch(e){}}
function fmtT(x){x=Math.floor(x||0);const h=Math.floor(x/3600),m=Math.floor(x%3600/60),s=x%60;return (h?h+':'+pad(m):m)+':'+pad(s)}
function ytNow(){if(!YTP||!YTP.getVideoData)return;let d={};try{d=YTP.getVideoData()||{}}catch(e){}const st=YTP.getPlayerState?YTP.getPlayerState():-1;VIZ.on=st===1;
  if($('mTitle'))$('mTitle').textContent=d.title||(st===-1||st===5?'ready':'loading…');if($('mArtist'))$('mArtist').textContent=d.author||'';ytBtn(st===1||st===3);
  try{const ids=ytVids();if(ids&&$('mIdx')){const i=ids.indexOf(d.video_id);$('mIdx').textContent=(i>=0?'#'+(i+1)+' / ':'')+ids.length}const pl=YTP.getPlaylist&&YTP.getPlaylist();if(pl&&pl.length&&$('mIdx'))$('mIdx').textContent='#'+(YTP.getPlaylistIndex()+1)+' / '+pl.length}catch(e){}
  if($('fmNow'))$('fmNow').textContent=d.title?'♪ '+d.title+(d.author?' — '+d.author:''):'';
  const s=deckSrc();if(s&&s.deck==='mine'&&d.video_id){const m=MUSIC.list.find(x=>x.id===s.id);if(m&&!m.thumb){m.thumb=`https://i.ytimg.com/vi/${d.video_id}/hqdefault.jpg`;save('tools/music',MUSIC)}}}
setInterval(()=>{if(!YTP||!YTP.getCurrentTime||!ytReady)return;try{const t=YTP.getCurrentTime(),du=YTP.getDuration();if($('mBar')&&!mSeekDrag){$('mBar').style.width=(du?t/du*100:0)+'%';$('mKnob').style.left=(du?t/du*100:0)+'%'}if($('mTime'))$('mTime').textContent=fmtT(t)+' / '+fmtT(du);const ps=YTP.getPlayerState();ytBtn(ps===1||ps===3);VIZ.on=ps===1;if($('dHudR'))$('dHudR').textContent=(ps===1?'▶ ':'❚❚ ')+fmtT(t);
  const s=deckSrc();if(s&&s.deck!=='mine'&&YTP.getPlayerState()===1&&t>5&&!mSeekDrag){const v=(YTP.getVideoData()||{}).video_id;if(v){DPOS[s.deck]={key:s.key,v,t};DPOS.n=(DPOS.n||0)+1;if(DPOS.n%5===0)LS.set('deckpos',DPOS)}}}catch(e){}},1000);

/* PSP-style wave visualiser. It can't read YouTube's audio (cross-origin), so it follows play/pause and drifts organically. 30fps, stops when not visible. */
const VIZ={cv:new Set(),run:false,e:0,on:false,t:0,last:0,col:null};
function vizAttach(c){if(!c)return;VIZ.cv.add(c);if(!VIZ.run){VIZ.run=true;VIZ.last=performance.now();requestAnimationFrame(vizTick)}}
function vizTick(ts){VIZ.cv.forEach(c=>{if(!c.isConnected)VIZ.cv.delete(c)});if(!VIZ.cv.size){VIZ.run=false;return}
  const live=[...VIZ.cv].filter(c=>c.offsetWidth>0);if(!live.length||document.hidden){VIZ.last=ts;setTimeout(()=>requestAnimationFrame(vizTick),400);return}
  if(ts-VIZ.last<32){requestAnimationFrame(vizTick);return}const dt=Math.min(.1,(ts-VIZ.last)/1000);VIZ.last=ts;
  VIZ.e+=((VIZ.on?1:.08)-VIZ.e)*Math.min(1,dt*2);VIZ.t+=dt*(.25+VIZ.e*.9);live.forEach(drawViz);requestAnimationFrame(vizTick)}
function drawViz(c){const dpr=Math.min(2,devicePixelRatio||1),W=c.offsetWidth,H=c.offsetHeight;if(c.width!==Math.round(W*dpr)){c.width=Math.round(W*dpr);c.height=Math.round(H*dpr)}
  const g=c.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);const t=VIZ.t,e=VIZ.e;
  if(!VIZ.col){const cs=getComputedStyle(document.documentElement);VIZ.col=[cs.getPropertyValue('--pink').trim()||'#ff2a6d',cs.getPropertyValue('--cyan').trim()||'#05d9e8',cs.getPropertyValue('--ok').trim()||'#57f5a8']}
  g.globalCompositeOperation='source-over';g.fillStyle='rgba(2,2,4,.28)';g.fillRect(0,0,W,H);
  g.strokeStyle='rgba(255,255,255,.035)';g.lineWidth=1;g.beginPath();for(let x=0;x<W;x+=24){g.moveTo(x+.5,0);g.lineTo(x+.5,H)}for(let y=0;y<H;y+=24){g.moveTo(0,y+.5);g.lineTo(W,y+.5)}g.stroke();
  g.globalCompositeOperation='lighter';const mid=H*.52,amp=H*.32;
  for(let k=0;k<5;k++){const col=VIZ.col[k%3],ph=k*1.7,sp=.6+k*.17,thick=(6+k*5)*(.35+e*.65);
    const y=x=>{const u=x/W;return mid+Math.sin(u*(2.2+k*.35)*Math.PI+t*sp+ph)*amp*(.25+.75*e)*(.55+.45*Math.sin(t*.5+k))+Math.sin(u*9+t*1.9+k)*amp*.12*e+Math.sin(u*3.1-t*.7+ph)*amp*.18};
    g.beginPath();for(let x=0;x<=W;x+=6)g.lineTo(x,y(x)-thick);for(let x=W;x>=0;x-=6)g.lineTo(x,y(x)+thick);g.closePath();g.fillStyle=col;g.globalAlpha=.07+.05*e;g.fill();
    g.beginPath();for(let x=0;x<=W;x+=4)g.lineTo(x,y(x));g.strokeStyle=col;g.globalAlpha=.35+.45*e;g.lineWidth=1.2;g.stroke()}
  g.globalAlpha=1;g.globalCompositeOperation='source-over';
  const n=Math.max(16,Math.floor(W/14)),bw=W/n;for(let i=0;i<n;i++){const v=Math.abs(Math.sin(i*.9+t*3.1)*Math.sin(i*.37-t*1.7)+Math.sin(t*5+i*2.3)*.25)*e;const h=Math.max(1.5,v*H*.22);g.fillStyle=i%2?VIZ.col[1]:VIZ.col[0];g.globalAlpha=.25+.5*v;g.fillRect(i*bw+1,H-h,bw-2,h)}g.globalAlpha=1}

/* ambient sound, synthesised (no downloads) */
const AMB={kind:null,vol:(LS.get('amb')||{}).vol??40,ctx:null,src:null,g:null};
function ambient(kind){try{if(AMB.src){AMB.src.forEach(n=>{try{n.stop()}catch(e){}});AMB.src=null}AMB.kind=kind;if(!kind)return;
  const A=window.AudioContext||window.webkitAudioContext;AMB.ctx=AMB.ctx||new A();const a=AMB.ctx;a.resume&&a.resume();
  const len=a.sampleRate*4,buf=a.createBuffer(2,len,a.sampleRate);for(let ch=0;ch<2;ch++){const d=buf.getChannelData(ch);let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0,last=0;
    for(let i=0;i<len;i++){const w=Math.random()*2-1;
      if(kind==='white')d[i]=w*.25;
      else if(kind==='brown'||kind==='rain'){last=(last+.02*w)/1.02;d[i]=last*3.2}
      else{b0=.99886*b0+w*.0555179;b1=.99332*b1+w*.0750759;b2=.969*b2+w*.153852;b3=.8665*b3+w*.3104856;b4=.55*b4+w*.5329522;b5=-.7616*b5-w*.016898;d[i]=(b0+b1+b2+b3+b4+b5+b6+w*.5362)*.09;b6=w*.115926}
      if(kind==='rain'&&Math.random()<.0009)d[i]+=(Math.random()-.5)*.9;if(kind==='cafe'&&Math.random()<.00006)for(let k=0;k<400&&i+k<len;k++)d[i+k]+=Math.sin(k*(.05+Math.random()*.02))*.05*Math.exp(-k/150)}}
  const s=a.createBufferSource();s.buffer=buf;s.loop=true;let node=s;
  if(kind==='rain'){const f=a.createBiquadFilter();f.type='highpass';f.frequency.value=400;s.connect(f);node=f}
  if(kind==='cafe'){const f=a.createBiquadFilter();f.type='lowpass';f.frequency.value=1800;s.connect(f);node=f}
  AMB.g=a.createGain();AMB.g.gain.value=AMB.vol/100*.6;node.connect(AMB.g);AMB.g.connect(a.destination);s.start();AMB.src=[s]}catch(e){}}

/* ---------------- loading ---------------- */
async function loadTools(){const [f,m,a]=await Promise.all([load('tools/focus'),load('tools/music'),load('tools/decks')]);VLIST=a||{};FOCUS={sessions:[],pomo:false,brk:10,task:'',...(f||{})};MUSIC={list:[],cur:null,vol:60,shuffle:false,deck:'lofi',decks:{},open:{},showVid:false,...(m||{})};
  WEEK=await load('weeks/w-'+WK)||{};if(typeof loadProto==='function')await loadProto();if(typeof loadLeet==='function')await loadLeet();renderTools()}
watch('tools/music',d=>{if(!d)return;const keep={cur:MUSIC.cur,deck:MUSIC.deck};MUSIC={list:[],decks:{},open:{},...d,...keep};if(cur==='tools'&&TOOLV==='focus'&&$('mBox')&&!YTP)musicRender(false)});
