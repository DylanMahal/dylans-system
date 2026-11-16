/* ================= JOURNAL (typing + Apple Pencil) ================= */
const PAGE_W=1000,PAGE_H=1400;
const MOODS=[...Array(10)].map((_,i)=>[String(i+1),String(i+1)]);
const MOODC=['#ff2a2a','#ff5a1f','#ff8a00','#ffb000','#d9c400','#9fd400','#57e08a','#05d9e8','#3aa8ff','#c77dff'];const moodI=v=>`<i class="mood" style="background:${MOODC[(+v||1)-1]||'#777'}"></i>`;
const PROMPTS=[['woop','WOOP\nWish: \nOutcome: \nObstacle: \nPlan (if…then…): '],['wins','3 wins today\n1. \n2. \n3. '],['grat','Grateful for\n- '],['tmrw','Tomorrow, the one thing that matters: ']];
let JDATE=null,JE=null,JLIST=[],jmode=LS.get('jmode')||'type',jtool='pen',jcolor='#e6e6e6',jwidth=4,pencilOnly=LS.get('pencilOnly')||false,jundo=[],jredo=[],jSaveT=null,jLoaded=false;
const jpath=d=>'journal/e-'+d;
async function loadJournal(){
  if(!JDATE)JDATE=DAYK;
  const rows=await listDocs('journal/e-');JLIST=rows.map(r=>r.data).filter(Boolean).sort((a,b)=>a.date<b.date?1:-1);
  await openEntry(JDATE);jLoaded=true;
}
watchPrefix('journal/e-',(evt,path,data)=>{const d=path.slice(10);JLIST=JLIST.filter(x=>x.date!==d);if(evt!=='DELETE'&&data)JLIST.push(data);JLIST.sort((a,b)=>a.date<b.date?1:-1);
  if(cur==='journal'){renderJList();if(d===JDATE&&data&&!jDirty){JE=data;renderJEditor(true)}}});
let jDirty=false;
async function openEntry(d){JDATE=d;const e=await load(jpath(d));JE=e||{date:d,text:'',mood:null,tags:[],ink:{h:PAGE_H,strokes:[]}};if(!JE.ink)JE.ink={h:PAGE_H,strokes:[]};jundo=[];jredo=[];renderJList();renderJEditor()}
function saveJ(){jDirty=true;clearTimeout(jSaveT);$('jSaved').textContent='…';jSaveT=setTimeout(()=>{JE.updatedAt=new Date().toISOString();const empty=!JE.text&&!JE.mood&&!(JE.tags||[]).length&&!JE.ink.strokes.length;
  if(empty)removeDoc(jpath(JE.date));else save(jpath(JE.date),JE,true);
  JLIST=JLIST.filter(x=>x.date!==JE.date);if(!empty)JLIST.push(clone(JE));JLIST.sort((a,b)=>a.date<b.date?1:-1);renderJList();$('jSaved').textContent='saved';jDirty=false},700)}
