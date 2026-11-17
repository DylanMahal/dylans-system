/* ================= ROUTER ================= */
const VIEWS=[['today','today','◉'],['week','week','▦'],['streaks','streaks','✦'],['gym','gym','▲'],['food','food','◍'],['sleep','sleep','☾'],['journal','journal','✎'],['alter','alter','⬡'],['tools','tools','⧗'],['media','media','◐'],['stack','stack','◈'],['money','money','£']];
$('tabs').innerHTML=VIEWS.map(([v,l],i)=>`<button type="button" data-v="${v}"><span class="k">${i+1}</span>${l}</button>`).join('');
$('bnav').innerHTML=VIEWS.map(([v,l,ic])=>`<button type="button" data-v="${v}"><i>${ic}</i><span>${l}</span></button>`).join('')+'<span class="bnind" id="bnind"></span>';
let cur=null,goTok=0;
function go(v,fromHash,dirHint){
  if(!VIEWS.some(x=>x[0]===v))v='today';if(v===cur)return;
  const oi=VIEWS.findIndex(x=>x[0]===cur),ni=VIEWS.findIndex(x=>x[0]===v);const dir=dirHint||(oi<0?0:ni>oi?1:-1);cur=v;
  VIEWS.forEach(([x])=>$('v-'+x).classList.toggle('on',x===v));
  document.querySelectorAll('#tabs button,#bnav button').forEach(b=>b.setAttribute('aria-current',b.dataset.v===v?'page':'false'));
  const nb=document.querySelector(`#bnav button[data-v="${v}"]`);if(nb){$('bnind').style.transform=`translateX(${nb.offsetLeft}px)`;$('bnind').style.width=nb.offsetWidth+'px';nb.scrollIntoView({inline:'center',block:'nearest',behavior:FX?'smooth':'auto'})}
  if(!fromHash&&location.hash!=='#'+v)history.replaceState(null,'','#'+v);
  const view=$('v-'+v);
  const m=$('main');
  if(FX&&m.animate){m.animate([{transform:`translateX(${dir*48}px)`,opacity:.1,filter:'hue-rotate(80deg) contrast(1.6)'},{transform:`translateX(${-dir*6}px)`,opacity:1,filter:'none',offset:.7},{transform:'none',opacity:1}],{duration:380,easing:'cubic-bezier(.2,.9,.1,1)'});m.classList.remove('switching');void m.offsetWidth;m.classList.add('switching')}
  const h=view.querySelector('.banner h2.glitch');if(h&&FX){const node=h.lastChild;scramble({set textContent(t){node.textContent=t}},h.dataset.text.slice(1),500)}
  artMount(v);
  if(v!=='alter'){aLeave();if(typeof aQuiet==='function')aQuiet()}
  if(v==='money'||v==='stack')document.querySelectorAll(`#v-${v} [data-scr]`).forEach(el=>scramble(el,el.dataset.scr,700));
  window.scrollTo(0,0);
  const LOADERS={today:()=>{if(typeof renderTodayTasks==='function')renderTodayTasks();if(typeof renderTodayCal==='function')renderTodayCal()},week:()=>renderWeek(),gym:()=>loadGym(),tools:()=>renderTools(),media:()=>renderMedia(),food:()=>loadFood(),sleep:()=>loadSleep(),journal:()=>setJTab(JTAB),streaks:()=>loadHabits(),alter:()=>loadAlter()};
  /* a thin progress bar while the page fetches, and the stagger runs once the real content is in (not on stale/empty markup) */
  const tk=++goTok;let p;try{p=LOADERS[v]&&LOADERS[v]()}catch(e){console.error(e)}
  if(p&&typeof p.then==='function'){const sl=setTimeout(()=>{if(goTok===tk)view.classList.add('loading')},120);
    p.catch(e=>{console.error(e);if(goTok===tk&&LOADERS[v])return new Promise(r=>setTimeout(r,800)).then(()=>LOADERS[v]())}).catch(e=>console.error(e))
     .finally(()=>{clearTimeout(sl);view.classList.remove('loading');if(goTok===tk&&cur===v)staggerIn(view)})}
  else requestAnimationFrame(()=>{if(goTok===tk)staggerIn(view)});
}
$('tabs').onclick=e=>{const b=e.target.closest('button');if(b)go(b.dataset.v)};
$('bnav').onclick=e=>{const b=e.target.closest('button');if(b){go(b.dataset.v);try{navigator.vibrate&&navigator.vibrate(8)}catch(_){}}};
addEventListener('hashchange',()=>go(location.hash.slice(1),true));
/* section changes only from the nav buttons (no swipe) */
function renderAllViews(){renderToday();renderStack();renderMoney();renderTargets();renderTools()}

applyLex();
