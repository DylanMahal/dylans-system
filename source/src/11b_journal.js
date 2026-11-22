/* ================= JOURNAL (typing + Apple Pencil) ================= */
const PAGE_W=1000,PAGE_H=1400;
const MOODS=[...Array(10)].map((_,i)=>[String(i+1),String(i+1)]);
const MOODC=['#f50a0a','#f52d0a','#f5510a','#f5740a','#f5970a','#f5be0a','#edf50a','#9ff50a','#49f50a','#09e126'];const moodI=v=>`<i class="mood" style="background:${MOODC[(+v||1)-1]||'#777'}"></i>`;
const PROMPTS=[['grat','Gratitude',"3 good things today, and why they happened\n1. \n   why: \n2. \n   why: \n3. \n   why: "],['review','Review',"Review\nWhat went well: \nWhat didn't: \nWhat I learned: \nWhat I'll do differently: "],['unload','Unload',"Unload: what's on my mind, and how I honestly feel about it\n"],['tmrw','Tomorrow',"Tomorrow\nThe one thing that matters: \nWhen and where I'll do it: \nIf ___ gets in the way, then I'll: \nEverything else to remember:\n- "]];
const JPI={recap:'<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',grat:'<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',review:'<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/><path d="M12 8v4l3 2"/>',unload:'<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>',tmrw:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'};
const jpBtn=(k,l,c)=>`<button class="jpb${c?' '+c:''}" type="button" data-pr="${k}"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${JPI[k]}</svg><span>${l}</span></button>`;
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
const jEmpty=e=>!String(e.text||'').trim()&&!e.mood&&!(e.tags||[]).length&&!((e.ink&&e.ink.strokes)||[]).some(k=>k&&(k.tool||k.t)!=='eraser'&&(k.pts||k.p||k.points||[1]).length);
function saveJ(){jDirty=true;clearTimeout(jSaveT);$('jSaved').textContent='…';jSaveT=setTimeout(()=>{JE.updatedAt=new Date().toISOString();const empty=jEmpty(JE);
  if(empty)removeDoc(jpath(JE.date));else save(jpath(JE.date),JE,true);
  JLIST=JLIST.filter(x=>x.date!==JE.date);if(!empty)JLIST.push(clone(JE));JLIST.sort((a,b)=>a.date<b.date?1:-1);renderJList();$('jSaved').textContent='saved';jDirty=false},700)}
function renderJList(){
  const q=norm($('jQ').value);
  const days=new Set(JLIST.map(e=>e.date));
  const items=JLIST.filter(e=>!q||norm(e.text).includes(q)||(e.tags||[]).some(t=>norm(t).includes(q)));
  $('jList').innerHTML=(days.has(DAYK)||q?'':`<button type="button" class="jitem${JDATE===DAYK?' on':''}" data-jd="${DAYK}"><span class="jd">${esc(nice(DAYK))}</span></button>`)+
    items.map(e=>`<button type="button" class="jitem${e.date===JDATE?' on':''}" data-jd="${e.date}"><span class="jd">${esc(nice(e.date))}${e.mood?`${moodI(e.mood)}`:''}${e.ink&&e.ink.strokes&&e.ink.strokes.length?'<span class="dim"> ✎</span>':''}</span></button>`).join('')||'<div class="dim" style="font-size:12px;padding:8px">Nothing found.</div>';
  const streak=(()=>{let n=0;const d=new Date(logical());for(;;){if(days.has(ymd(d))){n++;d.setDate(d.getDate()-1)}else if(ymd(d)===DAYK){d.setDate(d.getDate()-1)}else break}return n})();
  $('jStreak').textContent=`${JLIST.length} entries · ${streak} day streak`;
}
$('jQ').oninput=renderJList;
$('jList').onclick=e=>{const b=e.target.closest('[data-jd]');if(b){flushJ();openEntry(b.dataset.jd);if(innerWidth<900)$('jEditor').scrollIntoView({behavior:FX?'smooth':'auto'})}};
function flushJ(){if(jSaveT){clearTimeout(jSaveT);jSaveT=null;JE.updatedAt=new Date().toISOString();save(jpath(JE.date),JE,true);jDirty=false}}
function renderJEditor(keepScroll){
  $('jDate').textContent=new Date(JDATE+'T12:00').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});
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
$('jPrompts').innerHTML=jpBtn('recap','Day recap','pr')+PROMPTS.map(([k,l])=>jpBtn(k,l)).join('');
$('jDel').onclick=function(){if(!this.dataset.arm){this.dataset.arm=1;this.classList.add('arm');this.insertAdjacentHTML('beforeend','<span>Delete?</span>');clearTimeout(this._t);this._t=setTimeout(()=>{delete this.dataset.arm;this.classList.remove('arm');const x=this.querySelector('span');x&&x.remove()},3000);return}
  clearTimeout(this._t);clearTimeout(jSaveT);delete this.dataset.arm;this.classList.remove('arm');const x=this.querySelector('span');x&&x.remove();
  const d=JDATE;removeDoc(jpath(d));JLIST=JLIST.filter(e=>e.date!==d);JE={date:d,text:'',mood:null,tags:[],ink:{h:PAGE_H,strokes:[]}};if(typeof JL!=='undefined')JL.reset();renderJList();renderJEditor();$('jSaved').textContent='deleted'};
