/* ================= JOURNAL (typing + Apple Pencil) ================= */
const PAGE_W=1000,PAGE_H=1400;
const MOODS=[...Array(10)].map((_,i)=>[String(i+1),String(i+1)]);
const MOODC=['#ff2a2a','#ff5a1f','#ff8a00','#ffb000','#d9c400','#9fd400','#57e08a','#05d9e8','#3aa8ff','#c77dff'];const moodI=v=>`<i class="mood" style="background:${MOODC[(+v||1)-1]||'#777'}"></i>`;
const PROMPTS=[['woop','WOOP\nWish: \nOutcome: \nObstacle: \nPlan (if…then…): '],['wins','3 wins today\n1. \n2. \n3. '],['grat','Grateful for\n- '],['tmrw','Tomorrow, the one thing that matters: ']];
let JDATE=null,JE=null,JLIST=[],jSaveT=null,jLoaded=false;
const jpath=d=>'journal/e-'+d;
async function loadJournal(){
  if(!JDATE)JDATE=DAYK;
  const rows=await listDocs('journal/e-');JLIST=rows.map(r=>r.data).filter(Boolean).sort((a,b)=>a.date<b.date?1:-1);
  await openEntry(JDATE);jLoaded=true;
}
watchPrefix('journal/e-',(evt,path,data)=>{const d=path.slice(10);JLIST=JLIST.filter(x=>x.date!==d);if(evt!=='DELETE'&&data)JLIST.push(data);JLIST.sort((a,b)=>a.date<b.date?1:-1);
  if(cur==='journal'){renderJList();if(d===JDATE&&data&&!jDirty){JE=data;renderJEditor(true)}}});
let jDirty=false;
async function openEntry(d){JDATE=d;const e=await load(jpath(d));JE=e||{date:d,text:'',mood:null,tags:[],ink:{h:PAGE_H,strokes:[]}};if(!JE.ink)JE.ink={h:PAGE_H,strokes:[]};if(typeof JL!=='undefined')JL.reset();renderJList();renderJEditor()}
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
  $('jWords').textContent=((JE.text||'').trim().match(/\S+/g)||[]).length+' words';
  $('jSaved').textContent=JE.updatedAt?'saved '+ago(JE.updatedAt):'';
  JL.refresh();JL.size();
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
$('jPrompts').onclick=e=>{const b=e.target.closest('[data-pr]');if(!b)return;if(b.dataset.pr==='recap'){jInsertRecap(b);return}const p=PROMPTS.find(x=>x[0]===b.dataset.pr)[1];JE.text=(JE.text?JE.text.replace(/\s*$/,'')+'\n\n':'')+p;renderJEditor();const t=$('jText');t.focus();t.setSelectionRange(t.value.length,t.value.length);saveJ();if(b.dataset.pr==='woop')autoTick(/^WOOP/)};

/* --- handwriting: drawn straight over the typed page (shared layer in 11a) --- */
const JL=inkLayer({host:$('jPage'),canvas:$('jCanvas'),bar:$('jTools'),full:$('jEditor'),paper:false,get:()=>JE&&JE.ink||null,make:()=>{if(!JE.ink)JE.ink={h:IH,strokes:[]};return JE.ink},changed:saveJ});

