/* ================= NOTES · handwriting (Apple Pencil) =================
   a note can hold typed text (html) and a handwriting layer: note.ink = {h, strokes:[{c,w,t,pts:[x,y,pressure,...]}], bg}
   same pen engine as the journal, but bound to whichever note is open */
let NI={tool:'pen',col:'#e6e6e6',w:4,po:LS.get('pencilOnly')||false,mode:'type',undo:[],redo:[],id:null,drawing:null,scale:1,last:0,cv:null,cx:null};
const NBG=['lined','grid','dots','blank'];
function nInkBusy(){return (NI.mode==='ink'&&NI.id===NCUR)||!!NI.drawing||Date.now()-NI.last<3000}
function nInkOf(make){const n=NOTES[NCUR];if(!n)return null;if(!n.ink&&make)n.ink={h:PAGE_H,strokes:[],bg:'lined'};return n.ink||null}
function nInkMount(){
  const ed=document.querySelector('#jPaneN .neditor');if(!ed||!NCUR||!NOTES[NCUR]||!$('nEd'))return;const n=NOTES[NCUR];
  if(NI.id!==NCUR){NI.id=NCUR;NI.undo=[];NI.redo=[];NI.drawing=null;NI.mode=(n.ink&&n.ink.strokes.length&&!nText(n.html))?'ink':'type'}
  const seg=document.createElement('div');seg.className='nmode';
  seg.innerHTML='<div class="seg" id="nModeSeg" role="group" aria-label="Mode"><button type="button" data-ni="m:type">type</button><button type="button" data-ni="m:ink">write</button></div>';
  const meta=ed.querySelector('.nmeta');(meta||ed.firstChild).after(seg);
  const pane=document.createElement('div');pane.id='nInkPane';
  pane.innerHTML=`<div class="jtools" id="nTools">
    <button type="button" data-ni="t:pen">pen</button><button type="button" data-ni="t:hl">highlight</button><button type="button" data-ni="t:eraser">erase</button><span class="sep"></span>
    ${['#e6e6e6','#ff2a6d','#05d9e8','#ffb000'].map(c=>`<button type="button" class="col" data-ni="c:${c}" style="--c:${c}" aria-label="colour"></button>`).join('')}
    <input type="range" id="nWidth" min="1" max="12" value="${NI.w}" aria-label="Pen width"><span class="sep"></span>
    <button type="button" data-ni="undo">undo</button><button type="button" data-ni="redo">redo</button><button type="button" data-ni="page">+ page</button>
    <select id="nBg" aria-label="Paper">${NBG.map(b=>`<option value="${b}">${b}</option>`).join('')}</select>
    <button type="button" data-ni="clear">clear</button><button type="button" data-ni="po" title="Ignore fingers so your palm can rest on the screen">pencil only</button></div>
    <div class="jcanvaswrap" id="nCanvasWrap"><canvas id="nCanvas"></canvas></div>`;
  $('nEd').after(pane);
  NI.cv=$('nCanvas');NI.cx=NI.cv.getContext('2d');
  nInkBind(pane);nInkRefresh()}
