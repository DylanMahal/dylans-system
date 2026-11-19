/* ================= INK LAYER — handwriting drawn over typed text (journal + notes) =================
   the page is a host element holding the text (textarea / contenteditable) with a transparent canvas laid over it.
   ink = {h, strokes:[{i,c,w,t,pts:[x,y,pressure,...]}], bg}; coordinates are page units (IW wide), so ink stays where it was drawn.
   Apple Pencil always writes; fingers type and scroll. With an ink tool picked, mouse / finger draw too (unless "pencil only"). */
const IW=1000,IH=1400;
const INKS={tool:'type',ink:'pen',col:'#e6e6e6',w:4,po:LS.get('pencilOnly')||false,...(LS.get('inkset')||{})};
const inkSet=()=>LS.set('inkset',{tool:INKS.tool,ink:INKS.ink,col:INKS.col,w:INKS.w,po:INKS.po});
const INK_BG=['blank','grid','dots'];const inkBgOf=k=>INK_BG.includes(k&&k.bg)?k.bg:'blank';
function inkLayer(o){
  const host=o.host,cv=o.canvas,cx=cv.getContext('2d'),bar=o.bar;
  const L={stack:o.stack||{undo:[],redo:[]},scale:1,H:IH,drawing:null,last:0,lw:0,lh:0};
  bar.className='jtools';
  bar.innerHTML=`<button type="button" data-ik="t:type" title="Type with the keyboard">type</button><button type="button" data-ik="t:pen">pen</button><button type="button" data-ik="t:hl">highlight</button><button type="button" data-ik="t:eraser">erase</button><span class="sep"></span>
    ${['#e6e6e6','#ff2a6d','#05d9e8','#ffb000'].map(c=>`<button type="button" class="col" data-ik="c:${c}" style="--c:${c}" aria-label="Colour"></button>`).join('')}
    <input type="range" min="1" max="12" value="${INKS.w}" aria-label="Pen width"><span class="sep"></span>
    <button type="button" data-ik="undo">undo</button><button type="button" data-ik="redo">redo</button><button type="button" data-ik="page">+ page</button>
    ${o.paper?`<select aria-label="Paper">${INK_BG.map(b=>`<option value="${b}">${b}</option>`).join('')}</select>`:''}
    <button type="button" data-ik="clear">clear</button><button type="button" data-ik="po" title="Ignore fingers so your palm can rest on the screen">pencil only</button>`;
  const touch=()=>{L.last=Date.now();o.changed&&o.changed()};
  L.refresh=()=>{bar.querySelectorAll('[data-ik^="t:"]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.ik==='t:'+INKS.tool));
    bar.querySelectorAll('[data-ik^="c:"]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.ik==='c:'+INKS.col));
    const po=bar.querySelector('[data-ik="po"]');po.setAttribute('aria-pressed',INKS.po);bar.querySelector('input[type=range]').value=INKS.w;
    const bg=bar.querySelector('select');if(bg)bg.value=inkBgOf(o.get());
    const ink=INKS.tool!=='type';cv.style.touchAction='none';host.classList.toggle('inking',ink);
    host.querySelectorAll('textarea,[contenteditable]').forEach(x=>{x.inert=ink});
    if(ink){const a=document.activeElement;if(a&&a!==document.body&&a.blur)a.blur();try{getSelection().removeAllRanges()}catch(_){}}};
  L.size=()=>{const w=host.clientWidth;if(!w)return;L.scale=w/IW;const k=o.get();host.style.minHeight=Math.round(((k&&k.h)||IH)*L.scale)+'px';const h=host.clientHeight;
    let r=devicePixelRatio||1;while(w*r*h*r>1.6e7&&r>1)r-=.5;cv.width=Math.round(w*r);cv.height=Math.round(h*r);L.H=h/L.scale;L.lw=w;L.lh=h;
    cx.setTransform(r*L.scale,0,0,r*L.scale,0,0);L.redraw()};
  L.redraw=()=>{const k=o.get()||{h:IH,strokes:[]},sc=L.scale;cx.save();cx.setTransform(1,0,0,1,0,0);cx.clearRect(0,0,cv.width,cv.height);cx.restore();
    const bg=o.paper?inkBgOf(k):'blank';cx.strokeStyle='rgba(255,255,255,.06)';cx.fillStyle='rgba(255,255,255,.14)';cx.lineWidth=1/sc;
    if(bg==='grid'){for(let y=40;y<L.H;y+=40){cx.beginPath();cx.moveTo(0,y);cx.lineTo(IW,y);cx.stroke()}for(let g=40;g<IW;g+=40){cx.beginPath();cx.moveTo(g,0);cx.lineTo(g,L.H);cx.stroke()}}
    else if(bg==='dots'){for(let y=40;y<L.H;y+=40)for(let g=40;g<IW;g+=40){cx.beginPath();cx.arc(g,y,1.6,0,7);cx.fill()}}
    cx.strokeStyle='rgba(255,42,109,.18)';for(let y=IH;y<L.H;y+=IH){cx.setLineDash([8,8]);cx.beginPath();cx.moveTo(0,y);cx.lineTo(IW,y);cx.stroke();cx.setLineDash([])}
    k.strokes.forEach(stroke);if(L.drawing&&!L.drawing.erase)stroke(L.drawing)};
  function stroke(s){const p=s.pts;if(p.length<3)return;cx.save();cx.lineCap='round';cx.lineJoin='round';cx.strokeStyle=s.c;
    if(s.t==='hl'){cx.globalAlpha=.32;cx.lineWidth=s.w*4;cx.beginPath();cx.moveTo(p[0],p[1]);for(let i=3;i<p.length;i+=3)cx.lineTo(p[i],p[i+1]);cx.stroke();cx.restore();return}
    for(let i=3;i<p.length;i+=3){const pr=(p[i+2]+p[i-1])/2;cx.lineWidth=Math.max(.6,s.w*(.35+pr*1.1));cx.beginPath();
      const mx0=i>=6?(p[i-6]+p[i-3])/2:p[i-3],my0=i>=6?(p[i-5]+p[i-2])/2:p[i-2];const mx1=(p[i-3]+p[i])/2,my1=(p[i-2]+p[i+1])/2;
      cx.moveTo(mx0,my0);cx.quadraticCurveTo(p[i-3],p[i-2],mx1,my1);cx.stroke()}
    if(p.length===3){cx.fillStyle=s.c;cx.beginPath();cx.arc(p[0],p[1],s.w/2,0,7);cx.fill()}cx.restore()}
  const pt=e=>{const r=cv.getBoundingClientRect();return [Math.round((e.clientX-r.left)/L.scale*10)/10,Math.round((e.clientY-r.top)/L.scale*10)/10,Math.round((e.pointerType==='mouse'?.5:(e.pressure||.5))*100)/100]};
  const scroller=()=>{let n=cv.parentElement;while(n&&n!==document.body){const cs=getComputedStyle(n);if(/(auto|scroll)/.test(cs.overflowY)&&n.scrollHeight>n.clientHeight+2)return n;n=n.parentElement}return document.scrollingElement||document.documentElement};
  cv.addEventListener('contextmenu',e=>e.preventDefault());
  const erase=p=>{const k=o.get();if(!k)return;const keep=[];let hit=false;
    k.strokes.forEach(s=>{let h=false;for(let i=0;i<s.pts.length;i+=3){if(Math.hypot(s.pts[i]-p[0],s.pts[i+1]-p[1])<14+s.w){h=true;break}}if(h){s.i=s.i||rid();L.stack.undo.push({del:s});hit=true}else keep.push(s)});
    if(hit){k.strokes=keep;L.stack.redo=[];L.redraw()}};
  cv.addEventListener('pointerdown',e=>{
    if(e.pointerType==='pen'&&!INKS.po){INKS.po=true;inkSet();L.refresh()}
    e.preventDefault();
    if(e.pointerType==='pen')L.penAt=Date.now();
    if(e.pointerType==='touch'&&INKS.po){ /* pencil-only: fingers scroll by hand, never draw; ignored while the pen is working (palm) */
      if(L.drawing||Date.now()-(L.penAt||0)<700)return;try{cv.setPointerCapture(e.pointerId)}catch(_){}L.scroll={y:e.clientY,el:scroller()};return}
    try{cv.setPointerCapture(e.pointerId)}catch(_){}
    const t=INKS.tool;
    if(t==='eraser'){L.drawing={erase:true};erase(pt(e));return}
    L.drawing={i:rid(),c:INKS.col,w:t==='hl'?INKS.w*1.5:INKS.w,t:t==='hl'?'hl':'pen',pts:pt(e)}});
  cv.addEventListener('pointermove',e=>{if(L.scroll){e.preventDefault();const dy=e.clientY-L.scroll.y;L.scroll.y=e.clientY;L.scroll.el.scrollTop-=dy;return}const d=L.drawing;if(!d)return;e.preventDefault();if(e.pointerType==='pen')L.penAt=Date.now();
    let evs=e.getCoalescedEvents?e.getCoalescedEvents():[];if(!evs.length)evs=[e];
    for(const ev of evs){const p=pt(ev);if(d.erase){erase(p);continue}const n=d.pts.length;if(Math.hypot(p[0]-d.pts[n-3],p[1]-d.pts[n-2])<1.2)continue;d.pts.push(...p);stroke({...d,pts:d.pts.slice(-9)})}
    if(!d.erase){const y=d.pts[d.pts.length-2];if(y>L.H-120){const k=o.make();k.h=(Math.ceil(L.H/IH)+1)*IH;L.size()}}});
  const end=()=>{L.scroll=null;const d=L.drawing;if(!d)return;L.drawing=null;if(!d.erase){const k=o.make();k.strokes.push(d);L.stack.undo.push({add:d});L.stack.redo=[]}L.redraw();touch()};
  cv.addEventListener('pointerup',end);cv.addEventListener('pointercancel',end);
  bar.oninput=e=>{if(e.target.type==='range'){INKS.w=+e.target.value;inkSet()}};
  bar.onchange=e=>{if(e.target.tagName==='SELECT'){const k=o.make();k.bg=e.target.value;L.redraw();touch()}};
  bar.onclick=e=>{const b=e.target.closest('[data-ik]');if(!b)return;const a=b.dataset.ik;
    if(a.startsWith('t:')){const t=a.slice(2);INKS.tool=t;inkSet();L.refresh();if(t!=='type'){const a=document.activeElement;if(a&&a.blur&&a!==document.body)a.blur()}return}
    if(a.startsWith('c:')){INKS.col=a.slice(2);if(INKS.tool==='eraser')INKS.tool='pen';inkSet();L.refresh();return}
    if(a==='po'){INKS.po=!INKS.po;inkSet();L.refresh();return}
    if(a==='page'){const k=o.make();k.h=(k.h||IH)+IH;L.size();touch();return}
    if(a==='undo'||a==='redo'){const from=a==='undo'?L.stack.undo:L.stack.redo,to=a==='undo'?L.stack.redo:L.stack.undo;const u=from.pop();if(!u)return;const k=o.make();
      const adding=a==='undo'?!!u.del:!!u.add;const s=u.add||u.del;
      if(adding)k.strokes.push(s);else k.strokes=k.strokes.filter(x=>x.i!==s.i);
      to.push(u);L.redraw();touch();return}
    if(a==='clear'){if(b.dataset.arm){const k=o.make();k.strokes.forEach(s=>{s.i=s.i||rid();L.stack.undo.push({del:s})});k.strokes=[];k.h=IH;L.size();touch();delete b.dataset.arm;b.textContent='clear'}
      else{b.dataset.arm=1;b.textContent='tap again';setTimeout(()=>{delete b.dataset.arm;b.textContent='clear'},2500)}return}};
  let raf=0;const ro=new ResizeObserver(()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{if(host.clientWidth!==L.lw||host.clientHeight!==L.lh)L.size()})});ro.observe(host);
  L.destroy=()=>{ro.disconnect();cancelAnimationFrame(raf)};
  L.reset=()=>{L.stack.undo=[];L.stack.redo=[];L.drawing=null};
  return L}
