/* ================= ALTER EGOS =================
   A list of selves. Each one opens into its own themed page: a written manifesto plus a
   masonry board of images and looping clips (muted on the board, sound in the viewer).
   Media lives in the private `vault` bucket (UID/alter/<ego>/…), never in the public repo. */
const ATHEME={
  operator:{n:'operator',ac:'#39ff9a',bg:'#04120b',fg:'#dcffe9',f:'var(--mono)',fx:'scan'},
  predator:{n:'predator',ac:'#ff2a3d',bg:'#140305',fg:'#ffe3e6',f:'var(--mono)',fx:'grain'},
  monk:{n:'monk',ac:'#d8c9a8',bg:'#100f0c',fg:'#efe9dc',f:'Georgia,"Times New Roman",serif',fx:'paper'},
  sovereign:{n:'sovereign',ac:'#ffc83d',bg:'#120d02',fg:'#fff3d6',f:'Georgia,"Times New Roman",serif',fx:'glow'},
  machine:{n:'machine',ac:'#9fb4c7',bg:'#0a0d10',fg:'#e6edf3',f:'var(--mono)',fx:'steel'},
  ghost:{n:'ghost',ac:'#eaeaea',bg:'#070707',fg:'#f4f4f4',f:'system-ui,"Segoe UI",sans-serif',fx:'none'},
  oracle:{n:'oracle',ac:'#a46bff',bg:'#0c0616',fg:'#ece0ff',f:'Georgia,"Times New Roman",serif',fx:'glow'},
  athlete:{n:'athlete',ac:'#2fa8ff',bg:'#030c16',fg:'#dcefff',f:'system-ui,"Segoe UI",sans-serif',fx:'grain'},
};
let ALTER={egos:[]},alterLoaded=false,AEGO=null,AE=null,aIO=null,aLO=null,aBusy=0;
/* the section keeps its router classes — wiping className used to unhide alter over every other view */
const aBase=el=>'view'+(el.classList.contains('on')?' on':'');
/* inside an ego the app's chrome gets out of the way: no tabs, no bottom nav */
function aLeave(){document.body.classList.remove('asolo')}
const aPath=(e,f)=>`${UID}/alter/${e}/${f}`;
async function loadAlter(){if(alterLoaded){renderAlter();return}
  try{const d=await load('alter/list');if(d&&Array.isArray(d.egos))ALTER=d}catch(e){}
  alterLoaded=true;renderAlter()}
const aSave=()=>save('alter/list',ALTER,true);
const aSaveEgo=()=>AE&&save('alter/e-'+AE.id,{notes:AE.notes||'',items:AE.items||[]},true);
/* signed urls for the private bucket, cached until they expire */
const AURL=new Map(Object.entries(LS.get('aurl')||{}).filter(([k,v])=>v&&v.exp>Date.now()+864e5));
/* reusing the same URL across launches lets the browser and the service worker serve the file
   from this device instead of downloading it again */
let aurlT=null;const aurlSave=()=>{clearTimeout(aurlT);aurlT=setTimeout(()=>LS.set('aurl',Object.fromEntries(AURL)),400)};
/* drop a file's on-device copy (after it was replaced or deleted) */
async function mediaForget(paths){paths=[].concat(paths).filter(Boolean);paths.forEach(p=>AURL.delete(p));aurlSave();
  try{if(!window.caches)return;const c=await caches.open('ds-media');for(const r of await c.keys()){const pn=decodeURIComponent(new URL(r.url).pathname);
    if(paths.some(p=>pn.endsWith('/vault/'+p)))await c.delete(r)}}catch(e){}}
async function aSign(paths){const need=paths.filter(p=>{const c=AURL.get(p);return !c||c.exp<Date.now()+6e4});
  for(let i=0;i<need.length;i+=80){const batch=need.slice(i,i+80);
    try{const {data}=await SB.storage.from('vault').createSignedUrls(batch,604800);
      (data||[]).forEach(r=>{if(r&&r.signedUrl&&!r.error)AURL.set(r.path,{u:r.signedUrl,exp:Date.now()+6048e5})});aurlSave()}catch(e){}}
  return paths.map(p=>(AURL.get(p)||{}).u||'')}
