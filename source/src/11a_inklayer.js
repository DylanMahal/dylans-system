/* ================= INK LAYER — handwriting drawn over typed text (journal + notes) =================
   the page is a host element holding the text (textarea / contenteditable) with canvases laid over / under it.
   ink = {h, strokes:[{i,c,w,t,pts:[x,y,pressure,...]}], bg}; coordinates are page units (IW wide), so ink stays where it was drawn.
   Highlighter strokes sit UNDER the text (back canvas) so words stay readable; pen strokes sit over it.
   One mode at a time: "type" (text is live) or an ink tool (text is frozen, the canvas takes every touch). */
const IW=1000,IH=1400;
const INKS={tool:'type',col:'#e6e6e6',hcol:'#ffe14d',w:4,po:LS.get('pencilOnly')||false,...(LS.get('inkset')||{})};INKS.tool='type';
INKS.w=[2,4,7].reduce((a,b)=>Math.abs(b-INKS.w)<Math.abs(a-INKS.w)?b:a);
const inkSet=()=>LS.set('inkset',{col:INKS.col,hcol:INKS.hcol,w:INKS.w,po:INKS.po});
const INK_BG=['blank','grid','dots'];const inkBgOf=k=>INK_BG.includes(k&&k.bg)?k.bg:'blank';
const INK_PEN=['#e6e6e6','#ff2a6d','#05d9e8','#ffb000'],INK_HL=['#ffe14d','#7dff9b','#ff7eb6','#6ad7ff'];
const ICO=d=>`<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const INK_I={type:ICO('<path d="M5 7V5h14v2M12 5v14M9 19h6"/>'),pen:ICO('<path d="M15 5l4 4L8 20l-5 1 1-5L15 5z"/><path d="M13 7l4 4"/>'),
  hl:ICO('<path d="M14 4l6 6-8 8H7l-3-3 10-11z"/><path d="M5 21h14"/>'),eraser:ICO('<path d="M20 20H9L4 15a2 2 0 010-3l8-8a2 2 0 013 0l5 5a2 2 0 010 3l-7 8"/><path d="M8 11l7 7"/>'),
  undo:ICO('<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>'),redo:ICO('<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 000 12h3"/>'),
  more:ICO('<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>'),
  full:ICO('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),exit:ICO('<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>'),
  page:ICO('<path d="M6 3h9l4 4v14H6z"/><path d="M12 11v6M9 14h6"/>'),clear:ICO('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>')};
function inkLayer(o){
  const host=o.host,cv=o.canvas,cx=cv.getContext('2d'),bar=o.bar;
  const bk=document.createElement('canvas');bk.className='inkcv inkback';host.insertBefore(bk,host.firstChild);const bx=bk.getContext('2d');
  const L={stack:o.stack||{undo:[],redo:[]},scale:1,H:IH,drawing:null,last:0,lw:0,lh:0};
  bar.className='inkbar';
  bar.innerHTML=`<div class="ib-seg" role="group" aria-label="Tool">${[['type','Type'],['pen','Pen'],['hl','Highlighter'],['eraser','Eraser']].map(([k,t])=>`<button type="button" data-ik="t:${k}" aria-label="${t}" title="${t}">${INK_I[k]}</button>`).join('')}</div>
    <div class="ib-ctx"><span class="ib-sep"></span><div class="ib-cols"></div><span class="ib-sep"></span>
    <div class="ib-sizes">${[[2,5],[4,8],[7,12]].map(([w,d])=>`<button type="button" class="ib-size" data-ik="s:${w}" aria-label="Size ${w}"><i style="width:${d}px;height:${d}px"></i></button>`).join('')}</div>
    <span class="ib-sep"></span>
    <button type="button" data-ik="undo" aria-label="Undo" title="Undo">${INK_I.undo}</button><button type="button" data-ik="redo" aria-label="Redo" title="Redo">${INK_I.redo}</button></div>
    ${o.fmt?`<div class="ib-fmt"><span class="ib-sep"></span>${o.fmt}</div>`:''}
    <span class="ib-sep ib-last"></span>
    <button type="button" data-ik="full" aria-label="Fullscreen" title="Fullscreen">${INK_I.full}</button><button type="button" data-ik="more" aria-label="More" title="More">${INK_I.more}</button>
    <div class="ib-pop">${o.paper?`<div class="ib-row"><span>Paper</span><div class="ib-seg">${INK_BG.map(b=>`<button type="button" data-ik="bg:${b}">${b}</button>`).join('')}</div></div>`:''}
      <button type="button" class="ib-act" data-ik="po"><span class="ib-l">Pencil only <small>Fingers scroll, only the pen draws</small></span><i class="ib-sw"></i></button>
      <button type="button" class="ib-act" data-ik="page">${INK_I.page}<span class="ib-l">Add a page</span></button>
      <button type="button" class="ib-act ib-bad" data-ik="clear">${INK_I.clear}<span class="ib-l">Clear all writing</span></button></div>`;
  const pop=bar.querySelector('.ib-pop'),colsEl=bar.querySelector('.ib-cols');
  const touch=()=>{L.last=Date.now();o.changed&&o.changed()};
  L.refresh=()=>{L.mirror&&L.mirror();const ink=INKS.tool!=='type',hl=INKS.tool==='hl';
    bar.querySelectorAll('[data-ik^="t:"]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.ik==='t:'+INKS.tool));
    const pal=hl?INK_HL:INK_PEN,cur=hl?INKS.hcol:INKS.col;
    colsEl.innerHTML=pal.map(c=>`<button type="button" class="ib-dot" data-ik="c:${c}" style="--c:${c}" aria-label="Colour" aria-pressed="${c===cur}"></button>`).join('');
    colsEl.style.opacity=INKS.tool==='eraser'||!ink?'.35':'1';
    bar.querySelectorAll('[data-ik^="s:"]').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.ik.slice(2)===INKS.w));
    bar.querySelector('[data-ik="po"]').setAttribute('aria-pressed',INKS.po);
    bar.querySelectorAll('[data-ik^="bg:"]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.ik==='bg:'+inkBgOf(o.get())));
    const fb=bar.querySelector('[data-ik="full"]');if(o.full){const on=o.full.classList.contains('inkfull');fb.innerHTML=on?INK_I.exit:INK_I.full;fb.setAttribute('aria-pressed',on);fb.title=on?'Exit fullscreen':'Fullscreen'}else fb.style.display='none';
    cv.style.touchAction='none';host.classList.toggle('inking',ink);bar.classList.toggle('typing',!ink);
    host.querySelectorAll('.inkdead').forEach(x=>x.remove());
    host.querySelectorAll('textarea,[contenteditable]').forEach(x=>{if(!ink){x.style.display='';return}
      let d;if(x.tagName==='TEXTAREA'){d=document.createElement('div');d.className=x.className;d.innerHTML=inkMarkHtml(x.value);d.style.height=x.style.height;d.style.whiteSpace='pre-wrap';d.style.overflowWrap='anywhere'}
      else{d=x.cloneNode(true);d.removeAttribute('id');d.removeAttribute('contenteditable')}
      d.classList.add('inkdead');d.setAttribute('aria-hidden','true');x.after(d);x.style.display='none'});
    if(ink){const a=document.activeElement;if(a&&a!==document.body&&a.blur)a.blur();try{getSelection().removeAllRanges()}catch(_){}}};
  L.size=()=>{const w=host.clientWidth;if(!w)return;L.scale=w/IW;const k=o.get();host.style.minHeight=Math.round(((k&&k.h)||IH)*L.scale)+'px';const h=host.clientHeight;
    let r=devicePixelRatio||1;while(w*r*h*r>1.6e7&&r>1)r-=.5;[cv,bk].forEach(c=>{c.width=Math.round(w*r);c.height=Math.round(h*r)});L.H=h/L.scale;L.lw=w;L.lh=h;
    [cx,bx].forEach(c=>c.setTransform(r*L.scale,0,0,r*L.scale,0,0));L.redraw()};
  const clear=c=>{c.save();c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,c.canvas.width,c.canvas.height);c.restore()};
  L.back=()=>{const k=o.get()||{h:IH,strokes:[]},sc=L.scale;clear(bx);
    const bg=o.paper?inkBgOf(k):'blank';bx.strokeStyle='rgba(255,255,255,.06)';bx.fillStyle='rgba(255,255,255,.14)';bx.lineWidth=1/sc;
    if(bg==='grid'){for(let y=40;y<L.H;y+=40){bx.beginPath();bx.moveTo(0,y);bx.lineTo(IW,y);bx.stroke()}for(let g=40;g<IW;g+=40){bx.beginPath();bx.moveTo(g,0);bx.lineTo(g,L.H);bx.stroke()}}
    else if(bg==='dots'){for(let y=40;y<L.H;y+=40)for(let g=40;g<IW;g+=40){bx.beginPath();bx.arc(g,y,1.6,0,7);bx.fill()}}
    bx.strokeStyle='rgba(255,42,109,.18)';for(let y=IH;y<L.H;y+=IH){bx.setLineDash([8,8]);bx.beginPath();bx.moveTo(0,y);bx.lineTo(IW,y);bx.stroke();bx.setLineDash([])}
    k.strokes.forEach(s=>{if(s.t==='hl')stroke(bx,s)});if(L.drawing&&L.drawing.t==='hl')stroke(bx,L.drawing)};
  L.redraw=()=>{const k=o.get()||{strokes:[]};L.back();clear(cx);k.strokes.forEach(s=>{if(s.t!=='hl')stroke(cx,s)});if(L.drawing&&!L.drawing.erase&&L.drawing.t!=='hl')stroke(cx,L.drawing)};
  function stroke(x,s){const p=s.pts;if(p.length<3)return;x.save();x.lineCap='round';x.lineJoin='round';x.strokeStyle=s.c;
    if(s.t==='hl'){x.globalAlpha=.4;x.lineCap='butt';x.lineWidth=s.w*4;x.beginPath();x.moveTo(p[0],p[1]);for(let i=3;i<p.length;i+=3)x.lineTo(p[i],p[i+1]);x.stroke();x.restore();return}
    for(let i=3;i<p.length;i+=3){const pr=(p[i+2]+p[i-1])/2;x.lineWidth=Math.max(.6,s.w*(.35+pr*1.1));x.beginPath();
      const mx0=i>=6?(p[i-6]+p[i-3])/2:p[i-3],my0=i>=6?(p[i-5]+p[i-2])/2:p[i-2];const mx1=(p[i-3]+p[i])/2,my1=(p[i-2]+p[i+1])/2;
      x.moveTo(mx0,my0);x.quadraticCurveTo(p[i-3],p[i-2],mx1,my1);x.stroke()}
    if(p.length===3){x.fillStyle=s.c;x.beginPath();x.arc(p[0],p[1],s.w/2,0,7);x.fill()}x.restore()}
  const pt=e=>{const r=cv.getBoundingClientRect(),fx=r.width?(L.lw||r.width)/r.width:1,fy=r.height?(L.lh||r.height)/r.height:1;return [Math.round((e.clientX-r.left)*fx/L.scale*10)/10,Math.round((e.clientY-r.top)*fy/L.scale*10)/10,Math.round((e.pointerType==='mouse'?.5:(e.pressure||.5))*100)/100]};
  const scroller=()=>{let n=cv.parentElement;while(n&&n!==document.body){const cs=getComputedStyle(n);if(/(auto|scroll)/.test(cs.overflowY)&&n.scrollHeight>n.clientHeight+2)return n;n=n.parentElement}return document.scrollingElement||document.documentElement};
  ['contextmenu','selectstart','gesturestart'].forEach(t=>cv.addEventListener(t,e=>e.preventDefault()));
  ['touchstart','touchmove'].forEach(t=>cv.addEventListener(t,e=>e.preventDefault(),{passive:false}));
  const erase=p=>{const k=o.get();if(!k)return;const keep=[];let hit=false;
    k.strokes.forEach(s=>{let h=false;for(let i=0;i<s.pts.length;i+=3){if(Math.hypot(s.pts[i]-p[0],s.pts[i+1]-p[1])<(s.t==='hl'?s.w*2:14+s.w)){h=true;break}}if(h){s.i=s.i||rid();L.stack.undo.push({del:s});hit=true}else keep.push(s)});
    if(hit){k.strokes=keep;L.stack.redo=[];L.redraw()}};
  cv.addEventListener('pointerdown',e=>{
    if(e.pointerType==='pen'&&!INKS.po){INKS.po=true;inkSet();L.refresh()}
    e.preventDefault();
    if(e.pointerType==='pen')L.penAt=Date.now();
    if(e.pointerType==='touch'&&INKS.po){ /* pencil-only: fingers scroll by hand, never draw; ignored while the pen is working (palm) */
      if(L.drawing||Date.now()-(L.penAt||0)<1500||e.width>30||e.height>30)return;try{cv.setPointerCapture(e.pointerId)}catch(_){}L.scroll={y:e.clientY,el:scroller()};return}
    try{cv.setPointerCapture(e.pointerId)}catch(_){}
    const t=INKS.tool;
    if(t==='eraser'){L.drawing={erase:true};erase(pt(e));return}
    L.drawing={i:rid(),c:t==='hl'?INKS.hcol:INKS.col,w:t==='hl'?INKS.w*1.5:INKS.w,t:t==='hl'?'hl':'pen',pts:pt(e)}});
  cv.addEventListener('pointermove',e=>{if(L.scroll){e.preventDefault();const dy=e.clientY-L.scroll.y;L.scroll.y=e.clientY;L.scroll.el.scrollTop-=dy;return}const d=L.drawing;if(!d)return;e.preventDefault();if(e.pointerType==='pen')L.penAt=Date.now();
    let evs=e.getCoalescedEvents?e.getCoalescedEvents():[];if(!evs.length)evs=[e];
    for(const ev of evs){const p=pt(ev);if(d.erase){erase(p);continue}const n=d.pts.length;if(Math.hypot(p[0]-d.pts[n-3],p[1]-d.pts[n-2])<1.2)continue;d.pts.push(...p);if(d.t!=='hl')stroke(cx,{...d,pts:d.pts.slice(-9)})}
    if(!d.erase&&d.t==='hl')L.back();
    if(!d.erase){const y=d.pts[d.pts.length-2];if(y>L.H-120){const k=o.make();k.h=(Math.ceil(L.H/IH)+1)*IH;L.size()}}});
  const end=()=>{L.scroll=null;const d=L.drawing;if(!d)return;L.drawing=null;if(!d.erase){const k=o.make();k.strokes.push(d);L.stack.undo.push({add:d});L.stack.redo=[]}if(d.erase)L.redraw();touch()};
  cv.addEventListener('pointerup',end);cv.addEventListener('pointercancel',end);
  const closePop=()=>pop.classList.remove('open');
  L.docDown=e=>{if(!bar.contains(e.target))closePop()};document.addEventListener('pointerdown',L.docDown,true);
  bar.onclick=e=>{const b=e.target.closest('[data-ik]');if(!b)return;const a=b.dataset.ik,k=a==='more'||a==='full'||a.startsWith('t:')||a.startsWith('c:')||a.startsWith('s:')||a==='po'?null:o.make();
    if(a==='more'){pop.classList.toggle('open');return}
    if(a==='t:hl'&&L.markSel()){closePop();return}
    if(a.startsWith('t:')){INKS.tool=a.slice(2);closePop();L.refresh();return}
    if(a.startsWith('c:')){const c=a.slice(2);if(INKS.tool==='hl')INKS.hcol=c;else{INKS.col=c;if(INKS.tool==='eraser'||INKS.tool==='type')INKS.tool='pen'}inkSet();L.refresh();return}
    if(a.startsWith('s:')){INKS.w=+a.slice(2);inkSet();L.refresh();return}
    if(a==='po'){INKS.po=!INKS.po;inkSet();L.refresh();return}
    if(a.startsWith('bg:')){const kk=o.make();kk.bg=a.slice(3);L.redraw();L.refresh();touch();return}
    if(a==='full'){if(o.full){o.full.classList.toggle('inkfull');inkFullSync();L.refresh();setTimeout(()=>L.size(),60)}return}
    if(a==='page'){k.h=(k.h||IH)+IH;L.size();touch();closePop();return}
    if(a==='undo'||a==='redo'){const from=a==='undo'?L.stack.undo:L.stack.redo,to=a==='undo'?L.stack.redo:L.stack.undo;const u=from.pop();if(!u)return;
      const adding=a==='undo'?!!u.del:!!u.add;const s=u.add||u.del;
      if(adding)k.strokes.push(s);else k.strokes=k.strokes.filter(x=>x.i!==s.i);
      to.push(u);L.redraw();touch();return}
    if(a==='clear'){const lab=b.querySelector('.ib-l');if(b.dataset.arm){k.strokes.forEach(s=>{s.i=s.i||rid();L.stack.undo.push({del:s})});k.strokes=[];k.h=IH;L.size();touch();delete b.dataset.arm;lab.textContent='Clear all writing';closePop()}
      else{b.dataset.arm=1;lab.textContent='Tap again to clear';setTimeout(()=>{delete b.dataset.arm;lab.textContent='Clear all writing'},2500)}return}};
  let raf=0;const ro=new ResizeObserver(()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{if(host.clientWidth!==L.lw||host.clientHeight!==L.lh)L.size()})});ro.observe(host);
  /* typed-text highlight: select words, then tap the highlighter. Textareas get invisible marker chars drawn by a mirror behind them */
  L.sel=null;
  L.onSel=()=>{const a=document.activeElement;if(a&&a.tagName==='TEXTAREA'&&host.contains(a)){L.sel=a.selectionEnd>a.selectionStart?{ta:a,s:a.selectionStart,e:a.selectionEnd}:null;return}
    const g=getSelection();if(g&&g.rangeCount&&!g.isCollapsed&&host.contains(g.anchorNode)&&host.contains(g.focusNode))L.sel={r:g.getRangeAt(0).cloneRange()};else if(a&&host.contains(a))L.sel=null};
  document.addEventListener('selectionchange',L.onSel);
  bar.addEventListener('mousedown',e=>{if(e.target.closest('[data-ik="t:hl"]'))e.preventDefault()});
  L.markSel=()=>{const q=L.sel;if(!q)return false;L.sel=null;
    if(q.ta){const t=q.ta,v=t.value,mid=v.slice(q.s,q.e);if(!mid.trim())return false;
      const o2=v.lastIndexOf('⁣',q.s),c2=v.lastIndexOf('⁤',q.s-1),inside=!/[⁣⁤]/.test(mid)&&o2>c2;
      const on=inside||/[⁣⁤]/.test(mid);const ce=inside?v.indexOf('⁤',q.e):-1;
      const nv=inside?v.slice(0,o2)+v.slice(o2+1,ce<0?v.length:ce)+(ce<0?'':v.slice(ce+1)):on?v.slice(0,q.s)+mid.replace(/[⁣⁤]/g,'')+v.slice(q.e):v.slice(0,q.s)+'⁣'+mid.replace(/[⁣⁤]/g,'')+'⁤'+v.slice(q.e);
      t.value=nv.replace(/⁣⁤/g,'');t.dispatchEvent(new Event('input',{bubbles:true}));L.mirror();return true}
    try{const g=getSelection();g.removeAllRanges();g.addRange(q.r);const ed=q.r.commonAncestorContainer.parentElement.closest('[contenteditable]');if(ed)ed.focus();
      document.execCommand('styleWithCSS',false,true);document.execCommand('hiliteColor',false,'rgba(255,214,10,.42)');g.collapseToEnd()}catch(_){return false}return true};
  L.mirror=()=>{host.querySelectorAll('textarea').forEach(t=>{let m=t._mir;const has=/⁣/.test(t.value);
    if(!has){if(m){m.remove();t._mir=null}return}
    if(!m){m=t._mir=document.createElement('div');m.className=t.className+' inkmir';m.setAttribute('aria-hidden','true');t.before(m);t.addEventListener('input',L.mirror);t.addEventListener('scroll',()=>{if(t._mir)t._mir.scrollTop=t.scrollTop})}
    m.style.cssText=`left:${t.offsetLeft}px;top:${t.offsetTop}px;width:${t.offsetWidth}px;height:${t.offsetHeight}px`;m.innerHTML=inkMarkHtml(t.value)+'\n';m.scrollTop=t.scrollTop})};
  L.destroy=()=>{document.removeEventListener('selectionchange',L.onSel);ro.disconnect();cancelAnimationFrame(raf);document.removeEventListener('pointerdown',L.docDown,true)};
  L.reset=()=>{L.stack.undo=[];L.stack.redo=[];L.drawing=null};
  return L}

const inkMarkHtml=v=>String(v||'').split('⁣').map((c,i)=>{if(!i)return esc(c).replace(/⁤/g,'');const j=c.indexOf('⁤');return j<0?'<mark class="inkmk">'+esc(c)+'</mark>':'<mark class="inkmk">'+esc(c.slice(0,j))+'</mark>'+esc(c.slice(j+1)).replace(/⁤/g,'')}).join('');
/* fullscreen: Esc, or leaving the page, closes it */
/* a fixed element is trapped by any ancestor with a transform, filter or z-index; while fullscreen is on, those are switched off
   all the way up so the note covers the whole screen like a notes app, then put back exactly as they were */
function inkFullSync(){document.querySelectorAll('[data-ifs]').forEach(p=>{p.style.cssText=p.dataset.ifs;delete p.dataset.ifs});
  const el=document.querySelector('.inkfull');document.documentElement.classList.toggle('inkfull-on',!!el);if(!el)return;
  for(let p=el.parentElement;p&&p!==document.documentElement;p=p.parentElement){const c=getComputedStyle(p);
    if(c.transform!=='none'||c.filter!=='none'||(c.backdropFilter&&c.backdropFilter!=='none')||(c.webkitBackdropFilter&&c.webkitBackdropFilter!=='none')||c.zIndex!=='auto'||c.contain!=='none'||c.willChange!=='auto'||c.perspective!=='none'||c.animationName!=='none'){
      p.dataset.ifs=p.style.cssText;p.style.setProperty('transform','none','important');p.style.setProperty('filter','none','important');p.style.setProperty('backdrop-filter','none','important');p.style.setProperty('-webkit-backdrop-filter','none','important');
      p.style.setProperty('z-index','auto','important');p.style.setProperty('contain','none','important');p.style.setProperty('will-change','auto','important');p.style.setProperty('perspective','none','important');p.style.setProperty('animation','none','important')}}}
const inkExitFull=()=>{document.querySelectorAll('.inkfull').forEach(x=>x.classList.remove('inkfull'));inkFullSync()};
addEventListener('keydown',e=>{if(e.key==='Escape'&&document.querySelector('.inkfull')){inkExitFull();document.querySelectorAll('[data-ik="full"]').forEach(b=>{b.textContent='⛶ full';b.setAttribute('aria-pressed',false)})}});
