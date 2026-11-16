/* ================= PALETTE + KEYS ================= */
let palItems=[],palSel=0;
function palIndex(){
  const a=VIEWS.map(([v])=>({l:'/'+v,s:'view',run:()=>go(v)}));
  a.push({l:'edit mode',s:EDIT?'on':'off',run:()=>setEdit(!EDIT)},{l:'add '+LW('item','item'),s:'stack',run:()=>{go('stack');addStack()}},{l:'add bill',s:'money',run:()=>{go('money');addExp()}},{l:'log blood pressure',s:'body',run:()=>{go('today');setTimeout(()=>{$('bodyCheck').scrollIntoView({behavior:'smooth',block:'center'});$('bpS').focus()},300)}},{l:'log weight',s:'body',run:()=>{go('today');setTimeout(()=>{$('bodyCheck').scrollIntoView({behavior:'smooth',block:'center'});$('wtIn').focus()},300)}},{l:'start focus timer',s:'tools',run:()=>{TOOLV='focus';go('tools');renderTools();setTimeout(()=>{if(!TM.end&&$('tmGo'))$('tmGo').click()},200)}},{l:'write in journal',s:'journal',run:()=>{go('journal')}},{l:'start workout',s:'gym',run:()=>{go('gym');if(!ACTIVE)startWorkout(null)}},{l:'boot video',s:'settings',run:openBootVideo},{l:'focus timer',s:'tools',run:()=>{TOOLV='focus';go('tools');renderTools()}},{l:'log a dose',s:'protocols',run:()=>{TOOLV='protocols';go('tools');renderTools()}},{l:'log a leetcode problem',s:'leetcode',run:()=>{TOOLV='leetcode';go('tools');renderTools();setTimeout(()=>pickProblem(s=>openProblem(s,true)),300)}},{l:'sign out',s:'account',run:signOut});
  visibleItems().forEach(i=>a.push({l:i.item,s:(i.time||'')+' · today',run:()=>{go('today');const el=document.querySelector(`#v-today [data-k="${CSS.escape(i.tk)}"]`);if(el){el.closest('.blk').classList.add('open');el.scrollIntoView({block:'center',behavior:FX?'smooth':'auto'});el.focus();FX&&el.animate([{background:'rgba(255,42,109,.4)'},{background:'transparent'}],{duration:1200})}}}));
  M.stack.forEach(s=>a.push({l:s.name,s:'stack · '+STATUSL[s.status],run:()=>{go('stack');openDrawer(s.key)}}));
  M.expenses.forEach(e=>a.push({l:e.name,s:'money · '+(e.m?gbp(e.m,2):'—'),run:()=>{go('money');billCat=e.cat;renderMoney()}}));
  return a;
}
function openPal(){$('pal').classList.add('on');$('palIn').value='';palSel=0;drawPal();$('palIn').focus()}
function closePal(){$('pal').classList.remove('on')}
function drawPal(){const q=norm($('palIn').value);const all=palIndex();palItems=(q?all.filter(x=>norm(x.l).includes(q)||norm(x.s).includes(q)):all.slice(0,14)).slice(0,40);palSel=Math.min(palSel,Math.max(0,palItems.length-1));
  $('palList').innerHTML=palItems.map((x,i)=>`<li class="${i===palSel?'sel':''}" data-i="${i}"><span>${esc(x.l)}</span><span class="dim">${esc(x.s)}</span></li>`).join('')||'<li class="dim">nothing found</li>'}
$('palIn').oninput=()=>{palSel=0;drawPal()};
$('palList').onclick=e=>{const li=e.target.closest('li[data-i]');if(li){closePal();palItems[+li.dataset.i].run()}};
$('pal').onclick=e=>{if(e.target===$('pal'))closePal()};
addEventListener('keydown',e=>{
  const _ae=document.activeElement||document.body;
  const typing=/INPUT|TEXTAREA|SELECT/.test(_ae.tagName)||_ae.isContentEditable===true;
  if($('pal').classList.contains('on')){if(e.key==='Escape')closePal();else if(e.key==='ArrowDown'){palSel=Math.min(palSel+1,palItems.length-1);drawPal();e.preventDefault()}else if(e.key==='ArrowUp'){palSel=Math.max(palSel-1,0);drawPal();e.preventDefault()}else if(e.key==='Enter'&&palItems[palSel]){closePal();palItems[palSel].run()}return}
  if($('modal').classList.contains('on')){if(e.key==='Escape')closeModal();return}
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openPal();return}
  if(e.key==='Escape'){closeDrawer();closeSheet();if(typing)document.activeElement.blur();return}
  if(typing||e.metaKey||e.ctrlKey||e.altKey)return;
  if(/^[1-8]$/.test(e.key)){go(VIEWS[+e.key-1][0]);return}
  if(e.key==='/'){e.preventDefault();openPal();return}
  if(e.key==='f'){$('fxBtn').click();return}
  if(e.key==='e'){setEdit(!EDIT);return}
  if(cur!=='today')return;
  if(e.key==='n'){const c=document.querySelector('#blocks .blk.cur')||document.querySelector('#blocks .blk');if(c){openBlock(+c.dataset.b,true);const ni=c.querySelector('.it.nowit')||c.querySelector('.it[aria-checked="false"]');ni&&ni.focus({preventScroll:true})}return}
  if(e.key==='j'||e.key==='k'){const its=[...document.querySelectorAll('#v-today .blk.open .it')].filter(x=>x.offsetParent);if(!its.length)return;let i=its.indexOf(document.activeElement);i=e.key==='j'?Math.min(i+1,its.length-1):Math.max(i-1,0);its[i].focus();its[i].scrollIntoView({block:'nearest'});e.preventDefault();return}
  if(e.key==='x'&&document.activeElement.classList.contains('it')){toggle(document.activeElement);return}
});

document.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('#promptBtn'))openPal()});