/* ---------- main list ---------- */
let CSI=0;
function renderAlter(){const el=$('v-alter');if(!el)return;if(!alterLoaded){loadAlter();return}
  if(AEGO){aRenderEgo();return}
  aLeave();el.className=aBase(el);el.removeAttribute('style');
  const seen=el.dataset.intro==='1';el.dataset.intro='1';
  el.innerHTML=`${FX?'<div class="csintro" id="csIntro"><span>Select<br>Your alter ego</span></div>':''}<div class="csel">
    <div class="cstop"><span class="csn" id="csN"></span></div>
    <div class="csstage">
      <button type="button" class="csarr" id="csL" aria-label="previous">◀</button>
      <div class="cswin" id="csWin"></div>
      <button type="button" class="csarr" id="csR" aria-label="next">▶</button>
    </div>
    <div class="csname" id="csName"></div>
    <button type="button" class="csgo" id="csGo">Select</button>
    <div class="csdots" id="csDots"></div>
  </div>`;
  CSI=0;csDraw(0);
  const intro=$('csIntro');if(intro)setTimeout(()=>{intro.classList.add('out');setTimeout(()=>intro.remove(),620)},1250);
  $('csL').onclick=()=>csStep(-1);$('csR').onclick=()=>csStep(1);
  $('csGo').onclick=csPick;
  /* tapping the portrait toggles its sound; only the button enters the page */
  $('csWin').onclick=()=>{CSND=!CSND;csSnd()};
  let x0=null;
  $('csWin').addEventListener('pointerdown',e=>{x0=e.clientX});
  $('csWin').addEventListener('pointerup',e=>{if(x0==null)return;const d=e.clientX-x0;x0=null;if(Math.abs(d)>40){csStep(d<0?1:-1);e.stopPropagation()}});
  el.onkeydown=null;
  document.onkeydown=e=>{if(AEGO||$('v-alter').hidden||!$('csWin'))return;
    if(e.key==='ArrowLeft')csStep(-1);else if(e.key==='ArrowRight')csStep(1);else if(e.key==='Enter')csPick()}}
let CSND=false;
function csSnd(){const w=$('csWin');if(!w)return;w.classList.toggle('snd',CSND);const v=w.querySelector('video');if(!v)return;
  v.muted=!CSND;v.volume=1;if(CSND){const p=v.play();if(p&&p.catch)p.catch(()=>{v.muted=true})}}
/* leaving the section: nothing of it keeps sounding */
function aQuiet(){document.querySelectorAll('#v-alter video,#g-motivation video').forEach(v=>{try{v.muted=true;if(v.classList.contains('csvid'))v.pause()}catch(e){}});
  document.querySelectorAll('.apin.snd').forEach(f=>f.classList.remove('snd'));if(typeof aPeekClose==='function'&&APK)aPeekClose()}
const csList=()=>ALTER.egos.concat([{id:'__new',name:'new alter ego',tag:'name it, theme it, build the board',theme:'ghost'}]);
function csStep(d){const L=csList();CSI=((CSI+d)%L.length+L.length)%L.length;csDraw(d)}
async function csDraw(d){const win=$('csWin');if(!win)return;const L=csList();const e=L[CSI];
  const t=ATHEME[e.theme]||ATHEME.ghost;const isNew=e.id==='__new';
  win.style.setProperty('--ac',t.ac);win.style.setProperty('--abg',t.bg);
  win.innerHTML=`<div class="csfig${isNew?' isnew':''}">${isNew?'<span class="csplus">＋</span>'
    :`${e.cover?`<img alt="" class="cspic">`:''}${e.v?'<video class="csvid" muted loop playsinline preload="none"></video>':''}`}
    <i class="cscrn tl"></i><i class="cscrn tr"></i><i class="cscrn bl"></i><i class="cscrn br"></i></div>`;
  win.classList.remove('inL','inR');void win.offsetWidth;win.classList.add(d<0?'inL':'inR');
  $('csName').innerHTML=`<b>${esc(e.name||'untitled')}</b><i>${esc(e.tag||t.n)}</i>`;
  $('csName').style.setProperty('--ac',t.ac);
  $('csN').textContent=String(CSI+1).padStart(2,'0')+' / '+String(L.length).padStart(2,'0');
  $('csDots').innerHTML=L.map((_,i)=>`<span class="${i===CSI?'on':''}"></span>`).join('');
  $('csGo').textContent=isNew?'create':'select';$('csGo').style.setProperty('--ac',t.ac);
  if(isNew)return;
  const want=CSI;
  if(e.cover){const [u]=await aSign([e.cover]);const p=win.querySelector('.cspic');if(p&&u&&CSI===want)p.src=u}
  if(e.v){const [u]=await aSign([e.v]);const v=win.querySelector('.csvid');
    if(v&&u&&CSI===want){v.src=u;v.muted=!CSND;win.classList.toggle('snd',CSND);const pr=v.play();if(pr&&pr.catch)pr.catch(()=>{v.muted=true;v.play().catch(()=>{})})}}}