function nInkRefresh(){
  const pane=$('nInkPane');if(!pane)return;const ink=NI.mode==='ink';const ed=document.querySelector('#jPaneN .neditor');
  $('nEd').style.display=ink?'none':'';pane.style.display=ink?'':'none';
  const fb=ed.querySelector('.ntbtns');if(fb)fb.style.display=ink?'none':'';
  $('nModeSeg').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.ni==='m:'+NI.mode));
  pane.querySelectorAll('[data-ni^="t:"]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.ni==='t:'+NI.tool));
  pane.querySelectorAll('[data-ni^="c:"]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.ni==='c:'+NI.col));
  const po=pane.querySelector('[data-ni="po"]');po.setAttribute('aria-pressed',NI.po);$('nCanvasWrap').classList.toggle('pencil',NI.po);
  const k=nInkOf();$('nBg').value=(k&&k.bg)||'lined';
  if(ink)nInkSize()}
function nInkSize(){const wrap=$('nCanvasWrap');if(!wrap||!NI.cv)return;const w=wrap.clientWidth||600;NI.scale=w/PAGE_W;const k=nInkOf();const h=((k&&k.h)||PAGE_H)*NI.scale;const r=devicePixelRatio||1;
  NI.cv.width=Math.round(w*r);NI.cv.height=Math.round(h*r);NI.cv.style.width=w+'px';NI.cv.style.height=h+'px';NI.cx.setTransform(r*NI.scale,0,0,r*NI.scale,0,0);nInkRedraw()}
function nInkRedraw(){const x=NI.cx;if(!x)return;const k=nInkOf()||{h:PAGE_H,strokes:[],bg:'lined'};const H=k.h||PAGE_H,sc=NI.scale;
  x.save();x.setTransform(1,0,0,1,0,0);x.clearRect(0,0,NI.cv.width,NI.cv.height);x.restore();
  x.strokeStyle='rgba(255,255,255,.06)';x.fillStyle='rgba(255,255,255,.14)';x.lineWidth=1/sc;
  if(k.bg==='lined'||!k.bg){for(let y=80;y<H;y+=56){x.beginPath();x.moveTo(40,y);x.lineTo(PAGE_W-40,y);x.stroke()}}
  else if(k.bg==='grid'){for(let y=40;y<H;y+=40){x.beginPath();x.moveTo(0,y);x.lineTo(PAGE_W,y);x.stroke()}for(let g=40;g<PAGE_W;g+=40){x.beginPath();x.moveTo(g,0);x.lineTo(g,H);x.stroke()}}
  else if(k.bg==='dots'){for(let y=40;y<H;y+=40)for(let g=40;g<PAGE_W;g+=40){x.beginPath();x.arc(g,y,1.6,0,7);x.fill()}}
  x.strokeStyle='rgba(255,42,109,.18)';for(let y=PAGE_H;y<H;y+=PAGE_H){x.setLineDash([8,8]);x.beginPath();x.moveTo(0,y);x.lineTo(PAGE_W,y);x.stroke();x.setLineDash([])}
  k.strokes.forEach(nStroke)}
function nStroke(s){const x=NI.cx,p=s.pts;if(p.length<3)return;x.save();x.lineCap='round';x.lineJoin='round';x.strokeStyle=s.c;
  if(s.t==='hl'){x.globalAlpha=.32;x.lineWidth=s.w*4;x.beginPath();x.moveTo(p[0],p[1]);for(let i=3;i<p.length;i+=3)x.lineTo(p[i],p[i+1]);x.stroke();x.restore();return}
  for(let i=3;i<p.length;i+=3){const pr=(p[i+2]+p[i-1])/2;x.lineWidth=Math.max(.6,s.w*(.35+pr*1.1));x.beginPath();
    const mx0=i>=6?(p[i-6]+p[i-3])/2:p[i-3],my0=i>=6?(p[i-5]+p[i-2])/2:p[i-2];const mx1=(p[i-3]+p[i])/2,my1=(p[i-2]+p[i+1])/2;
    x.moveTo(mx0,my0);x.quadraticCurveTo(p[i-3],p[i-2],mx1,my1);x.stroke()}
  if(p.length===3){x.fillStyle=s.c;x.beginPath();x.arc(p[0],p[1],s.w/2,0,7);x.fill()}x.restore()}
function nPt(e){const r=NI.cv.getBoundingClientRect();return [Math.round((e.clientX-r.left)/NI.scale*10)/10,Math.round((e.clientY-r.top)/NI.scale*10)/10,Math.round((e.pointerType==='mouse'?.5:(e.pressure||.5))*100)/100]}
function nInkDirty(){const n=NOTES[NCUR];if(!n)return;NI.last=Date.now();n.upd=new Date().toISOString();if($('nSaved'))$('nSaved').textContent='…';clearTimeout(nSaveT);nSaveT=setTimeout(nSave,600)}
function nInkBind(pane){const cv=NI.cv;
  cv.addEventListener('pointerdown',e=>{
    if(e.pointerType==='pen'&&!NI.po){NI.po=true;LS.set('pencilOnly',true);nInkRefresh()}
    if(NI.po&&e.pointerType==='touch')return;
    e.preventDefault();cv.setPointerCapture(e.pointerId);
    if(NI.tool==='eraser'){NI.drawing={erase:true};nErase(nPt(e));return}
    NI.drawing={c:NI.col,w:NI.tool==='hl'?NI.w*1.5:NI.w,t:NI.tool==='hl'?'hl':'pen',pts:nPt(e)}});
  cv.addEventListener('pointermove',e=>{const d=NI.drawing;if(!d)return;if(NI.po&&e.pointerType==='touch')return;e.preventDefault();
    let evs=e.getCoalescedEvents?e.getCoalescedEvents():[];if(!evs.length)evs=[e];
    for(const ev of evs){const p=nPt(ev);if(d.erase){nErase(p);continue}const n=d.pts.length;if(Math.hypot(p[0]-d.pts[n-3],p[1]-d.pts[n-2])<1.2)continue;d.pts.push(...p);nStroke({...d,pts:d.pts.slice(-9)})}
    if(!d.erase){const k=nInkOf(true),y=d.pts[d.pts.length-2];if(y>(k.h||PAGE_H)-120){k.h=(k.h||PAGE_H)+PAGE_H;nInkSize()}}});
  const end=()=>{const d=NI.drawing;if(!d)return;NI.drawing=null;if(!d.erase){const k=nInkOf(true);k.strokes.push(d);NI.undo.push({add:d});NI.redo=[]}nInkRedraw();nInkDirty()};
  cv.addEventListener('pointerup',end);cv.addEventListener('pointercancel',end);
  $('nWidth').oninput=e=>{NI.w=+e.target.value};
  $('nBg').onchange=e=>{const k=nInkOf(true);k.bg=e.target.value;nInkRedraw();nInkDirty()};
  pane.onclick=e=>{const b=e.target.closest('[data-ni]');if(!b)return;const a=b.dataset.ni,k=nInkOf(true);
    if(a[0]==='t'&&a[1]===':'){NI.tool=a.slice(2);nInkRefresh();return}
    if(a[0]==='c'&&a[1]===':'){NI.col=a.slice(2);if(NI.tool==='eraser')NI.tool='pen';nInkRefresh();return}
    if(a==='undo'){const u=NI.undo.pop();if(!u)return;if(u.add)k.strokes=k.strokes.filter(s=>s!==u.add);if(u.del)k.strokes.push(u.del);NI.redo.push(u);nInkRedraw();nInkDirty();return}
    if(a==='redo'){const u=NI.redo.pop();if(!u)return;if(u.add)k.strokes.push(u.add);if(u.del)k.strokes=k.strokes.filter(s=>s!==u.del);NI.undo.push(u);nInkRedraw();nInkDirty();return}
    if(a==='page'){k.h=(k.h||PAGE_H)+PAGE_H;nInkSize();nInkDirty();return}
    if(a==='po'){NI.po=!NI.po;LS.set('pencilOnly',NI.po);nInkRefresh();return}
    if(a==='clear'){if(b.dataset.arm){NI.undo.push(...k.strokes.map(s=>({del:s})));k.strokes=[];k.h=PAGE_H;nInkSize();nInkDirty();delete b.dataset.arm;b.textContent='clear'}
      else{b.dataset.arm=1;b.textContent='tap again';setTimeout(()=>{delete b.dataset.arm;b.textContent='clear'},2500)}return}}}
function nErase(p){const k=nInkOf();if(!k)return;const r=14,keep=[];let hit=false;
  k.strokes.forEach(s=>{let h=false;for(let i=0;i<s.pts.length;i+=3){if(Math.hypot(s.pts[i]-p[0],s.pts[i+1]-p[1])<r+s.w){h=true;break}}if(h){NI.undo.push({del:s});hit=true}else keep.push(s)});
  if(hit){k.strokes=keep;nInkRedraw()}}
/* mode switch (type / write) */
document.addEventListener('click',e=>{const b=e.target.closest('#nModeSeg [data-ni]');if(!b)return;NI.mode=b.dataset.ni.slice(2);nInkRefresh();if(NI.mode==='type'){const ed=$('nEd');ed&&ed.focus()}});
addEventListener('resize',()=>{if(cur==='journal'&&JTAB==='notes'&&NI.mode==='ink')nInkSize()});
/* list thumbnail for handwritten notes (cached per note + last-edit time) */
const NTH=new Map();
function nThumb(n){const S=n.ink&&n.ink.strokes;if(!S||!S.length)return '';const key=n.id+'|'+n.upd;let u=NTH.get(key);
  if(!u){for(const k of NTH.keys())if(k.startsWith(n.id+'|'))NTH.delete(k);
    let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;S.forEach(s=>{for(let i=0;i<s.pts.length;i+=3){x0=Math.min(x0,s.pts[i]);x1=Math.max(x1,s.pts[i]);y0=Math.min(y0,s.pts[i+1]);y1=Math.max(y1,s.pts[i+1])}});
    const pad=20,bw=Math.max(60,x1-x0+pad*2),bh=Math.max(60,y1-y0+pad*2),T=88,sc=Math.min(T/bw,T/bh);const c=document.createElement('canvas');c.width=c.height=T;const g=c.getContext('2d');
    g.lineCap='round';g.lineJoin='round';const ox=(T-bw*sc)/2-(x0-pad)*sc,oy=(T-bh*sc)/2-(y0-pad)*sc;
    S.forEach(s=>{if(s.pts.length<6)return;g.strokeStyle=s.c;g.globalAlpha=s.t==='hl'?.35:1;g.lineWidth=Math.max(1,s.w*sc*(s.t==='hl'?3:1));g.beginPath();for(let i=0;i<s.pts.length;i+=3){const X=s.pts[i]*sc+ox,Y=s.pts[i+1]*sc+oy;i?g.lineTo(X,Y):g.moveTo(X,Y)}g.stroke()});
    u=c.toDataURL('image/png');NTH.set(key,u)}
  return `<img class="nth" alt="" src="${u}">`}