function renderJList(){
  const q=norm($('jQ').value);
  const days=new Set(JLIST.map(e=>e.date));
  const items=JLIST.filter(e=>!q||norm(e.text).includes(q)||(e.tags||[]).some(t=>norm(t).includes(q)));
  $('jList').innerHTML=(days.has(DAYK)||q?'':`<button type="button" class="jitem${JDATE===DAYK?' on':''}" data-jd="${DAYK}"><span class="jd">${esc(nice(DAYK).toLowerCase())}</span><span class="dim">today · not written yet</span></button>`)+
    items.map(e=>`<button type="button" class="jitem${e.date===JDATE?' on':''}" data-jd="${e.date}"><span class="jd">${esc(nice(e.date).toLowerCase())}${e.mood?`${moodI(e.mood)}`:''}${e.ink&&e.ink.strokes&&e.ink.strokes.length?'<span class="dim"> ✎</span>':''}</span><span class="dim jprev">${esc((e.text||'').split('\n').find(l=>l.trim())||(e.ink&&e.ink.strokes.length?'handwritten':''))}</span>${(e.tags||[]).length?`<span class="jtags">${e.tags.map(t=>'#'+esc(t)).join(' ')}</span>`:''}</button>`).join('')||'<div class="dim" style="font-size:12px;padding:8px">Nothing found.</div>';
  const streak=(()=>{let n=0;const d=new Date(logical());for(;;){if(days.has(ymd(d))){n++;d.setDate(d.getDate()-1)}else if(ymd(d)===DAYK){d.setDate(d.getDate()-1)}else break}return n})();
  $('jStreak').textContent=`${JLIST.length} entries · ${streak} day streak`;
}
$('jQ').oninput=renderJList;
$('jList').onclick=e=>{const b=e.target.closest('[data-jd]');if(b){flushJ();openEntry(b.dataset.jd);if(innerWidth<900)$('jEditor').scrollIntoView({behavior:FX?'smooth':'auto'})}};
function flushJ(){if(jSaveT){clearTimeout(jSaveT);jSaveT=null;JE.updatedAt=new Date().toISOString();save(jpath(JE.date),JE,true);jDirty=false}}
function renderJEditor(keepScroll){
  $('jDate').textContent=new Date(JDATE+'T12:00').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'}).toLowerCase();
  $('jMood').innerHTML=MOODS.map(([v,l])=>`<button type="button" data-mood="${v}" aria-pressed="${String(JE.mood)===v}" title="${l}">${moodI(v)}<span>${l}</span></button>`).join('');
  $('jTags').innerHTML=(JE.tags||[]).map((t,i)=>`<span class="jtag">#${esc(t)}<button type="button" data-rmtag="${i}" aria-label="Remove tag">✕</button></span>`).join('')+`<input class="jtagin" id="jTagIn" placeholder="+ tag" aria-label="Add tag">`;
  $('jText').value=JE.text||'';autoGrow();
  $('jModeSeg').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.jm===jmode));
  $('jTypePane').hidden=jmode!=='type';$('jInkPane').hidden=jmode!=='ink';
  $('jWords').textContent=((JE.text||'').trim().match(/\S+/g)||[]).length+' words';
  $('jPencil').setAttribute('aria-pressed',pencilOnly);$('jCanvasWrap').classList.toggle('pencil',pencilOnly);
  $('jTools').querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.tool===jtool));
  $('jTools').querySelectorAll('[data-col]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.col===jcolor));
  $('jSaved').textContent=JE.updatedAt?'saved '+ago(JE.updatedAt):'';
  if(jmode==='ink')sizeInk();
}
$('jPrev').onclick=()=>{flushJ();openEntry(addDays(JDATE,-1))};
$('jNext').onclick=()=>{flushJ();openEntry(addDays(JDATE,1))};
$('jToday').onclick=()=>{flushJ();openEntry(DAYK)};
$('jMood').onclick=e=>{const b=e.target.closest('[data-mood]');if(!b)return;JE.mood=JE.mood===+b.dataset.mood?null:+b.dataset.mood;saveJ();renderJEditor();burstEl(b,18)};
$('jTags').onclick=e=>{const b=e.target.closest('[data-rmtag]');if(b){JE.tags.splice(+b.dataset.rmtag,1);saveJ();renderJEditor()}};
$('jTags').onkeydown=e=>{if(e.target.id!=='jTagIn')return;if(e.key==='Enter'||e.key===','){e.preventDefault();const v=e.target.value.trim().replace(/^#/,'');if(v){JE.tags=[...(JE.tags||[]),v];saveJ();renderJEditor();$('jTagIn').focus()}}};
function autoGrow(){const t=$('jText');t.style.height='auto';t.style.height=Math.max(260,t.scrollHeight)+'px'}
$('jText').oninput=()=>{JE.text=$('jText').value;autoGrow();$('jWords').textContent=((JE.text||'').trim().match(/\S+/g)||[]).length+' words';saveJ()};
$('jPrompts').innerHTML=`<button class="chip pr" type="button" data-pr="recap">day recap</button>`+PROMPTS.map(([k])=>`<button class="chip" type="button" data-pr="${k}">${k==='woop'?'WOOP':k==='wins'?'3 wins':k==='grat'?'grateful for':'tomorrow'}</button>`).join('');
$('jPrompts').onclick=e=>{const b=e.target.closest('[data-pr]');if(!b)return;if(b.dataset.pr==='recap'){jInsertRecap(b);return}const p=PROMPTS.find(x=>x[0]===b.dataset.pr)[1];JE.text=(JE.text?JE.text.replace(/\s*$/,'')+'\n\n':'')+p;jmode='type';LS.set('jmode',jmode);renderJEditor();const t=$('jText');t.focus();t.setSelectionRange(t.value.length,t.value.length);saveJ();if(b.dataset.pr==='woop')autoTick(/^WOOP/)};
$('jModeSeg').onclick=e=>{const b=e.target.closest('[data-jm]');if(!b)return;jmode=b.dataset.jm;LS.set('jmode',jmode);renderJEditor();glitchAll()};

/* --- handwriting canvas --- */
const jc=$('jCanvas'),jx=jc.getContext('2d');let jscale=1,drawing=null;
function sizeInk(){const w=$('jCanvasWrap').clientWidth||600;jscale=w/PAGE_W;const h=(JE.ink.h||PAGE_H)*jscale;const r=devicePixelRatio||1;jc.width=Math.round(w*r);jc.height=Math.round(h*r);jc.style.width=w+'px';jc.style.height=h+'px';jx.setTransform(r*jscale,0,0,r*jscale,0,0);redrawInk()}
function redrawInk(){jx.save();jx.setTransform(1,0,0,1,0,0);jx.clearRect(0,0,jc.width,jc.height);jx.restore();
  // ruled lines
  jx.strokeStyle='rgba(255,255,255,.06)';jx.lineWidth=1/jscale;for(let y=80;y<(JE.ink.h||PAGE_H);y+=56){jx.beginPath();jx.moveTo(40,y);jx.lineTo(PAGE_W-40,y);jx.stroke()}
  jx.strokeStyle='rgba(255,42,109,.18)';for(let y=PAGE_H;y<(JE.ink.h||PAGE_H);y+=PAGE_H){jx.setLineDash([8,8]);jx.beginPath();jx.moveTo(0,y);jx.lineTo(PAGE_W,y);jx.stroke();jx.setLineDash([])}
  JE.ink.strokes.forEach(drawStroke)}
function drawStroke(s){const p=s.pts;if(p.length<3)return;jx.save();jx.lineCap='round';jx.lineJoin='round';jx.strokeStyle=s.c;
  if(s.t==='hl'){jx.globalAlpha=.32;jx.lineWidth=s.w*4;jx.beginPath();jx.moveTo(p[0],p[1]);for(let i=3;i<p.length;i+=3)jx.lineTo(p[i],p[i+1]);jx.stroke();jx.restore();return}
  for(let i=3;i<p.length;i+=3){const pr=(p[i+2]+p[i-1])/2;jx.lineWidth=Math.max(.6,s.w*(.35+pr*1.1));jx.beginPath();
    const mx0=i>=6?(p[i-6]+p[i-3])/2:p[i-3],my0=i>=6?(p[i-5]+p[i-2])/2:p[i-2];const mx1=(p[i-3]+p[i])/2,my1=(p[i-2]+p[i+1])/2;
    jx.moveTo(mx0,my0);jx.quadraticCurveTo(p[i-3],p[i-2],mx1,my1);jx.stroke()}
  if(p.length===3){jx.fillStyle=s.c;jx.beginPath();jx.arc(p[0],p[1],s.w/2,0,7);jx.fill()}jx.restore()}
function ptOf(e){const r=jc.getBoundingClientRect();return [Math.round((e.clientX-r.left)/jscale*10)/10,Math.round((e.clientY-r.top)/jscale*10)/10,Math.round((e.pointerType==='mouse'?.5:(e.pressure||.5))*100)/100]}
jc.addEventListener('pointerdown',e=>{
  if(e.pointerType==='pen'&&!pencilOnly){pencilOnly=true;LS.set('pencilOnly',true);$('jPencil').setAttribute('aria-pressed',true);$('jCanvasWrap').classList.add('pencil')}
  if(pencilOnly&&e.pointerType==='touch')return;
  e.preventDefault();jc.setPointerCapture(e.pointerId);
  if(jtool==='eraser'){drawing={erase:true};eraseAt(ptOf(e));return}
  drawing={c:jcolor,w:jtool==='hl'?jwidth*1.5:jwidth,t:jtool==='hl'?'hl':'pen',pts:ptOf(e)};
});
jc.addEventListener('pointermove',e=>{if(!drawing)return;if(pencilOnly&&e.pointerType==='touch')return;e.preventDefault();
  let evs=e.getCoalescedEvents?e.getCoalescedEvents():[];if(!evs.length)evs=[e];
  for(const ev of evs){const p=ptOf(ev);if(drawing.erase){eraseAt(p);continue}const n=drawing.pts.length;if(Math.hypot(p[0]-drawing.pts[n-3],p[1]-drawing.pts[n-2])<1.2)continue;drawing.pts.push(...p);
    const s={...drawing,pts:drawing.pts.slice(-9)};drawStroke(s)}
  // grow the page as you write near the bottom
  if(!drawing.erase){const y=drawing.pts[drawing.pts.length-2];if(y>(JE.ink.h||PAGE_H)-120){JE.ink.h=(JE.ink.h||PAGE_H)+PAGE_H;sizeInk()}}
});
function endStroke(){if(!drawing)return;if(!drawing.erase){JE.ink.strokes.push(drawing);jundo.push({add:drawing});jredo=[]}drawing=null;redrawInk();saveJ()}
jc.addEventListener('pointerup',endStroke);jc.addEventListener('pointercancel',endStroke);
function eraseAt(p){const r=14;const before=JE.ink.strokes.length;const keep=[];JE.ink.strokes.forEach(s=>{let hit=false;for(let i=0;i<s.pts.length;i+=3){if(Math.hypot(s.pts[i]-p[0],s.pts[i+1]-p[1])<r+s.w){hit=true;break}}if(hit)jundo.push({del:s});else keep.push(s)});if(keep.length!==before){JE.ink.strokes=keep;redrawInk()}}
$('jTools').onclick=e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.tool){jtool=b.dataset.tool;renderJEditor();return}
  if(b.dataset.col){jcolor=b.dataset.col;if(jtool==='eraser')jtool='pen';renderJEditor();return}
  if(b.id==='jUndo'){const u=jundo.pop();if(!u)return;if(u.add)JE.ink.strokes=JE.ink.strokes.filter(s=>s!==u.add);if(u.del)JE.ink.strokes.push(u.del);jredo.push(u);redrawInk();saveJ();return}
  if(b.id==='jRedo'){const u=jredo.pop();if(!u)return;if(u.add)JE.ink.strokes.push(u.add);if(u.del)JE.ink.strokes=JE.ink.strokes.filter(s=>s!==u.del);jundo.push(u);redrawInk();saveJ();return}
  if(b.id==='jPage'){JE.ink.h=(JE.ink.h||PAGE_H)+PAGE_H;sizeInk();saveJ();return}
  if(b.id==='jClear'){if(b.dataset.arm){jundo.push(...JE.ink.strokes.map(s=>({del:s})));JE.ink.strokes=[];JE.ink.h=PAGE_H;sizeInk();saveJ();delete b.dataset.arm;b.textContent='clear'}else{b.dataset.arm=1;b.textContent='tap again';setTimeout(()=>{delete b.dataset.arm;b.textContent='clear'},2500)}return}
  if(b.id==='jPencil'){pencilOnly=!pencilOnly;LS.set('pencilOnly',pencilOnly);renderJEditor();return}
};
$('jWidth').oninput=e=>{jwidth=+e.target.value};
addEventListener('resize',()=>{if(cur==='journal'&&jmode==='ink')sizeInk()});

/* ---- day recap: pull what the app already knows about a day ---- */
async function jRecap(d){
  const L=[];const R=n=>Math.round(n||0);
  try{
    const f=await load('food/d-'+d);
    if(f&&f.m){const all=['b','l','d','s'].reduce((a,k)=>a.concat(f.m[k]||[]),[]);
      if(all.length){const t=typeof fSum==='function'?fSum(all):null;
        L.push('food · '+all.length+' item'+(all.length===1?'':'s')+(t?' · '+R(t.kcal)+' kcal · '+R(t.p)+'p '+R(t.c)+'c '+R(t.f)+'f':''));
        L.push('  '+all.map(x=>x.n).filter(Boolean).join(', '))}
      const ex=(f.ex||[]).reduce((n,e)=>n+(+e.k||0),0);if(ex)L.push('exercise burn · '+R(ex)+' kcal');
      if(f.w)L.push('weight · '+f.w+' kg')}
  }catch(e){}
  try{
    const s2=await load('sleep/w-'+d);
    if(s2&&(s2.asleep||s2.start)){const h=x=>x?Math.floor(x/60)+'h '+String(x%60).padStart(2,'0')+'m':'';
      L.push('sleep · '+(h(s2.asleep)||'logged')+(s2.deep?' · deep '+h(s2.deep):'')+(s2.rem?' · rem '+h(s2.rem):'')+(s2.mood?' · felt '+s2.mood+'/5':''))}
  }catch(e){}
  try{
    let ws=(typeof WORKOUTS!=='undefined'&&WORKOUTS.length)?WORKOUTS:(await listDocs('gym/w-')).map(r=>r.data).filter(Boolean);
    ws.filter(w=>w&&w.date===d).forEach(w=>{
      const st=(w.nsets!=null)?{vol:w.vol,n:w.nsets}:(typeof stats==='function'?stats(w):{vol:0,n:0});
      L.push('gym · '+(w.name||'session')+' · '+(st.n||0)+' sets'+(st.vol?' · '+R(st.vol)+' kg volume':''));
      const lines=(w.ex||[]).map(x=>{const ds=(x.sets||[]).filter(s3=>s3.done!==false&&s3.t!=='w');if(!ds.length)return '';
        const b=ds.slice().sort((a,c)=>((+c.kg||0)*(+c.r||0))-((+a.kg||0)*(+a.r||0)))[0];
        return x.n+' '+ds.length+'×'+((+b.kg)?b.kg+'kg':'')+((+b.r)?' × '+b.r:'')}).filter(Boolean);
      if(lines.length)L.push('  '+lines.join(' · '));
      if((w.prs||[]).length)L.push('  PRs · '+w.prs.map(x=>typeof x==='string'?x:(x.n||'')+' '+(x.kg||'')+'kg×'+(x.r||'')).join(', '))})
  }catch(e){}
  try{
    const t=await load('tasks/all');const done=((t&&t.list)||[]).filter(x=>x.done&&String(x.done).slice(0,10)===d);
    if(done.length)L.push('tasks done · '+done.map(x=>x.t).join(', '))
  }catch(e){}
  try{
    const hl=await load('habits/log'),hx=await load('habits/list');
    const day=(hl&&hl.d&&hl.d[d])||{};
    const nm={};const HL=(hx&&hx.list)||(Array.isArray(hx)?hx:[]);HL.forEach(h=>{nm[h.id]=h.n||h.name});
    const hit=Object.keys(day).filter(k=>day[k]).map(k=>nm[k]||k);
    if(hit.length)L.push('habits · '+hit.join(', '))
  }catch(e){}
  return L.length?L.join('\n'):'nothing logged in the app for this day yet.'}
async function jInsertRecap(btn){
  if(btn){btn.disabled=true;btn.textContent='reading…'}
  let txt='';try{txt=await jRecap(JDATE)}catch(e){txt='could not read the day.'}
  if(btn){btn.disabled=false;btn.textContent='day recap'}
  const head='— '+nice(JDATE).toLowerCase()+' · from the app —\n';
  JE.text=(JE.text?JE.text.replace(/\s*$/,'')+'\n\n':'')+head+txt+'\n\n';
  jmode='type';LS.set('jmode',jmode);renderJEditor();
  const t=$('jText');t.focus();t.setSelectionRange(t.value.length,t.value.length);saveJ()}