/* ---- day recap: pull what the app already knows about a day ---- */
async function jRecap(d){
  const L=[],R=n=>Math.round(n||0),K=n=>R(n).toLocaleString('en-GB');
  const P=(l,v)=>L.push(l.padEnd(8)+v),S=v=>L.push(' '.repeat(8)+v);
  const cut=(x,n)=>{x=String(x||'').trim();return x.length>n?x.slice(0,n-1)+'…':x};
  const hm=x=>x?Math.floor(x/60)+'h'+String(x%60).padStart(2,'0'):'';
  try{
    const f=await load('food/d-'+d);
    if(f&&f.m){const ML=[['b','breakfast'],['l','lunch'],['d','dinner'],['s','snacks']];
      const all=ML.reduce((a,[k])=>a.concat(f.m[k]||[]),[]);
      if(all.length){const t=typeof fSum==='function'?fSum(all):null;
        P('food',t?K(t.kcal)+' kcal · P'+R(t.p)+' C'+R(t.c)+' F'+R(t.f):all.length+' items');
        ML.forEach(([k,lab])=>{const its=(f.m[k]||[]).map(x=>cut(x.n,26)).filter(Boolean);if(!its.length)return;
          const c={};its.forEach(n=>c[n]=(c[n]||0)+1);
          S(lab+' · '+Object.entries(c).map(([n,q])=>q>1?n+' ×'+q:n).join(', '))})}
      const ex=(f.ex||[]).reduce((n,e)=>n+(+e.k||0),0);if(ex)P('burn',K(ex)+' kcal');
      if(f.w)P('weight',f.w+' kg')}
  }catch(e){}
  try{
    const s2=await load('sleep/w-'+d);
    if(s2&&(s2.asleep||s2.start)){
      P('sleep',[hm(s2.asleep)||'logged',s2.deep&&'deep '+hm(s2.deep),s2.rem&&'REM '+hm(s2.rem)].filter(Boolean).join(' · '));
      if(s2.mood)S('felt '+s2.mood+'/5')}
  }catch(e){}
  try{
    let ws=(typeof WORKOUTS!=='undefined'&&WORKOUTS.length)?WORKOUTS:(await listDocs('gym/w-')).map(r=>r.data).filter(Boolean);
    ws.filter(w=>w&&w.date===d).forEach(w=>{
      const st=(w.nsets!=null)?{vol:w.vol,n:w.nsets}:(typeof stats==='function'?stats(w):{vol:0,n:0});
      P('gym',[w.name||'session',(st.n||0)+' sets',st.vol&&K(st.vol)+' kg vol'].filter(Boolean).join(' · '));
      (w.ex||[]).forEach(x=>{const ds=(x.sets||[]).filter(s3=>s3.done!==false&&s3.t!=='w');if(!ds.length)return;
        const b=ds.slice().sort((a,c)=>((+c.kg||0)*(+c.r||0))-((+a.kg||0)*(+a.r||0)))[0];
        S(cut(x.n,24)+' · '+ds.length+'×'+[(+b.kg)&&b.kg+'kg',(+b.r)&&b.r].filter(Boolean).join('×'))});
      (w.prs||[]).forEach(x=>S('PR '+(typeof x==='string'?x:(x.n||'')+' '+(x.kg||'')+'kg×'+(x.r||''))))})
  }catch(e){}
  try{
    const t=await load('tasks/all');const done=((t&&t.list)||[]).filter(x=>x.done&&String(x.done).slice(0,10)===d);
    if(done.length){P('tasks',done.length+' done');done.forEach(x=>S('✓ '+cut(x.t,34)))}
  }catch(e){}
  try{
    const hl=await load('habits/log'),hx=await load('habits/list');
    const day=(hl&&hl.d&&hl.d[d])||{};
    const nm={};const HL=(hx&&hx.list)||(Array.isArray(hx)?hx:[]);HL.forEach(h=>{nm[h.id]=h.n||h.name});
    const hit=Object.keys(day).filter(k=>day[k]).map(k=>nm[k]||k);
    if(hit.length){P('habits',hit.length+' hit');S(hit.join(', '))}
  }catch(e){}
  return L.length?L.join('\n'):'nothing logged in the app for this day yet.'}
async function jInsertRecap(btn){
  if(btn){btn.disabled=true;btn.textContent='reading…'}
  let txt='';try{txt=await jRecap(JDATE)}catch(e){txt='could not read the day.'}
  if(btn){btn.disabled=false;btn.textContent='day recap'}
  const head='── recap · '+nice(JDATE).toLowerCase()+' ──\n';
  JE.text=(JE.text?JE.text.replace(/\s*$/,'')+'\n\n':'')+head+txt+'\n────\n\n';
  renderJEditor();
  const t=$('jText');t.focus();t.setSelectionRange(t.value.length,t.value.length);saveJ()}
