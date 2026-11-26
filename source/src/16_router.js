/* ================= ROUTER ================= */
/* sections that live inside another page rather than in the tab bars */
const VHIDE=new Set(['media']);
const VIEWS=[['today','Today','<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>'],['goals','Goals','<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>'],['week','Week','<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/>'],['streaks','Streaks','<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>'],['gym','Gym','<path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11"/>'],['food','Food','<path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06zM10 2c1 .5 2 2 2 5"/>'],['sleep','Sleep','<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>'],['journal','Journal','<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>'],['career','Career','<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 12.5h18"/>'],['alter','Alter','<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>'],['looks',LW('looks','Looks'),'<path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/>'],['tools','Tools','<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>'],['media','Media','<rect x="2" y="4" width="20" height="16" rx="3"/><path d="m10 9 5 3-5 3z"/>'],['stack','Stack','<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>'],['money','Money','<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>']];
try{const o=LS.get('nx/taborder');if(Array.isArray(o)&&o.length){const ix=k=>{const i=o.indexOf(k);return i<0?99:i};VIEWS.sort((a,b)=>ix(a[0])-ix(b[0]))}}catch(e){}
const NVI=p=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const NAV=VIEWS.filter(x=>!VHIDE.has(x[0]));
$('tabs').innerHTML=NAV.map(([v,l,ic],i)=>`<button type="button" data-v="${v}" title="${l} (${i+1})">${NVI(ic)}<span>${l}</span></button>`).join('');
/* every section is in the bar; on iPhone portrait it scrolls sideways (about five tabs on screen at once) */
$('bnav').innerHTML=NAV.map(([v,l,ic])=>`<button type="button" data-v="${v}"><i>${NVI(ic)}</i><span>${l}</span></button>`).join('')+'<span class="bnind" id="bnind"></span>';
function bnShow(v,smooth){const b=$('bnav'),nb=b&&b.querySelector(`button[data-v="${v}"]`);if(!nb||b.scrollWidth<=b.clientWidth+2)return;const x=nb.offsetLeft-(b.clientWidth-nb.offsetWidth)/2;b.scrollTo({left:Math.max(0,x),behavior:smooth?'smooth':'auto'})}
let cur=null,goTok=0;
function go(v,fromHash,dirHint){if(typeof inkExitFull==="function")inkExitFull();
  let sub=null;if(typeof v==='string'&&v.includes('/')){const z=v.split('/');v=z[0];sub=z[1]||null}
  if(!VIEWS.some(x=>x[0]===v))v='today';if(v===cur){const NXS=window.NX_SUB||{};if(sub&&NXS[v])NXS[v](sub);return}
  const oi=VIEWS.findIndex(x=>x[0]===cur),ni=VIEWS.findIndex(x=>x[0]===v);const dir=dirHint||(oi<0?0:ni>oi?1:-1);cur=v;
  VIEWS.forEach(([x])=>$('v-'+x).classList.toggle('on',x===v));
  document.querySelectorAll('#tabs button,#bnav button[data-v]').forEach(b=>b.setAttribute('aria-current',b.dataset.v===v?'page':'false'));bnShow(v,true);
  const nb=document.querySelector(`#bnav button[data-v="${v}"]`);if(nb){$('bnind').style.transform=`translateX(${nb.offsetLeft}px)`;$('bnind').style.width=nb.offsetWidth+'px';bnavFit()}
  if(!fromHash&&location.hash!=='#'+v)history.replaceState(null,'','#'+v);
  const view=$('v-'+v);
  const m=$('main');
  if(FX&&m.animate){m.animate([{transform:`translateX(${dir*48}px)`,opacity:.1,filter:'hue-rotate(80deg) contrast(1.6)'},{transform:`translateX(${-dir*6}px)`,opacity:1,filter:'none',offset:.7},{transform:'none',opacity:1}],{duration:380,easing:'cubic-bezier(.2,.9,.1,1)'});m.classList.remove('switching');void m.offsetWidth;m.classList.add('switching')}
  const h=view.querySelector('.banner h2.glitch');if(h&&FX){const node=h.lastChild;scramble({set textContent(t){node.textContent=t}},h.dataset.text,500)}
  const eb=view.querySelector('.bover .eyebrow');if(eb)eb.textContent=new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});
  artMount(v);
  if(v!=='alter'){aLeave();if(typeof aQuiet==='function')aQuiet()}
  if(v==='money'||v==='stack')document.querySelectorAll(`#v-${v} [data-scr]`).forEach(el=>scramble(el,el.dataset.scr,700));
  window.scrollTo(0,0);setTimeout(repaint,420);
  const LOADERS={today:()=>{if(typeof renderTodayTasks==='function')renderTodayTasks();if(typeof renderTodayCal==='function')renderTodayCal()},week:()=>renderWeek(),gym:()=>loadGym(),tools:()=>renderTools(),media:()=>renderMedia(),food:()=>loadFood(),sleep:()=>loadSleep(),journal:()=>setJTab(JTAB),streaks:()=>loadHabits(),alter:()=>loadAlter(),looks:()=>loadLooks(),stack:()=>window.setStackV&&setStackV(LS.get('stackv')||'stack'),goals:()=>typeof renderGoals==='function'&&renderGoals(),career:()=>typeof renderCareer==='function'&&renderCareer()};
  /* a thin progress bar while the page fetches, and the stagger runs once the real content is in (not on stale/empty markup) */
  const tk=++goTok;let p;try{p=LOADERS[v]&&LOADERS[v]()}catch(e){console.error(e);if(typeof nxErr==='function')nxErr(e,v)}
  if(sub)setTimeout(()=>{const NXS=window.NX_SUB||{};try{if(NXS[v])NXS[v](sub)}catch(e){window.nxErr&&nxErr(e,v)}},0);if(window.nxUsageOpen)window.nxUsageOpen(v);
  if(p&&typeof p.then==='function'){const sl=setTimeout(()=>{if(goTok===tk)view.classList.add('loading')},120);
    p.catch(e=>{console.error(e);if(goTok===tk&&LOADERS[v])return new Promise(r=>setTimeout(r,800)).then(()=>LOADERS[v]())}).catch(e=>console.error(e))
     .finally(()=>{clearTimeout(sl);view.classList.remove('loading');if(goTok===tk&&cur===v)staggerIn(view)})}
  else requestAnimationFrame(()=>{if(goTok===tk)staggerIn(view)});
}
$('tabs').onclick=e=>{const b=e.target.closest('button');if(b)go(b.dataset.v)};
/* the tab bar always spans the screen: every tab gets an equal share; labels drop when there isn't room */
function bnavFit(){const b=$('bnav');if(!b||!b.offsetWidth)return;const n=[...b.querySelectorAll('button')].filter(x=>x.offsetWidth).length||VIEWS.length;b.classList.toggle('compact',b.offsetWidth/n<60)}addEventListener('resize',bnavFit);setTimeout(bnavFit,0);
$('bnav').onclick=e=>{const b=e.target.closest('button');if(b){go(b.dataset.v);try{navigator.vibrate&&navigator.vibrate(8)}catch(_){}}};
addEventListener('hashchange',()=>go(location.hash.slice(1),true));
/* section changes only from the nav buttons (no swipe) */
/* sync can fire rebuild several times in a burst: draw once, only if the model really changed, never under a typing cursor, and keep the scroll */
let ravT=null,ravSig='';
function renderAllViews(force){clearTimeout(ravT);ravT=setTimeout(()=>{const a=document.activeElement;
  if(!force&&a&&a!==document.body&&(a.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))){ravT=setTimeout(()=>renderAllViews(),1500);return}
  let sig='';try{sig=DAYK+stab(M)}catch(e){}if(!force&&sig&&sig===ravSig)return;ravSig=sig;
  const y=scrollY;renderToday();renderStack();renderMoney();renderTargets();renderTools();if(Math.abs(scrollY-y)>2)scrollTo(0,y)},force?0:80)}

applyLex();