function csPick(){const L=csList();const e=L[CSI];if(!e)return;
  if(e.id==='__new')return aEdit(null);
  const win=$('csWin');win.classList.add('picking');
  const t=ATHEME[e.theme]||ATHEME.ghost;
  const fl=document.createElement('div');fl.className='chflash';fl.style.setProperty('--ac',t.ac);
  if(FX)document.body.appendChild(fl);
  setTimeout(()=>{fl.remove();document.onkeydown=null;aOpen(e.id)},FX?560:0)}
/* the motivation board is not a self — it lives in the gym */
let MOTIV=null;
async function renderMotivation(){const el=$('g-motivation');if(!el)return;
  if(!MOTIV){el.innerHTML='<div class="aempty">loading…</div>';
    try{MOTIV=await load('alter/e-'+LX('gb','m'))||{items:[]}}catch(e){MOTIV={items:[]}}}
  const items=MOTIV.items||[];
  /* dealt fresh every visit — the wall never reads the same way twice */
  const shown=items.slice();
  for(let i=shown.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[shown[i],shown[j]]=[shown[j],shown[i]]}
  el.innerHTML='<div class="mtop"><button type="button" class="aadd" id="mAdd" aria-label="add pics or videos">+</button></div>'+(shown.length
    ? `<div class="mwall aemason">${shown.map((it,i)=>aTile(it,i,LX('gb','m'))).join('')}</div>`
    : '<div class="aempty">Nothing here yet.</div>');
  $('mAdd').onclick=e=>{e.stopPropagation();aAddMedia(LX('gb','m'),$('mAdd'),its=>{MOTIV.items=(MOTIV.items||[]).concat(its);save('alter/e-'+LX('gb','m'),MOTIV,true);renderMotivation()})};
  aMason(el);requestAnimationFrame(()=>aMason(el));aHydrate(el);
  let lt=0,lp=null;
  el.onclick=e=>{const p=e.target.closest('.apin');if(!p)return;const n=Date.now();
    if(lp===p&&n-lt<340){lt=0;lp=null;aPeekOpen(p,true);return}
    lt=n;lp=p;const v=p.querySelector('video');if(v)aSound(v)}}
function aEdit(ego){const e=ego||{id:rid(),name:'',tag:'',theme:'ghost',notes:''};
  openSheet(ego?'edit alter ego':'new alter ego',`<div class="gc-form">
    <input id="aeN" class="gc-in big" placeholder="Name" value="${esc(e.name)}" autocomplete="off">
    <input id="aeT" class="gc-in" placeholder="One line — who is he?" value="${esc(e.tag)}" autocomplete="off">
    <div class="athemes" id="aeTh">${Object.entries(ATHEME).map(([k,t])=>`<button type="button" data-th="${k}" class="${k===e.theme?'on':''}" style="--ac:${t.ac};--abg:${t.bg}"><i></i>${t.n}</button>`).join('')}</div>
    <div class="bigbtns"><button class="btn p" type="button" id="aeOk">${ego?'Save':'Create'}</button>${ego?'<button class="btn" type="button" id="aeDel">Delete</button>':''}</div></div>`);
  let th=e.theme;
  $('sheetBody').onclick=ev=>{const t=ev.target.closest('[data-th]');
    if(t){th=t.dataset.th;$('aeTh').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===t));return}
    if(ev.target.id==='aeOk'){e.name=$('aeN').value.trim()||'untitled';e.tag=$('aeT').value.trim();e.theme=th;
      if(!ego)ALTER.egos.push(e);aSave();closeSheet();if(AEGO)aRenderEgo();else renderAlter()}
    if(ev.target.id==='aeDel')aDeleteEgo(e)};
  setTimeout(()=>$('aeN')&&$('aeN').focus(),60)}
