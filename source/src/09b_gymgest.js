/* ================= GYM GESTURES =================
   Hold an exercise header to reorder exercises (drag the rows, Done saves). Swipe a set left to show Delete.
   The rest dock sits just above whatever bottom bar is showing. */
function restLift(){const d=$('restDock'),n=document.querySelector('.bnav');if(!d)return;const h=n&&getComputedStyle(n).display!=='none'?n.getBoundingClientRect().height:0;d.style.bottom=h?Math.round(h+8)+'px':''}
addEventListener('resize',()=>restLift());

/* ---------- reorder ---------- */
function exReorder(){if(!ACTIVE||ACTIVE.ex.length<2){closeSheet();return}
  const order=ACTIVE.ex.map((_,i)=>i);
  const row=i=>{const e=exOf(ACTIVE.ex[i]);return `<div class="ro-i" data-ri="${i}">${thumb(e)}<b>${esc(e.n)}</b><span class="ro-h" aria-hidden="true">≡</span></div>`};
  openSheet('Reorder exercises',`<div class="dim" style="font-size:12.5px;margin-bottom:10px">Drag to move.</div><div class="ro-l" id="roL">${order.map(row).join('')}</div><div class="bigbtns" style="margin-top:12px"><span style="flex:1"></span><button class="btn p" type="button" id="roOk">Done</button></div>`);
  const L=$('roL');let drag=null;
  L.addEventListener('pointerdown',e=>{const it=e.target.closest('.ro-i');if(!it)return;e.preventDefault();const r=it.getBoundingClientRect();
    drag={it,y0:e.clientY,off:e.clientY-r.top,h:r.height};it.classList.add('drag');try{it.setPointerCapture(e.pointerId)}catch(_){}});
  L.addEventListener('pointermove',e=>{if(!drag)return;e.preventDefault();const {it}=drag;it.style.transform=`translateY(${e.clientY-drag.y0}px)`;
    const sibs=[...L.children].filter(x=>x!==it);let before=null;for(const s of sibs){const r=s.getBoundingClientRect();if(e.clientY<r.top+r.height/2){before=s;break}}
    const ref=before||null;if(it.nextSibling!==ref&&!(ref===null&&it===L.lastElementChild)){const r0=it.getBoundingClientRect().top;L.insertBefore(it,ref);const r1=it.getBoundingClientRect().top;drag.y0+=r1-r0;it.style.transform=`translateY(${e.clientY-drag.y0}px)`}});
  const end=()=>{if(!drag)return;drag.it.classList.remove('drag');drag.it.style.transform='';drag=null};
  L.addEventListener('pointerup',end);L.addEventListener('pointercancel',end);
  $('roOk').onclick=()=>{const idx=[...L.children].map(x=>+x.dataset.ri);closeSheet();if(idx.some((v,i)=>v!==i))mut(()=>{ACTIVE.ex=idx.map(i=>ACTIVE.ex[i])})}}

/* hold an exercise header for half a second to open the reorder list */
(()=>{const W=$('g-workout');if(!W)return;let t=null,sx=0,sy=0,fired=false;
  W.addEventListener('pointerdown',e=>{const h=e.target.closest('.exhead');if(!h||!ACTIVE)return;fired=false;sx=e.clientX;sy=e.clientY;clearTimeout(t);
    t=setTimeout(()=>{fired=true;try{navigator.vibrate&&navigator.vibrate(15)}catch(_){}exReorder()},450)});
  W.addEventListener('pointermove',e=>{if(t&&Math.hypot(e.clientX-sx,e.clientY-sy)>8){clearTimeout(t);t=null}});
  ['pointerup','pointercancel'].forEach(k=>W.addEventListener(k,()=>{clearTimeout(t);t=null}));
  W.addEventListener('click',e=>{if(fired&&e.target.closest('.exhead')){e.stopPropagation();e.preventDefault();fired=false}},true);
  W.addEventListener('contextmenu',e=>{if(e.target.closest('.exhead'))e.preventDefault()})})();

/* ---------- swipe a set left to delete ---------- */
(()=>{const W=$('g-workout');if(!W)return;const OPEN=-84;let s=null;
  const shut=except=>W.querySelectorAll('.srow.swo').forEach(r=>{if(r!==except){r.classList.remove('swo');r.style.transform=''}});
  W.addEventListener('touchstart',e=>{const r=e.target.closest('.srow');if(!r||!ACTIVE){shut();return}const p=e.touches[0];
    s={r,x:p.clientX,y:p.clientY,base:r.classList.contains('swo')?OPEN:0,dx:0,lock:null};shut(r)},{passive:true});
  W.addEventListener('touchmove',e=>{if(!s)return;const p=e.touches[0],dx=p.clientX-s.x,dy=p.clientY-s.y;
    if(s.lock==null&&Math.hypot(dx,dy)>8)s.lock=Math.abs(dx)>Math.abs(dy)*1.2?'x':'y';if(s.lock!=='x')return;
    e.preventDefault();s.dx=dx;const v=Math.max(OPEN-30,Math.min(0,s.base+dx));s.r.style.transition='none';s.r.style.transform=`translateX(${v}px)`;s.r.classList.add('swg')},{passive:false});
  W.addEventListener('touchend',()=>{if(!s)return;const {r}=s;r.style.transition='';r.classList.remove('swg');
    if(s.lock==='x'){const v=s.base+s.dx;if(v<OPEN/2){r.classList.add('swo');r.style.transform=`translateX(${OPEN}px)`}else{r.classList.remove('swo');r.style.transform=''}}s=null});
  W.addEventListener('click',e=>{const b=e.target.closest('[data-swdel]');if(b){e.stopPropagation();const [xi,si]=SXY(b.dataset.swdel);mut(()=>ACTIVE.ex[xi].sets.splice(si,1));return}
    const r=e.target.closest('.srow.swo');if(r){e.stopPropagation();e.preventDefault();shut()}},true)})();