$('jPrompts').onclick=e=>{const b=e.target.closest('[data-pr]');if(!b)return;if(b.dataset.pr==='recap'){jInsertRecap(b);return}const p=PROMPTS.find(x=>x[0]===b.dataset.pr)[2];JE.text=(JE.text?JE.text.replace(/\s*$/,'')+'\n\n':'')+p;renderJEditor();const t=$('jText');t.focus();t.setSelectionRange(t.value.length,t.value.length);saveJ()};

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
  try{
    const dd=d===DAYK&&typeof DAY!=='undefined'?DAY:await load('days/d-'+d);
    if(dd&&dd.total){P('plan',dd.done+'/'+dd.total+' ticked · '+R(dd.done/dd.total*100)+'%');if(dd.water)S('water · '+dd.water)}
  }catch(e){}
  try{
    const fo=await load('tools/focus');const fs=((fo&&fo.sessions)||[]).filter(x=>x.d===d);
    if(fs.length){P('focus',hm(fs.reduce((a,x)=>a+(+x.min||0),0))+' deep work · '+fs.length+' block'+(fs.length>1?'s':''));
      const tk=[...new Set(fs.map(x=>cut(x.task,30)).filter(Boolean))];if(tk.length)S(tk.join(', '))}
  }catch(e){}
  try{
    const bk=d===DAYK&&typeof BRICK!=='undefined'&&brickLoaded?BRICK:await load('tools/brick');const bs=((bk&&bk.sessions)||[]).filter(x=>x.d===d);
    if(bs.length){const br=bs.filter(x=>x.broke).length;P('brick',hm(bs.reduce((a,x)=>a+(+x.min||0),0))+' phone-free · '+bs.length+' session'+(bs.length>1?'s':'')+(br?' · '+br+' ended early':''))}
  }catch(e){}
  try{
    const h=await load('health/d-'+d)||{};
    if(h.screentime!=null)P('screen',hm(R(h.screentime/60))+' screen time');
    const hv=[h.hrv&&'HRV '+R(h.hrv)+' ms',h.rhr&&'RHR '+R(h.rhr),h.kcal&&K(h.kcal)+' active kcal',h.steps&&K(h.steps)+' steps'].filter(Boolean);
    if(hv.length)P('body',hv.join(' · '));
    if(typeof sRec==='function'&&typeof sleepLoaded!=='undefined'&&sleepLoaded){const rc=sRec(d);if(rc)S('recovery '+rc.v+'%')}
  }catch(e){}
  try{
    if(!L.some(x=>x.startsWith('weight'))){const wt=await load('body/wt');const w=((wt&&wt.r)||[]).filter(x=>String(x.t).slice(0,10)===d).pop();if(w)P('weight',w.kg+' kg')}
  }catch(e){}
  return L.length?L.join('\n'):'nothing logged in the app for this day yet.'}
async function jInsertRecap(btn){
  if(btn){btn.disabled=true;btn.classList.add('busy')}
  let txt='';try{txt=await jRecap(JDATE)}catch(e){txt='could not read the day.'}
  if(btn){btn.disabled=false;btn.classList.remove('busy')}
  const head='── recap · '+nice(JDATE).toLowerCase()+' ──\n';
  JE.text=(JE.text?JE.text.replace(/\s*$/,'')+'\n\n':'')+head+txt+'\n────\n\n';
  renderJEditor();
  const t=$('jText');t.focus();t.setSelectionRange(t.value.length,t.value.length);saveJ()}