function aDeleteEgo(e){openSheet('delete '+e.name+'?',`<div class="gc-det"><p>This removes the alter ego, its writing and every pinned image and clip. It can't be undone.</p>
  <div class="bigbtns"><button class="btn" type="button" id="adY">Delete everything</button><button class="btn p" type="button" id="adN">Keep it</button></div></div>`);
  $('sheetBody').onclick=async ev=>{if(ev.target.id==='adN')return closeSheet();if(ev.target.id!=='adY')return;
    closeSheet();try{const d=await load('alter/e-'+e.id);const paths=[];(d&&d.items||[]).forEach(it=>{paths.push(aPath(e.id,it.f));if(it.p)paths.push(aPath(e.id,it.p))});
      if(paths.length){await SB.storage.from('vault').remove(paths);mediaForget(paths)}await KV.del('alter/e-'+e.id)}catch(x){}
    ALTER.egos=ALTER.egos.filter(x=>x.id!==e.id);aSave();AEGO=null;AE=null;renderAlter()}}
/* ---------- one alter ego ---------- */
async function aOpen(id){const meta=ALTER.egos.find(e=>e.id===id);if(!meta)return;AEGO=id;AE={...meta,notes:'',items:[]};
  aRenderEgo();try{const d=await load('alter/e-'+id);if(d){AE.notes=d.notes||'';AE.items=d.items||[]}}catch(e){}
  aRenderEgo();scrollTo(0,0)}
function aBack(){aLeave();AEGO=null;AE=null;if(aIO){aIO.disconnect();aIO=null}renderAlter();scrollTo(0,0)}
const APH={predator:"Rules, standards, the version of you that doesn't negotiate. Write it like orders.",
  oracle:'What is already written. Who you become, and what it costs. Write it as prophecy.',
  operator:'Protocols. What gets switched off, what gets done, in what order. Write it like a spec.',
  sovereign:'The standard you hold. Presence, grooming, carriage, the details nobody else bothers with.',
  ghost:'Who is he? How does he move, speak, train, decide? Write it as if it is already true.',
  monk:'The discipline. What you give up, and what that buys you.',
  machine:'Inputs, outputs, tolerances. No feelings in this one.',
  athlete:'The work, the numbers, the standard on the worst day.'};
/* one media element, with its own aspect in --asp so each skin can honour or override it */
function aMedia(it,cls,ego){const p=esc(aPath(ego||AE.id,it.f));
  return it.k==='v'
    ? `<video class="${cls||''}" muted loop playsinline preload="none" data-src="${p}" ${it.p?`data-poster="${esc(aPath(ego||AE.id,it.p))}"`:''}></video>`
    : `<img class="${cls||''}" alt="" loading="lazy" data-src="${p}">`}
function aTile(it,i,ego){const w=it.w||3,h=it.h||4;
  return `<figure class="apin${it.k==='v'?' isv':''}" data-i="${i}" data-aid="${esc(it.id||it.f||i)}" data-aw="${w}" data-ah="${h}" style="--asp:${w}/${h}">`
  +`<span class="apix">${String(i+1).padStart(2,'0')}</span>${aMedia(it,'',ego)}</figure>`}
/* real masonry: every tile keeps its own shape, and some are given extra width
   so the board has a rhythm instead of one uniform column width throughout */
const AU=2;
/* a stable 0..1 drawn from the tile's own id — the layout stays put between renders */
function aRnd(s){let h=2166136261;for(let i=0;i<String(s).length;i++){h^=String(s).charCodeAt(i);h=Math.imul(h,16777619)}return ((h>>>0)%10000)/10000}
/* how many columns a tile earns: wide pictures take the extra width, tall ones
   rarely need it since their height already gives them the room */
function aWide(f,cols){
  if(cols<3)return 1;
  const r=(+f.dataset.aw||3)/(+f.dataset.ah||4), n=aRnd(f.dataset.aid||f.dataset.i||'');
  const p=(r>1.25?.62:r>.85?.4:.17)*(cols>3?1:.7);
  let w=n<p?2:1;
  if(w===2&&cols>=5&&r>1.5&&n<p*.3)w=3;
  return Math.min(w,cols)}
function aMason(root){const el=root||$('v-alter');if(!el)return;
  el.querySelectorAll('.aemason').forEach(b=>{
    const cs=getComputedStyle(b);const gap=parseFloat(cs.rowGap)||0;
    const cols=(cs.gridTemplateColumns||'').split(' ').filter(x=>x&&x!=='none').length||1;
    const tiles=[...b.querySelectorAll('.apin')];if(!tiles.length)return;
    const cw=(b.getBoundingClientRect().width-gap*(cols-1))/cols;if(cw<=0)return;
    const U=AU+gap;
    const h=new Array(cols).fill(0);
    /* where a run of n columns sits lowest, and how much dead space that leaves */
    const fit=n=>{let c=0,top=Infinity,low=0;
      for(let k=0;k+n<=cols;k++){let m=0;for(let j=k;j<k+n;j++)if(h[j]>m)m=h[j];
        if(m<top-0.5){top=m;c=k}}
      if(!isFinite(top))top=0;
      low=h[c];for(let j=c;j<c+n;j++)if(h[j]<low)low=h[j];
      return {c,top,waste:top-low}};
    const last=new Array(cols).fill(null),place=new Map();
    tiles.forEach(f=>{
      let cspan=aWide(f,cols),a=fit(cspan);
      /* a wide tile hanging off a taller neighbour would leave a hole under it: narrow it
         until it sits flush, so every tile butts straight onto the ones above it */
      while(cspan>1&&a.waste>gap+1){cspan--;a=fit(cspan)}
      const px=cw*cspan+gap*(cspan-1);
      const rspan=Math.max(1,Math.round((px*(+f.dataset.ah||4)/(+f.dataset.aw||3)+gap)/U));
      place.set(f,{c:a.c,span:cspan,row:Math.round(a.top/U)+1,rspan});
      for(let j=a.c;j<a.c+cspan;j++){h[j]=a.top+rspan*U;last[j]=f}});
    /* columns finish at different depths, which reads as black gaps along the bottom —
       stretch whichever tile ends each short column down to meet the deepest one */
    let deep=0;for(let j=0;j<cols;j++)if(h[j]>deep)deep=h[j];
    new Set(last.filter(Boolean)).forEach(f=>{
      const p=place.get(f);let bottom=0;
      for(let j=p.c;j<p.c+p.span;j++)if(h[j]>bottom)bottom=h[j];
      const grow=Math.round((deep-bottom)/U);
      if(grow>0&&grow<p.rspan*1.5)p.rspan+=grow});
    tiles.forEach(f=>{const p=place.get(f);
      f.style.gridColumn=(cols>1?(p.c+1):1)+' / span '+p.span;
      f.style.gridRowStart=p.row;
      f.style.gridRowEnd='span '+p.rspan});
  })}
let aMT=null;
addEventListener('resize',()=>{clearTimeout(aMT);aMT=setTimeout(()=>aMason(),120)});
/* each skin lays its media out differently — collage, scroll, index, spread, wall */
function aBoardHTML(sk,items){
  if(!items.length)return '<div class="aempty">Nothing pinned here yet.</div>';
  if(sk==='operator')return `<div class="aegrid aemason">${items.map((it,i)=>aTile(it,i)).join('')}</div>`;
  if(sk==='oracle')return `<div class="aescroll">${items.map((it,i)=>
      `<section class="aeverse">${aTile(it,i)}<i class="aenum">${aRom(i+1)}</i></section>`).join('')}</div>`;
  if(sk==='sovereign')return `<div class="aespread aemason">${items.map((it,i)=>aTile(it,i)).join('')}</div>`;
  if(sk==='predator')return `<div class="aecollage aemason">${items.map((it,i)=>aTile(it,i)).join('')}</div>`;
  if(sk==='ghost')return `<div class="aewall aemason">${items.map((it,i)=>aTile(it,i)).join('')}</div>`;
  return `<div class="aboard aemason">${items.map((it,i)=>aTile(it,i)).join('')}</div>`}
const aRom=n=>['','I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][n]||String(n);
function aRenderEgo(){const el=$('v-alter');if(!el||!AE)return;const t=ATHEME[AE.theme]||ATHEME.ghost;const sk=AE.theme||'ghost';
  if(typeof cur==='undefined'||cur==='alter')document.body.classList.add('asolo');else aLeave();
  el.className=aBase(el)+' aego fx-'+t.fx+' sk-'+sk;el.setAttribute('style',`--ac:${t.ac};--abg:${t.bg};--afg:${t.fg};--af:${t.f}`);
  const items=AE.items||[];const nm=esc(AE.name||'');
  const mini=`<span class="aemini"><b>${nm}</b><i>${esc(AE.tag||t.n)}</i></span>`;
  const head=`<div class="aehead"><div class="aenav"><button type="button" class="aeback" id="aeBack">‹</button>${mini}<span class="aeacts"><button type="button" class="aeback" id="aeAdd" aria-label="add pics or videos">+</button><button type="button" class="aeback" id="aeEdit">Edit</button></span></div></div>`;
  el.classList.add('aenter');setTimeout(()=>el.classList.remove('aenter'),620);el.innerHTML=head+
    `<div class="aenotes"><i class="aenb"></i><textarea id="aeNotes" placeholder="${esc(APH[sk]||APH.ghost)}">${esc(AE.notes||'')}</textarea><span class="aesave" id="aeSaved"></span></div>
     <div class="aboardwrap" id="aBoard">${aBoardHTML(sk,items)}</div>`;
  aMason();requestAnimationFrame(()=>aMason());aHydrate();aBindEgo()}
async function aHydrate(root){const el=root||$('v-alter');if(!el)return;
  const nodes=[...el.querySelectorAll('[data-src]')];if(!nodes.length)return;
  const urls=await aSign(nodes.map(n=>n.dataset.src));
  nodes.forEach((n,i)=>{if(!urls[i])return;
    if(n.tagName==='VIDEO'){n.dataset.url=urls[i];if(n.dataset.poster)aSign([n.dataset.poster]).then(([p])=>{if(p)n.poster=p})}
    else n.src=urls[i]});
  if(aIO)aIO.disconnect();if(aLO)aLO.disconnect();
  /* load well before a clip is needed, so nothing is still buffering when it scrolls in */
  aLO=new IntersectionObserver(es=>es.forEach(e=>{const v=e.target;
    if(e.isIntersecting&&!v.src&&v.dataset.url)v.src=v.dataset.url}),{rootMargin:'600px 0px'});
  /* then play on any sliver of visibility — a tall last tile never reached a .35 threshold */
  aIO=new IntersectionObserver(es=>es.forEach(e=>{const v=e.target;
    if(e.isIntersecting){if(!v.src&&v.dataset.url)v.src=v.dataset.url;aPlay(v)}
    else{v.pause();if(!v.muted)aMute(v)}}),{threshold:.01,rootMargin:'0px'});
  el.querySelectorAll('video').forEach(v=>{aLO.observe(v);aIO.observe(v);
    v.addEventListener('loadeddata',()=>{if(v.dataset.want==='1')aPlay(v)},{once:true})});
}
function aPlay(v){v.dataset.want='1';const p=v.play();if(p&&p.catch)p.catch(()=>{})}
/* one clip at a time has sound; tapping a clip toggles its own audio */
function aMute(v){v.muted=true;const f=v.closest('.apin');if(f)f.classList.remove('snd')}
function aSound(v){document.querySelectorAll('video').forEach(o=>{if(o!==v&&!o.muted)aMute(o)});
  if(v.muted){v.muted=false;v.volume=1;const f=v.closest('.apin');if(f)f.classList.add('snd');
    const p=v.play();if(p&&p.catch)p.catch(()=>{v.muted=true;if(f)f.classList.remove('snd')})}
  else aMute(v)}
function aBindEgo(){
  $('aeBack').onclick=aBack;
  $('aeAdd').onclick=()=>{const ego=AE.id;aAddMedia(ego,$('aeAdd'),its=>{if(!AE||AE.id!==ego)return;AE.items=(AE.items||[]).concat(its);aSaveEgo();aRenderEgo()})};$('aeEdit').onclick=()=>aEdit(ALTER.egos.find(e=>e.id===AEGO));
  const ta=$('aeNotes');let tmr=null;
  ta.oninput=()=>{AE.notes=ta.value;$('aeSaved').textContent='…';clearTimeout(tmr);tmr=setTimeout(()=>{aSaveEgo();$('aeSaved').textContent='saved';setTimeout(()=>{if($('aeSaved'))$('aeSaved').textContent=''},1500)},800)};
  $('aBoard').onclick=e=>{const p=e.target.closest('.apin');if(!p)return;const v=p.querySelector('video');if(v)aSound(v)}}

/* ---------- add pics / videos to a board ----------
   one tiny "+": pick any number of files; each gets its real size (the masonry needs it),
   big photos are shrunk, videos get a poster frame, and all of it goes to the private vault. */
const aUid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const aBlob=(c,q)=>new Promise(r=>c.toBlob(r,'image/jpeg',q));
function aFit(w,h,m){const k=Math.min(1,m/Math.max(w,h));return [Math.round(w*k)||1,Math.round(h*k)||1]}
async function aPrepImg(f){const u=URL.createObjectURL(f);
  try{const im=new Image();im.src=u;await im.decode();const w=im.naturalWidth,h=im.naturalHeight;
    if(Math.max(w,h)<=2048&&/jpe?g|png|webp|gif/.test(f.type))return {blob:f,ext:(f.type.split('/')[1]||'jpg').replace('jpeg','jpg'),ct:f.type,w,h};
    const [W,H]=aFit(w,h,2048);const c=document.createElement('canvas');c.width=W;c.height=H;c.getContext('2d').drawImage(im,0,0,W,H);
    return {blob:await aBlob(c,.88),ext:'jpg',ct:'image/jpeg',w:W,h:H}}
  finally{URL.revokeObjectURL(u)}}
async function aPrepVid(f){const u=URL.createObjectURL(f);const v=document.createElement('video');
  v.muted=true;v.playsInline=true;v.setAttribute('playsinline','');v.preload='auto';v.src=u;
  const once=(ev,ms)=>new Promise(r=>{const t=setTimeout(r,ms);v.addEventListener(ev,()=>{clearTimeout(t);r()},{once:true})});
  try{await once('loadeddata',15000);const w=v.videoWidth||9,h=v.videoHeight||16;let poster=null;
    try{v.currentTime=Math.min(.5,(v.duration||1)/2);await once('seeked',5000);
      const [W,H]=aFit(w,h,720);const c=document.createElement('canvas');c.width=W;c.height=H;c.getContext('2d').drawImage(v,0,0,W,H);poster=await aBlob(c,.8)}catch(e){}
    const ext=(f.name.split('.').pop()||'mp4').toLowerCase().replace(/[^a-z0-9]/g,'')||'mp4';
    return {blob:f,ext,ct:f.type||'video/mp4',w,h,poster}}
  finally{v.removeAttribute('src');v.load();URL.revokeObjectURL(u)}}
function aAddMedia(ego,btn,done){
  const inp=document.createElement('input');inp.type='file';inp.multiple=true;inp.accept='image/*,video/*';
  inp.style.cssText='position:fixed;left:-9999px;top:0';document.body.appendChild(inp);
  inp.onchange=async()=>{const files=[...inp.files];inp.remove();if(!files.length)return;
    const lbl=btn.textContent;btn.disabled=true;const out=[];let bad=0;
    for(let i=0;i<files.length;i++){const f=files[i];btn.textContent=(i+1)+'/'+files.length;
      try{const isV=/^video\//.test(f.type)||/\.(mp4|mov|m4v|webm)$/i.test(f.name);
        const m=isV?await aPrepVid(f):await aPrepImg(f);const id=aUid();const it={id,k:isV?'v':'i',f:id+'.'+m.ext,w:m.w,h:m.h};
        const up=(n,b,ct)=>SB.storage.from('vault').upload(aPath(ego,n),b,{contentType:ct,upsert:true}).then(r=>{if(r.error)throw r.error});
        await up(it.f,m.blob,m.ct);
        if(m.poster){it.p=id+'_p.jpg';try{await up(it.p,m.poster,'image/jpeg')}catch(e){delete it.p}}
        out.push(it)}catch(e){bad++}}
    btn.textContent=lbl;btn.disabled=false;
    if(out.length)done(out);
    if(bad){const b=document.getElementById(btn.id);if(b){b.textContent=bad+' failed';setTimeout(()=>{const x=document.getElementById(btn.id);if(x)x.textContent=lbl},2500)}}};
  inp.click()}

/* ---------- vault relay ----------
   Loaded in an iframe with ?relay=1, this lets a page that CAN read a CDN
   (allowlisted in the private word list) hand its bytes to the app, which is the thing holding the
   Supabase session. Inert unless the flag is present. */
if(new URLSearchParams(location.search).get('relay')==='1'){
  const OK=new RegExp(LX('ro','^$'));
  addEventListener('message',async e=>{
    const d=e.data;if(!d||d.k!=='vault-put')return;
    const reply=o=>{try{e.source.postMessage(Object.assign({k:'vault-done',id:d.id},o),'*')}catch(_){}};
    if(!OK.test(e.origin))return reply({ok:false,msg:'origin'});
    if(typeof d.path!=='string'||d.path.indexOf(UID+'/')!==0)return reply({ok:false,msg:'path'});
    try{const {error}=await SB.storage.from('vault').upload(d.path,new Blob([d.buf],{type:d.ct||'application/octet-stream'}),{contentType:d.ct||'application/octet-stream',upsert:true});
      reply({ok:!error,msg:error?error.message:''})}
    catch(err){reply({ok:false,msg:String(err).slice(0,120)})}});
  addEventListener('load',()=>{try{parent!==window&&parent.postMessage({k:'vault-ready'},'*')}catch(_){}});
  try{parent!==window&&parent.postMessage({k:'vault-ready'},'*')}catch(_){}
}

/* ---------- hold a pin to see it full screen ----------
   a long press lifts the media out of the board at full size and plays it with sound;
   letting go — or any tap, or escape — puts it back. taps alone still toggle the sound. */
let APK=null,aPkT=null,aPkFrom=null,aPkSwallow=false;
function aPeekOpen(fig,tap){
  if(APK)return;
  const src=fig.querySelector('img,video');if(!src)return;
  const box=document.createElement('div');box.className='apeek';
  let node;
  if(src.tagName==='VIDEO'){
    node=document.createElement('video');
    node.src=src.currentSrc||src.src||src.dataset.url||'';
    node.playsInline=true;node.setAttribute('playsinline','');node.loop=true;node.controls=false;
    node.muted=false;node.volume=1;
    if(src.poster)node.poster=src.poster;
    try{node.currentTime=src.currentTime||0}catch(e){}
    const p=node.play();if(p&&p.catch)p.catch(()=>{node.muted=true;node.play().catch(()=>{})});
    try{src.pause()}catch(e){}
  }else{
    node=document.createElement('img');node.src=src.currentSrc||src.src;node.alt=''}
  box.appendChild(node);document.body.appendChild(box);
  APK={box,node,t0:tap?Date.now():0};aPkFrom=fig;
  /* every way a press can end, on the overlay and on the window alike: a pointerup that
     never arrives must not be able to strand the screen */
  ['pointerup','pointercancel','pointerdown','touchend','mouseup','click'].forEach(t=>{
    box.addEventListener(t,aPeekClose,true);
    addEventListener(t,aPeekClose,true)});
  addEventListener('keydown',aPeekClose,true);
  addEventListener('blur',aPeekClose,true);
  APK.guard=setTimeout(aPeekClose,60000);
}
function aPeekClose(){
  if(!APK)return;
  /* opened by a double tap: the tail of that same tap must not close it again */
  if(APK.t0&&Date.now()-APK.t0<380)return;
  const {box,node,guard}=APK;APK=null;clearTimeout(guard);
  ['pointerup','pointercancel','pointerdown','touchend','mouseup','click'].forEach(t=>removeEventListener(t,aPeekClose,true));
  removeEventListener('keydown',aPeekClose,true);removeEventListener('blur',aPeekClose,true);
  try{if(node.tagName==='VIDEO'){node.pause();node.src=''}}catch(e){}
  box.remove();
  if(aPkFrom){const v=aPkFrom.querySelector('video');if(v&&v.dataset.url)v.play().catch(()=>{});aPkFrom=null}
  aPkSwallow=true;setTimeout(()=>{aPkSwallow=false},350);
}
addEventListener('pointerdown',e=>{
  if(APK)return;
  const fig=e.target.closest&&e.target.closest('.apin');if(!fig)return;
  if(fig.closest('.mwall'))return; /* the motivation wall uses a double tap instead */
  const x0=e.clientX,y0=e.clientY;
  clearTimeout(aPkT);
  const off=()=>{removeEventListener('pointermove',move);removeEventListener('pointerup',up);removeEventListener('pointercancel',up)};
  const move=ev=>{if(Math.abs(ev.clientX-x0)>12||Math.abs(ev.clientY-y0)>12){clearTimeout(aPkT);aPkT=null;off()}};
  const up=()=>{clearTimeout(aPkT);aPkT=null;off()};
  aPkT=setTimeout(()=>{aPkT=null;off();aPeekOpen(fig)},420);
  addEventListener('pointermove',move);addEventListener('pointerup',up);addEventListener('pointercancel',up);
},true);
/* the press that opened the peek must not also land as a tap on the pin */
addEventListener('click',e=>{if(aPkSwallow){e.stopPropagation();e.preventDefault()}},true);
addEventListener('contextmenu',e=>{if(e.target.closest&&e.target.closest('.apin'))e.preventDefault()});
